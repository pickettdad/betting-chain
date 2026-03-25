import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET() {
  try {
    const runs = await db.listRuns(50);
    const stats = await db.getStats();
    return NextResponse.json({ runs, stats });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch runs' },
      { status: 500 }
    );
  }
}
