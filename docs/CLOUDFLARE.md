# Cloudflare

`backend/worker.ts` is the neutral Worker entrypoint and can be deployed after setting a unique worker name. The full persistent booking/data layer is intentionally not tied to an AVE account or Durable Object namespace in this master template.

For a client deployment, keep `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in deployment secrets. Set `CLINIC_BACKEND_URL` in the web application if bookings should be forwarded to a persistent backend.

The current Worker is a health/deployment scaffold. Telegram and OpenAI server integrations live in the Next API routes and use the same environment-secret model.
