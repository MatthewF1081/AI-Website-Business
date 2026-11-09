/*
 * Client website questionnaire (onboarding.html).
 *
 * The form is built from BRIEF_SECTIONS (assets/brief-questions.js). Answers are
 * saved as a draft in this browser while the client works. On send:
 *   Database mode: images go to the private "client-uploads" storage bucket and
 *   the answers go to the client_briefs table (see supabase/add-client-briefs.sql).
 *   Clients can only add briefs, never read them.
 *   Local mode (no Supabase settings): the brief is kept in this browser only.
 *
 * Spreadsheet: when SITE_CONFIG.sheetWebhook is set (build.js), each finished
 * questionnaire is also POSTed there as one flat row, one field per question,
 * for Make / Zapier / Power Automate to add to an Excel spreadsheet.
 *
 * Personal link: onboarding.html?business=Acme%20HVAC&name=Sam&email=sam@acme.com
 * fills those answers in for the client.
 */
(function () {
  var cfg = window.SITE_CONFIG || {};
  var SECTIONS = window.BRIEF_SECTIONS;
  var format = window.BRIEF_FORMAT;
  var ICONS = window.OB_ICONS || {};
  var DRAFT_KEY = "tws_brief_draft_v1";
  var LOCAL_KEY = "tws_briefs_v1";
  var BUCKET = "client-uploads";
  var MAX_FILE = 15 * 1024 * 1024;
  var remote = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  var form = document.getElementById("ob-form");
  var panelsEl = document.getElementById("ob-panels");
  var stepsEl = document.getElementById("ob-steps");
  var reviewPanel = document.getElementById("panel-review");
  var statusEl = document.getElementById("ob-status");
  var backBtn = document.getElementById("ob-back");
  var nextBtn = document.getElementById("ob-next");
  var countEl = document.getElementById("ob-count");

  var STEPS = SECTIONS.map(function (s) { return { id: s.id, title: s.title }; }).concat([{ id: "review", title: "Check and send" }]);
  var FIELDS = {};
  SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { FIELDS[f.name] = f; }); });

  var current = 0;
  var furthest = 0;
  var files = {}; // field name -> [File]; files can't be kept in a draft
  var sending = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- Building the form ---------- */
  function fieldId(f, suffix) { return "q-" + f.name + (suffix != null ? "-" + suffix : ""); }

  function labelHtml(f) {
    return esc(f.label) + (f.required ? '<span class="req" aria-hidden="true">*</span>' : ' <span class="muted small">(optional)</span>');
  }

  function fieldHtml(f) {
    var id = fieldId(f);
    var hint = f.hint ? '<span class="hint" id="' + id + '-hint">' + esc(f.hint) + "</span>" : "";
    var describe = ' aria-describedby="' + (f.hint ? id + "-hint " : "") + id + '-error"';
    var err = '<span class="error" id="' + id + '-error" aria-live="polite"></span>';
    var cls = "field" + (f.full ? " full" : "");
    var req = f.required ? " required" : "";
    var inner;

    if (f.type === "radio" || f.type === "checks") {
      var type = f.type === "radio" ? "radio" : "checkbox";
      inner = '<div class="option-grid">' + f.options.map(function (o, i) {
        return '<label class="option"><input type="' + type + '" name="' + f.name + '" value="' + esc(o) + '" id="' + fieldId(f, i) + '"><span>' + esc(o) + "</span></label>";
      }).join("") + "</div>";
      return '<fieldset class="' + cls + '" data-field="' + f.name + '"' + describe + "><legend>" + labelHtml(f) + "</legend>" + hint + inner + err + "</fieldset>";
    }
    if (f.type === "colors") {
      inner = '<div class="ob-colors" id="' + id + '"><div class="ob-colors-list"></div>' +
        '<button class="btn btn-outline btn-sm ob-add-color" type="button">' + (ICONS.plus || "") + "Add a color</button>" +
        '<label class="ob-pick"><input type="checkbox" id="' + id + '-auto"> Choose for me</label></div>';
      return '<fieldset class="' + cls + '" data-field="' + f.name + '"' + describe + "><legend>" + labelHtml(f) + "</legend>" + hint + inner + err + "</fieldset>";
    }
    if (f.type === "services") {
      inner = '<div class="ob-services" id="' + id + '"></div><button class="btn btn-outline btn-sm ob-add" type="button" data-add-service>' + (ICONS.plus || "") + "Add another service</button>";
      return '<fieldset class="' + cls + '" data-field="' + f.name + '"' + describe + "><legend>" + labelHtml(f) + "</legend>" + hint + inner + err + "</fieldset>";
    }
    if (f.type === "files") {
      inner = '<div class="ob-drop">' + (ICONS.upload || "") +
        '<b>Tap to choose files</b><span class="small">or drag and drop them here</span>' +
        '<input type="file" id="' + id + '" accept="' + esc(f.accept || "image/*") + '"' + (f.max > 1 ? " multiple" : "") + describe + "></div>" +
        '<div class="ob-thumbs" id="' + id + '-thumbs"></div>';
      return '<div class="' + cls + '" data-field="' + f.name + '"><label for="' + id + '">' + labelHtml(f) + "</label>" + hint + inner + err + "</div>";
    }
    if (f.type === "select") {
      inner = '<select id="' + id + '" name="' + f.name + '"' + req + describe + '><option value="">Choose one</option>' +
        f.options.map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("") + "</select>";
    } else if (f.type === "textarea") {
      inner = '<textarea id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 4) + '" maxlength="5000"' + req + describe + "></textarea>";
    } else {
      var extra = f.type === "url" ? ' inputmode="url"' : f.type === "tel" ? ' inputmode="tel"' : "";
      inner = '<input id="' + id + '" name="' + f.name + '" type="' + f.type + '" maxlength="500"' + extra + req +
        (f.autocomplete ? ' autocomplete="' + f.autocomplete + '"' : "") + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + describe + ">";
    }
    return '<div class="' + cls + '" data-field="' + f.name + '"><label for="' + id + '">' + labelHtml(f) + "</label>" + inner + hint + err + "</div>";
  }

  function build() {
    panelsEl.innerHTML = SECTIONS.map(function (s, i) {
      return '<section class="ob-panel" data-step="' + i + '" hidden aria-labelledby="sec-' + s.id + '">' +
        '<h2 id="sec-' + s.id + '" tabindex="-1">' + esc(s.title) + "</h2>" +
        '<p class="muted">' + esc(s.intro) + "</p>" +
        '<div class="form-grid two">' + s.fields.map(fieldHtml).join("") + "</div></section>";
    }).join("");

    stepsEl.innerHTML = STEPS.map(function (s, i) {
      return '<li><button type="button" data-goto="' + i + '"><span class="ob-step-label">' + esc(s.title) + '</span><span class="sr-only"> (step ' + (i + 1) + " of " + STEPS.length + ")</span></button></li>";
    }).join("");
  }

  /* ---------- Repeating rows ---------- */
  function addService(svc) {
    var list = panelsEl.querySelector(".ob-services");
    var n = list.children.length + 1;
    var row = document.createElement("div");
    row.className = "ob-service";
    row.innerHTML =
      '<input type="text" class="ob-svc-name" maxlength="200" aria-label="Service ' + n + ' name" placeholder="e.g. AC repair">' +
      '<input type="text" class="ob-svc-desc" maxlength="1000" aria-label="Service ' + n + ' details" placeholder="Short note (optional)">' +
      '<button class="ob-remove" type="button" aria-label="Remove service ' + n + '">' + (ICONS.x || "×") + "</button>";
    row.querySelector(".ob-svc-name").value = (svc && svc.name) || "";
    row.querySelector(".ob-svc-desc").value = (svc && svc.description) || "";
    list.appendChild(row);
    return row;
  }

  function addColor(hex) {
    var list = panelsEl.querySelector(".ob-colors-list");
    if (list.children.length >= 3) return null;
    var n = list.children.length + 1;
    var wrap = document.createElement("div");
    wrap.className = "ob-color";
    wrap.innerHTML = '<input type="color" aria-label="Brand color ' + n + '" value="' + (hex || "#3b1812") + '"><span></span>' +
      '<button class="ob-remove" type="button" aria-label="Remove color ' + n + '">' + (ICONS.x || "×") + "</button>";
    wrap.querySelector("span").textContent = wrap.querySelector("input").value.toUpperCase();
    list.appendChild(wrap);
    syncColorButton();
    return wrap;
  }

  function syncColorButton() {
    var full = panelsEl.querySelector(".ob-colors-list").children.length >= 3;
    panelsEl.querySelector(".ob-add-color").hidden = full;
  }

  /* ---------- Reading and writing answers ---------- */
  function readField(f) {
    var id = fieldId(f);
    if (f.type === "radio") {
      var r = form.querySelector('input[name="' + f.name + '"]:checked');
      return r ? r.value : "";
    }
    if (f.type === "checks") {
      return Array.prototype.map.call(form.querySelectorAll('input[name="' + f.name + '"]:checked'), function (c) { return c.value; });
    }
    if (f.type === "colors") {
      if (document.getElementById(id + "-auto").checked) return ["Choose for me"];
      return Array.prototype.map.call(panelsEl.querySelectorAll(".ob-color input"), function (c) { return c.value.toUpperCase(); });
    }
    if (f.type === "services") {
      return Array.prototype.map.call(panelsEl.querySelectorAll(".ob-service"), function (row) {
        return { name: row.querySelector(".ob-svc-name").value.trim(), description: row.querySelector(".ob-svc-desc").value.trim() };
      }).filter(function (s) { return s.name || s.description; }).map(function (s) {
        return { name: s.name || "(unnamed)", description: s.description };
      });
    }
    if (f.type === "files") {
      return (files[f.name] || []).map(function (file) { return { name: file.name, size: file.size, type: file.type }; });
    }
    var el = document.getElementById(id);
    var v = el.value.trim();
    if (f.type === "url" && v && !/^https?:\/\//i.test(v)) v = "https://" + v;
    return v;
  }

  function writeField(f, v) {
    var id = fieldId(f);
    if (v == null) return;
    if (f.type === "radio" || f.type === "checks") {
      var vals = Array.isArray(v) ? v : [v];
      form.querySelectorAll('input[name="' + f.name + '"]').forEach(function (c) { c.checked = vals.indexOf(c.value) !== -1; });
    } else if (f.type === "colors") {
      var auto = v[0] === "Choose for me";
      document.getElementById(id + "-auto").checked = auto;
      if (!auto) v.forEach(function (hex) { if (/^#[0-9a-f]{6}$/i.test(hex)) addColor(hex); });
    } else if (f.type === "services") {
      panelsEl.querySelector(".ob-services").innerHTML = "";
      v.forEach(addService);
    } else if (f.type !== "files") {
      var el = document.getElementById(id);
      if (el) el.value = v;
    }
  }

  function collect() {
    var answers = {};
    SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { answers[f.name] = readField(f); }); });
    return answers;
  }

  function saveDraft() {
    if (sending) return;
    try {
      var a = collect();
      SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { if (f.type === "files") delete a[f.name]; }); });
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers: a, step: current, furthest: furthest }));
    } catch (e) { /* storage may be unavailable; the form still works */ }
  }

  function loadDraft() {
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { draft = null; }
    var answers = (draft && draft.answers) || {};
    // A personal link fills in the client's details unless they've already typed them.
    var params = new URLSearchParams(location.search);
    ["name", "business", "email", "phone"].forEach(function (k) {
      var v = params.get(k);
      if (v && !answers[k]) answers[k] = v.slice(0, 200);
    });
    Object.keys(answers).forEach(function (k) { if (FIELDS[k]) writeField(FIELDS[k], answers[k]); });
    if (!panelsEl.querySelector(".ob-service")) { addService(); addService(); addService(); }
    if (draft) {
      furthest = Math.min(draft.furthest || 0, STEPS.length - 1);
      current = Math.min(draft.step || 0, furthest);
    }
    if (answers.business) {
      document.getElementById("ob-heading").textContent = "Let's plan the new " + answers.business + " website";
    }
  }

  /* ---------- Uploads ---------- */
  function renderThumbs(f) {
    var box = document.getElementById(fieldId(f) + "-thumbs");
    box.querySelectorAll("img").forEach(function (img) { URL.revokeObjectURL(img.src); });
    box.innerHTML = "";
    (files[f.name] || []).forEach(function (file, i) {
      var fig = document.createElement("figure");
      fig.className = "ob-thumb";
      if (/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.type)) {
        var img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        fig.appendChild(img);
      } else {
        var name = document.createElement("span");
        name.className = "ob-file-name";
        name.textContent = file.name;
        fig.appendChild(name);
      }
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "ob-thumb-remove";
      rm.setAttribute("aria-label", "Remove " + file.name);
      rm.innerHTML = ICONS.x || "×";
      rm.addEventListener("click", function () {
        files[f.name].splice(i, 1);
        renderThumbs(f);
        document.getElementById(fieldId(f)).focus();
      });
      fig.appendChild(rm);
      box.appendChild(fig);
    });
  }

  function addFiles(f, list) {
    var have = files[f.name] || (files[f.name] = []);
    var skipped = [];
    Array.prototype.forEach.call(list, function (file) {
      if (have.length >= f.max) return skipped.push(file.name + " (limit is " + f.max + ")");
      if (file.size > MAX_FILE) return skipped.push(file.name + " (over 15 MB)");
      if (!/^image\//.test(file.type) && file.type !== "application/pdf") return skipped.push(file.name + " (not an image)");
      have.push(file);
    });
    renderThumbs(f);
    setError(f, skipped.length ? "Not added: " + skipped.join(", ") + ". Share big or extra files with a folder link instead." : "");
  }

  /* ---------- Validation ---------- */
  function setError(f, msg) {
    var wrap = form.querySelector('[data-field="' + f.name + '"]');
    var err = document.getElementById(fieldId(f) + "-error");
    wrap.classList.toggle("invalid", !!msg);
    err.textContent = msg;
    var el = document.getElementById(fieldId(f));
    if (el && "setAttribute" in el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== "file") el.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function validateField(f) {
    var v = readField(f);
    var empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
    var msg = "";
    if (f.required && empty) {
      msg = f.type === "checks" ? "Please pick at least one." : f.type === "services" ? "Please add at least one service." : "Please fill this in.";
    } else if (!empty && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      msg = "Please enter a valid email, like name@company.com.";
    } else if (!empty && f.type === "tel" && v.replace(/\D/g, "").length < 7) {
      msg = "Please enter a phone number we can call.";
    } else if (!empty && f.type === "url" && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v)) {
      msg = "Please enter a full web address, like www.example.com.";
    }
    if (f.type !== "files") setError(f, msg);
    return !msg;
  }

  function validateStep(i) {
    var firstBad = null;
    SECTIONS[i].fields.forEach(function (f) {
      if (!validateField(f) && !firstBad) firstBad = f;
    });
    if (firstBad) {
      var target = document.getElementById(fieldId(firstBad)) || form.querySelector('[data-field="' + firstBad.name + '"] input');
      if (target && target.className === "ob-services") target = target.querySelector("input");
      if (target && target.className === "ob-colors") target = target.querySelector("input");
      if (target) target.focus();
    }
    return !firstBad;
  }

  /* ---------- Steps ---------- */
  function show(i, focus) {
    current = i;
    furthest = Math.max(furthest, i);
    panelsEl.querySelectorAll(".ob-panel").forEach(function (p) { p.hidden = Number(p.getAttribute("data-step")) !== i; });
    var isReview = i === STEPS.length - 1;
    reviewPanel.hidden = !isReview;
    if (isReview) renderReview();
    backBtn.hidden = i === 0;
    nextBtn.innerHTML = isReview ? "Send my answers " + (ICONS.arrow || "") : "Next " + (ICONS.arrow || "");
    countEl.textContent = "Step " + (i + 1) + " of " + STEPS.length;
    stepsEl.querySelectorAll("button").forEach(function (b, n) {
      if (n === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      b.setAttribute("data-state", n < i || n <= furthest && n !== i ? "done" : "");
      b.disabled = n > furthest;
    });
    clearStatus();
    if (focus) {
      var h = isReview ? document.getElementById("review-title") : panelsEl.querySelector('[data-step="' + i + '"] h2');
      h.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
    saveDraft();
  }

  function renderReview() {
    var a = collect();
    document.getElementById("ob-review").innerHTML = SECTIONS.map(function (s, i) {
      var rows = s.fields.map(function (f) {
        var text = format(f, a[f.name]);
        var val;
        if (f.type === "colors" && a[f.name].length && a[f.name][0] !== "Choose for me") {
          val = a[f.name].map(function (h) { return '<span class="ob-swatch" style="background:' + esc(h) + '"></span>' + esc(h); }).join(" &nbsp; ");
        } else {
          val = text ? esc(text) : '<span class="ob-empty">Not answered</span>';
        }
        return "<dt>" + esc(f.label) + "</dt><dd>" + val + "</dd>";
      }).join("");
      return '<div class="ob-review-sec"><div class="ob-review-head"><h3>' + esc(s.title) + '</h3><button class="btn btn-outline btn-sm" type="button" data-goto="' + i + '">' +
        (ICONS.pencil || "") + 'Edit<span class="sr-only"> ' + esc(s.title) + "</span></button></div><dl>" + rows + "</dl></div>";
    }).join("");
  }

  function status(kind, msg) {
    statusEl.className = "form-status show " + kind;
    statusEl.innerHTML = (kind === "error" ? ICONS.error : ICONS.check) + "<span>" + msg + "</span>";
    statusEl.focus();
  }
  function clearStatus() { statusEl.className = "form-status"; statusEl.innerHTML = ""; }

  /* ---------- Sending ---------- */
  function headers(extra) {
    var h = Object.assign({ "apikey": cfg.supabaseAnonKey }, extra);
    // Legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys don't.
    if (cfg.supabaseAnonKey.indexOf("sb_") !== 0) h.Authorization = "Bearer " + cfg.supabaseAnonKey;
    return h;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
      return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16);
    });
  }

  function safeName(name) {
    var parts = name.toLowerCase().split(".");
    var ext = parts.length > 1 ? "." + parts.pop().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
    return (parts.join("-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "file") + ext;
  }

  function uploadAll(briefId, onProgress) {
    var queue = [];
    Object.keys(files).forEach(function (field) {
      files[field].forEach(function (file, i) { queue.push({ field: field, file: file, path: briefId + "/" + field + "-" + (i + 1) + "-" + safeName(file.name) }); });
    });
    var done = [];
    var chain = Promise.resolve();
    queue.forEach(function (item, n) {
      chain = chain.then(function () {
        onProgress(n + 1, queue.length);
        return fetch(cfg.supabaseUrl + "/storage/v1/object/" + BUCKET + "/" + item.path, {
          method: "POST",
          headers: headers({ "Content-Type": item.file.type || "application/octet-stream", "x-upsert": "false" }),
          body: item.file
        }).then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error("Upload of " + item.file.name + " failed (" + r.status + "): " + t); });
          done.push({ field: item.field, path: item.path, name: item.file.name, size: item.file.size, type: item.file.type });
        });
      });
    });
    return chain.then(function () { return done; });
  }

  // One spreadsheet row: column names are the question labels, in form order.
  function sheetRow(answers, briefId, uploaded) {
    var row = { "Received": new Date().toLocaleString(), "Brief ID": briefId };
    SECTIONS.forEach(function (s) {
      s.fields.forEach(function (f) {
        if (f.type === "files") {
          var names = (uploaded || []).filter(function (u) { return u.field === f.name; }).map(function (u) { return u.name; });
          row[f.label] = names.length ? names.length + " file" + (names.length === 1 ? "" : "s") + ": " + names.join(", ") : "";
        } else {
          row[f.label] = format(f, answers[f.name]);
        }
      });
    });
    return row;
  }

  function sendToSheet(answers, briefId, uploaded) {
    return fetch(cfg.sheetWebhook, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sheetRow(answers, briefId, uploaded))
    }).then(function (r) { if (!r.ok) throw new Error("Spreadsheet webhook returned " + r.status); });
  }

  function send() {
    var answers = collect();
    var briefId = uuid();
    var row = {
      id: briefId,
      name: answers.name,
      business: answers.business,
      email: answers.email,
      phone: answers.phone,
      answers: answers,
      files: []
    };

    if (cfg.formEndpoint) {
      fetch(cfg.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ type: "Website questionnaire", name: answers.name, business: answers.business, email: answers.email, phone: answers.phone })
      }).catch(function () {});
    }

    if (!remote) {
      // Without the database, the spreadsheet (if set up) is where the answers go.
      var sheet = cfg.sheetWebhook ? sendToSheet(answers, briefId, (answers.logo || []).map(function (f) { return Object.assign({ field: "logo" }, f); }).concat((answers.photos || []).map(function (f) { return Object.assign({ field: "photos" }, f); }))) : Promise.resolve();
      try {
        var all = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
        row.created_at = new Date().toISOString();
        row.status = "new";
        row.files = (answers.logo || []).concat(answers.photos || []);
        all.unshift(row);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
      } catch (e) { /* demo mode only */ }
      return sheet;
    }

    return uploadAll(briefId, function (n, total) {
      nextBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Uploading ' + n + " of " + total + "…";
    }).then(function (uploaded) {
      row.files = uploaded;
      nextBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Sending…';
      return fetch(cfg.supabaseUrl + "/rest/v1/client_briefs", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json", "Prefer": "return=minimal" }),
        body: JSON.stringify(row)
      });
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("Answers not saved (" + r.status + "): " + t); });
      // The database is the source of truth; the spreadsheet row is best-effort.
      if (cfg.sheetWebhook) sendToSheet(answers, briefId, row.files).catch(function (err) { console.error(err); });
    });
  }

  /* ---------- Events ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending) return;
    if (current < STEPS.length - 1) {
      if (validateStep(current)) show(current + 1, true);
      return;
    }
    for (var i = 0; i < SECTIONS.length; i++) {
      if (!validateStep(i)) {
        show(i, false);
        validateStep(i);
        status("error", "A few required answers are missing in \"" + esc(SECTIONS[i].title) + "\". They're marked in red.");
        return;
      }
    }
    if (!document.getElementById("consent").checked) {
      status("error", "Please tick the box to confirm we can use your details to build your site.");
      return;
    }
    if (document.getElementById("company_hp").value) return; // bot

    sending = true;
    nextBtn.disabled = true;
    backBtn.disabled = true;
    nextBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Sending…';
    send().then(function () {
      try { localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
      document.getElementById("ob-intro").hidden = true;
      document.querySelector(".ob-steps").hidden = true;
      form.hidden = true;
      document.getElementById("ob-done").hidden = false;
      document.getElementById("done-title").focus();
      window.scrollTo(0, 0);
    }).catch(function (err) {
      console.error(err);
      sending = false;
      nextBtn.disabled = false;
      backBtn.disabled = false;
      show(current, false);
      status("error", "Sorry, that didn't send. Your answers are still saved here, so please try again. If it keeps happening, call " + esc(cfg.phone || "us") + ".");
    });
  });

  backBtn.addEventListener("click", function () { if (current > 0) show(current - 1, true); });

  form.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (go) return show(Number(go.getAttribute("data-goto")), true);
    if (e.target.closest("[data-add-service]")) {
      addService().querySelector("input").focus();
      return saveDraft();
    }
    if (e.target.closest(".ob-add-color")) {
      var c = addColor();
      document.getElementById("q-colors-auto").checked = false;
      if (c) c.querySelector("input").focus();
      return saveDraft();
    }
    var rm = e.target.closest(".ob-remove");
    if (rm) {
      var row = rm.parentNode;
      var isColor = row.classList.contains("ob-color");
      row.remove();
      if (isColor) syncColorButton();
      if (!isColor && !panelsEl.querySelector(".ob-service")) addService();
      saveDraft();
    }
  });
  stepsEl.addEventListener("click", function (e) {
    var go = e.target.closest("[data-goto]");
    if (go && !go.disabled) show(Number(go.getAttribute("data-goto")), true);
  });

  var saveTimer;
  form.addEventListener("input", function (e) {
    if (e.target.type === "color") e.target.nextElementSibling.textContent = e.target.value.toUpperCase();
    if (e.target.id === "q-colors-auto" && e.target.checked) {
      panelsEl.querySelector(".ob-colors-list").innerHTML = "";
      syncColorButton();
    }
    var wrap = e.target.closest("[data-field]");
    if (wrap && wrap.classList.contains("invalid")) validateField(FIELDS[wrap.getAttribute("data-field")]);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 400);
  });
  form.addEventListener("change", function (e) {
    if (e.target.type === "file") {
      var f = FIELDS[e.target.closest("[data-field]").getAttribute("data-field")];
      addFiles(f, e.target.files);
      e.target.value = "";
      if (f.name === "logo" && files.logo.length) {
        var up = form.querySelector('input[name="logoStatus"][value="I\'ve uploaded it"]');
        if (up) up.checked = true;
      }
    }
    saveDraft();
  });
  form.addEventListener("focusout", function (e) {
    var wrap = e.target.closest && e.target.closest("[data-field]");
    if (wrap && e.target.value && /^(email|tel|url)$/.test(e.target.type)) validateField(FIELDS[wrap.getAttribute("data-field")]);
  });
  ["dragenter", "dragover"].forEach(function (t) {
    form.addEventListener(t, function (e) { var d = e.target.closest && e.target.closest(".ob-drop"); if (d) d.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    form.addEventListener(t, function (e) { var d = e.target.closest && e.target.closest(".ob-drop"); if (d) d.classList.remove("over"); });
  });

  window.addEventListener("beforeunload", function (e) {
    var pending = Object.keys(files).some(function (k) { return files[k].length; });
    if (pending && !sending && form.hidden === false) { e.preventDefault(); e.returnValue = ""; }
  });

  build();
  loadDraft();
  show(current, false);
})();
