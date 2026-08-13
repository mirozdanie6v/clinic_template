# Integrations

## OpenAI
Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. The Next.js route `/api/ai` uses the clinic catalog from `app-data.js` as its knowledge base and falls back to catalog matching when no API key is configured. If `CLINIC_AI_WORKER_URL` is set, the app will try that worker first.

## Telegram
Set `TELEGRAM_BOT_TOKEN`. `/api/telegram/session` verifies Telegram Mini App `initData` server-side and returns the authenticated Telegram identity. `/api/telegram/send` is the server-side single-recipient send endpoint. Never expose the bot token to browser code.

## Persistent backend / Cloudflare
Set `CLINIC_BACKEND_URL` to a compatible backend endpoint. `/api/booking/create` forwards appointments to `${CLINIC_BACKEND_URL}/booking/create`; without a backend URL it runs in prototype mode and returns a local appointment payload.

The repository contains a `wrangler.jsonc` scaffold. Cloudflare account IDs/API tokens belong in deployment environment/secrets, not in Git.
