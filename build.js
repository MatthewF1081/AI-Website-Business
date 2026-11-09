/*
 * Static site builder. Run:  node build.js
 *
 * - Edit business details in SITE below (name, phone, email, etc.).
 * - Page content lives in src/pages/*.html. The first line of each page is a
 *   JSON comment with its title/description/nav key.
 * - Shared header, footer and mobile call bar are defined once in layout().
 * - Output is written to site/ (assets live in site/assets/ and are not touched).
 *
 * Tokens available in page files:
 *   {{favicon}} -> the browser tab icon (for standalone pages)
 *   {{brand}} {{phone}} {{phoneHref}} {{sms}} {{email}} {{city}} {{year}}
 *   {{config}} -> public settings as JSON (for window.SITE_CONFIG)
 *   {{icon:name}}  -> inline SVG from ICONS
 */
const fs = require("fs");
const path = require("path");

const SITE = {
  brand: "TradeSite Studio",
  tagline: "Websites that make the phone ring for HVAC, plumbing & roofing pros.",
  phone: "(555) 010-2468",
  phoneHref: "+15550102468",
  email: "hello@tradesite.example",
  city: "Serving contractors nationwide",
  hours: "Mon–Fri, 8am–6pm",
  url: "https://www.tradesite.example",
  // Lead database (see supabase/schema.sql and README.md). From Supabase >
  // Project Settings > API Keys: the Project URL and the publishable / anon
  // public key. Both are safe to put in a website; never use the secret or
  // service_role key here. Leave empty to keep leads in this browser only.
  supabaseUrl: "https://mvgxflrqmlswrwwjuwdt.supabase.co",
  supabaseAnonKey: "sb_publishable_R8dMPd5W5AjCzkJliAG2Cg_KiBfMbNO",
  // Optional: also POST each quote request here (e.g. a Formspree form) to get
  // an email notification for every new lead.
  formEndpoint: "",
  // Optional: a webhook URL from Make, Zapier or Power Automate. Every finished
  // client questionnaire is POSTed here as one row (one field per question), so
  // the connector can add it to an Excel spreadsheet. See README.md.
  sheetWebhook: "https://hook.eu1.make.com/er1llb4s9eq1ipmqa1rt9l5yrxqlvbe5"
};

const PUBLIC_CONFIG = {
  brand: SITE.brand,
  phone: SITE.phone,
  phoneHref: SITE.phoneHref,
  hours: SITE.hours,
  supabaseUrl: SITE.supabaseUrl.replace(/\/+$/, ""),
  supabaseAnonKey: SITE.supabaseAnonKey,
  formEndpoint: SITE.formEndpoint,
  sheetWebhook: SITE.sheetWebhook
};

const ICONS = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  thermometer: '<path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  roof: '<path d="m2 12 10-8 10 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  logo: '<path d="M3 11 12 4l9 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<polygon fill="currentColor" stroke="none" points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>',
  dollar: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  "phone-missed": '<line x1="22" x2="16" y1="2" y2="8"/><line x1="16" x2="22" y1="2" y2="8"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
  list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  "left-right": '<path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  sheet: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M12 11v8"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'
};

// Browser tab icon, shared by every page (standalone pages use {{favicon}}).
const FAVICON = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#3b1812"/><g transform="translate(4 4)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + ICONS.logo + "</g></svg>");

function icon(name) {
  if (!ICONS[name]) throw new Error("Unknown icon: " + name);
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + "</svg>";
}

const NAV = [
  { key: "home", href: "index.html", label: "Home" },
  { key: "services", href: "services.html", label: "Services & Pricing" },
  { key: "process", href: "process.html", label: "How It Works" },
  { key: "about", href: "about.html", label: "About" },
  { key: "faq", href: "faq.html", label: "FAQ" },
  { key: "contact", href: "contact.html", label: "Contact" }
];

function fill(str) {
  return str
    .replace(/\{\{icon:([a-z-]+)\}\}/g, (_, n) => icon(n))
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k === "year" ? String(new Date().getFullYear()) : k === "sms" ? "sms:" + SITE.phoneHref : k === "config" ? JSON.stringify(PUBLIC_CONFIG) : k === "favicon" ? FAVICON : SITE[k] !== undefined ? SITE[k] : m));
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Prices used in the structured data. Keep these in step with src/pages/services.html.
const PRICING = {
  packages: [
    { name: "Starter website package", price: 997, description: "About 5 pages, mobile-first design, click-to-call and text buttons, quote form, Google Business Profile setup and basic on-page SEO." },
    { name: "Standard website package", price: 1997, description: "About 10 pages with Google reviews on the site, an estimate or booking form, schema markup and leads sent into your CRM." },
    { name: "Plus website package", price: 3497, description: "About 15 pages including up to 4 city pages, missed-call text-back and AI chatbot set up, and local SEO setup." }
  ],
  plans: [
    { name: "Care monthly plan", price: 99, description: "Hosting and SSL, security updates, weekly backups, uptime monitoring and 1 small edit a month." },
    { name: "Growth monthly plan", price: 397, description: "Everything in Care plus missed-call text-back, Google review requests, 4 Google Business Profile posts a month, call tracking, a monthly report and 2 small edits a month." }
  ],
  addons: [
    { name: "AI chatbot / after-hours lead capture", setup: 397, monthly: 79 },
    { name: "Missed-call text-back", setup: 197, monthly: 49 },
    { name: "Review request automation", monthly: 59 },
    { name: "Extra service or city page", price: 150 }
  ]
};

const PAGE_TYPE = { home: "WebPage", services: "WebPage", process: "WebPage", about: "AboutPage", faq: "FAQPage", contact: "ContactPage" };

function pageUrl(file) {
  return SITE.url + "/" + (file === "index.html" ? "" : file);
}

function offer(item, extra) {
  return Object.assign({ "@type": "Offer", priceCurrency: "USD", seller: { "@id": SITE.url + "/#business" } }, extra || {}, {
    itemOffered: { "@type": "Service", name: item.name, description: item.description, serviceType: "Website design", provider: { "@id": SITE.url + "/#business" } }
  });
}

function monthly(price) {
  return { "@type": "UnitPriceSpecification", price: price, priceCurrency: "USD", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } };
}

function offerCatalog() {
  return {
    "@type": "OfferCatalog",
    name: "Website packages, monthly plans and add-ons",
    itemListElement: [
      { "@type": "OfferCatalog", name: "Website packages (one-time build)", itemListElement: PRICING.packages.map((p) => offer(p, { price: p.price })) },
      { "@type": "OfferCatalog", name: "Monthly plans", itemListElement: PRICING.plans.map((p) => offer(p, { priceSpecification: monthly(p.price) })) },
      { "@type": "OfferCatalog", name: "Add-ons", itemListElement: PRICING.addons.map((a) => {
        const specs = [];
        if (a.setup) specs.push({ "@type": "PriceSpecification", name: "Setup", price: a.setup, priceCurrency: "USD" });
        if (a.monthly) specs.push(monthly(a.monthly));
        return offer(a, a.price ? { price: a.price } : { priceSpecification: specs });
      }) }
    ]
  };
}

function businessSchema() {
  return {
    "@type": "ProfessionalService",
    "@id": SITE.url + "/#business",
    name: SITE.brand,
    description: SITE.tagline,
    slogan: "Websites that make the phone ring",
    url: SITE.url + "/",
    telephone: SITE.phoneHref,
    email: SITE.email,
    priceRange: "$997 – $3,497",
    currenciesAccepted: "USD",
    areaServed: { "@type": "Country", name: "United States" },
    audience: { "@type": "BusinessAudience", audienceType: "HVAC, plumbing and roofing companies" },
    openingHoursSpecification: [{
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "18:00"
    }],
    contactPoint: [{
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: SITE.phoneHref,
      email: SITE.email,
      areaServed: "US",
      availableLanguage: "English"
    }],
    knowsAbout: ["HVAC website design", "Plumbing website design", "Roofing website design", "Local SEO", "Google Business Profile", "Missed-call text-back", "Lead capture"],
    hasOfferCatalog: offerCatalog()
  };
}

function faqItems(body) {
  const re = /<details class="faq"[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="answer">([\s\S]*?)<\/div>\s*<\/details>/g;
  const items = [];
  let m;
  while ((m = re.exec(body))) {
    items.push({ "@type": "Question", name: stripTags(m[1]), acceptedAnswer: { "@type": "Answer", text: stripTags(m[2]) } });
  }
  return items;
}

// One JSON-LD graph per page: the business, the website, this page and its breadcrumb trail.
function pageSchema(meta, body) {
  const url = pageUrl(meta.file);
  const page = {
    "@type": PAGE_TYPE[meta.nav] || "WebPage",
    "@id": url + "#webpage",
    url: url,
    name: meta.title,
    description: meta.description,
    isPartOf: { "@id": SITE.url + "/#website" },
    about: { "@id": SITE.url + "/#business" },
    inLanguage: "en-US"
  };
  const graph = [
    businessSchema(),
    { "@type": "WebSite", "@id": SITE.url + "/#website", url: SITE.url + "/", name: SITE.brand, publisher: { "@id": SITE.url + "/#business" }, inLanguage: "en-US" },
    page
  ];
  if (meta.nav !== "home") {
    const navItem = NAV.find((n) => n.key === meta.nav);
    page.breadcrumb = { "@id": url + "#breadcrumb" };
    graph.push({
      "@type": "BreadcrumbList",
      "@id": url + "#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url + "/" },
        { "@type": "ListItem", position: 2, name: navItem ? navItem.label : meta.title, item: url }
      ]
    });
  }
  if (meta.nav === "faq") page.mainEntity = faqItems(body);
  if (meta.nav === "services") page.mainEntity = { "@id": SITE.url + "/#business" };
  return { "@context": "https://schema.org", "@graph": graph };
}

function layout(meta, body) {
  const navItems = NAV.map((n) => `<li><a href="${n.href}"${n.key === meta.nav ? ' aria-current="page"' : ""}>${n.label}</a></li>`).join("\n          ");
  const drawerItems = NAV.map((n) => `<li><a href="${n.href}"${n.key === meta.nav ? ' aria-current="page"' : ""}>${n.label}${icon("arrow")}</a></li>`).join("\n          ");
  // "</" is escaped so text inside the JSON can never close the script tag.
  const schemaTags = `<script type="application/ld+json">${JSON.stringify(pageSchema(meta, body)).replace(/<\//g, "<\\/")}</script>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.description)}">
  <meta name="theme-color" content="#3b1812">
  <link rel="canonical" href="${SITE.url}/${meta.file === "index.html" ? "" : meta.file}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.description)}">
  <meta property="og:url" content="${SITE.url}/${meta.file === "index.html" ? "" : meta.file}">
  <link rel="icon" href="${FAVICON}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/styles.css">
  ${schemaTags}
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>

  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="index.html" aria-label="${esc(SITE.brand)} home">
        <span class="logo-mark">${icon("logo")}</span>
        <span>${esc(SITE.brand)}</span>
      </a>
      <nav aria-label="Main">
        <ul class="nav-links">
          ${navItems}
        </ul>
      </nav>
      <div class="header-actions">
        <a class="btn btn-outline btn-sm btn-call" href="tel:${SITE.phoneHref}">${icon("phone")}<span>${SITE.phone}</span></a>
        <a class="btn btn-primary btn-sm btn-quote" href="contact.html">Free quote</a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">${icon("menu")}</button>
      </div>
    </div>
  </header>

  <div class="mobile-nav" id="mobile-nav" aria-hidden="true" inert>
    <div class="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="mobile-nav-top">
        <span class="logo"><span class="logo-mark">${icon("logo")}</span><span>${esc(SITE.brand)}</span></span>
        <button class="menu-toggle" type="button" data-close-menu aria-label="Close menu">${icon("x")}</button>
      </div>
      <nav aria-label="Mobile">
        <ul>
          ${drawerItems}
        </ul>
      </nav>
      <div class="btn-row">
        <a class="btn btn-accent btn-block" href="tel:${SITE.phoneHref}">${icon("phone")}Call ${SITE.phone}</a>
        <a class="btn btn-outline btn-block" href="contact.html">Get a free quote</a>
      </div>
    </div>
  </div>

  <main id="main">
${body}
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="logo" href="index.html"><span class="logo-mark">${icon("logo")}</span><span>${esc(SITE.brand)}</span></a>
          <p style="margin-top:16px;max-width:34ch">${esc(SITE.tagline)}</p>
        </div>
        <div>
          <h4>Pages</h4>
          <ul>
            ${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("\n            ")}
          </ul>
        </div>
        <div>
          <h4>Who we build for</h4>
          <ul>
            <li><a href="services.html#trades">HVAC companies</a></li>
            <li><a href="services.html#trades">Plumbers</a></li>
            <li><a href="services.html#trades">Roofers</a></li>
          </ul>
        </div>
        <div>
          <h4>Talk to us</h4>
          <ul>
            <li><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></li>
            <li><a href="sms:${SITE.phoneHref}">Text us</a></li>
            <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
            <li><span>${SITE.hours}</span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${new Date().getFullYear()} ${esc(SITE.brand)}. All rights reserved.</span>
        <a href="crm.html" rel="nofollow">Team login</a>
      </div>
    </div>
  </footer>

  <div class="mobile-cta">
    <a class="btn btn-accent" href="tel:${SITE.phoneHref}">${icon("phone")}Call</a>
    <a class="btn btn-primary" href="contact.html">${icon("message")}Free quote</a>
  </div>

  <div class="chat" data-chat>
    <button class="chat-launcher" type="button" aria-expanded="false" aria-controls="chat-panel">${icon("message")}<span>Questions? Chat with us</span></button>
    <section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
      <header class="chat-head">
        <span class="chat-avatar">${icon("bot")}</span>
        <div class="chat-head-text">
          <p class="chat-title" id="chat-title">${esc(SITE.brand)} assistant</p>
          <p class="chat-sub"><span class="chat-dot" aria-hidden="true"></span>Instant answers, a real person anytime</p>
        </div>
        <button class="chat-close" type="button" aria-label="Close chat">${icon("x")}</button>
      </header>
      <div class="chat-log" role="log" aria-live="polite" aria-label="Chat messages"></div>
      <div class="chat-chips" aria-label="Suggested questions"></div>
      <form class="chat-form" novalidate>
        <label class="sr-only" for="chat-input">Type your message</label>
        <input id="chat-input" type="text" autocomplete="off" maxlength="500" placeholder="Ask about prices, timelines…">
        <button type="submit" aria-label="Send message">${icon("arrow")}</button>
      </form>
    </section>
  </div>

  <script>window.SITE_CONFIG = ${JSON.stringify(PUBLIC_CONFIG)};</script>
  <script src="assets/leads.js"></script>
  <script src="assets/site.js"></script>
  <script src="assets/chat.js"></script>
</body>
</html>
`;
}

const srcDir = path.join(__dirname, "src", "pages");
const outDir = path.join(__dirname, "site");

for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith(".html"))) {
  const raw = fs.readFileSync(path.join(srcDir, file), "utf8");
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(file + " is missing its meta comment");
  const meta = Object.assign({ file }, JSON.parse(m[1]));
  const body = fill(raw.slice(m[0].length));
  fs.writeFileSync(path.join(outDir, file), meta.standalone ? body : layout(meta, body));
  console.log("built", file);
}
