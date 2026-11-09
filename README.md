# TradeSite Studio website

A static website for an HVAC, plumbing and roofing web design studio. It has 6 public pages and a lead CRM.

## Edit
- **Business name, phone, email, hours:** the `SITE` object at the top of `build.js`
- **Page content:** `src/pages/*.html`
- **Styles:** `site/assets/styles.css` (colors and fonts are tokens at the top)
- **Chat assistant answers:** the `TOPICS` list in `site/assets/chat.js`. When a visitor taps "Talk to a person", their name, number and the full chat are saved as a lead marked **Chat** in the CRM.

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

## Client website questionnaire (`site/onboarding.html`)
A form you send to new clients. It collects their details, brand (logo, colors, style), services, page content, images (photo uploads or a folder link) and what they want their customers to see. Answers save as they go, so they can come back later on the same device.

- **Questions:** edit `site/assets/brief-questions.js`. The form, the review step, the team page and the Excel export all update from that one list.
- **Send it:** open `/briefs.html` (or "Client briefs" in the CRM), type the client's business, name and email, then **Copy link** or **Email it**. The link fills in their details for them. The plain link `https://your-domain.com/onboarding.html` works too. Open `briefs.html` from your live site (not by double-clicking the file), or set `QUESTIONNAIRE_URL` in `src/pages/briefs.html`, so the link works for clients.
- **See answers:** `/briefs.html` (same team login as the CRM) lists every submission with its images, a status (New, Reviewed, In progress, Done), and Print / Save as PDF.
- **Excel:** click **Export to Excel** on `/briefs.html`. You get an .xlsx with one row per client and one column per question, plus an "Images" sheet with a link to every uploaded photo (links work for 30 days; export again for fresh ones).

**Automatic Excel spreadsheet (optional):** every finished questionnaire can be added as a new row in an Excel file in your OneDrive, with one column per question. The website sends each answer set to a free connector (Make.com), which adds the row.
1. Upload `excel/Client briefs.xlsx` to your OneDrive (for example the Documents folder). Its columns already match the questionnaire, inside a table called **ClientBriefs**.
2. Create a free account at [make.com](https://www.make.com) and create a new scenario.
3. Add **Webhooks → Custom webhook**, click **Add**, name it "Client questionnaire", and copy the webhook address it gives you.
4. Paste that address into `sheetWebhook` in `build.js`, run `node build.js`, and upload `site/` again.
5. Back in Make, click **Redetermine data structure**, then send one test questionnaire from your live site so Make learns the fields.
6. Add a second module: **Microsoft 365 Excel → Add a Row to a Table**. Sign in with your Microsoft account, choose `Client briefs.xlsx`, the **Client briefs** worksheet and the **ClientBriefs** table. Each column then shows a box; pick the webhook field with the same name (they're named identically).
7. Turn the scenario **ON**. From then on every finished questionnaire appears as a new row within a minute or so.

Images stay in the database; the spreadsheet lists the file names. To see or download the images, use `/briefs.html`. Zapier ("Webhooks by Zapier" → "Microsoft Excel: Add Row") or Power Automate ("When an HTTP request is received" → "Add a row into a table") work the same way. If you add or rename questions, add a column with the same name to the spreadsheet table.

**Set up the database for it (once):** in Supabase **SQL Editor**, paste all of `supabase/add-client-briefs.sql` and click **Run**. This creates the `client_briefs` table and a private `client-uploads` image bucket. Clients can only send answers and upload images; only team members can see them. Until you run it, the questionnaire shows an error when a client presses Send.

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

**Database updates:** if your database was set up before the contact form had separate monthly plan and add-on choices, run `supabase/add-plan-addons.sql` once in the SQL Editor. Until you do, quote forms can't be saved.

**Email alerts (optional):** set `formEndpoint` in `build.js` to a Formspree form URL (or a Make/Zapier webhook) to get an email for every new quote request as well.

**Security notes:** website visitors can only *add* leads; they can't read, change or delete them. Only signed-in team members listed in `team_members` can see leads. The publishable/anon key is meant to be public, and these database rules are what protect your data.
