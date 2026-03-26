# Chronos — Personal Life OS

A unified dashboard for academics, finances, and productivity. One tab, everything you need.

## What's Inside

```
Chronos/
├── apps/
│   ├── finance-coach/      ← Telegram bot (LIVE ✅)
│   │   ├── Groq AI (Llama 3.3 70B, $0)
│   │   ├── Natural language expense/income logging
│   │   ├── Budget tracking & insights
│   │   └── 3 accounts: Personal / Business / Family Allowance
│   └── dashboard/          ← Next.js web dashboard (Phase 2)
└── data/
    └── dashboard.db        ← Dashboard preferences & cache
```

## Current Status

| Component | Phase | Status |
|-----------|-------|--------|
| Finance Telegram Bot | Phase 1 | ✅ Live — message @Plutus124bot |
| Architecture Plan | Phase 1 | ✅ Done — see `SPEC.md` |
| Dashboard Scaffold | Phase 1 | ✅ Done — Next.js + shadcn/ui + NextAuth |
| Dashboard Shell + Finance | Phase 2 | 🔜 Next |
| LMS Integration | Phase 3 | 🔜 After shell |
| Tasks + Calendar + UI | Phase 4 | 🔜 After LMS |
| Polish + AI Coach | Phase 5 | 🔜 After calendar |
| Mobile / PWA | Phase 6 | 🔜 Future |

## Quick Start (Finance Bot — Running Now)

Message **@Plutus124bot** on Telegram:

```
spent $45 on groceries
coffee $3.50
got paid $500 freelance
how much did I spend this month?
/insights
/balance
```

## Dashboard (Phase 2+)

See [SPEC.md](./SPEC.md) for full architecture. Dashboard will include:

- 📚 **LMS Widget** — Assignments, deadlines, grades (Moodle → Playwright)
- 💰 **Finance Widget** — Balances, budgets, Groq insights (from Telegram bot data)
- 📋 **Tasks Widget** — Google Tasks with due dates + Calendar reminders
- 📅 **Calendar Widget** — Events with native popup/email reminders
- 📊 **Overview** — Week summary, next deadlines, Groq AI coach

## Requirements

| Requirement | Status |
|-------------|--------|
| Node.js 18+ | ✅ Available |
| Groq API Key | ✅ Configured |
| Telegram Bot Token | ✅ Configured |
| Google Cloud Project | 🔜 Phase 4 (Tasks + Calendar) |
| UP Tacloban LMS credentials | 🔜 Phase 3 |
| Playwright | 🔜 Phase 3 |

## Development

```bash
# Finance bot (already running)
cd apps/finance-coach && npm start

# Dashboard (Phase 2)
cd apps/dashboard && npm run dev
```
