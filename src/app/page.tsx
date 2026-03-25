'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Activity, TrendingUp, Clock, ChevronRight, Trophy, XCircle, MinusCircle } from 'lucide-react';
import { STEP_META, StepName } from '@/lib/ai/types';
import { clsx } from 'clsx';

interface RunSummary {
  id: string;
  created_at: string;
  date_label: string;
  leagues: string[];
  status: string;
  steps: any[];
  final_verdict?: string;
  final_ticket?: string;
  result?: string;
  profit?: number;
}

interface Stats {
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  plays: number;
  passes: number;
  totalProfit: number;
}

export default function Dashboard() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<any | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Fetch runs list
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/runs');
      const data = await res.json();
      setRuns(data.runs ?? []);
      setStats(data.stats ?? null);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Poll active run
  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${activeRunId}`);
        const data = await res.json();
        setActiveRun(data);
        if (data.status === 'complete' || data.status === 'error') {
          clearInterval(interval);
          fetchRuns();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeRunId, fetchRuns]);

  // Upload and start chain
  const handleSubmit = async () => {
    if (!files.length) return;
    setUploading(true);

    const formData = new FormData();
    files.forEach((f) => formData.append('screenshots', f));

    try {
      const res = await fetch('/api/chain', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.runId) {
        setActiveRunId(data.runId);
        setActiveRun({ status: 'running', steps: [] });
        setFiles([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (newFiles: FileList | File[]) => {
    setFiles(Array.from(newFiles).filter((f) => f.type.startsWith('image/')));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-10">
        <h1 className="font-display text-3xl font-800 tracking-tight">
          <span className="text-accent-green">●</span> Betting Chain
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Multi-model AI analysis pipeline — Upload → Analyze → Decide
        </p>
      </header>

      {/* Stats Bar */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
          <StatCard label="Total Runs" value={stats.total} />
          <StatCard label="Plays" value={stats.plays} color="green" />
          <StatCard label="Passes" value={stats.passes} color="amber" />
          <StatCard label="Wins" value={stats.wins} color="green" />
          <StatCard label="Losses" value={stats.losses} color="red" />
          <StatCard
            label="ROI"
            value={
              stats.wins + stats.losses > 0
                ? `${((stats.totalProfit / (stats.wins + stats.losses)) * 100).toFixed(1)}%`
                : '—'
            }
            color={stats.totalProfit >= 0 ? 'green' : 'red'}
          />
        </div>
      )}

      {/* Upload Zone */}
      <div className="mb-8">
        <div
          className={clsx(
            'drop-zone rounded-xl p-8 text-center cursor-pointer transition-all',
            dragOver && 'drag-over'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = 'image/*';
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              if (target.files) handleFiles(target.files);
            };
            input.click();
          }}
        >
          <Upload className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">
            Drop sportsbook screenshots here or click to browse
          </p>
          <p className="text-text-muted text-xs mt-1">PNG, JPG — supports multiple images</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex gap-2 flex-wrap flex-1">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="bg-bg-tertiary px-3 py-1.5 rounded-lg text-xs text-text-secondary flex items-center gap-2"
                >
                  📷 {f.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(files.filter((_, j) => j !== i));
                    }}
                    className="text-text-muted hover:text-accent-red"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={uploading}
              className={clsx(
                'px-6 py-2.5 rounded-lg font-semibold text-sm transition-all',
                uploading
                  ? 'bg-bg-elevated text-text-muted cursor-not-allowed'
                  : 'bg-accent-green text-bg-primary hover:brightness-110'
              )}
            >
              {uploading ? 'Starting...' : 'Run Analysis →'}
            </button>
          </div>
        )}
      </div>

      {/* Active Run Progress */}
      {activeRun && (
        <div className="mb-8 bg-bg-secondary rounded-xl border border-border-subtle overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-3">
            {activeRun.status === 'running' && (
              <div className="w-2.5 h-2.5 rounded-full bg-accent-green pulse-dot" />
            )}
            <span className="font-display font-semibold text-sm">
              {activeRun.status === 'running'
                ? 'Chain Running...'
                : activeRun.status === 'error'
                  ? 'Chain Error'
                  : 'Chain Complete'}
            </span>
            {activeRun.final_verdict && (
              <span
                className={clsx(
                  'ml-auto px-3 py-1 rounded-full text-xs font-bold',
                  activeRun.final_verdict === 'PLAY'
                    ? 'bg-accent-green/15 text-accent-green'
                    : 'bg-accent-red/15 text-accent-red'
                )}
              >
                {activeRun.final_verdict}
              </span>
            )}
          </div>

          {/* Step progress indicators */}
          <div className="grid grid-cols-6 gap-0">
            {(
              ['extract', 'filter', 'veto', 'optimize', 'adversarial', 'final'] as StepName[]
            ).map((stepName, idx) => {
              const meta = STEP_META[stepName];
              const stepData = activeRun.steps?.find((s: any) => s.step === stepName);
              const isRunning =
                !stepData &&
                activeRun.status === 'running' &&
                (activeRun.steps?.length ?? 0) === idx;
              const isComplete = stepData?.status === 'complete';
              const isError = stepData?.status === 'error';

              return (
                <div
                  key={stepName}
                  className={clsx(
                    'p-4 border-r border-border-subtle last:border-r-0 transition-all',
                    isRunning && 'bg-bg-tertiary',
                    isComplete && 'bg-bg-secondary'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{meta.icon}</span>
                    {isRunning && (
                      <div
                        className="w-2 h-2 rounded-full pulse-dot"
                        style={{ background: meta.color }}
                      />
                    )}
                    {isComplete && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: meta.color }}
                      />
                    )}
                    {isError && <div className="w-2 h-2 rounded-full bg-accent-red" />}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                    {meta.label}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {isComplete
                      ? `${((stepData?.durationMs ?? 0) / 1000).toFixed(1)}s`
                      : isRunning
                        ? 'running...'
                        : isError
                          ? 'error'
                          : '—'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Final ticket display */}
          {activeRun.final_ticket && (
            <div className="px-5 py-4 border-t border-border-subtle">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                Main Ticket
              </div>
              <div className="text-sm font-semibold">{activeRun.final_ticket}</div>
              {activeRun.final_explanation && (
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  {activeRun.final_explanation}
                </p>
              )}
              {activeRun.recheck_required && (
                <div className="mt-2 px-3 py-1.5 bg-accent-amber/10 text-accent-amber text-xs rounded-lg inline-block font-semibold">
                  ⚠ Recheck required before placing bet
                </div>
              )}
              <a
                href={`/run/${activeRunId}`}
                className="mt-3 inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
              >
                View full analysis <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Recent Runs */}
      <div>
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-muted" /> Recent Runs
        </h2>
        {runs.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-12">
            No runs yet. Upload screenshots to start your first analysis.
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <a
                key={run.id}
                href={`/run/${run.id}`}
                className="flex items-center gap-4 bg-bg-secondary rounded-xl px-5 py-4 border border-border-subtle hover:border-border-active transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{run.date_label}</span>
                    <span className="text-xs text-text-muted">
                      {run.leagues?.join(' · ')}
                    </span>
                  </div>
                  {run.final_ticket && (
                    <p className="text-xs text-text-secondary mt-1 truncate">
                      {run.final_ticket}
                    </p>
                  )}
                </div>

                {/* Verdict badge */}
                {run.final_verdict && (
                  <span
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-bold shrink-0',
                      run.final_verdict === 'PLAY'
                        ? 'bg-accent-green/15 text-accent-green'
                        : 'bg-accent-red/15 text-accent-red'
                    )}
                  >
                    {run.final_verdict}
                  </span>
                )}

                {/* Result badge */}
                {run.result && (
                  <span
                    className={clsx(
                      'shrink-0',
                      run.result === 'win' && 'text-accent-green',
                      run.result === 'loss' && 'text-accent-red',
                      run.result === 'push' && 'text-accent-amber'
                    )}
                  >
                    {run.result === 'win' && <Trophy className="w-4 h-4" />}
                    {run.result === 'loss' && <XCircle className="w-4 h-4" />}
                    {run.result === 'push' && <MinusCircle className="w-4 h-4" />}
                  </span>
                )}

                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-secondary transition-colors shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  const colorClass =
    color === 'green'
      ? 'text-accent-green'
      : color === 'red'
        ? 'text-accent-red'
        : color === 'amber'
          ? 'text-accent-amber'
          : 'text-text-primary';

  return (
    <div className="bg-bg-secondary rounded-xl px-4 py-3 border border-border-subtle">
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={clsx('text-xl font-bold font-display mt-1', colorClass)}>
        {value}
      </div>
    </div>
  );
}
