# MaiTalent.fun & Troll City — Supabase Edge Function Secrets

> This file documents every secret required by each Supabase project.
> Replace every `REPLACE_*` value with a real secret before deployment.
> Do NOT commit real secrets to git.

---

## Project: MaiTalent.fun
**Supabase URL:** `https://adjifwfblbdkypmeqiay.supabase.co`

### Where to set
```bash
supabase secrets set \
  --project-id adjifwfblbdkypmeqiay \
  SUPABASE_URL="REPLACE_WITH_MAITALENT_URL" \
  SUPABASE_SERVICE_ROLE_KEY="REPLACE_WITH_MAITALENT_SERVICE_ROLE_KEY" \
  TROLL_CITY_PROMO_VERIFY_URL="REPLACE_WITH_TROLL_CITY_VERIFY_URL" \
  TROLL_CITY_PROMO_REDEEM_URL="REPLACE_WITH_TROLL_CITY_REDEEM_URL" \
  TROLL_CITY_PROMO_SECRET="REPLACE_WITH_TROLL_CITY_SHARED_SECRET"
```

### Secrets required

| Secret | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | `redeem-maitalent-promo/index.ts:23` | Admin Supabase client URL (MaiTalent project) |
| `SUPABASE_SERVICE_ROLE_KEY` | `redeem-maitalent-promo/index.ts:24` | Admin DB access (bypasses RLS for wallet credit) |
| `TROLL_CITY_PROMO_VERIFY_URL` | `redeem-maitalent-promo/index.ts:63` | Troll City promo verification endpoint |
| `TROLL_CITY_PROMO_REDEEM_URL` | `redeem-maitalent-promo/index.ts:63` | Troll City promo redemption endpoint |
| `TROLL_CITY_PROMO_SECRET` | `redeem-maitalent-promo/index.ts:64` | Bearer token / API key for Troll City calls |

### Edge Functions that consume these

**`redeem-maitalent-promo`** (MaiTalent project — this is where redemption happens)
- Reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to create admin Supabase client
- Reads `TROLL_CITY_PROMO_VERIFY_URL` or `TROLL_CITY_PROMO_REDEEM_URL` to call Troll City for validation
- Reads `TROLL_CITY_PROMO_SECRET` (or fallbacks `TROLLCITY_PROMO_API_KEY` / `TROLLCITY_SERVICE_TOKEN`) as Bearer token

**`coin-capture`**
- Reads `SUPABASE_SERVICE_ROLE_KEY` (`coin-capture/index.ts:29`)

**`coin-purchase`**
- Reads `SUPABASE_SERVICE_ROLE_KEY` (`coin-purchase/index.ts:37`)

**`paypal-payout`**
- Reads `SUPABASE_SERVICE_ROLE_KEY` (`paypal-payout/index.ts:19`)

---

## Project: Troll City
**Supabase URL:** `https://yjxpwfalenorzrqxwmtr.supabase.co`

### Role
Troll City **issues** promo cards and **validates** them when MaiTalent calls its API.
MaiTalent **redeems** the codes locally and credits user wallets.

### Secrets required by Troll City (only if hosting a verify/redeem API there)

| Secret | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | If hosting an API on Troll City | Admin Supabase client URL |
| `SUPABASE_SERVICE_ROLE_KEY` | If hosting an API on Troll City | Admin DB access on Troll City project |
| `TROLL_CITY_PROMO_SECRET` | Shared between MaiTalent and Troll City | Auth for MaiTalent → Troll City API calls |

### Where to set (if Troll City hosts a verification API)
```bash
supabase secrets set \
  --project-id yjxpwfalenorzrqxwmtr \
  SUPABASE_URL="REPLACE_WITH_TROLL_CITY_URL" \
  SUPABASE_SERVICE_ROLE_KEY="REPLACE_WITH_TROLL_CITY_SERVICE_ROLE_KEY" \
  TROLL_CITY_PROMO_SECRET="REPLACE_WITH_SHARED_SECRET"
```

---

## Frontend .env (MaiTalent only — NO secrets)

These are **NOT secrets**. They are safe to commit or share.

```env
VITE_SUPABASE_URL=https://adjifwfblbdkypmeqiay.supabase.co
VITE_SUPABASE_ANON_KEY=REPLACE_WITH_MAITALENT_ANON_KEY
```

### MUST NOT appear in frontend .env
- `SUPABASE_SERVICE_ROLE_KEY` / `SB_SERVICE_ROLE_KEY`
- `TROLL_CITY_PROMO_SECRET`
- `TROLLCITY_PROMO_API_KEY`
- `TROLLCITY_SERVICE_TOKEN`
- PayPal client secret
- Any other server-side secret

---

## Architecture Summary

```
User (MaiTalent.fun)
    │
    ▼
walletStore.ts ──► fetch( VITE_SUPABASE_URL/functions/v1/redeem-maitalent-promo )
                        │
                        ▼
                Edge Function (MaiTalent Supabase)
                  1. Validates user JWT
                  2. Calls Troll City API (TROLL_CITY_PROMO_VERIFY_URL + TROLL_CITY_PROMO_SECRET)
                  3. Credits user_profiles.tokens
                  4. Inserts token_transactions record
                  5. Returns success to frontend
```

- **MaiTalent.fun** = frontend + Edge Functions + database (user_profiles, token_transactions)
- **Troll City** = promo issuer + verification API only

---

## Verification Checklist

- [ ] `redeem-maitalent-promo` Edge Function is deployed to **MaiTalent** Supabase project (`adjifwfblbdkypmeqiay`)
- [ ] MaiTalent Edge Function secrets are set via `supabase secrets set`
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in MaiTalent frontend `.env`
- [ ] `VITE_SUPABASE_SERVICE_ROLE` has been **removed** from `.env` and `.env.example`
- [ ] `TROLL_CITY_PROMO_*` secrets are set **only** as Edge Function secrets on MaiTalent, never in frontend `.env`
- [ ] Frontend `walletStore.ts` calls `${VITE_SUPABASE_URL}/functions/v1/redeem-maitalent-promo`
- [ ] Console logs show the real endpoint and HTTP status on every redemption attempt
