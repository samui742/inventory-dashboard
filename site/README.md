# Inventory dashboard web app

Next.js inventory dashboard deployed on Vercel with Supabase PostgreSQL storage.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Run `npm install` and `npm run dev`.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or prefix it with
`NEXT_PUBLIC_`.

## Database setup

Run `supabase/schema.sql` once in a Supabase project, followed by
`supabase/seed.sql` to import the preserved inventory records.

Row Level Security is enabled without public table policies. All reads and
writes pass through the Next.js API routes using the server-side service role.

## Deployment

Configure these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (the production origin, optional before first deploy)

Vercel builds the app with `npm run build`.
