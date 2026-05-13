# Optify

Modern SaaS-style UI analyzer with a black/green interface, rotating hero text, instant URL analysis, layout suggestions, and AI prompt generation.

## Local Development

1. Install dependencies:

npm install

2. Run Vercel local dev (required for /api routes):

npm run dev

3. Open the local URL shown in your terminal.

## What It Does

- Accepts a target URL.
- Fetches and analyzes page HTML in a serverless API.
- Scores:
  - UI
  - Speed
  - Accessibility
  - SEO
  - Conversion
- Infers layout/component patterns.
- Recommends section reorder and component improvements.
- Generates a ready-to-paste AI implementation prompt.

## Real Audit Data

The API can use Google PageSpeed Insights for real performance, accessibility,
and SEO scores. Set `PSI_API_KEY` in Vercel (or your local env) to increase
quota reliability. Without a key, the endpoint still works but may be rate
limited.

## Deploy To Vercel

### Option A: Dashboard (recommended)

1. Push this repository to GitHub.
2. In Vercel, click Add New -> Project.
3. Import your GitHub repository.
4. Framework preset: Other.
5. Build command: leave empty.
6. Output directory: leave empty.
7. Deploy.

### Option B: CLI

1. Install CLI:

npm i -g vercel

2. Login:

vercel login

3. Deploy:

vercel

4. Production deploy:

vercel --prod

## Connect Your Domain In Vercel

1. Open your project in Vercel.
2. Go to Settings -> Domains.
3. Add your domain (example: yourdomain.com).
4. Vercel will show DNS records to create at your DNS provider.

Typical setup:
- Root domain (@):
  - Type: A
  - Value: 76.76.21.21
- Subdomain (www):
  - Type: CNAME
  - Value: cname.vercel-dns.com

5. Wait for DNS propagation and click Verify in Vercel.
6. Set your preferred primary domain in the same Domains screen.

## Notes

- Some websites block crawlers or have strict bot/security protections.
- In those cases, analysis may fail with an API error.
