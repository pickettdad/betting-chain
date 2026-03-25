import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('screenshots') as File[];

    if (!files.length) {
      return NextResponse.json(
        { error: 'No screenshots uploaded' },
        { status: 400 }
      );
    }

    // Generate run ID
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const dateLabel = format(new Date(), 'MMM d, yyyy');

    // Upload images to Supabase Storage
    const imagePaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = await file.arrayBuffer();
      const path = `${runId}/screenshot_${i}.png`;

      const { error } = await supabase.storage
        .from('screenshots')
        .upload(path, buffer, { contentType: 'image/png' });

      if (error) throw new Error(`Upload failed: ${error.message}`);
      imagePaths.push(path);
    }

    // Create run record in database
    const { error: insertError } = await supabase.from('runs').insert({
      id: runId,
      date_label: dateLabel,
      leagues: [],
      status: 'running',
      steps: [],
      image_paths: imagePaths,
    });

    if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

    // Trigger GitHub Actions workflow
    const ghResponse = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/actions/workflows/run-chain.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { run_id: runId },
        }),
      }
    );

    if (!ghResponse.ok) {
      const ghError = await ghResponse.text();
      console.error('GitHub Actions trigger failed:', ghError);
      // Don't throw — the run record exists, user can re-trigger manually
    }

    return NextResponse.json({ runId, status: 'running' });
  } catch (error: any) {
    console.error('Chain start error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}
