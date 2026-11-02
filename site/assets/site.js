(function () {
  document.documentElement.classList.add("js");
  var cfg = window.SITE_CONFIG || {};

  /* ---------- Header shadow on scroll ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var drawer = document.getElementById("mobile-nav");
  var lastFocus = null;

  function openMenu() {
    lastFocus = document.activeElement;
    drawer.classList.add("open");
    drawer.removeAttribute("inert");
    drawer.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    var first = drawer.querySelector("button, a");
    if (first) first.focus();
  }
  function closeMenu() {
    drawer.classList.remove("open");
    drawer.setAttribute("inert", "");
    drawer.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }
  if (toggle && drawer) {
    toggle.addEventListener("click", openMenu);
    drawer.addEventListener("click", function (e) {
      if (e.target === drawer || e.target.closest("[data-close-menu]")) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("open")) closeMenu();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1200 && drawer.classList.contains("open")) closeMenu();
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (el.dataset.delay || 0) + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Pre-select package from ?package= ---------- */
  var params = new URLSearchParams(location.search);
  var pkg = params.get("package");
  if (pkg) {
    var sel = document.querySelector('select[name="package"]');
    if (sel) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value.toLowerCase() === pkg.toLowerCase()) sel.selectedIndex = i;
      }
    }
  }

  /* ---------- Lead forms ---------- */
  var ERR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';

  function fieldMessage(input) {
    var v = input.validity;
    var label = input.dataset.label || "This field";
    if (v.valueMissing) return label + " is required.";
    if (v.typeMismatch && input.type === "email") return "Enter an email like name@company.com.";
    if (v.patternMismatch && input.type === "tel") return "Enter a 10-digit phone number, like 555-201-4433.";
    if (v.typeMismatch && input.type === "url") return "Enter a full web address, like https://yourcompany.com.";
    return "Please check this field.";
  }

  function validateField(input) {
    var field = input.closest(".field");
    if (!field) return true;
    var ok = input.checkValidity();
    var err = field.querySelector(".error");
    field.classList.toggle("invalid", !ok);
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    if (err) err.innerHTML = ok ? "" : ERR_ICON + "<span>" + fieldMessage(input) + "</span>";
    return ok;
  }

  document.querySelectorAll("form[data-lead-form]").forEach(function (form) {
    var inputs = form.querySelectorAll("input[required], select[required], textarea[required], input[type=email], input[type=tel], input[type=url]");
    inputs.forEach(function (input) {
      input.addEventListener("blur", function () { if (input.value || input.closest(".field.invalid")) validateField(input); });
      input.addEventListener("input", function () { if (input.closest(".field.invalid")) validateField(input); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstBad = null;
      inputs.forEach(function (input) {
        if (!validateField(input) && !firstBad) firstBad = input;
      });
      var status = form.querySelector(".form-status");
      if (firstBad) {
        status.className = "form-status error show";
        status.innerHTML = ERR_ICON + "<span>Please fix the highlighted fields and try again.</span>";
        firstBad.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      var btnHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending…';

      var fd = new FormData(form);
      if (fd.get("website_hp")) return; // honeypot
      var trades = fd.getAll("trade");
      var data = {
        name: (fd.get("name") || "").trim(),
        company: (fd.get("company") || "").trim(),
        email: (fd.get("email") || "").trim(),
        phone: (fd.get("phone") || "").trim(),
        trade: trades.join(", "),
        package: fd.get("package") || "",
        website: (fd.get("website") || "").trim(),
        serviceArea: (fd.get("area") || "").trim(),
        timeline: fd.get("timeline") || "",
        message: (fd.get("message") || "").trim(),
        source: form.dataset.leadForm || "website"
      };

      var store = window.LeadStore;
      var notify = cfg.formEndpoint
        ? fetch(cfg.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(data)
          }).then(function (r) { if (!r.ok) throw new Error("bad status"); })
        : null;
      var send;
      if (store && store.remote) {
        // The database is the source of truth; the email notification is best-effort.
        send = store.submit(data);
        if (notify) notify.catch(function () {});
      } else {
        if (store) store.submit(data);
        send = notify || new Promise(function (res) { setTimeout(res, 600); });
      }

      send.then(function () {
        status.className = "form-status success show";
        status.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg><span>Thanks, ' +
          (data.name.split(" ")[0] || "there") + "! We got your request and will reach out within one business day. Need us sooner? Call " +
          '<a href="tel:' + (cfg.phoneHref || "") + '">' + (cfg.phone || "us") + "</a>.</span>";
        form.reset();
        form.querySelectorAll(".field.invalid").forEach(function (f) { f.classList.remove("invalid"); });
      }).catch(function () {
        status.className = "form-status error show";
        status.innerHTML = ERR_ICON + "<span>We couldn't send that just now. Please try again, or call " +
          '<a href="tel:' + (cfg.phoneHref || "") + '">' + (cfg.phone || "us") + "</a>.</span>";
      }).finally(function () {
        btn.disabled = false;
        btn.innerHTML = btnHTML;
        status.focus();
      });
    });
  });

  /* ---------- FAQ search ---------- */
  var faqSearch = document.getElementById("faq-search");
  if (faqSearch) {
    var items = document.querySelectorAll("details.faq");
    var groups = document.querySelectorAll(".faq-group");
    var empty = document.querySelector(".faq-empty");
    var live = document.getElementById("faq-count");
    faqSearch.addEventListener("input", function () {
      var q = faqSearch.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (d) {
        var hit = !q || d.textContent.toLowerCase().indexOf(q) !== -1;
        d.hidden = !hit;
        if (hit) shown++;
        if (q && hit) d.open = true;
      });
      groups.forEach(function (g) {
        g.hidden = !g.querySelector("details.faq:not([hidden])");
      });
      empty.style.display = shown ? "none" : "block";
      live.textContent = q ? shown + (shown === 1 ? " question matches" : " questions match") : "";
    });
  }
})();
