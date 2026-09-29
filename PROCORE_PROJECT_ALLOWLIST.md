# PROCORE_PROJECT_ALLOWLIST (Greg)

Operator checklist for the optional Production restriction on which **exact Procore project names** may resolve via REST. Follow-up to [#45](https://github.com/gregorydcastro-cpu/RFI-iphone/pull/45). This value is a list of names, not a secret — still do not commit real job names.

Leave the variable **unset** unless you want that restriction.

## Rules

| | |
| --- | --- |
| Env name | `PROCORE_PROJECT_ALLOWLIST` |
| Where | Vercel **server** env (Production; Preview only if you test live pulls there) |
| Never | `NEXT_PUBLIC_PROCORE_PROJECT_ALLOWLIST` or any `NEXT_PUBLIC_` prefix. The server reads `PROCORE_PROJECT_ALLOWLIST` only (lowercase alias `procore_project_allowlist` is also accepted). A public key is not read and must not be set. |
| Format | **Exact** Procore project names, separated by comma, newline, or pipe. A semicolon is split the same way. |
| Unset or empty | Any **exact** name the connected puller's token can see may resolve (fictional Maple Point demos and other projects that token can list). |
| Company ids | **Never** put a company id in this list. Company id is resolved from the API after the name matches. |
| Wake | Fictional `DEMO_JOBS` / Maple Point **never** enqueue or HTTP-wake, whether this list is unset, empty, or includes those names. |

## Production checklist

1. In Procore, copy each project **name** exactly — the `name` on `GET /rest/v1.0/projects`, the string a connected puller's token can see. Not the company name, not a numeric company id, not a shortened label.
2. Vercel → project **gc-field-log** → Settings → Environment Variables.
3. Add **`PROCORE_PROJECT_ALLOWLIST`** on **Production**. Server-only. Do not create `NEXT_PUBLIC_PROCORE_PROJECT_ALLOWLIST`.
4. Paste names with one of the formats below. Use one key. If both `PROCORE_PROJECT_ALLOWLIST` and `procore_project_allowlist` are set, the uppercase key wins.
5. Redeploy Production so the server runtime sees the variable. It is read per request (`readEnv`); it is not inlined into the client bundle.
6. With a connected puller, confirm a listed name resolves and a name you left off does not resolve via REST.
7. To allow every exact name that token can see, delete the variable (or leave it empty / whitespace) and redeploy.

## Formats

Comma:

```
Maple Point Medical Office, Cedar Ridge Outpatient
```

Newline (one exact name per line):

```
Maple Point Medical Office
Cedar Ridge Outpatient
```

Pipe:

```
Maple Point Medical Office | Cedar Ridge Outpatient
```

These examples are fictional catalog names only. Replace them with the exact Production project names you intend to allow before saving the env. Do not commit those Production names into git.

## What "exact" means

- The server trims each piece, then compares the **full** name, case-insensitive. `maple point medical office` matches `Maple Point Medical Office`.
- A shorter label does not match. `Maple Point` is not `Maple Point Medical Office`. `Cedar Ridge` is not `Cedar Ridge Outpatient`.
- Blank pieces are dropped. The same name twice (any casing) is kept once; the first spelling is kept.
- Unset, empty, or whitespace-only is the same: no name restriction. REST still requires an exact match against a project that token can see.

Parsed by `parseProcoreProjectAllowlist` / `parseProjectAllowlist` in `lib/procoreAllowlist.ts`. `readProjectAllowlist` is what REST calls.

## What this list does not do

- It does not set `Procore-Company-Id`. `resolveCompanyIdForProject` / `resolveProjectForName` still walk `GET /rest/v1.0/companies` and `GET /rest/v1.0/projects?company_id=` and use the company id from that match. A number in this list is just another name string and will not match a project.
- It does not wake the Procore bot. Wake is `public.procore_bot_requests` and optional `PROCORE_BOT_WAKE_URL`.
- **`DEMO_JOBS` / Maple Point never wake**, including when the allowlist is unset and when those names are written on the list:
  - Maple Point Medical Office (alias `Maple Point`, slug `maple-point`)
  - Cedar Ridge Outpatient
  - Harbor View Tenant Fit-Out
  - Pine Hollow Warehouse
  Cached pack reads and REST for those demos stay as they are. The skip is `isDemoOrFictionalJob`, not this env.
- A **non-demo** name that is missing from a **set** list fails REST (`project_not_found` before the companies call) and can still fall through to the existing bot wake for that non-demo job. This list restricts REST names. It is not a wake denylist.
