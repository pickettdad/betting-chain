/**
 * Betting Chain Runner
 * Standalone script executed by GitHub Actions.
 * Reads a run from Supabase, downloads screenshots, runs all 6 AI steps,
 * writes results back, and sends notifications.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================
// Config
// ============================================================
const RUN_ID = process.env.RUN_ID;
if (!RUN_ID) {
  console.error('ERROR: RUN_ID environment variable is required');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// ============================================================
// AI Clients
// ============================================================

async function callOpenAIVision(prompt, imagesBase64) {
  const imageContent = imagesBase64.map((b64) => ({
    type: 'image_url',
    image_url: { url: `data:image/png;base64,${b64}`, detail: 'high' },
  }));
  const response = await openai.chat.completions.create({
    model: 'o3',
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...imageContent] }],
    max_completion_tokens: 16000,
  });
  return response.choices[0]?.message?.content ?? '';
}

async function callOpenAI(prompt) {
  const response = await openai.chat.completions.create({
    model: 'o3',
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 16000,
  });
  return response.choices[0]?.message?.content ?? '';
}

async function callGrok(prompt) {
  // Uses the xAI Responses API (not chat/completions) to enable
  // real-time web + X/Twitter search via server-side tools.
  // Confirmed correct as of March 2026 per xAI docs.
  const response = await fetch('https://api.x.ai/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-4',
      input: [{ role: 'user', content: prompt }],
      tools: [
        { type: 'web_search' },
        { type: 'x_search' },
      ],
      max_output_tokens: 8000,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok API error ${response.status}: ${err}`);
  }
  const data = await response.json();
  // Responses API returns data.output array; extract text blocks
  if (Array.isArray(data.output)) {
    const textParts = [];
    for (const item of data.output) {
      // Each output item may have a content array (message type) or be a tool result
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === 'text') textParts.push(block.text);
        }
      }
    }
    if (textParts.length > 0) return textParts.join('\n');
  }
  // Fallback: try to extract any text from the response
  return JSON.stringify(data.output ?? data, null, 2);
}

async function callClaude(prompt) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { maxOutputTokens: 8000 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ============================================================
// Prompts
// ============================================================

function buildPrompt1() {
  return `You are the slate extraction engine.

Task:
Read the attached sportsbook screenshots and convert them into a clean structured text slate.

Rules:
- Extract only visible pre-game lines.
- Include only these fields: League | Game | Market | Side | Odds | Start Time
- Keep team names exactly as shown where possible.
- Use decimal odds exactly as shown.
- Do not analyze, rank, or comment.
- Do not summarize.
- Do not omit lines just because they seem weak.
- Do not infer hidden lines, alternate markets, or anything behind "more bets."
- Preserve the board order as shown in the screenshots.
- If any field is unclear, write [unclear] instead of guessing.

Verification requirement:
- After completing the extraction, perform a second pass over the screenshots.
- Re-check every extracted team name, market, side, odds value, and start time against the image.
- Correct any mismatch before finalizing.
- Pay special attention to: similar-looking odds digits, favorite/underdog side alignment, over/under values, home vs away ordering, spread or puck-line sign errors.
- Only after the verification pass should you produce the final slate.

Output format:
[League]
Start Time | Away Team @ Home Team | Market | Side | Odds

Example:
[NBA]
19:00 | Indiana Pacers @ Orlando Magic | Spread | Pacers +12.5 | 1.92

If there are any uncertain fields, add this section at the end:
[Uncertainties]
<line item>`;
}

function buildPrompt2(slate) {
  return `You are the first-pass market filter.

Goal: Create a conservative shortlist from a structured OLG PROLINE+ pre-game slate.

Rules:
- Use only NBA and NHL unless another league is explicitly included.
- Use only pre-game main markets: moneyline, spread/puck line, total.
- Do not use props, Same Game Parlays, or exotic markets.
- Rank for conservative ticket utility, not raw payout.
- Prefer fewer legs and lower fragility.
- It is acceptable to conclude PASS on a weak slate.
- Do not force a 3x outcome.
- Treat spreads/totals around 1.88–1.95 as competitive markets, not safe edges.
- Very short favorites may be usable but should be flagged for low value and news sensitivity.
- If the first game is still several hours away, explicitly treat lineup-dependent or goalie-dependent plays as more fragile.

Task:
1. Ranked candidate list
2. Tier for each candidate: A / B / C
3. One-sentence reason
4. Key risk
5. News Sensitivity: Low / Medium / High
6. Keep or Cut

Additional: Flag any shortlist legs from the same game that could conflict. Add a Conflict Notes section.

Then produce:
- Top 5 shortlist
- Conflict Notes
- Best single
- Best pair for a 2.0x–2.4x target
- Best pair for a 3.0x–3.3x target
- Overall slate verdict: PLAYABLE or PASS

Output format:
| Rank | Line | Tier | Reason | Key Risk | News Sensitivity | Keep/Cut |

Here is the structured slate:

${slate}`;
}

function buildPrompt3(slate, shortlist) {
  return `You are the day-of news veto engine.

Inputs:
1. A structured pre-game sportsbook slate
2. A first-pass ranked shortlist

Your role: Only evaluate day-of risk that could materially change a conservative betting decision.

For each shortlisted candidate, check for: injuries, late scratches, expected lineup changes, confirmed goalie or pitcher where relevant, back-to-back fatigue, travel spots, credible day-of news.

For each candidate, return in table format:
| Line | Status | Severity | Timing Sensitivity | Recheck Needed | Reason |

Status: SAFE / CAUTION / VETO
Severity: 1 to 5
Timing Sensitivity: Low / Medium / High
Recheck Needed Before Bet: Yes / No

Timing requirement: If review is >3 hours before the first game, treat output as provisional. Mark Recheck Needed: Yes for lineup-dependent plays.

Then add:
- Any CUT candidate to reconsider after news review
- Any shortlisted play to remove immediately

Do not use hype. Do not invent angles. Do not make a final betting decision.

=== STRUCTURED SLATE ===
${slate}

=== FIRST-PASS SHORTLIST ===
${shortlist}`;
}

function buildPrompt4(slate, shortlist, veto) {
  return `You are the ticket optimization engine.

Inputs:
1. Structured sportsbook slate
2. First-pass ranked shortlist
3. Day-of news veto results

Goal: Build the strongest conservative pre-game ticket structure from surviving candidates.

Rules:
- Exclude all VETO candidates.
- Downgrade CAUTION candidates appropriately.
- Prefer the fewest legs possible.
- Prioritize ticket strength over payout.
- Do not force a 3x target if the slate does not support it.
- A PASS result is acceptable.
- Do not combine same-game legs that create overlapping, opposing, or narrow-outcome dependency.
- Respect Timing Sensitivity and Recheck flags.

Tasks:
1. Rank surviving candidates from strongest to weakest.
2. Build: best single, best 2-leg ticket for 2.0x–2.4x, best 2-leg for 3.0x–3.3x, one backup ticket.
3. Explain why each build is stronger than alternatives.
4. Flag hidden fragility, poor price quality, and correlation risk.
5. State clearly if the 3.0x target should be avoided.
6. Flag timing sensitivity if the run is early.

Output: Ranked survivors, Main ticket, Backup ticket, Pass condition

=== STRUCTURED SLATE ===
${slate}

=== FIRST-PASS SHORTLIST ===
${shortlist}

=== DAY-OF NEWS VETO ===
${veto}`;
}

function buildPrompt5(slate, shortlist, veto, optimize) {
  return `You are the adversarial review engine.

Inputs:
1. Structured sportsbook slate
2. First-pass shortlist
3. Day-of news veto results
4. Claude's proposed ticket(s)

Your role: Try to break the proposed ticket.

For each leg, evaluate: overconfidence, bad price for risk level, public-favorite trap, fragile matchup assumptions, line already reflecting the obvious angle, better surviving alternative.

For each leg, return: KEEP / QUESTION / REMOVE with one concise reason.

Then return:
- Whether the full ticket should stand, be edited, or be abandoned
- The strongest alternative if one exists
- Whether the best single is stronger than both proposed tickets

Give extra weight to Timing Sensitivity and Recheck flags if first game is >3 hours away.

=== STRUCTURED SLATE ===
${slate}

=== FIRST-PASS SHORTLIST ===
${shortlist}

=== DAY-OF NEWS VETO ===
${veto}

=== TICKET OPTIMIZATION (Claude) ===
${optimize}`;
}

function buildPrompt6(slate, shortlist, veto, optimize, adversarial) {
  return `You are the final decision engine.

Inputs:
1. Structured sportsbook slate
2. First-pass shortlist
3. Day-of news veto results
4. Claude optimization output
5. Gemini adversarial review

Rules:
- Keep only plays with strong support and no major unresolved objection.
- Prefer fewer legs.
- If the 3.0x build is too fragile, recommend the lower target instead.
- A no-bet result is acceptable.
- Treat the backup ticket as an alternative, not an automatic second play.
- If the final main ticket is a single and the backup is a parlay containing the same leg, state that the backup is an optional add-on.
- Respect Timing Sensitivity and Recheck flags.

Output:
1. Final main ticket
2. Final backup alternative
3. Final verdict: PLAY / PASS
4. Recommended usage: main only / optional add-on / choose one
5. One plain-English explanation
6. Recheck required before bet: Yes / No

IMPORTANT: After your full analysis, include a machine-readable JSON block at the very end:

\`\`\`json
{
  "mainTicket": "description with odds",
  "backupTicket": "description with odds",
  "verdict": "PLAY or PASS",
  "recommendedUsage": "main only / optional add-on / choose one",
  "explanation": "one plain-English sentence",
  "recheckRequired": true or false
}
\`\`\`

=== STRUCTURED SLATE ===
${slate}

=== FIRST-PASS SHORTLIST ===
${shortlist}

=== DAY-OF NEWS VETO ===
${veto}

=== TICKET OPTIMIZATION (Claude) ===
${optimize}

=== ADVERSARIAL REVIEW (Gemini) ===
${adversarial}`;
}

// ============================================================
// Database helpers
// ============================================================

async function getRun(id) {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw new Error(`Failed to fetch run: ${error.message}`);
  return data;
}

async function updateRun(id, updates) {
  const { error } = await supabase.from('runs').update(updates).eq('id', id);
  if (error) throw new Error(`Failed to update run: ${error.message}`);
}

async function downloadImages(imagePaths) {
  const images = [];
  for (const path of imagePaths) {
    const { data, error } = await supabase.storage
      .from('screenshots')
      .download(path);
    if (error) throw new Error(`Failed to download image ${path}: ${error.message}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    images.push(buffer.toString('base64'));
  }
  return images;
}

// ============================================================
// Notifications
// ============================================================

async function sendSMS(body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.NOTIFY_PHONE_NUMBER) return;
  try {
    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: process.env.NOTIFY_PHONE_NUMBER,
          From: process.env.TWILIO_FROM_NUMBER,
          Body: body.substring(0, 1500),
        }),
      }
    );
    console.log('SMS sent');
  } catch (err) {
    console.error('SMS failed:', err.message);
  }
}

async function sendEmail(subject, htmlBody) {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Betting Chain <onboarding@resend.dev>',
        to: process.env.NOTIFY_EMAIL,
        subject,
        html: htmlBody,
      }),
    });
    console.log('Email sent');
  } catch (err) {
    console.error('Email failed:', err.message);
  }
}

async function sendNotifications(decision) {
  const emoji = decision.verdict === 'PLAY' ? '🟢' : '🔴';
  const smsBody = [
    `${emoji} VERDICT: ${decision.verdict}`,
    `Main: ${decision.mainTicket}`,
    `Backup: ${decision.backupTicket}`,
    `Usage: ${decision.recommendedUsage}`,
    decision.recheckRequired ? '⚠️ RECHECK REQUIRED' : '',
    decision.explanation,
    `${process.env.APP_URL}/run/${RUN_ID}`,
  ].filter(Boolean).join('\n');

  const verdictColor = decision.verdict === 'PLAY' ? '#22c55e' : '#ef4444';
  const emailHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:500px;margin:0 auto;background:#0a0a0f;color:#e8e8ed;padding:24px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:32px;font-weight:800;color:${verdictColor};">${decision.verdict}</span>
        ${decision.recheckRequired ? '<br><span style="background:#f59e0b;color:#000;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">RECHECK REQUIRED</span>' : ''}
      </div>
      <div style="background:#12121a;padding:16px;border-radius:8px;margin-bottom:12px;">
        <div style="color:#9898a8;font-size:11px;text-transform:uppercase;">Main Ticket</div>
        <div style="font-size:16px;font-weight:600;margin-top:4px;">${decision.mainTicket}</div>
      </div>
      <div style="background:#12121a;padding:16px;border-radius:8px;margin-bottom:12px;">
        <div style="color:#9898a8;font-size:11px;text-transform:uppercase;">Backup</div>
        <div style="font-size:16px;margin-top:4px;">${decision.backupTicket}</div>
      </div>
      <p style="color:#9898a8;font-size:14px;line-height:1.5;">${decision.explanation}</p>
      <a href="${process.env.APP_URL}/run/${RUN_ID}" style="display:block;text-align:center;background:${verdictColor};color:#000;padding:12px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px;">View Full Analysis →</a>
    </div>`;

  await Promise.all([
    sendSMS(smsBody),
    sendEmail(`${emoji} Betting Chain: ${decision.verdict}`, emailHtml),
  ]);
}

// ============================================================
// Parse final decision
// ============================================================

function parseFinalDecision(output) {
  try {
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);

    const rawMatch = output.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    if (rawMatch) return JSON.parse(rawMatch[0]);
  } catch {}

  // Manual fallback
  return {
    mainTicket: 'See analysis',
    backupTicket: 'See analysis',
    verdict: output.includes('PLAY') ? 'PLAY' : 'PASS',
    recommendedUsage: 'See analysis',
    explanation: 'See full analysis for details.',
    recheckRequired: output.toLowerCase().includes('recheck required before bet: yes'),
  };
}

function detectLeagues(slate) {
  const leagues = [];
  if (slate.includes('[NBA]') || slate.toLowerCase().includes('basketball')) leagues.push('NBA');
  if (slate.includes('[NHL]') || slate.toLowerCase().includes('hockey')) leagues.push('NHL');
  if (slate.includes('[MLB]') || slate.toLowerCase().includes('baseball')) leagues.push('MLB');
  return leagues.length > 0 ? leagues : ['NBA', 'NHL'];
}

// ============================================================
// Retry helper for transient API errors
// ============================================================

async function withRetry(fn, { maxRetries = 1, delayMs = 10000, stepName = '' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error?.message ?? '';
      const isTransient = msg.includes('429') || msg.includes('500') ||
        msg.includes('502') || msg.includes('503') || msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') || msg.includes('fetch failed');
      if (isTransient && attempt < maxRetries) {
        console.log(`⚠️ ${stepName} transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs / 1000}s...`);
        console.log(`   Error: ${msg}`);
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

// ============================================================
// Run a single step
// ============================================================

async function runStep(name, model, fn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP: ${name} (${model})`);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    const output = await withRetry(fn, { maxRetries: 1, delayMs: 10000, stepName: name });
    const duration = Date.now() - start;
    console.log(`✅ ${name} complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`Output preview: ${output.substring(0, 200)}...`);
    return {
      step: name,
      status: 'complete',
      model,
      output,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ ${name} failed after ${(duration / 1000).toFixed(1)}s:`, error.message);
    return {
      step: name,
      status: 'error',
      model,
      output: '',
      durationMs: duration,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// ============================================================
// Main execution
// ============================================================

async function main() {
  console.log(`\nBetting Chain Runner — Run ID: ${RUN_ID}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  // 1. Fetch run record
  const run = await getRun(RUN_ID);
  console.log(`Run date: ${run.date_label}`);
  console.log(`Image paths: ${run.image_paths?.length ?? 0} screenshots`);

  // 2. Download images from Supabase Storage
  const imagesBase64 = await downloadImages(run.image_paths);
  console.log(`Downloaded ${imagesBase64.length} images`);

  const steps = [];

  const saveProgress = async (extraUpdates = {}) => {
    await updateRun(RUN_ID, { steps, ...extraUpdates });
  };

  // === STEP 1: Slate Extraction ===
  const step1 = await runStep('extract', 'o3', () =>
    callOpenAIVision(buildPrompt1(), imagesBase64)
  );
  steps.push(step1);
  await saveProgress({ leagues: detectLeagues(step1.output) });
  if (step1.status === 'error') { await saveProgress({ status: 'error' }); process.exit(1); }

  // === STEP 2: Market Filter ===
  const step2 = await runStep('filter', 'o3', () =>
    callOpenAI(buildPrompt2(step1.output))
  );
  steps.push(step2);
  await saveProgress();
  if (step2.status === 'error') { await saveProgress({ status: 'error' }); process.exit(1); }

  // === STEP 3: News Veto ===
  const step3 = await runStep('veto', 'grok-4', () =>
    callGrok(buildPrompt3(step1.output, step2.output))
  );
  steps.push(step3);
  await saveProgress();
  if (step3.status === 'error') { await saveProgress({ status: 'error' }); process.exit(1); }

  // === STEP 4: Ticket Optimization ===
  const step4 = await runStep('optimize', 'claude-opus-4-6', () =>
    callClaude(buildPrompt4(step1.output, step2.output, step3.output))
  );
  steps.push(step4);
  await saveProgress();
  if (step4.status === 'error') { await saveProgress({ status: 'error' }); process.exit(1); }

  // === STEP 5: Adversarial Review ===
  const step5 = await runStep('adversarial', 'gemini-2.5-pro', () =>
    callGemini(buildPrompt5(step1.output, step2.output, step3.output, step4.output))
  );
  steps.push(step5);
  await saveProgress();
  if (step5.status === 'error') { await saveProgress({ status: 'error' }); process.exit(1); }

  // === STEP 6: Final Decision ===
  const step6 = await runStep('final', 'o3', () =>
    callOpenAI(buildPrompt6(step1.output, step2.output, step3.output, step4.output, step5.output))
  );
  steps.push(step6);

  // Parse and save final result
  const decision = parseFinalDecision(step6.output);

  await saveProgress({
    status: step6.status === 'error' ? 'error' : 'complete',
    final_verdict: decision?.verdict,
    final_ticket: decision?.mainTicket,
    final_backup: decision?.backupTicket,
    final_explanation: decision?.explanation,
    recheck_required: decision?.recheckRequired,
    recommended_usage: decision?.recommendedUsage,
  });

  // Send notifications
  if (decision) {
    await sendNotifications(decision);
  }

  const totalTime = steps.reduce((sum, s) => sum + s.durationMs, 0);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CHAIN COMPLETE — ${decision?.verdict ?? 'UNKNOWN'}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Main ticket: ${decision?.mainTicket}`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  updateRun(RUN_ID, { status: 'error' }).catch(() => {});
  process.exit(1);
});
