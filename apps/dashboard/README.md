# Chronos Dashboard

Next.js 15 dashboard for personal life management integrating LMS, finance tracking, tasks, and AI insights.

## Features

- **LMS Integration**: UP Tacloban College Moodle scraping for assignments and grades
- **Finance Tracking**: SQLite database integration with existing Telegram bot
- **Google Tasks**: Full CRUD operations with OAuth2 authentication
- **AI Insights**: Groq-powered coaching and recommendations
- **Authentication**: Secure password-based login with NextAuth.js

## Tech Stack

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- NextAuth.js for authentication
- Playwright for web scraping
- Better SQLite3 for database access
- Google APIs for tasks integration
- Groq SDK for AI insights

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

3. Generate admin password hash:
```bash
node -e "
const bcrypt = require('bcryptjs');
const password = 'your-password-here';
const hash = bcrypt.hashSync(password, 12);
console.log('ADMIN_PASSWORD_HASH=' + hash);
"
```

4. Set up Google Tasks API:
   - Go to Google Cloud Console
   - Enable Google Tasks API
   - Create OAuth2 credentials
   - Add redirect URI: http://localhost:3000/api/auth/google/callback

5. Get Groq API key:
   - Sign up at https://console.groq.com
   - Create an API key (free tier available)

6. Configure Moodle credentials for UP Tacloban College LMS

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXTAUTH_URL` | App URL for NextAuth | Yes |
| `NEXTAUTH_SECRET` | Secret for JWT signing | Yes |
| `ADMIN_USERNAME` | Dashboard admin username | Yes |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password | Yes |
| `GROQ_API_KEY` | Groq API key for AI insights | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `MOODLE_USERNAME` | UP Tacloban LMS username | Yes |
| `MOODLE_PASSWORD` | UP Tacloban LMS password | Yes |

## Security Notes

- Uses bcrypt for password hashing
- Environment variables for sensitive data
- NextAuth.js for session management
- Playwright runs in headless mode for scraping
- API routes protected by authentication middleware

## Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── auth/           # NextAuth configuration
│   │   └── groq/           # Groq AI endpoints
│   ├── auth/               # Authentication pages
│   └── page.tsx            # Main dashboard
├── components/             # React components
├── lib/                    # Utility libraries
│   ├── database.ts         # SQLite finance database
│   ├── google-tasks.ts     # Google Tasks API client
│   └── moodle.ts           # Moodle LMS scraper
└── middleware.ts           # Auth middleware
```
