# Shadid Heat and Air — website

A 12-page, mobile-first lead generation site for **Shadid Heat and Air**, 4907 NW 23rd St, Oklahoma City, OK 73127.

| Core (5) | Services (5) | Area + gallery (2) |
|---|---|---|
| Home `index.html` | AC Repair `ac-repair.html` | Service Areas `service-areas.html` |
| About `about.html` | Furnace & Heating `heating-repair.html` | Our Work `gallery.html` |
| Services `services.html` | AC & Furnace Installation `hvac-installation.html` | |
| Reviews `reviews.html` | Ductwork `ductwork.html` | |
| Contact / Book `contact.html` | Maintenance & Tune-Ups `hvac-maintenance.html` | |

There's also a `thank-you.html` page, used as the conversion page and hidden from Google, and a `404.html` page.

## Build & preview
```bash
node build.js
```
```bash
node serve.js
```
Open http://localhost:5175. Edit `build.js` and `src/pages/*.html` only. `site/*.html` is generated. `site/assets/` (CSS, JS, images) is edited by hand.

## Deploy
Upload the `site/` folder to Netlify, Cloudflare Pages or Vercel. Point the domain at it, then set `url` in `build.js` to the live domain and rebuild, because canonical tags, the sitemap and the schema all use it.

## What's included (package checklist)
- **Mobile-first design:** sticky Call / Text / Estimate bar on phones and a full-screen menu. Tested at 375px with no sideways scrolling.
- **Click-to-call and text buttons:** in the header, the hero, every page and the mobile bar. The text message is pre-filled.
- **Quote form:** a short form on Home, every service page and Gallery, plus the full form on Contact. It has inline validation, an error summary, spam protection and an SMS consent checkbox.
- **Estimate or booking request:** the Contact form switches between *Free estimate* and *Book a service visit* (preferred day + time window). Link straight to booking with `contact.html?type=booking`.
- **Review section:** real Google reviews and the 4.8★ / 24-review badge on Home, About, every service page and the Reviews page. A **Leave a review** button sends customers to Google.
- **Call tracking:** see below.
- **Schema markup:**
  - Every page: `HVACBusiness` (address, geo, hours, service areas, service catalog) and `BreadcrumbList`.
  - Service pages: `Service` and `FAQPage`.
  - Home, Contact and Service Areas: `FAQPage`.
  - Home: `WebSite`.
  - Star-rating schema is left out on purpose: Google doesn't show stars for a business's reviews of itself, and adding it risks a manual penalty.
- **Basic local SEO:**
  - A unique title and description on every page, with the city in it.
  - Canonical tags, Open Graph tags and geo meta tags.
  - The name, address and phone in the footer of every page.
  - City cards on Service Areas and a Google Map on Contact and Service Areas.
  - Internal links between services and areas, plus `sitemap.xml` and `robots.txt`.
- **CRM connection:** see below.
- **Google Business Profile setup:** see [docs/google-business-profile.md](docs/google-business-profile.md).
- **5 revision rounds:** tracked in the log at the bottom of this file.

## CRM connection
Every form submission is sent as JSON to `crmWebhook` in `build.js`. It includes the name, phone, email, address, ZIP, service, system type, request type, preferred date and time, message, contact preference, SMS consent, page, and source tracking (channel, UTM tags, gclid, landing page, tracking number shown).

1. In the client's CRM, create an inbound webhook:
   - **GoHighLevel:** Automation → Workflow → *Inbound Webhook* trigger.
   - **HubSpot, Jobber, Housecall Pro, ServiceTitan:** a Zapier or Make scenario (*Webhooks → Catch Hook* → *Create contact / request*).
2. Paste the URL into `crmWebhook`, then run `node build.js`.
3. Send one test request from the live site so the CRM learns the fields, then map them.
4. Optional: put a Formspree URL in `emailEndpoint` to also get an email for every lead.

Until `crmWebhook` is set, the site runs in **demo mode**. Leads are only saved in that browser (`localStorage`, key `sha_demo_leads`), and the thank-you page shows a demo notice when you're on localhost. **Set the webhook before launch.**

## Call tracking
**Built in (default).** Put tracking numbers from CallRail, CallTrackingMetrics, etc. into `trackingNumbers` in `build.js`. Visitors from each source see that source's number on every page for 30 days:

| Source | When it's used |
|---|---|
| `googleAds` | The URL has `gclid`, or `utm_source=google&utm_medium=cpc` |
| `googleBusiness` | The URL has `utm_source=gbp`. Set the GBP website link to `https://www.shadidheatandair.com/?utm_source=gbp&utm_medium=organic&utm_campaign=gbp-listing` |
| `facebook` | The URL has `fbclid` or `utm_source=facebook` |
| `other` | Any other `utm_source` |

Everyone else sees the main number.

**CallRail instead:** paste the swap script URL into `callRailScript`. The built-in swap then switches off.

**Analytics:** set `ga4Id` and, optionally, `googleAdsId` + `googleAdsLeadLabel`. The site sends these events:
- `phone_call_click` (with where on the page it was tapped)
- `sms_click`
- `form_start`
- `generate_lead`

Mark `generate_lead` and `phone_call_click` as key events (conversions) in GA4.

## Confirm with the client before launch
- [ ] Domain (`url`) and email address (`email`)
- [ ] Hours. Google only shows "Opens 7 am"; Mon–Fri 7–6 and Sat 8–12 are placeholders.
- [ ] Oklahoma mechanical license number (`license`)
- [ ] Whether the 866 number can receive texts. If not, add a text-enabled local 405 number to `smsNumber`, or set it to `""` to hide the Text buttons.
- [ ] Claims used in the copy:
  - Licensed & insured
  - Free estimates on replacements and ductwork, and a flat diagnostic fee for repairs
  - Replies within 1 business hour
  - Brands serviced
  - Warranties
  - A yearly maintenance plan
- [ ] Service-area cities
- [ ] **Photos.** The current images are free stock placeholders from Unsplash, and none of them shows HVAC work. Replace them in `site/assets/img/` (same file names, `.webp`, ~1200px wide) with the client's own job, truck and team photos. Their Google profile already has some. Real photos convert noticeably better.
- [ ] Google Place ID (`googlePlaceId`), so **Leave a review** opens the review box directly
- [ ] Logo. `site/assets/logo.svg` is a placeholder mark.

## Revision rounds (5 included)
| Round | Date | Requested changes | Done |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
