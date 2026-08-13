# clinic_template

Universal clinic miniapp template based on the AVE Clinic miniapp architecture.

## Create a client prototype

1. Copy `clients/_template/` to `clients/<client-slug>/`.
2. Fill `clients/<client-slug>/clinic.json`: brand, contacts, theme, service groups, services, specialists, AI, Telegram and Cloudflare settings.
3. Put client images under `public/client/` and the source logo at the path declared in `logoSource`.
4. Run:

```bash
node scripts/apply-clinic-config.mjs clients/<client-slug>/clinic.json
```

5. Add real secrets only as environment variables using `.env.example` as the list of required variables. Never commit bot tokens, OpenAI keys or Cloudflare API tokens.

The generator validates service/specialist relationships and applies client data to the existing miniapp UI, booking flow, AI knowledge base and Cloudflare/Telegram integration layer.
