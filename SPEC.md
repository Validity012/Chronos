# Chronos — Personal Life OS Dashboard

> **Phase 1: Architecture & Planning**

---

## What Is Chronos?

A unified personal dashboard for academics, finances, and productivity. One tab, everything you need.

```
┌─────────────────────────────────────────────────────────────┐
│  CHRONOS                    [Week of Mar 26]    [⚙️] [👤] │
├──────────────────┬──────────────────┬────────────────────┤
│  📚 ACADEMICS   │   💰 FINANCE    │   📅 TASKS        │
│                  │                   │                    │
│  3 assignments  │  -$81.49 spent   │  5 tasks due      │
│  due this week  │  Groq insights    │  Google Tasks      │
│  [View All →]   │  [View All →]    │  + Calendar        │
├──────────────────┴──────────────────┴────────────────────┤
│  📊 OVERVIEW                                              │
│  Week summary | Next deadlines | Groq AI coach             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Decisions

### 1. Monorepo Structure

```
~/Chronos/
├── apps/
│   ├── finance-coach/     ← Telegram bot (live)
│   │   ├── src/
│   │   │   ├── bot.js       # Telegram bot entry
│   │   │   ├── handlers.js  # All commands + AI routing
│   │   │   ├── groq.js     # Groq AI client
│   │   │   ├── models.js   # DB queries
│   │   │   └── db.js       # SQLite schema
│   │   └── data/
│   │       └── finance.db  ← shared SQLite (write: bot, read: dashboard)
│   └── dashboard/         ← Next.js web dashboard
│       ├── src/
│       │   ├── app/           # Next.js 15 app router
│       │   ├── components/    # shadcn/ui components
│       │   ├── lib/
│       │   │   ├── moodle.ts        # LMS scraper (Playwright)
│       │   │   ├── google-tasks.ts  # Tasks API client
│       │   │   ├── google-calendar.ts # Calendar API client
│       │   │   ├── finance.ts       # Read from finance.db
│       │   │   └── groq.ts         # AI insights (server-side)
│       │   └── types/
│       └── prisma/
│           └── schema.prisma # Dashboard preferences + cache
├── data/                  ← dashboard.db + shared data
└── SPEC.md
```

### 2. Data Layer

| Database | Location | Access | Purpose |
|----------|----------|--------|---------|
| `finance.db` (SQLite) | `apps/finance-coach/data/` | Write: bot / Read: dashboard | Transactions, budgets, accounts |
| `dashboard.db` (SQLite via Prisma) | `data/` | Dashboard only | Widget prefs, LMS cache, session |

### 3. LMS Integration — Playwright

**UP Tacloban College LMS** (`lms.uptacloban.edu.ph`) — Moodle 3.x with Boost theme.

| Approach | Verdict |
|----------|---------|
| Playwright | ✅ Robust — handles CSRF (`logintoken`), JS rendering |
| Moodle REST API | Available but Sept 2025 breach → admin needs enabling |
| HTTP + Cheerio | Fragile — Moodle UI changes break selectors |

**Login flow**:
1. GET `/login/index.php` → extract `logintoken` from form
2. POST `username` + `password` + `logintoken` → get `MoodleSession` cookie
3. Navigate authenticated pages → scrape → extract data

**Deep links**: Assignment cards link to `lms.uptacloban.edu.ph/mod/assign/view.php?id=XXX` (opens new tab).

### 4. Google Tasks + Calendar Integration

**Tasks API** — lightweight task lists, date-only due dates (no time precision).

**Calendar API** — full CRUD + native reminders (popup + email). Events sync across all devices.

**Key insight**: Tasks with due dates automatically appear in Google Calendar. Calendar provides the reminder system Tasks API lacks.

**Strategy**:
- Read tasks from Google Tasks API (polling every 5 min)
- Create events in Google Calendar with reminders (30min, 1hr, 1day before)
- User sets due date + time → dashboard creates Calendar event → notification fired

| API | Auth | Quota | Notes |
|-----|------|-------|-------|
| Tasks | OAuth2 | 50K queries/day | Polling, no webhooks |
| Calendar | OAuth2 | 1M queries/day | Full CRUD + reminders |

### 5. Groq AI — Server-Side Only

All AI calls through Next.js API routes. API key never touches the browser.

```
Browser → POST /api/insights → Groq Llama 3.3 70B (server-side) → response
```

### 6. Authentication

**Phase 2-3**: No auth — localhost-only, single user.
**Phase 4+**: NextAuth.js + Google OAuth (matches Google Tasks/Calendar auth).

### 7. Caching Strategy

| Data | Cache TTL | Storage |
|------|----------|---------|
| Assignments | 10 min | Dashboard DB |
| Grades | 30 min | Dashboard DB |
| Tasks | 5 min | Dashboard DB |
| Calendar events | 5 min | Dashboard DB |
| Courses | 2 hours | Dashboard DB |

---

## Technology Stack

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 16 + React 19 + TypeScript | ✅ Scaffolded |
| UI Components | shadcn/ui + Tailwind CSS v4 | 🔜 Phase 2 |
| LMS Scraping | Playwright (Chromium) | 🔜 Phase 3 |
| Google Tasks | `googleapis` npm + OAuth2 | 🔜 Phase 4 |
| Google Calendar | `googleapis` npm + OAuth2 | 🔜 Phase 4 |
| Finance Data | Direct SQLite read (read-only) | 🔜 Phase 2 |
| AI | `groq-sdk` (server-side) | ✅ Exists |
| Dashboard DB | Prisma + SQLite | 🔜 Phase 2 |
| Styling | Tailwind CSS + dark mode | 🔜 Phase 2 |
| Charts | Recharts | 🔜 Phase 2 |

---

## Module Inventory

### `apps/dashboard/src/lib/moodle.ts`
- Login with CSRF token extraction
- Scrape: dashboard, assignments, grades, courses
- Returns typed `Assignment[]`, `Grade[]`, `Course[]`
- Handles session cookies, error recovery, retries

### `apps/dashboard/src/lib/google-tasks.ts`
- OAuth2 flow (auth URL → callback → token storage)
- List/create/update/delete tasks
- Polling with cache detection
- Maps tasks to dashboard TaskItem format

### `apps/dashboard/src/lib/google-calendar.ts`
- OAuth2 flow (shared with Tasks — same auth client)
- List/create/update/delete events
- **Create events with reminders**: popup (30min, 1hr) + email (1 day)
- `createTaskReminder(task)` — convenience method wrapping Tasks + Calendar

### `apps/dashboard/src/lib/finance.ts`
- Read-only connection to `apps/finance-coach/data/finance.db`
- Aggregate queries (monthly summary, categories, budgets, recent transactions)
- Builds AI context object

### `apps/dashboard/src/lib/groq.ts`
- Server-side Groq API calls
- Finance coaching, spending analysis, LMS Q&A
- Rate limiting (1 req/min per user)

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/google` | GET | Start Google OAuth (Tasks + Calendar) |
| `/api/auth/google/callback` | GET | Handle OAuth callback → store tokens |
| `/api/lms/scrape` | POST | Trigger LMS scrape (cached) |
| `/api/lms/assignments` | GET | Get pending assignments |
| `/api/lms/grades` | GET | Get grades |
| `/api/finance/summary` | GET | Account balances, monthly summary |
| `/api/finance/insights` | POST | Groq AI coaching |
| `/api/tasks` | GET/POST | List / create Google Tasks |
| `/api/tasks/[id]` | PATCH/DELETE | Update / delete task |
| `/api/calendar/events` | GET/POST | List / create Calendar events |
| `/api/calendar/reminders` | POST | Create task-as-calendar-event with reminders |

---

## Build Phases

### Phase 1 — Architecture & Planning ✅
- [x] Requirements confirmed
- [x] Tech stack selected
- [x] Data architecture defined
- [x] Module inventory planned
- [x] API routes designed
- [x] Security audit (gitignore, credentials)
- [x] Google Calendar integration added
- [x] README updated
- [x] Credentials saved to `.env`

### Phase 2 — Dashboard Shell + Finance
- [ ] Install deps: `playwright`, `googleapis`, `prisma`, `shadcn/ui`
- [ ] Set up Prisma schema (preferences, cache tables)
- [ ] Dashboard layout: sidebar, header, widget grid
- [ ] Finance widget: read from `finance.db`, summary cards
- [ ] Budget status cards (progress bars)
- [ ] Recent transactions list
- [ ] Groq AI insights panel
- [ ] Dark/light mode toggle
- [ ] Settings page (credentials config)

### Phase 3 — LMS Integration
- [ ] Install Playwright + Chromium
- [ ] Moodle login with CSRF (`logintoken`)
- [ ] Assignments scraper (due date, course, status, link)
- [ ] Grades scraper (course, score, max, date)
- [ ] Courses scraper (name, materials link)
- [ ] Assignment cards with deep links to LMS
- [ ] Grade display with color coding
- [ ] LMS widget on dashboard
- [ ] Error handling + "refresh" button

### Phase 4 — Tasks + Calendar + UI/UX
- [ ] Google Cloud project — enable Tasks + Calendar APIs
- [ ] OAuth2 flow (auth URL → callback → token storage)
- [ ] Task list display with due dates
- [ ] Create task form (title, due date, notes)
- [ ] Task completion toggle (mark done → archive)
- [ ] Calendar event creation with reminders (30min, 1hr, 1day)
- [ ] `createTaskReminder()` convenience method
- [ ] Tasks + Calendar widgets on dashboard
- [ ] **UI/UX polish**: animations, transitions, empty states
- [ ] **shadcn/ui components**: cards, dialogs, forms, tables
- [ ] Responsive sidebar (collapsible)
- [ ] Loading skeletons

### Phase 5 — Overview + AI Coach
- [ ] Overview panel: week summary, next 3 deadlines
- [ ] Groq AI chat panel (inline, not modal)
- [ ] Quick actions: "log expense", "add task", "check grades"
- [ ] Performance: caching, lazy loading, optimistic updates
- [ ] Error boundaries + toast notifications

### Phase 6 — Mobile + PWA
- [ ] Responsive layout (breakpoints at sm/md)
- [ ] PWA manifest + service worker
- [ ] Offline-first (cache finance + tasks data)
- [ ] Push notifications (via service worker)
- [ ] Bottom nav bar on mobile

---

## Key Risks & Mitigations

| Risk | P | Impact | Mitigation |
|------|---|--------|------------|
| Moodle UI changes break scraper | High | Medium | Error boundaries, refresh fallback, cache last-known |
| LMS data breach (Sept 2025) | Medium | Medium | Monitor availability, cache data |
| Google Tasks time precision lost | Low | Low | Use Calendar for time-specific reminders |
| Groq rate limits | Very Low | Low | Personal use far within free tier |
| SQLite concurrent access | Low | High | Dashboard read-only, WAL mode |
| Google API key exposed | Low | Medium | HTTP referrer restriction + API restrictions |

---

## Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| Groq API | $0 | Llama 3.3 70B, free tier |
| Google Tasks API | $0 | 50K queries/day |
| Google Calendar API | $0 | 1M queries/day |
| Next.js hosting | $0 | Self-hosted localhost |
| Databases | $0 | SQLite + Prisma, local |

**Total: $0/month**

---

## Credentials & Secrets

### Already Configured ✅

| Service | Location |
|---------|----------|
| Telegram Bot Token | `apps/finance-coach/.env` |
| Groq API Key | `apps/finance-coach/.env` + `apps/dashboard/.env` |
| Google API Key | `apps/dashboard/.env` |
| LMS Username | `apps/dashboard/.env` |
| LMS Password | `apps/dashboard/.env` |

### Still Needed 🔜

| Service | Action Required |
|---------|----------------|
| Google OAuth2 Client ID | Create at console.cloud.google.com → Credentials → OAuth 2.0 Client IDs |
| Google OAuth2 Client Secret | Same as above |
| NextAuth Secret | Generate: `openssl rand -base64 32` |

### Security Notes (from audit)

- `.env` files are gitignored in all three `.gitignore` files ✅
- Root `.gitignore` now includes `*.db`, `*.sqlite`, `credentials.json`, `token.json` ✅
- Google API key: **must** set HTTP referrer restriction to `localhost:3000/*` in Google Cloud Console
- Google API key: **must** restrict to only Tasks + Calendar APIs in Google Cloud Console
- LMS credentials: stored in `.env`, never in source code ✅
- Git history: .env files never committed ✅; source files use `process.env` only ✅; credentials table in SPEC.md uses placeholders ✅

---

## Google Cloud Console Checklist

1. Go to https://console.cloud.google.com
2. Create project (or use existing)
3. Enable **Google Tasks API**
4. Enable **Google Calendar API**
5. Go to **Credentials** → find your API key
6. **Set application restrictions**: HTTP referrers → add `http://localhost:3000/*`
7. **Set API restrictions**: Google Tasks API ✅ + Google Calendar API ✅
8. Create **OAuth 2.0 Client ID** (Web application):
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
9. Copy Client ID + Client Secret → add to `apps/dashboard/.env`
