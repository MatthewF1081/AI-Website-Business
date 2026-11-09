/*
 * Questions for the client website questionnaire (onboarding.html).
 * The form, the review step, the team briefs page and the Excel export are all
 * built from this list, so add, remove or reword questions here only.
 *
 * Field types: text, email, tel, url, textarea, select, radio, checks (pick many),
 * colors, services (repeating name + description rows), files (image uploads).
 * "name" is the saved key; changing it hides old answers for that question.
 */
window.BRIEF_SECTIONS = [
  {
    id: "you",
    title: "About you",
    intro: "Who we'll be working with and how to reach you.",
    fields: [
      { name: "name", label: "Your name", type: "text", required: true, autocomplete: "name" },
      { name: "business", label: "Business name", type: "text", required: true, autocomplete: "organization" },
      { name: "email", label: "Email", type: "email", required: true, autocomplete: "email" },
      { name: "phone", label: "Phone", type: "tel", required: true, autocomplete: "tel" },
      { name: "contactTime", label: "Best time to reach you", type: "select", options: ["Any time", "Mornings", "Afternoons", "Evenings", "Text me first"] },
      { name: "trade", label: "What trade are you in?", type: "checks", required: true, options: ["HVAC", "Plumbing", "Roofing", "Electrical", "Other"], full: true },
      { name: "address", label: "Business address", type: "text", autocomplete: "street-address", hint: "Leave blank if you don't want it shown on the site.", full: true },
      { name: "serviceAreas", label: "Towns and areas you serve", type: "textarea", required: true, rows: 3, hint: "List the cities, towns or zip codes you want to get jobs from.", full: true },
      { name: "years", label: "Years in business", type: "text" },
      { name: "license", label: "License or registration numbers", type: "text", hint: "If you want them shown." }
    ]
  },
  {
    id: "brand",
    title: "Your brand",
    intro: "Your logo, colors and the feel you want.",
    fields: [
      { name: "currentWebsite", label: "Current website", type: "url", placeholder: "https://", hint: "Leave blank if you don't have one.", full: true },
      { name: "domain", label: "Do you own a domain name?", type: "radio", options: ["Yes, I have one", "No, please help me get one", "Not sure"], full: true },
      { name: "logo", label: "Upload your logo", type: "files", accept: "image/*,.pdf", max: 3, hint: "PNG, JPG, SVG or PDF. The biggest, sharpest version you have.", full: true },
      { name: "logoStatus", label: "Logo status", type: "radio", options: ["I've uploaded it", "I'll send it later", "I need a new logo"], full: true },
      { name: "colors", label: "Brand colors", type: "colors", hint: "Pick up to 3, or tick \"Choose for me\".", full: true },
      { name: "style", label: "How should your site feel?", type: "checks", options: ["Bold and confident", "Clean and modern", "Friendly and local", "Premium", "Traditional and trusted"], full: true },
      { name: "likedSites", label: "Websites you like (any business)", type: "textarea", rows: 3, hint: "Paste links and tell us what you like about each one.", full: true }
    ]
  },
  {
    id: "services",
    title: "Your services",
    intro: "What you do, so every service gets shown properly.",
    fields: [
      { name: "services", label: "Services you offer", type: "services", required: true, hint: "Add one row per service. A short note is plenty; we'll write the page.", full: true },
      { name: "featured", label: "Which service do you want more of?", type: "textarea", required: true, rows: 2, hint: "Your most profitable job, or the one you want the phone ringing for.", full: true },
      { name: "customerType", label: "Who do you work for?", type: "checks", options: ["Homeowners", "Landlords and property managers", "Commercial", "New builds"], full: true },
      { name: "emergency", label: "Do you offer emergency or 24/7 service?", type: "radio", options: ["Yes, 24/7", "Yes, extended hours", "No"] },
      { name: "financing", label: "Do you offer financing?", type: "radio", options: ["Yes", "No", "Planning to"] },
      { name: "pricing", label: "Show prices on the site?", type: "radio", options: ["Yes, show prices", "Show \"from\" prices", "No prices"] },
      { name: "brands", label: "Brands you install or carry", type: "text", hint: "e.g. Carrier, Rheem, GAF" }
    ]
  },
  {
    id: "content",
    title: "Content and pages",
    intro: "The words and pages on your site. Rough notes are fine.",
    fields: [
      { name: "pages", label: "Which pages do you want?", type: "checks", options: ["Home", "About us", "A page for each service", "A page for each town", "Reviews", "Photo gallery", "FAQ", "Quote", "Careers / hiring", "Blog or tips", "Contact"], full: true },
      { name: "headline", label: "A headline or slogan you use", type: "text", hint: "Leave blank and we'll suggest some.", full: true },
      { name: "story", label: "Your story", type: "textarea", rows: 4, hint: "How you started, who runs it, what you care about.", full: true },
      { name: "different", label: "What makes you different from other companies?", type: "textarea", required: true, rows: 3, full: true },
      { name: "guarantees", label: "Guarantees and warranties", type: "textarea", rows: 2, full: true },
      { name: "credentials", label: "Certifications, awards and memberships", type: "textarea", rows: 2, hint: "e.g. NATE certified, BBB A+, manufacturer partner.", full: true },
      { name: "reviewsLink", label: "Link to your Google reviews", type: "url", placeholder: "https://", full: true },
      { name: "testimonials", label: "Favourite customer reviews to feature", type: "textarea", rows: 3, full: true },
      { name: "faqs", label: "Questions customers always ask you", type: "textarea", rows: 3, full: true },
      { name: "writer", label: "Who should write the words?", type: "radio", options: ["You write it all", "I'll send my own", "A mix of both"], full: true }
    ]
  },
  {
    id: "images",
    title: "Images",
    intro: "Real photos win more trust than stock. Send what you have.",
    fields: [
      { name: "photos", label: "Upload your photos", type: "files", accept: "image/*", max: 20, hint: "Up to 20 photos, 15 MB each. Jobs, team, vans, before and after.", full: true },
      { name: "photoLink", label: "Or share a folder link", type: "url", placeholder: "https://", hint: "Google Drive, Dropbox or iCloud link for bigger sets.", full: true },
      { name: "imagesWanted", label: "Which images do you want on the site?", type: "checks", options: ["Owner or team photos", "Vans and trucks", "Before and after jobs", "Finished jobs", "Equipment and products", "Office or shop", "Stock photos are fine", "I'd like a photo shoot"], full: true },
      { name: "imageNotes", label: "Anything about the images?", type: "textarea", rows: 3, hint: "e.g. use the red van photo on the home page, no photos of the owner.", full: true }
    ]
  },
  {
    id: "customers",
    title: "Your customers",
    intro: "What you want people to see and do when they land on your site.",
    fields: [
      { name: "idealCustomer", label: "Describe your ideal customer", type: "textarea", required: true, rows: 3, full: true },
      { name: "seeFirst", label: "What should customers see first?", type: "textarea", required: true, rows: 3, hint: "The one message you want every visitor to get.", full: true },
      { name: "mainAction", label: "What should visitors do next?", type: "checks", required: true, options: ["Call us", "Request a quote", "Book online", "Text us", "Fill in a form"], full: true },
      { name: "worries", label: "What do customers worry about before hiring?", type: "textarea", rows: 2, hint: "e.g. surprise costs, mess, people turning up late.", full: true },
      { name: "competitors", label: "Main competitors", type: "textarea", rows: 2, hint: "Names or website links.", full: true },
      { name: "avoid", label: "Anything to avoid?", type: "textarea", rows: 2, hint: "Colors, words or claims you don't want on the site.", full: true },
      { name: "launchBy", label: "When do you need the site live?", type: "select", options: ["As soon as possible", "Within a month", "In 1 to 3 months", "No rush"] },
      { name: "extra", label: "Anything else?", type: "textarea", rows: 3, full: true }
    ]
  }
];

// Plain-text version of one answer, used by the review step, the briefs page and Excel.
window.BRIEF_FORMAT = function (field, value) {
  if (value == null || value === "") return "";
  if (field.type === "services") {
    return (value || []).map(function (s) { return s.description ? s.name + ": " + s.description : s.name; }).join("\n");
  }
  if (field.type === "files") return (value || []).map(function (f) { return f.name; }).join("\n");
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};
