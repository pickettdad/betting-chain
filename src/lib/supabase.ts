import { createClient } from '@supabase/supabase-js';
import { ChainRun } from '@/lib/ai/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const db = {
  async getRun(id: string): Promise<ChainRun | null> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as ChainRun;
  },

  async listRuns(limit = 50): Promise<ChainRun[]> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`DB list error: ${error.message}`);
    return (data ?? []) as ChainRun[];
  },

  async updateResult(
    id: string,
    result: 'win' | 'loss' | 'push',
    profit: number
  ): Promise<void> {
    const { error } = await supabase
      .from('runs')
      .update({ result, profit })
      .eq('id', id);
    if (error) throw new Error(`DB result update error: ${error.message}`);
  },

  async getStats(): Promise<{
    total: number;
    wins: number;
    losses: number;
    pushes: number;
    plays: number;
    passes: number;
    totalProfit: number;
  }> {
    const { data, error } = await supabase
      .from('runs')
      .select('final_verdict, result, profit')
      .eq('status', 'complete');

    if (error) throw new Error(`DB stats error: ${error.message}`);

    const runs = data ?? [];
    return {
      total: runs.length,
      wins: runs.filter((r) => r.result === 'win').length,
      losses: runs.filter((r) => r.result === 'loss').length,
      pushes: runs.filter((r) => r.result === 'push').length,
      plays: runs.filter((r) => r.final_verdict === 'PLAY').length,
      passes: runs.filter((r) => r.final_verdict === 'PASS').length,
      totalProfit: runs.reduce((sum, r) => sum + (r.profit ?? 0), 0),
    };
  },
};
