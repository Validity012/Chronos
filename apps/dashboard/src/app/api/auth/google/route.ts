import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from '@/lib/dashboard-db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'callback') {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
      return NextResponse.redirect(new URL('/?error=google_auth_failed', request.url));
    }

    try {
      const oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
      );

      const { tokens } = await oauth2Client.getToken(code);

      const expirySeconds = tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600;

      const db = getDb();
      db.prepare(`
        INSERT OR REPLACE INTO lms_session (id, cookies, token, last_used, expires_at)
        VALUES ('google-tasks', ?, ?, datetime('now'), datetime('now', '+' || ? || ' seconds'))
      `).run('google-tasks', JSON.stringify(tokens), tokens.access_token || '', expirySeconds);

      return NextResponse.redirect(new URL('/?success=google_connected', request.url));
    } catch (err) {
      console.error('Google OAuth error:', err);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }
  }

  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/tasks.readonly',
    ],
    prompt: 'consent',
  });

  return NextResponse.redirect(authUrl);
}
