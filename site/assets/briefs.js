/*
 * Team page for client questionnaire answers (briefs.html).
 * Signs in with the same team login as the CRM, lists briefs from the
 * client_briefs table, shows uploaded images, and exports everything to Excel.
 * In local mode it reads briefs sent from this browser.
 */
(function () {
  var cfg = window.SITE_CONFIG || {};
  var S = window.LeadStore;
  var SECTIONS = window.BRIEF_SECTIONS;
  var format = window.BRIEF_FORMAT;
  var ICONS = window.BF_ICONS || {};
  var BUCKET = "client-uploads";
  var LOCAL_KEY = "tws_briefs_v1";
  var XLSX_SRC = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  var STATUSES = [
    { id: "new", label: "New" },
    { id: "reviewed", label: "Reviewed" },
    { id: "in_progress", label: "In progress" },
    { id: "done", label: "Done" }
  ];

  var briefs = [];
  var selected = null;
  var started = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function statusLabel(id) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].id === id) return STATUSES[i].label;
    return id;
  }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3500);
  }

  /* ---------- Data ---------- */
  function check(res) {
    if (res.error) throw new Error(res.error.message || "Database error");
    return res.data;
  }

  function fetchBriefs() {
    if (!S.remote) {
      try { return Promise.resolve(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]")); } catch (e) { return Promise.resolve([]); }
    }
    return S.db().from("client_briefs").select("*").order("created_at", { ascending: false }).then(check);
  }

  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(briefs)); } catch (e) { /* ignore */ }
  }

  function setStatus(brief, status) {
    var prev = brief.status;
    brief.status = status;
    renderList();
    if (!S.remote) { saveLocal(); return; }
    S.db().from("client_briefs").update({ status: status }).eq("id", brief.id).then(check).then(function () {
      toast("Marked as " + statusLabel(status).toLowerCase());
    }).catch(function (err) {
      brief.status = prev;
      renderList();
      if (selected === brief) renderDetail();
      toast("Couldn't save: " + err.message);
    });
  }

  function removeBrief(brief) {
    if (!confirm("Delete the brief from " + (brief.business || brief.name) + " and all its images? This can't be undone.")) return;
    var paths = (brief.files || []).map(function (f) { return f.path; }).filter(Boolean);
    var done = !S.remote ? Promise.resolve() :
      (paths.length ? S.db().storage.from(BUCKET).remove(paths).then(check) : Promise.resolve())
        .then(function () { return S.db().from("client_briefs").delete().eq("id", brief.id).then(check); });
    done.then(function () {
      briefs = briefs.filter(function (b) { return b !== brief; });
      if (!S.remote) saveLocal();
      selected = null;
      renderList();
      renderDetail();
      toast("Brief deleted");
    }).catch(function (err) { toast("Couldn't delete: " + err.message); });
  }

  // path -> temporary link (team-only images live in a private bucket)
  function signedUrls(paths, seconds) {
    if (!S.remote || !paths.length) return Promise.resolve({});
    return S.db().storage.from(BUCKET).createSignedUrls(paths, seconds).then(check).then(function (rows) {
      var map = {};
      rows.forEach(function (r) { if (r.signedUrl) map[r.path] = r.signedUrl; });
      return map;
    });
  }

  /* ---------- List ---------- */
  function matches(b, q) {
    if (!q) return true;
    return [b.name, b.business, b.email, b.phone].join(" ").toLowerCase().indexOf(q) !== -1;
  }

  function renderList() {
    var q = $("bf-search").value.trim().toLowerCase();
    var shown = briefs.filter(function (b) { return matches(b, q); });
    $("bf-total").textContent = "(" + briefs.length + ")";
    if (!shown.length) {
      $("bf-list").innerHTML = '<li class="bf-empty">' + (briefs.length ? "No briefs match that search." : "No briefs yet. Send the link above to a client and their answers will show here.") + "</li>";
      return;
    }
    $("bf-list").innerHTML = shown.map(function (b) {
      var imgs = (b.files || []).length;
      return '<li class="bf-item"><button type="button" data-id="' + esc(b.id) + '"' + (selected === b ? ' aria-current="true"' : "") + ">" +
        "<b>" + esc(b.business || b.name) + "</b>" +
        '<span class="bf-meta"><span>' + esc(b.name) + "</span><span>" + esc(when(b.created_at)) + "</span></span>" +
        '<span class="bf-meta"><span class="bf-status ' + esc(b.status) + '">' + esc(statusLabel(b.status)) + "</span>" +
        (imgs ? "<span>" + imgs + " file" + (imgs === 1 ? "" : "s") + "</span>" : "") + "</span></button></li>";
    }).join("");
  }

  /* ---------- Detail ---------- */
  function answerHtml(f, v) {
    if (f.type === "colors" && v && v.length && v[0] !== "Choose for me") {
      return v.map(function (h) { return '<span class="bf-swatch" style="background:' + esc(h) + '"></span>' + esc(h); }).join(" &nbsp; ");
    }
    if (f.type === "url" && v) return '<a href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">' + esc(v) + "</a>";
    var text = format(f, v);
    return text ? esc(text) : '<span class="ob-empty">Not answered</span>';
  }

  function renderDetail() {
    var el = $("bf-detail");
    var b = selected;
    if (!b) {
      el.innerHTML = '<p class="muted bf-placeholder">Pick a brief to see the answers and images.</p>';
      return;
    }
    var a = b.answers || {};
    var filesByField = {};
    (b.files || []).forEach(function (f) { (filesByField[f.field || "photos"] = filesByField[f.field || "photos"] || []).push(f); });

    var html = '<div class="bf-detail-head"><div><h2>' + esc(b.business || b.name) + '</h2><p class="muted small" style="margin:0">Sent ' + esc(when(b.created_at)) + "</p></div>" +
      '<div class="field"><label class="sr-only" for="bf-status-select">Status</label><select id="bf-status-select">' +
      STATUSES.map(function (s) { return '<option value="' + s.id + '"' + (s.id === b.status ? " selected" : "") + ">" + s.label + "</option>"; }).join("") +
      "</select></div></div>";

    html += '<div class="bf-contact">' +
      (b.phone ? '<a class="btn btn-outline btn-sm" href="tel:' + esc(b.phone.replace(/[^\d+]/g, "")) + '">' + (ICONS.phone || "") + esc(b.phone) + "</a>" : "") +
      (b.email ? '<a class="btn btn-outline btn-sm" href="mailto:' + esc(b.email) + '">' + (ICONS.mail || "") + esc(b.email) + "</a>" : "") + "</div>";

    SECTIONS.forEach(function (s) {
      html += '<section class="bf-sec"><h3>' + esc(s.title) + "</h3><dl>";
      s.fields.forEach(function (f) {
        if (f.type === "files") {
          var list = filesByField[f.name] || [];
          html += "<dt>" + esc(f.label) + "</dt><dd>" + (list.length ? '<div class="bf-images" data-files="' + esc(f.name) + '">' +
            list.map(function (file) {
              return '<a data-path="' + esc(file.path || "") + '" target="_blank" rel="noopener noreferrer"><span class="bf-file">' + esc(file.name) + "</span></a>";
            }).join("") + "</div>" : '<span class="ob-empty">None uploaded</span>') + "</dd>";
        } else {
          html += "<dt>" + esc(f.label) + "</dt><dd>" + answerHtml(f, a[f.name]) + "</dd>";
        }
      });
      html += "</dl></section>";
    });

    html += '<div class="bf-actions"><button class="btn btn-outline btn-sm" type="button" id="bf-print">' + (ICONS.printer || "") + "Print or save as PDF</button>" +
      '<button class="btn btn-danger-text btn-sm" type="button" id="bf-delete">' + (ICONS.trash || "") + "Delete brief</button></div>";
    el.innerHTML = html;

    $("bf-status-select").addEventListener("change", function (e) { setStatus(b, e.target.value); });
    $("bf-print").addEventListener("click", function () { window.print(); });
    $("bf-delete").addEventListener("click", function () { removeBrief(b); });

    var paths = (b.files || []).map(function (f) { return f.path; }).filter(Boolean);
    signedUrls(paths, 3600).then(function (map) {
      if (selected !== b) return;
      el.querySelectorAll("[data-path]").forEach(function (link) {
        var url = map[link.getAttribute("data-path")];
        if (!url) return;
        link.href = url;
        var file = (b.files || []).filter(function (f) { return f.path === link.getAttribute("data-path"); })[0];
        if (file && /^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.type)) {
          link.innerHTML = '<img loading="lazy" alt="' + esc(file.name) + '" src="' + esc(url) + '">';
        }
      });
    }).catch(function (err) { toast("Couldn't load images: " + err.message); });
  }

  /* ---------- Excel export ---------- */
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = XLSX_SRC;
      s.onload = function () { resolve(window.XLSX); };
      s.onerror = function () { reject(new Error("The Excel library didn't load. Check your internet connection.")); };
      document.head.appendChild(s);
    });
  }

  function exportExcel() {
    if (!briefs.length) return toast("No briefs to export yet");
    var btn = $("export-btn");
    btn.disabled = true;
    var LINK_DAYS = 30;
    var allPaths = [];
    briefs.forEach(function (b) { (b.files || []).forEach(function (f) { if (f.path) allPaths.push(f.path); }); });

    Promise.all([loadXlsx(), signedUrls(allPaths, LINK_DAYS * 86400)]).then(function (res) {
      var XLSX = res[0];
      var urls = res[1];
      var fields = [];
      SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { if (f.type !== "files") fields.push(f); }); });

      // Sheet 1: one row per client, one column per question.
      var head = ["Received", "Status"].concat(fields.map(function (f) { return f.label; }), ["Images uploaded"]);
      var rows = briefs.map(function (b) {
        var a = b.answers || {};
        return [new Date(b.created_at), statusLabel(b.status)].concat(
          fields.map(function (f) { return format(f, a[f.name]); }),
          [(b.files || []).length]
        );
      });
      var ws = XLSX.utils.aoa_to_sheet([head].concat(rows), { cellDates: true });
      ws["!cols"] = head.map(function (h, i) { return { wch: i === 0 ? 18 : Math.min(Math.max(h.length, 14), 40) }; });
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: head.length - 1 } }) };
      for (var r = 1; r <= rows.length; r++) {
        var cell = ws[XLSX.utils.encode_cell({ r: r, c: 0 })];
        if (cell) { cell.z = "yyyy-mm-dd hh:mm"; delete cell.w; }
      }

      // Sheet 2: one row per uploaded image, with a clickable link.
      var imgHead = ["Business", "Contact", "Type", "File name", "Link (works for " + LINK_DAYS + " days)"];
      var imgRows = [];
      briefs.forEach(function (b) {
        (b.files || []).forEach(function (f) {
          imgRows.push([b.business || "", b.name || "", f.field === "logo" ? "Logo" : "Photo", f.name, urls[f.path] ? "Open image" : "Not available"]);
        });
      });
      var ws2 = XLSX.utils.aoa_to_sheet([imgHead].concat(imgRows));
      ws2["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 8 }, { wch: 36 }, { wch: 22 }];
      var n = 1;
      briefs.forEach(function (b) {
        (b.files || []).forEach(function (f) {
          var url = urls[f.path];
          if (url) ws2[XLSX.utils.encode_cell({ r: n, c: 4 })].l = { Target: url, Tooltip: f.name };
          n++;
        });
      });

      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Client briefs");
      XLSX.utils.book_append_sheet(wb, ws2, "Images");
      XLSX.writeFile(wb, "client-briefs-" + new Date().toISOString().slice(0, 10) + ".xlsx");
      toast("Excel file downloaded");
    }).catch(function (err) {
      toast("Export failed: " + err.message);
    }).then(function () { btn.disabled = false; });
  }

  /* ---------- Send link ---------- */
  function updateLink() {
    // A link copied from a file on this computer (file:///...) wouldn't open for clients.
    var base = (window.QUESTIONNAIRE_URL || "").trim() ||
      (/^https?:$/.test(location.protocol) ? location.href.split(/[?#]/)[0].replace(/[^/]*$/, "") + "onboarding.html" : "");
    $("s-link-warn").hidden = !!base;
    $("copy-btn").disabled = !base;
    $("mail-btn").setAttribute("aria-disabled", String(!base));
    if (!base) {
      $("s-link").value = "";
      $("mail-btn").removeAttribute("href");
      return;
    }
    var params = new URLSearchParams();
    [["business", "s-business"], ["name", "s-name"], ["email", "s-email"]].forEach(function (p) {
      var v = $(p[1]).value.trim();
      if (v) params.set(p[0], v);
    });
    var link = base + (params.toString() ? "?" + params.toString() : "");
    $("s-link").value = link;
    var first = $("s-name").value.trim().split(" ")[0];
    var subject = "Your website questionnaire from " + (cfg.brand || "us");
    var body = "Hi" + (first ? " " + first : "") + ",\n\nTo get started on your new website, please fill in this short questionnaire. It covers your services, the images you want and what your customers should see. It takes about 15 minutes and saves as you go:\n\n" + link + "\n\nAny questions, call us on " + (cfg.phone || "") + ".\n\nThanks!";
    $("mail-btn").href = "mailto:" + encodeURIComponent($("s-email").value.trim()) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  /* ---------- Start up ---------- */
  function load() {
    return fetchBriefs().then(function (rows) {
      briefs = rows || [];
      if (selected) selected = briefs.filter(function (b) { return b.id === selected.id; })[0] || null;
      renderList();
      renderDetail();
    }).catch(function (err) {
      $("bf-list").innerHTML = '<li class="bf-empty">Couldn\'t load briefs: ' + esc(err.message) + ". If you just set up the questionnaire, run <code>supabase/add-client-briefs.sql</code> in Supabase.</li>";
    });
  }

  function showOnly(view) {
    $("loading").hidden = view !== "loading";
    $("auth-view").hidden = view !== "auth";
    $("app-view").hidden = view !== "app";
    $("top-actions").hidden = view !== "app";
  }

  function showAuth(panel) {
    showOnly("auth");
    $("login-form").hidden = panel !== "login";
    $("denied").hidden = panel !== "denied";
    $("auth-title").textContent = panel === "denied" ? "No access yet" : "Team sign in";
  }

  function startApp() {
    showOnly("app");
    if (started) return load();
    started = true;
    if (S.remote) {
      S.db().channel("briefs-changes")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_briefs" }, function () { load(); toast("New brief received"); })
        .subscribe();
    }
    return load();
  }

  function afterSignIn(session) {
    return S.auth.isTeamMember().then(function (ok) {
      if (ok) return startApp();
      $("denied-email").textContent = (session && session.user && session.user.email) || "this account";
      showAuth("denied");
    });
  }

  $("bf-list").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-id]");
    if (!btn) return;
    selected = briefs.filter(function (b) { return String(b.id) === btn.getAttribute("data-id"); })[0] || null;
    renderList();
    renderDetail();
    if (matchMedia("(max-width: 959px)").matches) $("bf-detail").scrollIntoView({ block: "start" });
    $("bf-detail").focus({ preventScroll: true });
  });
  $("bf-search").addEventListener("input", renderList);
  $("export-btn").addEventListener("click", exportExcel);
  ["s-business", "s-name", "s-email"].forEach(function (id) { $(id).addEventListener("input", updateLink); });
  $("copy-btn").addEventListener("click", function () {
    var link = $("s-link").value;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () {
      toast("Link copied");
    }).catch(function () {
      $("s-link").select();
      toast("Press Ctrl+C to copy");
    });
  });
  updateLink();

  if (!S.remote) {
    $("local-notice").hidden = false;
    startApp();
    return;
  }

  $("signout-btn").hidden = false;
  $("signout-btn").addEventListener("click", function () { S.auth.signOut().then(function () { location.reload(); }); });
  $("denied-signout").addEventListener("click", function () { S.auth.signOut().then(function () { location.reload(); }); });
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var st = $("login-status");
    S.auth.signIn($("login-email").value.trim(), $("login-password").value).then(afterSignIn).catch(function (err) {
      st.className = "form-status error show";
      st.textContent = /invalid/i.test(err.message) ? "That email and password don't match." : err.message;
    });
  });
  S.auth.session().then(function (session) {
    if (session) return afterSignIn(session);
    showAuth("login");
  }).catch(function () { showAuth("login"); });
})();
