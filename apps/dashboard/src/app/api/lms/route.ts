import { NextResponse } from 'next/server';
import { getLmsCache, setLmsCache } from '@/lib/dashboard-db';
import { getLMSData, type MoodleCredentials } from '@/lib/moodle';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cached = getLmsCache('lms');
    if (cached) {
      return NextResponse.json(JSON.parse(cached.data));
    }

    const credentials: MoodleCredentials = {
      username: process.env.MOODLE_USERNAME!,
      password: process.env.MOODLE_PASSWORD!,
    };

    if (!credentials.username || !credentials.password) {
      throw new Error('Moodle credentials are not set in environment variables.');
    }

    const data = await getLMSData(credentials);
    setLmsCache('lms', JSON.stringify(data), 15);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[LMS_API_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new NextResponse(`Error fetching LMS data: ${errorMessage}`, { status: 500 });
  }
}
