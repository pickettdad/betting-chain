// === Chain Types ===

export type StepName =
  | 'extract'
  | 'filter'
  | 'veto'
  | 'optimize'
  | 'adversarial'
  | 'final';

export type StepStatus = 'pending' | 'running' | 'complete' | 'error';

export type Verdict = 'PLAY' | 'PASS';

export interface StepResult {
  step: StepName;
  status: StepStatus;
  model: string;
  output: string;
  durationMs: number;
  error?: string;
  timestamp: string;
}

export interface ChainRun {
  id: string;
  created_at: string;
  date_label: string; // e.g. "Mar 25, 2026"
  leagues: string[];
  status: 'running' | 'complete' | 'error';
  steps: StepResult[];
  final_verdict?: Verdict;
  final_ticket?: string;
  final_backup?: string;
  final_explanation?: string;
  recheck_required?: boolean;
  recommended_usage?: string;
  result?: 'win' | 'loss' | 'push' | null;
  profit?: number | null;
  image_paths?: string[];
}

// === Parsed structured data passed between steps ===

export interface SlateGame {
  league: string;
  startTime: string;
  awayTeam: string;
  homeTeam: string;
  market: string;
  side: string;
  odds: number;
}

export interface ShortlistCandidate {
  rank: number;
  line: string;
  tier: string;
  reason: string;
  keyRisk: string;
  newsSensitivity: string;
  keepCut: string;
}

export interface VetoResult {
  line: string;
  status: 'SAFE' | 'CAUTION' | 'VETO';
  severity: number;
  timingSensitivity: string;
  recheckNeeded: boolean;
  reason: string;
}

export interface FinalDecision {
  mainTicket: string;
  backupTicket: string;
  verdict: Verdict;
  recommendedUsage: string;
  explanation: string;
  recheckRequired: boolean;
}

// === Step metadata for UI ===

export const STEP_META: Record<
  StepName,
  { label: string; model: string; provider: string; color: string; icon: string }
> = {
  extract: {
    label: 'Slate Extraction',
    model: 'o3',
    provider: 'OpenAI',
    color: '#22c55e',
    icon: '📋',
  },
  filter: {
    label: 'Market Filter',
    model: 'o3',
    provider: 'OpenAI',
    color: '#3b82f6',
    icon: '🔍',
  },
  veto: {
    label: 'News Veto',
    model: 'grok-3',
    provider: 'xAI',
    color: '#f59e0b',
    icon: '📰',
  },
  optimize: {
    label: 'Ticket Optimization',
    model: 'claude-opus-4-6',
    provider: 'Anthropic',
    color: '#a855f7',
    icon: '🎯',
  },
  adversarial: {
    label: 'Adversarial Review',
    model: 'gemini-2.5-pro',
    provider: 'Google',
    color: '#ef4444',
    icon: '⚔️',
  },
  final: {
    label: 'Final Decision',
    model: 'o3',
    provider: 'OpenAI',
    color: '#06b6d4',
    icon: '✅',
  },
};
