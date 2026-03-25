import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const run = await db.getRun(params.id);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    // Strip image paths from response to reduce payload
    const { image_paths, ...rest } = run;
    return NextResponse.json(rest);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch run' },
      { status: 500 }
    );
  }
}
