#!/usr/bin/env bash
# Production go-live smoke for GC Field Log (docs/ops).
# Does not require Drive or Stripe keys in this shell.
#
#   bash scripts/smoke-go-live.sh
#   BASE_URL=https://www.gcfieldlog.com bash scripts/smoke-go-live.sh
#
# Exits non-zero on unexpected hard failures (pricing not 200, Stripe status
# not boolean readiness, checkout not 503 while unset, webhook POST not
# 503-or-400, webhook GET not 405).
# Live sheet-pdf may still return drive_auth_missing 503 until Drive keys are set.
# This script never signs a Stripe event, never creates a Checkout Session
# once checkoutConfigured is true, and never prints secret values.
#
# Vercel Production names (no values): STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
# STRIPE_WEBHOOK_SECRET.

set -u

BASE_URL="${BASE_URL:-https://www.gcfieldlog.com}"
BASE_URL="${BASE_URL%/}"

failed=0
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

log() { printf '%s\n' "$*"; }
ok() { log "OK: $*"; }
fail() { log "FAIL: $*"; failed=1; }
note() { log "NOTE: $*"; }

# Fail if a response body contains a live secret. Env names are fine.
assert_no_secret() {
  local file="$1"
  local label="$2"
  if grep -qE 'sk_(live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|rk_(live|test)_[A-Za-z0-9]|pk_(live|test)_[A-Za-z0-9]|price_[A-Za-z0-9]{6,}|service_role' "$file"; then
    fail "$label body looks like it leaked a secret"
  fi
}

json_field() {
  local file="$1"
  local field="$2"
  python3 - "$file" "$field" <<'PY' 2>/dev/null || true
import json, sys
path, field = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    sys.exit(0)
val = data.get(field, "")
if val is None:
    val = ""
if isinstance(val, bool):
    print("true" if val else "false")
elif isinstance(val, list):
    print(",".join(str(item) for item in val))
else:
    print(val)
PY
}

content_type_of() {
  local hdr="$1"
  awk 'BEGIN { IGNORECASE=1 } /^content-type:/ { sub(/\r$/, ""); print; exit }' "$hdr"
}

fetch() {
  local outfile="$1"
  local hdrfile="$2"
  shift 2
  local errfile="$tmpdir/curl.err"
  local code
  if ! code=$(
    curl -sS --max-time 45 -D "$hdrfile" -o "$outfile" -w "%{http_code}" "$@" \
      2>"$errfile"
  ); then
    printf '000'
    return 1
  fi
  printf '%s' "$code"
}

log "BASE_URL=$BASE_URL"
log ""

# --- GET /pricing (must be 200) ---
pricing_body="$tmpdir/pricing.body"
pricing_hdr="$tmpdir/pricing.hdr"
pricing_code=$(fetch "$pricing_body" "$pricing_hdr" -L "$BASE_URL/pricing") || true
if [[ "$pricing_code" == "200" ]]; then
  ok "GET /pricing → $pricing_code"
else
  fail "GET /pricing → $pricing_code (expected 200)"
fi
assert_no_secret "$pricing_body" "GET /pricing"

# --- GET /api/stripe/status (booleans + unset env names; never values) ---
status_body="$tmpdir/stripe.status"
status_hdr="$tmpdir/stripe.status.hdr"
status_code=$(fetch "$status_body" "$status_hdr" "$BASE_URL/api/stripe/status") || true
assert_no_secret "$status_body" "GET /api/stripe/status"
status_flags="$tmpdir/stripe.status.flags"
python3 - "$status_body" "$status_code" "$status_flags" <<'PY'
import json, sys
path, code, dest = sys.argv[1], sys.argv[2], sys.argv[3]
allowed = ("STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET")
problems = []
data = None
try:
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    data = None
if code != "200" or not isinstance(data, dict):
    problems.append(f"status HTTP {code} is not JSON readiness")
else:
    for key in ("checkoutConfigured", "webhookConfigured"):
        if not isinstance(data.get(key), bool):
            problems.append(f"{key} is not a boolean")
    present = data.get("present")
    if not isinstance(present, dict):
        problems.append("present is not an object")
        present = {}
    for name in allowed:
        if not isinstance(present.get(name), bool):
            problems.append(f"present.{name} is not a boolean")
    missing = data.get("missing")
    if not isinstance(missing, list) or any(not isinstance(item, str) for item in missing):
        problems.append("missing is not a list of names")
        missing = []
    elif any(item not in allowed for item in missing):
        problems.append("missing contains a non-env name")
    if isinstance(data.get("checkoutConfigured"), bool) and isinstance(present, dict):
        expect_checkout = bool(present.get("STRIPE_SECRET_KEY") and present.get("STRIPE_PRICE_ID"))
        expect_webhook = bool(present.get("STRIPE_SECRET_KEY") and present.get("STRIPE_WEBHOOK_SECRET"))
        if data.get("checkoutConfigured") is not expect_checkout:
            problems.append("checkoutConfigured does not match present")
        if data.get("webhookConfigured") is not expect_webhook:
            problems.append("webhookConfigured does not match present")
        for name in allowed:
            is_set = present.get(name) is True
            if is_set and name in missing:
                problems.append(f"{name} is present and missing")
            if not is_set and name not in missing:
                problems.append(f"{name} is unset but not listed in missing")
    blob = json.dumps(data)
    for needle in ("sk_live_", "sk_test_", "whsec_", "pk_live_", "pk_test_", "rk_live_", "rk_test_"):
        if needle in blob:
            problems.append(f"body contains {needle}")
def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"
checkout = bool(isinstance(data, dict) and data.get("checkoutConfigured") is True)
webhook = bool(isinstance(data, dict) and data.get("webhookConfigured") is True)
missing = []
if isinstance(data, dict) and isinstance(data.get("missing"), list):
    missing = [item for item in data["missing"] if isinstance(item, str)]
with open(dest, "w", encoding="utf-8") as handle:
    handle.write("checkout_configured=" + shell_quote("true" if checkout else "false") + "\n")
    handle.write("webhook_configured=" + shell_quote("true" if webhook else "false") + "\n")
    handle.write("status_missing=" + shell_quote(",".join(missing)) + "\n")
    handle.write("status_problems=" + shell_quote("; ".join(problems)) + "\n")
PY
checkout_configured=false
webhook_configured=false
status_missing=""
status_problems="status check did not run"
if [[ -f "$status_flags" ]]; then
  # shellcheck disable=SC1090
  source "$status_flags"
fi
if [[ -n "${status_problems}" ]]; then
  fail "GET /api/stripe/status → ${status_problems}"
else
  ok "GET /api/stripe/status → 200 checkoutConfigured=${checkout_configured} webhookConfigured=${webhook_configured} missing=${status_missing:-none}"
fi
if [[ "$pricing_code" == "200" ]]; then
  if ! grep -q "data-billing-checkout=\"${checkout_configured}\"" "$pricing_body"; then
    fail "GET /pricing data-billing-checkout does not match status checkoutConfigured=${checkout_configured}"
  elif ! grep -q "data-billing-webhook=\"${webhook_configured}\"" "$pricing_body"; then
    fail "GET /pricing data-billing-webhook does not match status webhookConfigured=${webhook_configured}"
  else
    ok "GET /pricing billing flags match status (checkout=${checkout_configured} webhook=${webhook_configured})"
  fi
fi

# --- POST /api/stripe/checkout ---
# Unconfigured: 503 billing_unconfigured (no Stripe API call).
# Configured: do not POST. A session create is a live Stripe call, not a readiness check.
checkout_body="$tmpdir/checkout.body"
checkout_hdr="$tmpdir/checkout.hdr"
if [[ "$checkout_configured" == "true" ]]; then
  ok "POST /api/stripe/checkout skipped (checkoutConfigured=true — no Checkout Session created)"
else
  checkout_code=$(
    fetch "$checkout_body" "$checkout_hdr" -X POST "$BASE_URL/api/stripe/checkout"
  ) || true
  checkout_err=$(json_field "$checkout_body" "error")
  checkout_missing=$(json_field "$checkout_body" "missing")
  checkout_flag=$(json_field "$checkout_body" "checkoutConfigured")
  assert_no_secret "$checkout_body" "POST /api/stripe/checkout"
  if [[ "$checkout_code" == "503" && "$checkout_err" == "billing_unconfigured" && "$checkout_flag" == "false" ]]; then
    ok "POST /api/stripe/checkout → 503 billing_unconfigured checkoutConfigured=false missing=${checkout_missing:-} (Production env unset)"
  else
    fail "POST /api/stripe/checkout → ${checkout_code:-} error=${checkout_err:-n/a} checkoutConfigured=${checkout_flag:-n/a} (expected 503 billing_unconfigured checkoutConfigured=false)"
  fi
fi

# --- POST /api/stripe/webhook (no signature; does not call Stripe) ---
# 503 billing_unconfigured: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset.
# 400 missing_signature: both set. This script never signs.
webhook_body="$tmpdir/webhook.body"
webhook_hdr="$tmpdir/webhook.hdr"
webhook_code=$(
  fetch "$webhook_body" "$webhook_hdr" -X POST "$BASE_URL/api/stripe/webhook"
) || true
webhook_err=$(json_field "$webhook_body" "error")
webhook_missing=$(json_field "$webhook_body" "missing")
webhook_flag=$(json_field "$webhook_body" "webhookConfigured")
assert_no_secret "$webhook_body" "POST /api/stripe/webhook"
if [[ "$webhook_configured" == "false" && "$webhook_code" == "503" && "$webhook_err" == "billing_unconfigured" && "$webhook_flag" == "false" ]]; then
  ok "POST /api/stripe/webhook → 503 billing_unconfigured webhookConfigured=false missing=${webhook_missing:-} (STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset)"
elif [[ "$webhook_configured" == "true" && "$webhook_code" == "400" && "$webhook_err" == "missing_signature" ]]; then
  ok "POST /api/stripe/webhook → 400 missing_signature (webhook keys present; unsigned on purpose)"
else
  fail "POST /api/stripe/webhook → $webhook_code error=${webhook_err:-n/a} webhookConfigured=${webhook_flag:-n/a} (status webhookConfigured=${webhook_configured}; expected 503 billing_unconfigured or 400 missing_signature)"
fi

# --- GET /api/stripe/webhook (wrong method; does not read Stripe keys) ---
webhook_get_body="$tmpdir/webhook.get.body"
webhook_get_hdr="$tmpdir/webhook.get.hdr"
webhook_get_code=$(
  fetch "$webhook_get_body" "$webhook_get_hdr" -X GET "$BASE_URL/api/stripe/webhook"
) || true
webhook_get_err=$(json_field "$webhook_get_body" "error")
assert_no_secret "$webhook_get_body" "GET /api/stripe/webhook"
if [[ "$webhook_get_code" == "405" && "$webhook_get_err" == "method_not_allowed" ]]; then
  ok "GET /api/stripe/webhook → 405 method_not_allowed"
else
  fail "GET /api/stripe/webhook → $webhook_get_code error=${webhook_get_err:-n/a} (expected 405 method_not_allowed)"
fi

log ""
log "Stripe readiness (names only: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET):"
log "  GET /api/stripe/status → booleans checkoutConfigured / webhookConfigured / present. No key values."
log "  POST /api/stripe/checkout runs only when checkoutConfigured is false, and must be 503 billing_unconfigured."
log "  When checkoutConfigured is true this script does not create a Checkout Session."
log "Stripe webhook verify (this script never signs and never sends Stripe-Signature):"
log "  POST 503 billing_unconfigured → STRIPE_SECRET_KEY and/or STRIPE_WEBHOOK_SECRET still unset on this host."
log "  POST 400 missing_signature → both webhook env names are set. Unsigned on purpose."
log "  GET 405 method_not_allowed → route is up; only POST is accepted."
log "  Dashboard events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.paid"
log "  Production endpoint: https://www.gcfieldlog.com/api/stripe/webhook (www, not apex)."
log "  Signed delivery is an operator check in the Stripe Dashboard (Send test event)."

# --- GET /api/sheet-pdf (print status + JSON code; 503 is still expected) ---
pdf_body="$tmpdir/sheet.pdf"
pdf_hdr="$tmpdir/sheet.hdr"
pdf_url="$BASE_URL/api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N"
pdf_code=$(fetch "$pdf_body" "$pdf_hdr" "$pdf_url") || true
pdf_type=$(content_type_of "$pdf_hdr")
pdf_json_code=$(json_field "$pdf_body" "code")
if [[ -n "$pdf_json_code" ]]; then
  note "GET /api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N → $pdf_code code=$pdf_json_code ${pdf_type:-}"
else
  note "GET /api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N → $pdf_code ${pdf_type:-}"
fi
if [[ "$pdf_code" == "000" ]]; then
  fail "GET /api/sheet-pdf transport failed"
elif [[ "$pdf_code" == "200" ]]; then
  ok "sheet-pdf streamed (Drive configured)"
elif [[ "$pdf_code" == "503" && "$pdf_json_code" == "drive_auth_missing" ]]; then
  ok "sheet-pdf drive_auth_missing (keys unset — expected until Drive go-live)"
else
  note "sheet-pdf not a hard failure (configure Drive for 200 application/pdf)"
fi

# --- Grok Voice (status + unconfigured/configured degrade) ---
# Never treat a missing key as a hard fail. Fail if status is not JSON/200
# or if the body looks like it leaked a key.
voice_status_body="$tmpdir/voice.status"
voice_status_hdr="$tmpdir/voice.status.hdr"
voice_status_code=$(fetch "$voice_status_body" "$voice_status_hdr" "$BASE_URL/api/voice/status") || true
voice_configured=$(json_field "$voice_status_body" "configured")
if [[ "$voice_status_code" != "200" ]]; then
  fail "GET /api/voice/status → $voice_status_code (expected 200 JSON)"
elif grep -qiE 'xai-[A-Za-z0-9]{8,}|Bearer |sk-[A-Za-z0-9]{8,}' "$voice_status_body"; then
  fail "GET /api/voice/status body looks like it leaked a secret"
elif grep -qiE '"key"[[:space:]]*:' "$voice_status_body"; then
  fail "GET /api/voice/status must not include a key field"
else
  ok "GET /api/voice/status → 200 configured=${voice_configured:-false}"
fi

tts_body="$tmpdir/voice.tts"
tts_hdr="$tmpdir/voice.tts.hdr"
tts_code=$(
  fetch "$tts_body" "$tts_hdr" -X POST "$BASE_URL/api/tts" \
    -H "Content-Type: application/json" \
    -d '{"text":"Read-aloud smoke."}'
) || true
tts_err=$(json_field "$tts_body" "code")
if [[ "$tts_code" == "503" && "$tts_err" == "unconfigured" ]]; then
  ok "POST /api/tts → 503 unconfigured (key unset)"
elif [[ "$tts_code" == "200" ]]; then
  ok "POST /api/tts → 200 (key configured)"
else
  note "POST /api/tts → $tts_code code=${tts_err:-n/a} (not a hard fail)"
fi

dict_body="$tmpdir/voice.dict"
dict_hdr="$tmpdir/voice.dict.hdr"
dict_code=$(fetch "$dict_body" "$dict_hdr" -X POST "$BASE_URL/api/dictation") || true
dict_err=$(json_field "$dict_body" "code")
if [[ "$dict_code" == "503" && "$dict_err" == "unconfigured" ]]; then
  ok "POST /api/dictation → 503 unconfigured (key unset)"
elif [[ "$dict_code" == "400" && "$dict_err" == "bad_input" ]]; then
  ok "POST /api/dictation → 400 bad_input (key configured, no file)"
else
  note "POST /api/dictation → $dict_code code=${dict_err:-n/a} (not a hard fail)"
fi

# --- GET /api/time without a session must not return the crew roster ---
time_body="$tmpdir/time.body"
time_hdr="$tmpdir/time.hdr"
time_code=$(
  fetch "$time_body" "$time_hdr" -L "$BASE_URL/api/time?job=maple-point"
) || true
if [[ "$time_code" == "401" ]] && ! grep -q 'pin_stub' "$time_body"; then
  ok "GET /api/time?job=maple-point → 401 without a roster"
else
  fail "GET /api/time?job=maple-point → $time_code (expected 401, no roster)"
fi

log ""
if [[ "$failed" -ne 0 ]]; then
  log "smoke-go-live: FAILED"
  exit 1
fi
log "smoke-go-live: PASSED"
exit 0
