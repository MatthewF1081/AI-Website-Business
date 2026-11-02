# TradeSite Studio website

A static website for an HVAC, plumbing and roofing web design studio. It has 6 public pages and a lead CRM.

## Edit
- **Business name, phone, email, hours:** the `SITE` object at the top of `build.js`
- **Page content:** `src/pages/*.html`
- **Styles:** `site/assets/styles.css` (colors and fonts are tokens at the top)
- **Sample testimonials** on the home page are placeholders. Replace them with real reviews before launch.

## Build & preview
```bash
node build.js
```
```bash
node serve.js
```
Then open http://localhost:5173.

## Deploy
Upload the `site/` folder to any static host (Netlify, Cloudflare Pages, Vercel, GitHub Pages).

## CRM (`site/crm.html`, linked as "Team login" in the footer)
- Pipeline board (New, Contacted, Proposal sent, Won, Lost) with drag and drop, plus a list view
- Search, trade and package filters, deal values, follow-up dates, notes and activity, CSV export
- Quote forms on the site create a CRM lead automatically
- With the database connected: team sign-in, leads from every visitor on any device, and new leads appear live

Until the database is connected, the CRM runs in **browser-only mode**: leads are saved in that browser only.

### Connect the database (about 10 minutes, free)
1. Create a free account and a new project at [supabase.com](https://supabase.com).
2. In the project, open **SQL Editor**, paste all of `supabase/schema.sql`, and click **Run**.
3. Add your team login: **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
4. Allow that email into the CRM. Back in **SQL Editor**, run this with your email in lowercase:
   ```sql
   insert into public.team_members (email) values ('you@yourcompany.com') on conflict do nothing;
   ```
   Repeat steps 3–4 for each teammate.
5. Turn off public sign-ups: **Authentication → Sign In / Providers → Email**, switch off **Allow new users to sign up**. Even with sign-ups on, only emails in `team_members` can see leads.
6. Open **Project Settings → API Keys**. Copy the **Project URL** and the **publishable** key (or the legacy **anon public** key) into `supabaseUrl` and `supabaseAnonKey` in `build.js`. Never use the **secret** or **service_role** key here; it would give anyone full access.
7. For "Forgot password?" emails, set **Authentication → URL Configuration → Site URL** to your live site address and add `https://your-domain.com/crm.html` under **Redirect URLs**.
8. Run `node build.js` and upload `site/` again.

Then send a test quote from the Contact page and sign in at `/crm.html`; the lead should be there.

**Email alerts (optional):** set `formEndpoint` in `build.js` to a Formspree form URL (or a Make/Zapier webhook) to get an email for every new quote request as well.

**Security notes:** website visitors can only *add* leads; they can't read, change or delete them. Only signed-in team members listed in `team_members` can see leads. The publishable/anon key is meant to be public, and these database rules are what protect your data.
