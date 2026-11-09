/* Website chat assistant: answers common questions, then hands the visitor to a real person.
 * A handoff collects name + phone/email and saves it as a lead (source "chatbot") with the
 * full transcript, so it shows up in the CRM like any other quote request. */
(function () {
  var root = document.querySelector("[data-chat]");
  if (!root) return;
  var cfg = window.SITE_CONFIG || {};
  var launcher = root.querySelector(".chat-launcher");
  var panel = root.querySelector(".chat-panel");
  var log = root.querySelector(".chat-log");
  var chips = root.querySelector(".chat-chips");
  var form = root.querySelector(".chat-form");
  var input = form.querySelector("input");
  var closeBtn = root.querySelector(".chat-close");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var TEXT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var HUMAN = "Talk to a person";
  var MAIN_CHIPS = ["Prices", "How long does it take?", "Monthly plans", HUMAN];

  /* ---------- Answers ---------- */
  // Each topic: words that trigger it, the reply (trusted HTML), and follow-up suggestions.
  var TOPICS = [
    { id: "price", words: ["price", "cost", "how much", "pricing", "package", "quote", "expensive", "cheap", "afford", "budget", "$"],
      reply: "Websites are a one-time build:<ul><li><b>Starter</b> $997</li><li><b>Standard</b> $1,997</li><li><b>Plus</b> $3,497</li></ul>You pay 50% to start and 50% before launch. Our first 3 clients get <b>30% off</b> with the <a href=\"services.html#founding\">founding client offer</a>.",
      next: ["What's the difference?", "Monthly plans", HUMAN] },
    { id: "compare", words: ["difference", "compare", "which package", "which one", "recommend", "best for", "starter", "standard", "plus"],
      reply: "Quick version:<ul><li><b>Starter</b>: about 5 pages to get a new or small crew found and called. 2 revision rounds.</li><li><b>Standard</b>: about 10 pages, Google reviews on your site, booking form and leads sent to your CRM. 3 revision rounds.</li><li><b>Plus</b>: about 15 pages with up to 4 city pages, plus missed-call text-back and an AI chatbot set up. 4 revision rounds.</li></ul>Most established crews pick Standard. A person can help you choose on a free 15-minute call.",
      next: ["How long does it take?", HUMAN] },
    { id: "plans", words: ["monthly", "care", "plan", "hosting", "maintenance", "subscription", "growth", "per month", "/mo"],
      reply: "Monthly plans are optional:<ul><li><b>Care</b> $99/mo: hosting and SSL, security updates, weekly backups, monitoring, 1 small edit a month</li><li><b>Growth</b> $397/mo: Care plus missed-call text-back, review requests, 4 Google posts a month, call tracking, a monthly report and 2 edits a month</li></ul>Your first month of Care is free with any build.",
      next: ["Is there a contract?", "Prices", HUMAN] },
    { id: "founding", words: ["founding", "discount", "deal", "offer", "promo", "coupon", "special", "off"],
      reply: "Our first 3 clients get <b>30% off</b> any package: Starter $698, Standard $1,398 or Plus $2,448. In return you let us show your site in our portfolio, give a short testimonial, leave an honest Google review and stay on Care or Growth for at least 3 months. <a href=\"services.html#founding\">Details</a>",
      next: ["Prices", HUMAN] },
    { id: "contract", words: ["contract", "minimum", "cancel", "commit", "lock in"],
      reply: "Care has no minimum. Growth has a 3-month minimum. After that, cancel with 30 days' notice. Pay 12 months upfront on either plan and you get 2 months free.",
      next: ["Monthly plans", HUMAN] },
    { id: "time", words: ["how long", "time", "fast", "quick", "when", "days", "weeks", "turnaround", "rush", "asap", "soon"],
      reply: "Starter takes about 10 business days, Standard 2 to 3 weeks and Plus 3 to 4 weeks. The clock starts once we have your logo, photos, services, service areas and logins. Need it sooner? A rush build cuts the time in half for an extra 30% when your content is ready at kickoff.",
      next: ["What do you need from me?", "Prices", HUMAN] },
    { id: "needs", words: ["need from me", "write", "content", "photos", "logo", "my time", "what do i", "copy"],
      reply: "About an hour of your time in total. We write all the page copy for your trade. You send your logo, a few job photos and basics like your service area and license numbers.",
      next: ["How does payment work?", HUMAN] },
    { id: "pay", words: ["pay", "payment", "deposit", "upfront", "invoice", "card"],
      reply: "50% deposit to book your build and 50% before the site goes live. Monthly plans bill on the same date each month, or pay a year upfront and get 2 months free.",
      next: ["Prices", HUMAN] },
    { id: "revisions", words: ["revision", "changes", "edit", "update", "change my"],
      reply: "Starter includes 2 revision rounds, Standard 3 and Plus 4. A round is one list of changes sent in a single message. After launch, Care covers 1 small edit a month and Growth covers 2. Outside a plan, small edits are $75 each.",
      next: ["Monthly plans", HUMAN] },
    { id: "crm", words: ["crm", "track leads", "lead tracking", "servicetitan", "housecall", "jobber"],
      reply: "Standard and Plus send every lead into your CRM: Jobber or Housecall Pro through Zapier, or a simple CRM we provide.",
      next: ["Prices", HUMAN] },
    { id: "bot", words: ["chatbot", "chat bot", "ai", "bot"],
      reply: "Yes, we can put a chatbot like this one on your site. It answers questions about your services, areas and hours, then passes the customer to you with their details. Plus includes the setup; otherwise it's $397 setup + $79/mo.",
      next: ["What's missed-call text-back?", HUMAN] },
    { id: "textback", words: ["missed call", "missed-call", "text back", "text-back", "textback"],
      reply: "When you miss a call, the customer instantly gets a text from your business number, so the job doesn't go to the next contractor. It's included in the Growth plan, or $197 setup + $49/mo as an add-on. Texting goes live once carrier registration is approved, usually 1 to 3 weeks.",
      next: ["Monthly plans", HUMAN] },
    { id: "seo", words: ["seo", "google", "rank", "search", "found", "maps", "local"],
      reply: "Every package includes Google Business Profile setup and basic on-page SEO. Standard adds schema markup, and Plus adds local SEO setup with up to 4 city pages. No one can honestly guarantee rankings, but we build everything Google looks for in a local contractor.",
      next: ["Prices", HUMAN] },
    { id: "own", words: ["own", "ownership", "domain", "my site"],
      reply: "You own your domain and content. Once the build is paid in full, we hand over your site files if you ever leave.",
      next: ["Monthly plans", HUMAN] },
    { id: "trades", words: ["hvac", "plumb", "roof", "electric", "landscap", "trade", "contractor", "industry", "who do you"],
      reply: "We only build for HVAC, plumbing and roofing companies. That focus means we already know your services and what gets your customers to call. Doing something else? A person can tell you if we're a fit.",
      next: ["Prices", HUMAN] },
    { id: "redo", words: ["already have", "existing", "redesign", "redo", "old site", "current site"],
      reply: "Absolutely. Most clients come to us with a site that isn't bringing in calls. We review it on a free call, keep what works and rebuild the rest.",
      next: ["Prices", HUMAN] },
    { id: "hi", words: ["hello", "hi", "hey", "good morning", "good afternoon", "yo"], exact: true,
      reply: "Hi! Ask me anything about our websites, prices or timelines. Or tap <b>" + HUMAN + "</b> anytime.",
      next: MAIN_CHIPS },
    { id: "thanks", words: ["thanks", "thank you", "thx", "cheers", "ok", "okay", "great", "cool"], exact: true,
      reply: "You're welcome! Anything else I can help with?",
      next: MAIN_CHIPS }
  ];
  var HUMAN_WORDS = ["person", "human", "someone", "agent", "representative", "real person", "speak", "talk to", "call me", "contact", "sales", "owner", "free call", "book"];

  function norm(s) { return " " + s.toLowerCase().replace(/[^a-z0-9$/\-\s]/g, " ").replace(/\s+/g, " ") + " "; }
  function has(text, word) {
    // Short words must match whole words ("ai" shouldn't fire on "repair").
    return word.length <= 3 ? text.indexOf(" " + word.trim() + " ") !== -1 : text.indexOf(word) !== -1;
  }
  function match(raw) {
    var t = norm(raw);
    if (HUMAN_WORDS.some(function (w) { return has(t, w); })) return "human";
    var best = null, bestScore = 0;
    TOPICS.forEach(function (topic) {
      if (topic.exact && t.trim().split(" ").length > 3) return;
      var score = topic.words.filter(function (w) { return has(t, w); }).length;
      if (score > bestScore) { best = topic; bestScore = score; }
    });
    return best;
  }

  /* ---------- State (kept for this tab so the chat survives page changes) ---------- */
  var KEY = "tws_chat_v1";
  var state = { msgs: [], step: "chat", lead: {}, misses: 0, lastQuestion: "", sent: false };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY)); if (saved && saved.msgs) state = saved; } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  /* ---------- Rendering ---------- */
  function bubble(m) {
    var el = document.createElement("div");
    el.className = "chat-msg " + (m.from === "bot" ? "bot" : "me");
    var who = document.createElement("span");
    who.className = "sr-only";
    who.textContent = m.from === "bot" ? "Assistant: " : "You: ";
    var body = document.createElement("div");
    body.className = "chat-bubble";
    if (m.from === "bot") body.innerHTML = m.html; else body.textContent = m.text;
    el.appendChild(who);
    el.appendChild(body);
    return el;
  }
  function scroll() { log.scrollTop = log.scrollHeight; }
  function renderAll() {
    log.innerHTML = "";
    state.msgs.forEach(function (m) { log.appendChild(bubble(m)); });
    scroll();
  }
  function setChips(list) {
    state.chips = list || [];
    chips.innerHTML = "";
    state.chips.forEach(function (label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chat-chip" + (label === HUMAN ? " human" : "");
      b.textContent = label;
      b.addEventListener("click", function () { userSays(label); });
      chips.appendChild(b);
    });
    chips.hidden = !state.chips.length;
  }
  function setInput(kind) {
    var opts = {
      chat: ["text", "off", "Ask about prices, timelines…"],
      name: ["text", "name", "Your name"],
      contact: ["tel", "tel", "Phone number (or email)"],
      note: ["text", "off", "Anything we should know? (optional)"]
    }[kind] || ["text", "off", "Ask another question…"];
    input.type = opts[0];
    input.setAttribute("autocomplete", opts[1]);
    input.placeholder = opts[2];
    if (kind === "contact") input.setAttribute("inputmode", "tel"); else input.removeAttribute("inputmode");
  }

  var typing = null;
  function botSays(html, next, delay) {
    state.msgs.push({ from: "bot", html: html });
    save();
    var show = function () {
      if (typing) { typing.remove(); typing = null; }
      log.appendChild(bubble({ from: "bot", html: html }));
      setChips(next);
      save();
      scroll();
    };
    if (reduceMotion || !delay) { show(); return; }
    typing = document.createElement("div");
    typing.className = "chat-msg bot";
    typing.innerHTML = '<div class="chat-bubble chat-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></div>';
    log.appendChild(typing);
    setChips([]);
    scroll();
    setTimeout(show, delay);
  }

  function callButtons() {
    return '<div class="chat-actions"><a class="chat-action" href="tel:' + (cfg.phoneHref || "") + '">' + PHONE_SVG + "Call " + (cfg.phone || "us") + '</a>' +
      '<a class="chat-action" href="sms:' + (cfg.phoneHref || "") + '">' + TEXT_SVG + "Text us</a></div>";
  }

  /* ---------- Conversation ---------- */
  function startHandoff() {
    state.step = "name";
    setInput("name");
    botSays("Happy to connect you with a real person on our team. What's your name?", [], 500);
  }

  function userSays(text) {
    text = String(text || "").trim();
    if (!text) return;
    state.msgs.push({ from: "me", text: text });
    log.appendChild(bubble({ from: "me", text: text }));
    setChips([]);
    save();
    scroll();

    if (state.step === "name") {
      if (text.toLowerCase() === "cancel") return backToChat();
      state.lead.name = text.slice(0, 200);
      state.step = "contact";
      setInput("contact");
      botSays("Thanks, " + esc(state.lead.name.split(" ")[0]) + ". What's the best phone number to reach you? An email works too.", ["Cancel"], 500);
      return;
    }
    if (state.step === "contact") {
      if (text.toLowerCase() === "cancel") return backToChat();
      var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      var digits = text.replace(/\D/g, "");
      if (!isEmail && digits.length < 10) {
        botSays("That doesn't look quite right. Please enter a 10-digit phone number, like 555-201-4433, or an email address.", ["Cancel"], 400);
        return;
      }
      if (isEmail) state.lead.email = text.toLowerCase().slice(0, 320); else state.lead.phone = text.slice(0, 40);
      state.step = "note";
      setInput("note");
      botSays("Got it. Anything you'd like them to know before they reach out? Your trade, your town, what you need help with.", ["Skip"], 500);
      return;
    }
    if (state.step === "note") {
      state.lead.note = text.toLowerCase() === "skip" ? "" : text.slice(0, 1000);
      return sendHandoff();
    }

    if (text === "Cancel") return backToChat();
    var hit = match(text);
    if (hit === "human") {
      if (state.sent) {
        botSays("Your details are already with our team and someone will be in touch soon. If it's urgent, reach a person right now:" + callButtons(), MAIN_CHIPS.slice(0, 3), 500);
        return;
      }
      return startHandoff();
    }
    if (hit) {
      state.misses = 0;
      botSays(hit.reply, hit.next, 650);
      return;
    }
    state.misses++;
    state.lastQuestion = text;
    if (state.misses >= 2) {
      botSays("I'm not able to answer that one, but a person on our team can. Want me to connect you?", [HUMAN, "Prices", "How long does it take?"], 600);
    } else {
      botSays("Good question. I'm not sure I can answer that one. Try asking about prices, timelines, monthly plans or SEO, or I can pass you to a real person.", [HUMAN, "Prices", "Monthly plans"], 600);
    }
  }

  function backToChat() {
    state.step = "chat";
    state.lead = {};
    setInput("chat");
    botSays("No problem. What else can I help with?", MAIN_CHIPS, 400);
  }

  function transcript() {
    return state.msgs.map(function (m) {
      var t = m.from === "bot" ? m.html.replace(/<li>/g, "\n- ").replace(/<\/ul>/g, "\n").replace(/<[^>]+>/g, "") : m.text;
      return (m.from === "bot" ? "Bot: " : "Visitor: ") + t.trim();
    }).join("\n").slice(-4000);
  }

  function sendHandoff() {
    state.step = "sending";
    input.disabled = true;
    var data = {
      name: state.lead.name,
      email: state.lead.email || "",
      phone: state.lead.phone || "",
      message: "Chat handoff: visitor asked to talk to a person." +
        (state.lead.note ? "\nTheir note: " + state.lead.note : "") +
        (state.lastQuestion ? "\nUnanswered question: " + state.lastQuestion : "") +
        "\n\n--- Chat transcript ---\n" + transcript(),
      source: "chatbot"
    };
    var store = window.LeadStore;
    var send = store ? store.submit(data) : Promise.reject(new Error("No lead store"));
    if (cfg.formEndpoint) {
      fetch(cfg.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
        .catch(function () {});
    }
    send.then(function () {
      state.step = "done";
      state.sent = true;
      setInput("after");
      botSays("You're all set, " + esc(state.lead.name.split(" ")[0]) + ". I've passed this chat to our team and someone will " +
        (state.lead.phone ? "call or text you" : "email you") + " within one business day, usually much sooner" +
        (cfg.hours ? " (" + esc(cfg.hours) + ")" : "") + ". Can't wait? Reach us now:" + callButtons(), ["Prices", "Monthly plans"], 700);
    }).catch(function () {
      state.step = "chat";
      setInput("chat");
      botSays("Sorry, I couldn't send that just now. Please call or text us and a person will help you right away:" + callButtons(), MAIN_CHIPS, 400);
    }).finally(function () {
      input.disabled = false;
      state.lead = state.step === "done" ? state.lead : {};
      if (panel.hidden === false) input.focus();
      save();
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  /* ---------- Open / close ---------- */
  function open() {
    panel.hidden = false;
    root.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
    if (!state.msgs.length) {
      botSays("Hi! I'm the " + esc(cfg.brand || "") + " assistant. I can answer questions about our websites, prices and timelines, and connect you with a real person anytime. What can I help with?", MAIN_CHIPS, 0);
    }
    state.open = true;
    save();
    setTimeout(function () { input.focus(); scroll(); }, 30);
  }
  function close() {
    panel.hidden = true;
    root.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
    state.open = false;
    save();
    launcher.focus();
  }

  launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
  closeBtn.addEventListener("click", close);
  panel.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (input.disabled) return;
    var v = input.value;
    input.value = "";
    userSays(v);
  });

  // Restore an in-progress chat after moving to another page.
  if (state.msgs.length) {
    renderAll();
    setChips(state.chips || MAIN_CHIPS);
    setInput(state.step === "sending" ? "chat" : state.step);
    if (state.step === "sending") state.step = "chat";
    if (state.open && window.innerWidth >= 1024) { panel.hidden = false; root.classList.add("open"); launcher.setAttribute("aria-expanded", "true"); }
  }
})();
