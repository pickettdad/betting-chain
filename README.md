# Betting Chain

AI-powered multi-model betting analysis pipeline. Upload sportsbook screenshots, get a fully vetted ticket recommendation through a 6-step chain across 4 AI providers.

## How It Works

```
You upload screenshots → Vercel dashboard → Supabase Storage
                                          → triggers GitHub Actions
                                          → 6-step AI chain runs
                                          → results saved to Supabase
                                          → SMS + email notification sent
                                          → dashboard shows results
```

| Step | AI | Model | Role |
|------|-----|-------|------|
| 1. Slate Extraction | OpenAI | o3 (vision) | OCR screenshots → structured data |
| 2. Market Filter | OpenAI | o3 | Conservative shortlisting |
| 3. News Veto | xAI | Grok 3 (live search) | Real-time injury/lineup check |
| 4. Ticket Optimization | Anthropic | Claude Opus 4.6 | Build best ticket structure |
| 5. Adversarial Review | Google | Gemini 2.5 Pro | Try to break the proposed ticket |
| 6. Final Decision | OpenAI | o3 | Synthesize all inputs → PLAY/PASS |

## Architecture

- **Vercel** (free tier) — serves the dashboard, handles image upload, triggers the chain
- **GitHub Actions** (free tier, 2000 min/mo) — runs the AI chain with no timeout issues
- **Supabase** (free tier) — database + image storage

Vercel does NOT need AI API keys. All heavy processing happens in GitHub Actions.

## Setup (Step by Step)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → create a free project
2. Go to **SQL Editor** in the left sidebar
3. Paste the contents of `supabase-setup.sql` → click **Run**
4. Go to **Storage** in the left sidebar → click **New bucket**
   - Name: `screenshots`
   - Public bucket: **OFF**
   - Click **Create bucket**
5. Go to **Settings → API** and save these values:
   - Project URL (starts with `https://`)
   - `anon` public key
   - `service_role` secret key

### 2. Create a GitHub repo

1. Go to [github.com/new](https://github.com/new) → create a new repo named `betting-chain`
2. Download the project zip and unzip it
3. Use **Add file → Upload files** to upload everything into the repo

### 3. Set up GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

Add each of these:

| Secret Name | What It Is |
|-------------|-----------|
| `OPENAI_API_KEY` | From [platform.openai.com](https://platform.openai.com) |
| `XAI_API_KEY` | From [console.x.ai](https://console.x.ai) |
| `GOOGLE_AI_API_KEY` | From [aistudio.google.com](https://aistudio.google.com) |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `APP_URL` | Your Vercel app URL (add after Vercel deploy) |
| `TWILIO_ACCOUNT_SID` | *(optional)* For SMS notifications |
| `TWILIO_AUTH_TOKEN` | *(optional)* For SMS notifications |
| `TWILIO_FROM_NUMBER` | *(optional)* Your Twilio phone number |
| `NOTIFY_PHONE_NUMBER` | *(optional)* Your phone number |
| `RESEND_API_KEY` | *(optional)* For email notifications |
| `NOTIFY_EMAIL` | *(optional)* Your email address |

### 4. Create a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate new token (classic) → select `repo` and `workflow` scopes
3. Save the token — you'll need it for Vercel

### 5. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Import your `betting-chain` repo
2. Add these **Environment Variables** in the Vercel settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `GITHUB_OWNER` | Your GitHub username |
| `GITHUB_REPO` | `betting-chain` |
| `GITHUB_PAT` | The personal access token from step 4 |
| `NEXT_PUBLIC_APP_URL` | Your Vercel app URL (update after first deploy) |

3. Deploy

### 6. Update the APP_URL secret

After your first Vercel deploy, copy the URL (e.g. `https://betting-chain.vercel.app`) and:
- Add it as `APP_URL` in GitHub Secrets
- Update `NEXT_PUBLIC_APP_URL` in Vercel environment variables

## Usage

1. Take screenshots of the OLG PROLINE+ board (NBA, NHL, etc.)
2. Open your dashboard
3. Drop the screenshots in the upload zone → click **Run Analysis**
4. The chain runs in GitHub Actions (2–4 minutes)
5. Dashboard shows live progress as each step completes
6. You get an SMS + email with the final verdict
7. After games, come back and mark WIN / LOSS / PUSH

## Cost Per Run

| Provider | Model | Approx. Cost |
|----------|-------|-------------|
| OpenAI | o3 × 3 calls (1 with vision) | $1.50–2.50 |
| xAI | Grok 3 with search | $0.30–0.50 |
| Anthropic | Claude Opus 4.6 | $0.50–1.00 |
| Google | Gemini 2.5 Pro | $0.20–0.40 |
| **Total** | | **$2.50–4.40** |

All hosting infrastructure (Vercel, GitHub Actions, Supabase) stays within free tiers.

## Customizing Prompts

All prompts are embedded in `chain-runner/run.mjs`. Search for `buildPrompt1` through `buildPrompt6` to find and edit each one. Changes take effect on the next run automatically since GitHub Actions pulls from the repo.

## File Structure

```
betting-chain/
├── .github/
│   └── workflows/
│       └── run-chain.yml          # GitHub Actions workflow
├── chain-runner/
│   ├── package.json               # Chain runner dependencies
│   └── run.mjs                    # Standalone chain script (runs in Actions)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chain/route.ts     # Upload images + trigger workflow
│   │   │   └── runs/
│   │   │       ├── route.ts       # List runs + stats
│   │   │       └── [id]/
│   │   │           ├── route.ts   # Get single run
│   │   │           └── result/route.ts  # Update win/loss
│   │   ├── run/[id]/page.tsx      # Run detail page
│   │   ├── page.tsx               # Dashboard
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       ├── ai/types.ts            # TypeScript types
│       └── supabase.ts            # Dashboard database client
├── supabase-setup.sql             # Database schema (run once)
├── .env.example                   # Environment variable reference
└── README.md
```

## Troubleshooting

**Chain doesn't start after upload:**
- Check that `GITHUB_PAT` has `repo` + `workflow` scopes
- Verify the workflow file is on the `main` branch
- Check GitHub Actions tab for any workflow errors

**Step fails with API error:**
- Check the GitHub Actions run logs for the specific error
- Verify the API key is correct in GitHub Secrets
- Some models may have rate limits or require billing setup

**Dashboard shows "running" indefinitely:**
- Check GitHub Actions tab — the workflow may have failed
- The run status stays "running" until the chain-runner updates it to "complete" or "error"

**Grok search not working:**
- The xAI API search parameter format may change — check [docs.x.ai](https://docs.x.ai) for the latest format and update `chain-runner/run.mjs`
