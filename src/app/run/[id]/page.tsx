'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Trophy,
  XCircle,
  MinusCircle,
  AlertTriangle,
} from 'lucide-react';
import { STEP_META, StepName } from '@/lib/ai/types';
import { clsx } from 'clsx';

export default function RunDetail() {
  const params = useParams();
  const runId = params.id as string;
  const [run, setRun] = useState<any>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [resultInput, setResultInput] = useState<string | null>(null);
  const [profitInput, setProfitInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}`);
      const data = await res.json();
      setRun(data);
    } catch {}
  }, [runId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Poll while running
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [run, fetchRun]);

  const toggleStep = (step: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const saveResult = async () => {
    if (!resultInput) return;
    setSaving(true);
    try {
      await fetch(`/api/runs/${runId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultInput,
          profit: parseFloat(profitInput) || 0,
        }),
      });
      fetchRun();
    } catch {}
    setSaving(false);
  };

  if (!run) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-text-muted">
        Loading...
      </div>
    );
  }

  const steps: StepName[] = [
    'extract',
    'filter',
    'veto',
    'optimize',
    'adversarial',
    'final',
  ];

  const totalDuration = run.steps?.reduce(
    (sum: number, s: any) => sum + (s.durationMs ?? 0),
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back nav */}
      <a
        href="/"
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary mb-6"
      >
        <ArrowLeft className="w-3 h-3" /> Back to dashboard
      </a>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold">{run.date_label}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-text-muted">
              {run.leagues?.join(' · ')}
            </span>
            {totalDuration > 0 && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />{' '}
                {(totalDuration / 1000).toFixed(0)}s total
              </span>
            )}
          </div>
        </div>

        {run.final_verdict && (
          <span
            className={clsx(
              'px-4 py-2 rounded-xl text-sm font-bold',
              run.final_verdict === 'PLAY'
                ? 'bg-accent-green/15 text-accent-green'
                : 'bg-accent-red/15 text-accent-red'
            )}
          >
            {run.final_verdict}
          </span>
        )}
      </div>

      {/* Final Ticket Card */}
      {run.final_ticket && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                Main Ticket
              </div>
              <div className="text-base font-semibold">{run.final_ticket}</div>
            </div>
            {run.final_backup && (
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                  Backup
                </div>
                <div className="text-sm text-text-secondary">
                  {run.final_backup}
                </div>
              </div>
            )}
          </div>

          {run.recommended_usage && (
            <div className="mt-3 text-xs text-text-muted">
              Usage: {run.recommended_usage}
            </div>
          )}

          {run.final_explanation && (
            <p className="mt-3 text-sm text-text-secondary leading-relaxed border-t border-border-subtle pt-3">
              {run.final_explanation}
            </p>
          )}

          {run.recheck_required && (
            <div className="mt-3 px-3 py-2 bg-accent-amber/10 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0" />
              <span className="text-xs text-accent-amber font-semibold">
                Recheck required before placing bet
              </span>
            </div>
          )}
        </div>
      )}

      {/* Result Tracker */}
      {run.status === 'complete' && run.final_verdict === 'PLAY' && (
        <div className="bg-bg-secondary rounded-xl border border-border-subtle p-5 mb-6">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">
            Result Tracking
          </div>
          {run.result ? (
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  'flex items-center gap-2 text-sm font-bold',
                  run.result === 'win' && 'text-accent-green',
                  run.result === 'loss' && 'text-accent-red',
                  run.result === 'push' && 'text-accent-amber'
                )}
              >
                {run.result === 'win' && <Trophy className="w-4 h-4" />}
                {run.result === 'loss' && <XCircle className="w-4 h-4" />}
                {run.result === 'push' && <MinusCircle className="w-4 h-4" />}
                {run.result.toUpperCase()}
              </span>
              {run.profit !== null && run.profit !== undefined && (
                <span
                  className={clsx(
                    'text-sm font-mono',
                    run.profit >= 0 ? 'text-accent-green' : 'text-accent-red'
                  )}
                >
                  {run.profit >= 0 ? '+' : ''}
                  {run.profit.toFixed(2)}u
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {['win', 'loss', 'push'].map((r) => (
                <button
                  key={r}
                  onClick={() => setResultInput(r)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                    resultInput === r
                      ? r === 'win'
                        ? 'bg-accent-green text-bg-primary'
                        : r === 'loss'
                          ? 'bg-accent-red text-bg-primary'
                          : 'bg-accent-amber text-bg-primary'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-elevated'
                  )}
                >
                  {r.toUpperCase()}
                </button>
              ))}
              {resultInput && (
                <>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Profit/loss (units)"
                    value={profitInput}
                    onChange={(e) => setProfitInput(e.target.value)}
                    className="bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2 text-xs w-40 focus:outline-none focus:border-accent-blue"
                  />
                  <button
                    onClick={saveResult}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-accent-blue text-white text-xs font-semibold"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chain Steps */}
      <h2 className="font-display font-semibold text-base mb-4">
        Analysis Chain
      </h2>
      <div className="space-y-2">
        {steps.map((stepName, idx) => {
          const meta = STEP_META[stepName];
          const stepData = run.steps?.find((s: any) => s.step === stepName);
          const isExpanded = expandedSteps.has(stepName);
          const isRunning =
            !stepData &&
            run.status === 'running' &&
            (run.steps?.length ?? 0) === idx;

          return (
            <div
              key={stepName}
              className="bg-bg-secondary rounded-xl border border-border-subtle overflow-hidden"
            >
              <button
                onClick={() => stepData && toggleStep(stepName)}
                className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-bg-tertiary/50 transition-colors"
                disabled={!stepData}
              >
                <span className="text-lg">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{meta.label}</span>
                    <span className="text-[10px] text-text-muted font-mono">
                      {meta.provider} / {meta.model}
                    </span>
                  </div>
                </div>

                {isRunning && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full pulse-dot"
                      style={{ background: meta.color }}
                    />
                    <span className="text-xs text-text-muted">Running...</span>
                  </div>
                )}
                {stepData?.status === 'complete' && (
                  <span className="text-xs text-text-muted font-mono">
                    {((stepData.durationMs ?? 0) / 1000).toFixed(1)}s
                  </span>
                )}
                {stepData?.status === 'error' && (
                  <span className="text-xs text-accent-red">Error</span>
                )}

                {stepData && (
                  isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                  )
                )}
              </button>

              {isExpanded && stepData && (
                <div className="px-5 pb-5 border-t border-border-subtle">
                  {stepData.error && (
                    <div className="mt-3 px-3 py-2 bg-accent-red/10 rounded-lg text-xs text-accent-red">
                      {stepData.error}
                    </div>
                  )}
                  {stepData.output && (
                    <div className="mt-3 chain-output bg-bg-primary rounded-lg p-4 max-h-[500px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-[13px] leading-relaxed font-sans">
                        {stepData.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
