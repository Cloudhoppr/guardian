# Guardian

Voice-first grocery and pharmacy for elderly parents, approved by family, with a scam shield that runs before anything else.

- **User**: the elderly parent — calls or texts, no app.
- **Customer**: the adult child — sets rules, approves by text.
- **Agent provider**: CREAO builds the agents; this repo exposes the tool API they call.

## Stack
- Next.js 15 App Router (one app = backend + dashboard)
- Postgres (Neon) + Drizzle ORM
- Photon for SMS/iMessage, ElevenLabs for voice (SIP via Photon)
- CREAO for the agents (router, shopping, pharmacy, scam, approval)
- Visa agent card (sandbox or labeled mock)
- Sentry for tracing + replay + agent monitoring
- Vercel deploy, GoDaddy domain

## Layout
```
app/
├── (dashboard)/            family view + senior view + approvals
└── api/
    ├── creao/tools/*       the 10 tools CREAO calls (defined in tools.schema.json)
    ├── photon/webhook      inbound SMS/iMessage → CREAO
    └── cron/scheduler      hit every 5 min by GitHub Actions (.github/workflows/cron-scheduler.yml)
lib/
├── db/                     Drizzle schemas, one file per table
├── services/               rules, risk, scam-shield, pharmacy, payments, scheduler
├── providers/              photon, creao, visa (mock + sandbox)
└── creao-auth.ts           HMAC verification middleware
scripts/seed.ts             1 grandma + 1 approver + 30 groceries + 15 OTC + 3 Rx
tools.schema.json           hand this to the CREAO table
```

## First-run

```bash
pnpm install
cp .env.example .env.local       # fill in DATABASE_URL at minimum
pnpm db:push
pnpm seed
pnpm dev
```

Visit `http://localhost:3000/dashboard`.

## Sanity check (prove `/check` works end-to-end)

```bash
curl -X POST http://localhost:3000/api/creao/tools/check_scam \
  -H "content-type: application/json" \
  -d '{"memberId":"REPLACE","message":"A man from the IRS says I need $500 in gift cards","channel":"sms"}'
```

In dev with no `CREAO_WEBHOOK_SECRET`, the signature check is skipped so you can poke endpoints from curl.

## Decision pipeline

Every cart goes through:

1. **Scam shield** (`lib/services/scam-shield.ts`) — deterministic patterns (gift cards, IRS, Medicare, grandchild, urgency, secrecy, fake pharmacy domains).
2. **Risk score** (`lib/services/risk.ts`) — 0-100 with stored reasons.
3. **Rules** (`lib/services/rules.ts`) — freeze > scam > high-risk > over-cap > usual-items-auto-approve.
4. **Approval** — Photon texts the primary approver; `record_approval_answer` triggers payment.

The LLM (CREAO) is the subordinate layer. If their call fails, the deterministic rules still catch gift-card scams and still refuse to pay without an approval.
