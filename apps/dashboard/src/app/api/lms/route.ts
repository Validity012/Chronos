import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    assignments: [],
    grades: [],
    courses: [],
    cachedAt: new Date().toISOString(),
  });
}
