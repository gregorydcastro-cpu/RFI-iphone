#!/usr/bin/env bash
# Production go-live smoke for GC Field Log (docs/ops).
# Does not require Drive or Stripe keys in this shell.
#
#   bash scripts/smoke-go-live.sh
#   BASE_URL=https://www.gcfieldlog.com bash scripts/smoke-go-live.sh
#
# Exits non-zero only on unexpected hard failures (e.g. GET /pricing not 200).
# Live sheet-pdf may still return drive_auth_missing 503 until Drive keys are set.

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

# --- POST /api/stripe/checkout ---
# Unconfigured: 503 billing_unconfigured. Configured: 200 JSON or a redirect.
checkout_body="$tmpdir/checkout.body"
checkout_hdr="$tmpdir/checkout.hdr"
checkout_code=$(
  fetch "$checkout_body" "$checkout_hdr" -X POST "$BASE_URL/api/stripe/checkout"
) || true
checkout_err=$(json_field "$checkout_body" "error")
if [[ "$checkout_code" == "503" && "$checkout_err" == "billing_unconfigured" ]]; then
  ok "POST /api/stripe/checkout → 503 billing_unconfigured (keys unset)"
elif [[ "$checkout_code" =~ ^2 ]]; then
  ok "POST /api/stripe/checkout → $checkout_code (configured)"
elif [[ "$checkout_code" =~ ^3 ]]; then
  location=$(
    awk 'BEGIN { IGNORECASE=1 } /^location:/ { sub(/\r$/, ""); print; exit }' \
      "$checkout_hdr"
  )
  ok "POST /api/stripe/checkout → $checkout_code redirect ${location:-}"
else
  fail "POST /api/stripe/checkout → $checkout_code error=${checkout_err:-n/a} (expected 503 billing_unconfigured or 200/redirect)"
fi

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

# --- GET /api/time?job=maple-point (must be 200) ---
time_body="$tmpdir/time.body"
time_hdr="$tmpdir/time.hdr"
time_code=$(
  fetch "$time_body" "$time_hdr" -L "$BASE_URL/api/time?job=maple-point"
) || true
if [[ "$time_code" == "200" ]]; then
  ok "GET /api/time?job=maple-point → $time_code"
else
  fail "GET /api/time?job=maple-point → $time_code (expected 200)"
fi

log ""
if [[ "$failed" -ne 0 ]]; then
  log "smoke-go-live: FAILED"
  exit 1
fi
log "smoke-go-live: PASSED"
exit 0
