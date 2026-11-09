/*
 * Shadid Heat and Air — static site builder.   Run:  node build.js
 *
 * - Business details, tracking and CRM settings: the SITE object below.
 * - Service pages (5): the SERVICES list below (one template, five pages).
 * - Other pages: src/pages/*.html. The first line of each is a JSON comment
 *   with its title / description / nav key / breadcrumb / FAQs.
 * - Shared header, footer, mobile call bar and schema markup are in layout().
 * - Output goes to site/ (site/assets is hand-edited and never overwritten).
 *
 * Tokens available in page files:
 *   {{brand}} {{phone}} {{phoneHref}} {{smsHref}} {{email}} {{city}} {{address}}
 *   {{hours}} {{year}} {{rating}} {{reviewCount}} {{reviewsUrl}} {{writeReviewUrl}}
 *   {{mapEmbed}} {{icon:name}} {{quoteForm}} {{reviewCards}} {{serviceCards}}
 *   {{areaChips}} {{faq}} {{ctaBand}}
 */
const fs = require("fs");
const path = require("path");

/* ============================================================
 * 1. BUSINESS DETAILS  (confirm anything marked CONFIRM with the client)
 * ============================================================ */
const SITE = {
  brand: "Shadid Heat and Air",
  legalName: "Shadid Heat and Air",
  tagline: "Family-owned heating & air conditioning for Oklahoma City",
  url: "https://www.shadidheatandair.com", // CONFIRM: final domain
  phone: "(866) 227-8752",
  phoneHref: "+18662278752",
  // The number customers text. Toll-free numbers must be text-enabled (and
  // verified) with the carrier first. Leave "" to hide the Text buttons.
  smsNumber: "+18662278752",
  smsBody: "Hi Shadid Heat and Air, I'd like to schedule service.",
  email: "office@shadidheatandair.com", // CONFIRM
  street: "4907 NW 23rd St",
  city: "Oklahoma City",
  region: "OK",
  zip: "73127",
  geo: { lat: 35.4932, lng: -97.6107 }, // from the Google plus code F9VQ+7P
  // CONFIRM: Google shows "Opens 7 am". Closing time and weekend hours below are a guess.
  hours: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "07:00", closes: "18:00", label: "Mon–Fri 7am–6pm" },
    { days: ["Saturday"], opens: "08:00", closes: "12:00", label: "Sat 8am–12pm" }
  ],
  license: "OK Mechanical License #000000", // CONFIRM: real license number
  priceRange: "$$",
  // Google Business Profile
  rating: "4.8",
  reviewCount: "24",
  googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Shadid+Heat+and+Air+4907+NW+23rd+St+Oklahoma+City+OK+73127",
  googlePlaceId: "", // Paste the Place ID to make "Leave a review" open the review box directly
  social: [], // e.g. "https://www.facebook.com/shadidheatandair"

  /* ---------- Lead capture & CRM ---------- */
  // Every quote / booking request is POSTed as JSON to crmWebhook. Paste an
  // inbound webhook from GoHighLevel, HubSpot (via Zapier/Make), Jobber,
  // Housecall Pro (via Zapier) or any Make/Zapier scenario. See README.md.
  crmWebhook: "",
  // Optional second destination for an email alert, e.g. https://formspree.io/f/xxxx
  emailEndpoint: "",

  /* ---------- Call tracking ---------- */
  // Built-in dynamic number insertion: visitors from each source see that
  // source's tracking number everywhere on the site (stored for 30 days).
  // Get numbers from CallRail, CallTrackingMetrics, WhatConverts, etc.
  trackingNumbers: {
    googleAds: "",      // shown when the URL has gclid, or utm_source=google & utm_medium=cpc
    googleBusiness: "", // shown when the URL has utm_source=gbp (use this UTM on the GBP website link)
    facebook: "",       // shown when the URL has fbclid or utm_source=facebook
    other: ""           // any other utm_source
  },
  // Or paste your CallRail swap script URL to let CallRail do it instead
  // (e.g. "//cdn.callrail.com/companies/123456789/abcdef/12/swap.js").
  callRailScript: "",
  // Google Analytics 4 / Google Ads. Call, text and form events are sent as
  // phone_call_click, sms_click and generate_lead.
  ga4Id: "",        // e.g. "G-XXXXXXXXXX"
  googleAdsId: "",  // e.g. "AW-XXXXXXXXX"
  googleAdsLeadLabel: "" // conversion label for form leads
};

const AREAS = [
  { name: "Oklahoma City", note: "Our home base on NW 23rd — every neighborhood from Mesta Park to Quail Creek." },
  { name: "Bethany", note: "Minutes from our shop for fast repair visits." },
  { name: "Warr Acres", note: "Older homes, tight attics and duct upgrades are our everyday work." },
  { name: "Yukon", note: "AC repair, furnace service and full system replacements." },
  { name: "Mustang", note: "Tune-ups and new installs for growing neighborhoods." },
  { name: "Edmond", note: "Heating, cooling and ductwork for homes across Edmond." },
  { name: "The Village", note: "Service for mid-century homes and historic properties." },
  { name: "Nichols Hills", note: "Careful, clean work in historic homes with unique layouts." },
  { name: "Del City", note: "Repairs and replacements with upfront pricing." },
  { name: "Midwest City", note: "Furnace and AC service across Midwest City." },
  { name: "Moore", note: "Storm-season checkups, repairs and new systems." },
  { name: "Piedmont", note: "Service for acreages and newer builds." }
];

// Real Google reviews (shortened). Add more as they come in; keep them word-for-word.
const REVIEWS = [
  { name: "Angela K.", meta: "Local Guide · Google", when: "a year ago", text: "We have had our units serviced/replaced by Shadid Heat and Air for many years and the professionalism and quality has been consistently excellent time and time again. I cannot overstate how fantastic this company is!" },
  { name: "Mandy S.", meta: "Local Guide · Google", when: "3 years ago", text: "I can't say enough good about this company. They are down to earth, communicative, affordable, and honest people. You really cannot ask for more." },
  { name: "L. Miller", meta: "Google", when: "5 years ago", text: "They are truly beyond amazing! We live in a historical neighborhood and therefore have an extra amount of heating and ac needs. Clayton and Chase have been to our home numerous times over the past several years." }
];
const REVIEW_HIGHLIGHTS = [
  "They put in a new furnace/AC unit and ran all new duct work through my attic.",
  "Quick service, great communication, competitive pricing."
];

/* ============================================================
 * 2. SERVICE PAGES (5)
 * ============================================================ */
const SERVICES = [
  {
    slug: "ac-repair", nav: "AC Repair", icon: "snow", image: "technician",
    title: "AC Repair in Oklahoma City, OK",
    metaTitle: "AC Repair Oklahoma City, OK | Fast, Honest Air Conditioning Repair",
    description: "Air conditioner not cooling? Shadid Heat and Air repairs every make of AC in Oklahoma City, Bethany, Yukon and Edmond. Upfront pricing. Call or text to book.",
    lead: "When your AC quits in an Oklahoma July, you need someone who shows up, finds the real problem, and fixes it at a fair price. That's what we've done for OKC families for years.",
    short: "Warm air, strange noises or a unit that won't start — we diagnose it right and fix it fast.",
    signs: ["Blowing warm or weak air", "Unit runs but the house never cools", "Ice on the lines or outdoor unit", "Water leaking near the indoor unit", "Loud buzzing, grinding or clicking", "Breaker trips or the unit won't start"],
    includes: ["Full system diagnostic with a clear explanation", "Capacitor, contactor and fan motor replacement", "Refrigerant leak search and recharge", "Frozen coil and drain line repair", "Thermostat troubleshooting and replacement", "Honest repair-vs-replace advice — never a sales pitch"],
    faqs: [
      ["How much does AC repair cost in Oklahoma City?", "It depends on the part and the system. We charge a flat diagnostic fee and give you the exact repair price before any work starts, so there are no surprises."],
      ["Do you repair all brands?", "Yes. We service Trane, Carrier, Lennox, Goodman, Rheem, Amana, American Standard and nearly every other make of central air and heat pump."],
      ["Should I repair or replace my air conditioner?", "If your system is under 10–12 years old and the repair is modest, repair usually makes sense. If it's older, uses R-22 refrigerant, or needs a major part, we'll show you both options side by side and let you decide."]
    ]
  },
  {
    slug: "heating-repair", nav: "Furnace & Heating", icon: "flame", image: "tools",
    title: "Furnace & Heating Repair in Oklahoma City, OK",
    metaTitle: "Furnace Repair Oklahoma City, OK | Heating & Heat Pump Service",
    description: "No heat? Shadid Heat and Air repairs gas furnaces, heat pumps and electric heat across the Oklahoma City metro. Honest diagnosis and upfront pricing.",
    lead: "Oklahoma cold snaps hit fast. Whether it's a gas furnace that won't light or a heat pump stuck in defrost, our technicians get your heat back on safely.",
    short: "Gas furnaces, heat pumps and electric heat — safe, fast repairs when it turns cold.",
    signs: ["Furnace runs but blows cold air", "Pilot or igniter won't light", "Short cycling on and off", "Burning or gas smell (call right away)", "Rising utility bills", "Some rooms much colder than others"],
    includes: ["Igniter, flame sensor and gas valve repair", "Blower motor and limit switch replacement", "Heat pump defrost and reversing valve repair", "Carbon monoxide and heat exchanger safety check", "Thermostat and wiring repair", "Clear pricing before we start"],
    faqs: [
      ["What should I do if I smell gas?", "Leave the house, don't flip any switches, and call your gas utility or 911 from outside. Once it's safe, call us and we'll find and fix the source."],
      ["Do you work on heat pumps?", "Yes. We repair and replace air-source heat pumps and dual-fuel systems, which are common across the OKC metro."],
      ["How often should my furnace be serviced?", "Once a year, ideally in the fall. A tune-up catches worn parts before the first cold night and keeps your warranty valid."]
    ]
  },
  {
    slug: "hvac-installation", nav: "AC & Furnace Installation", icon: "home", image: "mechanical",
    title: "AC & Furnace Installation in Oklahoma City, OK",
    metaTitle: "HVAC Installation Oklahoma City, OK | New AC, Furnace & Heat Pump",
    description: "New air conditioner, furnace or heat pump installed right. Shadid Heat and Air sizes your system properly, installs it cleanly, and stands behind the work.",
    lead: "A new system is a big decision. We measure your home, size the equipment correctly, and give you clear options at different price points — then install it like it's our own house.",
    short: "Right-sized AC, furnace and heat pump systems, installed cleanly and backed by warranty.",
    signs: ["System is 12–15+ years old", "Repairs are adding up every season", "Uses R-22 (Freon) refrigerant", "Uneven temperatures room to room", "Utility bills keep climbing", "Planning a remodel or addition"],
    includes: ["In-home load calculation (not a rule-of-thumb guess)", "Good / better / best options with clear pricing", "Air conditioners, gas furnaces, heat pumps and dual-fuel", "Removal and disposal of your old equipment", "Permits, startup testing and thermostat setup", "Manufacturer and workmanship warranties"],
    faqs: [
      ["How long does a new AC or furnace install take?", "Most replacements are done in one day. Jobs that include new ductwork, like a full attic re-run, usually take two to three days."],
      ["What size system do I need?", "It depends on your home's square footage, insulation, windows and layout. We do a proper load calculation so you don't pay for a system that's too big or too small."],
      ["Do you offer free estimates on new systems?", "Yes. Estimates for system replacement are free. Book online or call and we'll come out, measure, and walk you through your options."]
    ]
  },
  {
    slug: "ductwork", nav: "Ductwork", icon: "wind", image: "home-bright",
    title: "Ductwork Repair & Replacement in Oklahoma City, OK",
    metaTitle: "Ductwork Repair & Replacement Oklahoma City, OK | Attic Duct Installation",
    description: "Leaky, crushed or undersized ducts waste money and leave rooms hot or cold. Shadid Heat and Air repairs, seals and replaces ductwork across the OKC metro.",
    lead: "Even a brand-new system can't keep up if the ducts are leaking into the attic. We find the leaks, fix the airflow, and re-run duct systems when it's time.",
    short: "Leaky or crushed ducts fixed, sealed or fully re-run so every room gets comfortable.",
    signs: ["Hot or cold rooms that never feel right", "Dust building up quickly", "Rattling or whistling vents", "Crushed, torn or disconnected ducts in the attic", "High bills even with a newer system", "Old metal or fabric ducts from the original build"],
    includes: ["Attic duct inspection with photos", "Duct sealing and reconnection", "Full duct replacement and re-runs", "New supply and return runs for additions", "Airflow balancing room by room", "Insulated flex and metal duct options"],
    faqs: [
      ["How do I know if my ducts need replacing?", "Signs include uneven temperatures, lots of dust, and ducts that are crushed or disconnected in the attic. We'll inspect them and send photos so you can see exactly what we see."],
      ["Can you replace ducts and the system at the same time?", "Yes, and it's often the best value. Many of our customers have us install a new furnace and AC and run all new ductwork through the attic in the same visit."],
      ["How long does ductwork last?", "Typically 15–25 years. In hot Oklahoma attics, flex duct can break down sooner, so it's worth checking if your home is older."]
    ]
  },
  {
    slug: "hvac-maintenance", nav: "Maintenance & Tune-Ups", icon: "wrench", image: "smart-home",
    title: "AC & Furnace Tune-Ups in Oklahoma City, OK",
    metaTitle: "HVAC Maintenance & Tune-Ups Oklahoma City, OK | AC & Furnace Checkups",
    description: "Seasonal AC and furnace tune-ups from Shadid Heat and Air. Catch problems early, lower your bills and keep your warranty valid. Serving the OKC metro.",
    lead: "Most breakdowns we see could have been caught at a tune-up. A spring AC check and a fall furnace check keep your system efficient and your family comfortable.",
    short: "Spring AC and fall furnace checkups that prevent breakdowns and lower bills.",
    signs: ["It's been over a year since the last service", "You're heading into summer or winter", "The system is noisier than it used to be", "Bills are higher than last year", "Your warranty requires yearly service", "You just bought the home"],
    includes: ["Coil, drain and filter check and cleaning", "Refrigerant and electrical tests", "Burner, igniter and flue safety inspection", "Carbon monoxide check", "Thermostat calibration", "A written report of anything that needs attention"],
    faqs: [
      ["When should I schedule a tune-up?", "Book your AC tune-up in spring (March–May) and your furnace tune-up in fall (September–November), before the busy season."],
      ["What's included in a tune-up?", "We clean, test and inspect the whole system — electrical, refrigerant, airflow, drains and safety controls — and give you a short report of what we found."],
      ["Do you offer a maintenance plan?", "Ask us about our yearly plan, which covers both seasonal visits on one simple schedule."]
    ]
  }
];

/* ============================================================
 * 3. ICONS (Lucide, 24px, stroke 2)
 * ============================================================ */
const ICONS = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  snow: '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  star: '<polygon fill="currentColor" stroke="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  google: '<path fill="currentColor" stroke="none" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"/>'
};
function icon(name, cls) {
  const body = ICONS[name];
  if (!body) throw new Error("Unknown icon: " + name);
  return `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ============================================================
 * 4. HELPERS
 * ============================================================ */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const YEAR = new Date().getFullYear();
const ADDRESS = `${SITE.street}, ${SITE.city}, ${SITE.region} ${SITE.zip}`;
const HOURS_LABEL = SITE.hours.map((h) => h.label).join(" · ");
const SMS_HREF = SITE.smsNumber ? `sms:${SITE.smsNumber}?&body=${encodeURIComponent(SITE.smsBody)}` : "";
const WRITE_REVIEW_URL = SITE.googlePlaceId
  ? `https://search.google.com/local/writereview?placeid=${SITE.googlePlaceId}`
  : SITE.googleMapsUrl;
const MAP_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(SITE.brand + ", " + ADDRESS)}&output=embed`;
const abs = (p) => SITE.url + "/" + (p === "index.html" ? "" : p);

const PUBLIC_CONFIG = {
  brand: SITE.brand,
  phone: SITE.phone,
  phoneHref: SITE.phoneHref,
  smsNumber: SITE.smsNumber,
  smsBody: SITE.smsBody,
  crmWebhook: SITE.crmWebhook,
  emailEndpoint: SITE.emailEndpoint,
  trackingNumbers: SITE.trackingNumbers,
  callRailScript: SITE.callRailScript,
  ga4Id: SITE.ga4Id,
  googleAdsId: SITE.googleAdsId,
  googleAdsLeadLabel: SITE.googleAdsLeadLabel
};

const stars = (n = 5) => `<span class="stars" aria-hidden="true">${icon("star").repeat(n)}</span>`;

function phoneLink(cls, label) {
  return `<a class="${cls}" href="tel:${SITE.phoneHref}" data-phone-link data-track="call">${icon("phone")}<span>${label || `<span data-phone-text>${SITE.phone}</span>`}</span></a>`;
}
function smsLink(cls, label) {
  if (!SMS_HREF) return "";
  return `<a class="${cls}" href="${SMS_HREF}" data-sms-link data-track="sms">${icon("message")}<span>${label || "Text us"}</span></a>`;
}

/* ---------- Reusable blocks ---------- */
function quoteForm(opts = {}) {
  const compact = !!opts.compact;
  const id = opts.id || (compact ? "qf" : "lead");
  const serviceOpts = SERVICES.map((s) => `<option${opts.service === s.nav ? " selected" : ""}>${esc(s.nav)}</option>`).join("") + `<option>Not sure / something else</option>`;
  const field = (name, label, input, help, required = true) => `
      <div class="field" data-field="${name}">
        <label for="${id}-${name}">${label}${required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(optional)</span>'}</label>
        ${input}
        ${help ? `<p class="help" id="${id}-${name}-help">${help}</p>` : ""}
        <p class="error" id="${id}-${name}-err" hidden></p>
      </div>`;
  const describe = (name, help) => `aria-describedby="${help ? `${id}-${name}-help ` : ""}${id}-${name}-err"`;

  const typeToggle = compact ? `<input type="hidden" name="requestType" value="Estimate">` : `
      <fieldset class="seg" data-request-toggle>
        <legend class="sr-only">What do you need?</legend>
        <label class="seg__opt"><input type="radio" name="requestType" value="Estimate" checked><span>${icon("clipboard")}Free estimate</span></label>
        <label class="seg__opt"><input type="radio" name="requestType" value="Service visit"><span>${icon("calendar")}Book a service visit</span></label>
      </fieldset>`;

  const fullFields = compact ? "" : `
      ${field("email", "Email", `<input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" ${describe("email")}>`, "", false)}
      ${field("address", "Service address", `<input id="${id}-address" name="address" type="text" autocomplete="street-address" ${describe("address")}>`, "", false)}
      <div class="booking-only" data-booking-only hidden>
        <div class="field-row">
          ${field("date", "Preferred day", `<input id="${id}-date" name="preferredDate" type="date" ${describe("date")}>`, "", false)}
          ${field("time", "Time window", `<select id="${id}-time" name="preferredTime" ${describe("time")}><option value="">Any time</option><option>Morning (7–10am)</option><option>Midday (10am–1pm)</option><option>Afternoon (1–5pm)</option></select>`, "", false)}
        </div>
        <p class="help">We'll call or text to confirm the exact arrival window.</p>
      </div>
      ${field("system", "System type", `<select id="${id}-system" name="system" ${describe("system")}><option value="">Not sure</option><option>Central AC + gas furnace</option><option>Heat pump</option><option>Dual fuel</option><option>Ductless mini-split</option><option>Other</option></select>`, "", false)}
      ${field("message", "What's going on?", `<textarea id="${id}-message" name="message" rows="4" ${describe("message", true)}></textarea>`, "A few words help us bring the right parts — e.g. “AC blowing warm air since yesterday.”", false)}
      <fieldset class="field contact-pref">
        <legend>Best way to reach you</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="contactPref" value="Call" checked><span>Call</span></label>
          <label class="chip"><input type="radio" name="contactPref" value="Text"><span>Text</span></label>
          <label class="chip"><input type="radio" name="contactPref" value="Email"><span>Email</span></label>
        </div>
      </fieldset>`;

  return `
  <form class="lead-form${compact ? " lead-form--compact" : ""}" data-lead-form novalidate>
    <div class="form-summary" role="alert" tabindex="-1" hidden></div>
    ${typeToggle}
    <div class="${compact ? "" : "field-row"}">
      ${field("name", "Your name", `<input id="${id}-name" name="name" type="text" autocomplete="name" required ${describe("name")}>`)}
      ${field("phone", "Phone", `<input id="${id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required ${describe("phone")}>`)}
    </div>
    <div class="${compact ? "" : "field-row"}">
      ${field("service", "Service needed", `<select id="${id}-service" name="service" required ${describe("service")}><option value="">Choose one…</option>${serviceOpts}</select>`)}
      ${field("zip", "ZIP code", `<input id="${id}-zip" name="zip" type="text" autocomplete="postal-code" inputmode="numeric" maxlength="5" required ${describe("zip")}>`)}
    </div>
    ${fullFields}
    <label class="consent"><input type="checkbox" name="smsConsent" value="yes"><span>OK to text me about this request. Msg &amp; data rates may apply. Reply STOP to opt out.</span></label>
    <input type="text" name="company_website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn--accent btn--lg btn--block" type="submit">
      <span class="btn__label">${compact ? "Get my free estimate" : "Send my request"}</span>${icon("arrow")}
    </button>
    <p class="form-note">${icon("shield")} No spam, no obligation. We reply within 1 business hour during open hours.</p>
  </form>`;
}

function reviewCards(list = REVIEWS) {
  return `<div class="reviews-grid">${list.map((r) => `
    <figure class="review-card">
      <div class="review-card__top">${stars()}<span class="review-card__src">${icon("google")}<span class="sr-only">Google review</span></span></div>
      <blockquote><p>“${esc(r.text)}”</p></blockquote>
      <figcaption><span class="avatar" aria-hidden="true">${esc(r.name[0])}</span><span><strong>${esc(r.name)}</strong><small>${esc(r.meta)} · ${esc(r.when)}</small></span></figcaption>
    </figure>`).join("")}
  </div>`;
}

function ratingBadge(dark) {
  return `<a class="rating${dark ? " rating--dark" : ""}" href="${SITE.googleMapsUrl}" target="_blank" rel="noopener">
    ${icon("google", "rating__g")}<span class="rating__num">${SITE.rating}</span>${stars()}<span class="rating__count">${SITE.reviewCount} Google reviews</span>
  </a>`;
}

function serviceCards() {
  return `<div class="svc-grid">${SERVICES.map((s) => `
    <a class="svc-card" href="${s.slug}.html">
      <span class="svc-card__icon">${icon(s.icon)}</span>
      <h3>${esc(s.nav)}</h3>
      <p>${esc(s.short)}</p>
      <span class="svc-card__more">Learn more ${icon("arrow")}</span>
    </a>`).join("")}
    <a class="svc-card svc-card--cta" href="contact.html">
      <span class="svc-card__icon">${icon("clipboard")}</span>
      <h3>Not sure what you need?</h3>
      <p>Tell us what's happening and we'll point you to the right fix — no charge for advice.</p>
      <span class="svc-card__more">Request an estimate ${icon("arrow")}</span>
    </a>
  </div>`;
}

function areaChips() {
  return `<ul class="area-chips">${AREAS.map((a) => `<li>${icon("pin")}${esc(a.name)}</li>`).join("")}</ul>`;
}

function faqBlock(faqs) {
  return `<div class="faq">${faqs.map(([q, a]) => `
    <details class="faq__item"><summary><span>${esc(q)}</span>${icon("chevron")}</summary><div class="faq__a"><p>${esc(a)}</p></div></details>`).join("")}
  </div>`;
}

function ctaBand() {
  return `
  <section class="cta-band" aria-labelledby="cta-band-h">
    <div class="container cta-band__inner">
      <div>
        <h2 id="cta-band-h">Too hot? Too cold? Let's fix it today.</h2>
        <p>Call, text or book online — a real person from our family business will get back to you fast.</p>
      </div>
      <div class="cta-band__actions">
        ${phoneLink("btn btn--accent btn--lg")}
        <a class="btn btn--ghost-light btn--lg" href="contact.html">${icon("calendar")}<span>Book online</span></a>
      </div>
    </div>
  </section>`;
}

/* ============================================================
 * 5. SCHEMA (JSON-LD)
 * ============================================================ */
const BUSINESS_ID = SITE.url + "/#business";
function businessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HVACBusiness",
    "@id": BUSINESS_ID,
    name: SITE.brand,
    legalName: SITE.legalName,
    description: SITE.tagline + ". AC repair, furnace repair, system installation, ductwork and maintenance.",
    url: SITE.url + "/",
    telephone: SITE.phoneHref,
    email: SITE.email,
    image: SITE.url + "/assets/img/technician.webp",
    logo: SITE.url + "/assets/logo.svg",
    priceRange: SITE.priceRange,
    address: { "@type": "PostalAddress", streetAddress: SITE.street, addressLocality: SITE.city, addressRegion: SITE.region, postalCode: SITE.zip, addressCountry: "US" },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    hasMap: SITE.googleMapsUrl,
    openingHoursSpecification: SITE.hours.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.days, opens: h.opens, closes: h.closes })),
    areaServed: AREAS.map((a) => ({ "@type": "City", name: `${a.name}, ${SITE.region}` })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Heating & Air Conditioning Services",
      itemListElement: SERVICES.map((s) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: s.nav, url: abs(s.slug + ".html") } }))
    },
    ...(SITE.social.length ? { sameAs: SITE.social } : {})
  };
}
function breadcrumbSchema(trail) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: abs(t.href) }))
  };
}
function faqSchema(faqs) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
}
function serviceSchema(s) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: s.nav,
    name: s.title,
    description: s.description,
    url: abs(s.slug + ".html"),
    provider: { "@id": BUSINESS_ID },
    areaServed: AREAS.map((a) => ({ "@type": "City", name: `${a.name}, ${SITE.region}` }))
  };
}
const ldjson = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

/* ============================================================
 * 6. LAYOUT
 * ============================================================ */
const NAV = [
  { key: "services", label: "Services", href: "services.html", children: SERVICES.map((s) => ({ key: s.slug, label: s.nav, href: s.slug + ".html" })) },
  { key: "areas", label: "Service Areas", href: "service-areas.html" },
  { key: "reviews", label: "Reviews", href: "reviews.html" },
  { key: "gallery", label: "Our Work", href: "gallery.html" },
  { key: "about", label: "About", href: "about.html" },
  { key: "contact", label: "Contact", href: "contact.html" }
];

function logo() {
  return `<a class="logo" href="index.html" aria-label="${esc(SITE.brand)} — home">
    <img src="assets/logo.svg" width="40" height="40" alt="">
    <span class="logo__text"><strong>Shadid</strong><small>Heat &amp; Air</small></span>
  </a>`;
}

function header(active) {
  const isActive = (item) => item.key === active || (item.children || []).some((c) => c.key === active);
  const items = NAV.map((item) => {
    const cur = isActive(item) ? ' aria-current="page"' : "";
    if (!item.children) return `<li><a href="${item.href}"${cur}>${item.label}</a></li>`;
    return `<li class="has-sub">
        <a href="${item.href}"${cur}>${item.label}</a>
        <button class="sub-toggle" type="button" aria-expanded="false" aria-label="Show ${item.label} menu">${icon("chevron")}</button>
        <ul class="sub">${item.children.map((c) => `<li><a href="${c.href}"${c.key === active ? ' aria-current="page"' : ""}>${c.label}</a></li>`).join("")}</ul>
      </li>`;
  }).join("");

  return `
  <a class="skip" href="#main">Skip to main content</a>
  <div class="topbar">
    <div class="container topbar__inner">
      <span>${icon("pin")}Family-owned · Serving the Oklahoma City metro</span>
      <span>${icon("clock")}${esc(HOURS_LABEL)}</span>
      <a href="${SITE.googleMapsUrl}" target="_blank" rel="noopener">${stars()}<span>${SITE.rating} on Google</span></a>
    </div>
  </div>
  <header class="site-header" data-header>
    <div class="container site-header__inner">
      ${logo()}
      <nav class="nav" id="site-nav" aria-label="Main">
        <ul class="nav__list">${items}</ul>
        <div class="nav__mobile-cta">
          ${phoneLink("btn btn--primary btn--block", `Call <span data-phone-text>${SITE.phone}</span>`)}
          ${smsLink("btn btn--outline btn--block", "Text us")}
          <a class="btn btn--accent btn--block" href="contact.html">Get a free estimate</a>
        </div>
      </nav>
      <div class="header-cta">
        ${phoneLink("header-phone", `<small>Call or text</small><strong data-phone-text>${SITE.phone}</strong>`)}
        <a class="btn btn--accent" href="contact.html">Free estimate</a>
      </div>
      <button class="menu-btn" type="button" aria-controls="site-nav" aria-expanded="false" data-menu-btn>
        ${icon("menu", "menu-btn__open")}${icon("x", "menu-btn__close")}<span class="sr-only">Menu</span>
      </button>
    </div>
  </header>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        ${logo()}
        <p>${esc(SITE.tagline)}. Honest repairs, clean installs and fair prices from people who pick up the phone.</p>
        ${ratingBadge(true)}
      </div>
      <div>
        <h2 class="footer-h">Services</h2>
        <ul class="footer-links">${SERVICES.map((s) => `<li><a href="${s.slug}.html">${s.nav}</a></li>`).join("")}</ul>
      </div>
      <div>
        <h2 class="footer-h">Company</h2>
        <ul class="footer-links">
          <li><a href="about.html">About us</a></li>
          <li><a href="reviews.html">Reviews</a></li>
          <li><a href="gallery.html">Our work</a></li>
          <li><a href="service-areas.html">Service areas</a></li>
          <li><a href="contact.html">Book service</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer-h">Contact</h2>
        <address class="nap">
          <strong>${esc(SITE.brand)}</strong><br>
          <a href="${SITE.googleMapsUrl}" target="_blank" rel="noopener">${esc(SITE.street)}<br>${esc(SITE.city)}, ${SITE.region} ${SITE.zip}</a><br>
          <a href="tel:${SITE.phoneHref}" data-phone-link data-track="call"><span data-phone-text>${SITE.phone}</span></a><br>
          <a href="mailto:${SITE.email}">${esc(SITE.email)}</a>
        </address>
        <p class="footer-hours">${SITE.hours.map((h) => esc(h.label)).join("<br>")}</p>
      </div>
    </div>
    <div class="container footer-areas">
      <h2 class="footer-h">Proudly serving</h2>
      <p>${AREAS.map((a) => esc(a.name)).join(" · ")}</p>
    </div>
    <div class="container footer-bottom">
      <p>© ${YEAR} ${esc(SITE.legalName)}. All rights reserved. ${esc(SITE.license)}.</p>
      <p><a href="sitemap.xml">Sitemap</a></p>
    </div>
  </footer>
  <div class="callbar" role="navigation" aria-label="Quick contact">
    ${phoneLink("callbar__btn callbar__btn--call", "Call")}
    ${smsLink("callbar__btn", "Text")}
    <a class="callbar__btn callbar__btn--quote" href="contact.html">${icon("clipboard")}<span>Estimate</span></a>
  </div>`;
}

function breadcrumbs(trail) {
  if (trail.length < 2) return "";
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail.map((t, i) => i === trail.length - 1
    ? `<li aria-current="page">${esc(t.name)}</li>`
    : `<li><a href="${t.href}">${esc(t.name)}</a></li>`).join("")}</ol></nav>`;
}

function layout({ file, title, description, nav, body, trail = [], schemas = [], noindex = false, image = "technician" }) {
  const canonical = abs(file);
  const all = [businessSchema(), ...(trail.length > 1 ? [breadcrumbSchema(trail)] : []), ...schemas];
  if (file === "index.html") all.push({ "@context": "https://schema.org", "@type": "WebSite", name: SITE.brand, url: SITE.url + "/" });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
  <meta name="theme-color" content="#0b2545">
  <meta name="geo.region" content="US-${SITE.region}">
  <meta name="geo.placename" content="${esc(SITE.city)}">
  <meta name="geo.position" content="${SITE.geo.lat};${SITE.geo.lng}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE.brand)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${SITE.url}/assets/img/${image}.webp">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
  <link rel="stylesheet" href="assets/styles.css">
  ${all.map(ldjson).join("\n  ")}
  <script>window.SITE_CONFIG=${JSON.stringify(PUBLIC_CONFIG)};</script>
  <script src="assets/site.js" defer></script>
</head>
<body>
${header(nav)}
<main id="main" tabindex="-1">
${breadcrumbs(trail)}
${body}
</main>
${footer()}
</body>
</html>
`;
}

/* ============================================================
 * 7. TOKENS + BUILD
 * ============================================================ */
function fill(html, extra = {}) {
  const map = {
    brand: esc(SITE.brand), phone: SITE.phone, phoneHref: SITE.phoneHref, smsHref: SMS_HREF, email: SITE.email,
    city: SITE.city, address: esc(ADDRESS), hours: esc(HOURS_LABEL), year: YEAR, rating: SITE.rating,
    reviewCount: SITE.reviewCount, reviewsUrl: SITE.googleMapsUrl, writeReviewUrl: WRITE_REVIEW_URL, mapEmbed: MAP_EMBED,
    quoteForm: quoteForm(), quoteFormCompact: quoteForm({ compact: true }), reviewCards: reviewCards(),
    serviceCards: serviceCards(), areaChips: areaChips(), ctaBand: ctaBand(), ratingBadge: ratingBadge(),
    ratingBadgeDark: ratingBadge(true), phoneBtn: phoneLink("btn btn--accent btn--lg"),
    phoneBtnLight: phoneLink("btn btn--outline btn--lg"), smsBtn: smsLink("btn btn--outline btn--lg"),
    smsBtnDark: smsLink("btn btn--ghost-light btn--lg"),
    reviewHighlights: REVIEW_HIGHLIGHTS.map((t) => `<li>${icon("quote")}<span>“${esc(t)}”</span></li>`).join(""),
    areaCards: AREAS.map((a) => `<article class="area-card"><h3>${icon("pin")}${esc(a.name)}, ${SITE.region}</h3><p>${esc(a.note)}</p></article>`).join(""),
    hoursList: SITE.hours.map((h) => `<li>${esc(h.label)}</li>`).join(""),
    ...extra
  };
  return html
    .replace(/\{\{icon:([\w-]+)\}\}/g, (_, n) => icon(n))
    .replace(/\{\{faq:(\w+)\}\}/g, (_, k) => faqBlock(extra.faqs || []))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? String(map[k]) : m));
}

function servicePage(s) {
  const others = SERVICES.filter((o) => o.slug !== s.slug);
  return `
<section class="page-hero page-hero--service">
  <div class="container page-hero__grid">
    <div>
      <p class="eyebrow eyebrow--light">${icon(s.icon)} ${esc(s.nav)} · ${esc(SITE.city)} metro</p>
      <h1>${esc(s.title)}</h1>
      <p class="lead">${esc(s.lead)}</p>
      <div class="hero__actions">
        ${phoneLink("btn btn--accent btn--lg", `Call <span data-phone-text>${SITE.phone}</span>`)}
        ${smsLink("btn btn--ghost-light btn--lg")}
      </div>
      ${ratingBadge(true)}
    </div>
    <aside class="form-card" aria-labelledby="svc-form-h">
      <h2 id="svc-form-h">Get a free estimate</h2>
      <p class="form-card__sub">Takes 30 seconds. We'll call or text you back fast.</p>
      ${quoteForm({ compact: true, service: s.nav, id: "sq" })}
    </aside>
  </div>
</section>

<section class="section">
  <div class="container split">
    <div>
      <p class="eyebrow">Warning signs</p>
      <h2>Do you need ${esc(s.nav.toLowerCase())}?</h2>
      <p class="muted">If you notice any of these, it's time to call. Catching problems early almost always costs less.</p>
      <ul class="checklist checklist--warn">${s.signs.map((x) => `<li>${icon("check-circle")}${esc(x)}</li>`).join("")}</ul>
    </div>
    <figure class="photo photo--tall">
      <img src="assets/img/${s.image}.webp" alt="${esc(s.nav)} by ${esc(SITE.brand)} in ${esc(SITE.city)}" loading="lazy" decoding="async" width="900" height="1100">
    </figure>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">What's included</p>
      <h2>How we handle ${esc(s.nav.toLowerCase())}</h2>
    </div>
    <ul class="feature-grid">${s.includes.map((x) => `<li class="feature">${icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul>
    <div class="steps">
      <div class="step"><span class="step__n">1</span><h3>Call, text or book</h3><p>Tell us what's happening. We'll give you an arrival window and call ahead.</p></div>
      <div class="step"><span class="step__n">2</span><h3>Honest diagnosis</h3><p>We find the real cause and give you the price before any work begins.</p></div>
      <div class="step"><span class="step__n">3</span><h3>Fixed right</h3><p>Clean, careful work — and we don't leave until you're comfortable.</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head section-head--row">
      <div><p class="eyebrow">Reviews</p><h2>What OKC homeowners say</h2></div>
      ${ratingBadge()}
    </div>
    ${reviewCards()}
  </div>
</section>

<section class="section section--tint">
  <div class="container split split--top">
    <div>
      <p class="eyebrow">FAQ</p>
      <h2>${esc(s.nav)} questions</h2>
      ${faqBlock(s.faqs)}
    </div>
    <div class="side-stack">
      <div class="info-card">
        <h3>${icon("pin")} Areas we serve</h3>
        <p class="muted">${esc(s.nav)} across the Oklahoma City metro, including:</p>
        ${areaChips()}
        <a class="link-arrow" href="service-areas.html">See all service areas ${icon("arrow")}</a>
      </div>
      <div class="info-card">
        <h3>${icon("wrench")} Other services</h3>
        <ul class="link-list">${others.map((o) => `<li><a href="${o.slug}.html">${esc(o.nav)} ${icon("arrow")}</a></li>`).join("")}</ul>
      </div>
    </div>
  </div>
</section>
${ctaBand()}`;
}

function build() {
  const out = path.join(__dirname, "site");
  const pagesDir = path.join(__dirname, "src", "pages");
  const built = [];

  for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith(".html"))) {
    const raw = fs.readFileSync(path.join(pagesDir, f), "utf8");
    const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
    if (!m) throw new Error(`${f}: missing JSON header comment`);
    const meta = JSON.parse(m[1]);
    const faqs = meta.faqs || [];
    const body = fill(raw.slice(m[0].length), { faqs });
    const trail = meta.crumb ? [{ name: "Home", href: "index.html" }, { name: meta.crumb, href: f }] : [];
    const schemas = faqs.length ? [faqSchema(faqs)] : [];
    fs.writeFileSync(path.join(out, f), layout({ file: f, title: meta.title, description: meta.description, nav: meta.nav, body, trail, schemas, noindex: !!meta.noindex, image: meta.image }));
    if (!meta.noindex) built.push(f);
  }

  for (const s of SERVICES) {
    const f = s.slug + ".html";
    const trail = [{ name: "Home", href: "index.html" }, { name: "Services", href: "services.html" }, { name: s.nav, href: f }];
    fs.writeFileSync(path.join(out, f), layout({
      file: f, title: s.metaTitle.split(" | ")[0] + " | " + SITE.brand, description: s.description, nav: s.slug,
      body: servicePage(s), trail, schemas: [serviceSchema(s), faqSchema(s.faqs)], image: s.image
    }));
    built.push(f);
  }

  // sitemap.xml + robots.txt
  const today = new Date().toISOString().slice(0, 10);
  const order = (f) => (f === "index.html" ? 0 : f === "contact.html" ? 1 : SERVICES.some((s) => s.slug + ".html" === f) ? 2 : 3);
  built.sort((a, b) => order(a) - order(b));
  fs.writeFileSync(path.join(out, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${built.map((f) => `  <url><loc>${abs(f)}</loc><lastmod>${today}</lastmod><priority>${f === "index.html" ? "1.0" : order(f) < 3 ? "0.9" : "0.7"}</priority></url>`).join("\n")}
</urlset>
`);
  fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /thank-you.html\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
  console.log(`Built ${built.length} indexable pages (+ utility pages) into site/`);
}

build();
