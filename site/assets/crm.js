(function () {
  var S = window.LeadStore;
  var ICON = window.CRM_ICONS || {};
  var STAGE_COLORS = { new: "#1d5fa8", contacted: "#c58a00", proposal: "#e0692a", won: "#1f7a4d", lost: "#9a8a80" };
  var PACKAGE_VALUE = { "Starter": 997, "Standard": 1997, "Plus": 3497 };
  // Monthly plans count as 12 months.
  var PLAN_VALUE = { "Care": 99 * 12, "Growth": 397 * 12 };
  var FOUNDING = "[Founding client offer]";

  // The oldest leads stored a monthly plan in the package field; read them as plans.
  function normalize(l) {
    if (["Care", "Leads", "Dominate"].indexOf(l.package) !== -1 && !l.plan) l = Object.assign({}, l, { plan: l.package, package: "" });
    return l;
  }
  function isFounding(l) { return (l.message || "").indexOf(FOUNDING) === 0; }
  function autoValue(pkg, plan) {
    return (PACKAGE_VALUE[pkg] || 0) + (PLAN_VALUE[plan] || 0);
  }
  function addonList(l) {
    return (l.addons || "").split(",").map(function (a) { return a.trim(); }).filter(Boolean);
  }

  var state = {
    view: "board",
    activeStage: "new",
    sort: { key: "createdAt", dir: "desc" },
    q: "",
    trade: "",
    pkg: "",
    editingId: null
  };
  var leads = [];          // in-memory copy of every lead
  var ownIds = {};         // leads added from this tab (no "new lead" toast for these)
  var started = false;

  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return "$" + Math.round(Number(n) || 0).toLocaleString("en-US"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var stageLabel = function (id) {
    var s = S.STAGES.filter(function (x) { return x.id === id; })[0];
    return s ? s.label : id;
  };
  var byId = function (id) { return leads.filter(function (l) { return l.id === id; })[0]; };
  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return "just now";
    if (d < 3600) return Math.floor(d / 60) + "m ago";
    if (d < 86400) return Math.floor(d / 3600) + "h ago";
    if (d < 86400 * 30) return Math.floor(d / 86400) + "d ago";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function leadValue(l) {
    return Number(l.value) || autoValue(l.package, l.plan);
  }
  function busy(btn, on, label) {
    if (on) {
      btn.dataset.html = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> ' + (label || "Saving…");
    } else if (btn.dataset.html) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.html;
    }
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg, actionLabel, action) {
    var t = $("toast");
    t.innerHTML = "<span>" + esc(msg) + "</span>" + (actionLabel ? '<button type="button">' + esc(actionLabel) + "</button>" : "");
    if (actionLabel) t.querySelector("button").onclick = function () { action(); t.classList.remove("show"); };
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, actionLabel ? 6000 : 3500);
  }
  function fail(err) {
    toast((err && err.message) || "Something went wrong. Please try again.");
  }

  /* ---------- Data ---------- */
  function reload() {
    return S.list().then(function (all) {
      leads = all.map(normalize);
      render();
    }).catch(function (err) {
      showNotice("err", "<b>Couldn't load leads.</b> " + esc(err.message) + " Check your Supabase settings in <code>build.js</code> and your internet connection, then reload.");
    });
  }

  function filtered() {
    var q = state.q.toLowerCase();
    return leads.filter(function (l) {
      if (state.trade && (l.trade || "").indexOf(state.trade) === -1) return false;
      if (state.pkg && l.package !== state.pkg && l.plan !== state.pkg) return false;
      if (q) {
        var hay = [l.name, l.company, l.email, l.phone, l.serviceArea, l.message, l.addons].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- Render ---------- */
  function renderStats(all) {
    var weekAgo = Date.now() - 7 * 86400000;
    var open = 0, won = 0, wonN = 0, lostN = 0, week = 0;
    all.forEach(function (l) {
      if (new Date(l.createdAt).getTime() > weekAgo) week++;
      if (l.stage === "won") { won += leadValue(l); wonN++; }
      else if (l.stage === "lost") lostN++;
      else open += leadValue(l);
    });
    $("s-total").textContent = all.length;
    $("s-week").textContent = week;
    $("s-open").textContent = money(open);
    $("s-won").textContent = money(won);
    $("s-rate").textContent = wonN + lostN ? Math.round((wonN / (wonN + lostN)) * 100) + "%" : "–";
  }

  function followTag(l) {
    if (!l.followUp || l.stage === "won" || l.stage === "lost") return "";
    var t = today();
    if (l.followUp < t) return '<span class="tag-sm overdue">Overdue</span>';
    if (l.followUp === t) return '<span class="tag-sm due">Follow up today</span>';
    return "";
  }

  function cardHTML(l) {
    var opts = S.STAGES.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === l.stage ? " selected" : "") + ">" + s.label + "</option>";
    }).join("");
    var trades = (l.trade || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    return '<article class="lead-card" draggable="true" data-id="' + esc(l.id) + '">' +
      '<button class="open-btn" type="button" aria-label="Open ' + esc(l.name || "lead") + '"></button>' +
      "<b>" + esc(l.name || "Unnamed lead") + "</b>" +
      (l.company ? '<span class="co">' + esc(l.company) + "</span>" : "") +
      (leadValue(l) ? '<span class="val">' + money(leadValue(l)) + "</span>" : "") +
      '<div class="tags">' +
        trades.map(function (t) { return '<span class="tag-sm">' + esc(t) + "</span>"; }).join("") +
        (isFounding(l) ? '<span class="tag-sm founding">Founding 30%</span>' : "") +
        (l.source === "chatbot" ? '<span class="tag-sm chat">Chat</span>' : "") +
        (l.package ? '<span class="tag-sm pkg">' + esc(l.package) + "</span>" : "") +
        (l.plan && l.plan !== "None" ? '<span class="tag-sm plan">' + esc(l.plan) + " plan</span>" : "") +
        (addonList(l).length ? '<span class="tag-sm extra">+' + addonList(l).length + " add-on" + (addonList(l).length > 1 ? "s" : "") + "</span>" : "") +
        followTag(l) +
      "</div>" +
      '<div class="foot"><span>' + ago(l.createdAt) + "</span>" +
        '<label class="sr-only" for="mv-' + esc(l.id) + '">Move ' + esc(l.name) + ' to stage</label>' +
        '<select class="move" id="mv-' + esc(l.id) + '" data-move="' + esc(l.id) + '">' + opts + "</select>" +
      "</div>" +
    "</article>";
  }

  function renderBoard(list) {
    $("stage-tabs").innerHTML = S.STAGES.map(function (s) {
      var n = list.filter(function (l) { return l.stage === s.id; }).length;
      return '<button type="button" role="tab" data-stage="' + s.id + '" aria-selected="' + (s.id === state.activeStage) + '">' +
        s.label + ' <span class="count">' + n + "</span></button>";
    }).join("");

    $("board").innerHTML = S.STAGES.map(function (s) {
      var items = list.filter(function (l) { return l.stage === s.id; });
      var total = items.reduce(function (a, l) { return a + leadValue(l); }, 0);
      return '<section class="column' + (s.id === state.activeStage ? " active" : "") + '" data-stage="' + s.id + '" aria-label="' + s.label + '">' +
        '<div class="column-head"><h2><span class="dot" style="background:' + STAGE_COLORS[s.id] + '"></span>' + s.label +
        ' <span class="meta">' + items.length + "</span></h2><span class=\"meta\">" + money(total) + "</span></div>" +
        '<div class="column-cards">' + (items.length ? items.map(cardHTML).join("") : '<div class="column-empty">No leads here</div>') + "</div>" +
      "</section>";
    }).join("");
  }

  function renderList(list) {
    var k = state.sort.key, dir = state.sort.dir === "asc" ? 1 : -1;
    list = list.slice().sort(function (a, b) {
      var x = k === "value" ? leadValue(a) : (a[k] || "").toString().toLowerCase();
      var y = k === "value" ? leadValue(b) : (b[k] || "").toString().toLowerCase();
      return x < y ? -dir : x > y ? dir : 0;
    });
    document.querySelectorAll("[data-sort]").forEach(function (b) {
      if (b.dataset.sort === k) b.setAttribute("aria-sort", state.sort.dir === "asc" ? "ascending" : "descending");
      else b.removeAttribute("aria-sort");
    });
    $("list").innerHTML = list.length ? list.map(function (l) {
      return '<tr data-id="' + esc(l.id) + '">' +
        '<td><button type="button" class="lead-link">' + esc(l.name || "Unnamed lead") + '</button><span class="sub">' + esc(l.company || l.phone || l.email || "") + "</span></td>" +
        "<td>" + esc(l.trade || "—") + "</td>" +
        "<td>" + esc([l.package, l.plan && l.plan !== "None" ? l.plan + " plan" : ""].filter(Boolean).join(" + ") || "—") +
          (addonList(l).length ? '<span class="sub">+' + addonList(l).length + " add-on" + (addonList(l).length > 1 ? "s" : "") + "</span>" : "") + "</td>" +
        '<td><span class="stage-pill"><span class="dot" style="background:' + STAGE_COLORS[l.stage] + '"></span>' + stageLabel(l.stage) + "</span></td>" +
        '<td class="r">' + (leadValue(l) ? money(leadValue(l)) : "—") + "</td>" +
        '<td class="r">' + ago(l.createdAt) + "</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="6" class="muted" style="text-align:center;padding:32px">No leads match these filters.</td></tr>';
  }

  function render() {
    leads = leads.map(normalize);
    var list = filtered();
    renderStats(leads);
    $("empty").hidden = leads.length > 0;
    $("board-view").hidden = !leads.length || state.view !== "board";
    $("list-view").hidden = !leads.length || state.view !== "list";
    if (state.view === "board") renderBoard(list); else renderList(list);
    var filtersOn = state.q || state.trade || state.pkg;
    $("crm-live").textContent = filtersOn ? list.length + " of " + leads.length + " leads shown" : "";
  }

  function showNotice(kind, html) {
    var n = $("mode-notice");
    n.className = "crm-notice" + (kind ? " " + kind : "");
    $("mode-text").innerHTML = html;
    n.hidden = false;
  }

  /* ---------- Drawer ---------- */
  var drawer = $("drawer");
  var form = $("lead-form");
  var lastFocus = null;

  $("l-stage").innerHTML = S.STAGES.map(function (s) { return '<option value="' + s.id + '">' + s.label + "</option>"; }).join("");

  function renderNotes(lead) {
    var notes = (lead && lead.notes) || [];
    $("note-list").innerHTML = notes.length ? notes.slice().reverse().map(function (n) {
      return '<li><time datetime="' + esc(n.at) + '">' + new Date(n.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + "</time>" + esc(n.text) + "</li>";
    }).join("") : '<li class="muted">No notes yet.</li>';
  }

  function renderQuick(lead) {
    var q = $("quick-actions");
    if (!lead) { q.innerHTML = ""; return; }
    var tel = (lead.phone || "").replace(/[^\d+]/g, "");
    var html = "";
    if (tel) {
      html += '<a class="btn btn-accent btn-sm" href="tel:' + esc(tel) + '">' + ICON.phone + "Call</a>";
      html += '<a class="btn btn-outline btn-sm" href="sms:' + esc(tel) + '">' + ICON.message + "Text</a>";
    }
    if (lead.email) html += '<a class="btn btn-outline btn-sm" href="mailto:' + esc(lead.email) + '">' + ICON.mail + "Email</a>";
    if (lead.website) html += '<a class="btn btn-outline btn-sm" href="' + esc(/^https?:/i.test(lead.website) ? lead.website : "https://" + lead.website) + '" target="_blank" rel="noopener noreferrer">Their site</a>';
    q.innerHTML = html;
  }

  function openDrawer(id) {
    lastFocus = document.activeElement;
    var lead = id ? byId(id) : null;
    state.editingId = lead ? lead.id : null;
    form.reset();
    form.querySelectorAll(".field.invalid").forEach(function (f) { f.classList.remove("invalid"); });
    $("drawer-title").textContent = lead ? (lead.name || "Lead") : "New lead";
    $("delete-btn").hidden = !lead;
    $("notes-section").hidden = !lead;
    if (lead) {
      ["name", "company", "phone", "email", "package", "plan", "stage", "serviceArea", "followUp", "message"].forEach(function (k) {
        if (form.elements[k]) form.elements[k].value = lead[k] || "";
      });
      form.elements.trade.value = (lead.trade || "").split(",")[0].trim();
      var chosen = addonList(lead);
      form.querySelectorAll('input[name="addon"]').forEach(function (c) { c.checked = chosen.indexOf(c.value) !== -1; });
      form.elements.value.value = lead.value || autoValue(lead.package, lead.plan) || "";
    } else {
      form.elements.stage.value = state.view === "board" ? state.activeStage : "new";
    }
    renderQuick(lead);
    renderNotes(lead);
    drawer.classList.add("open");
    drawer.removeAttribute("inert");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(function () { (lead ? drawer.querySelector("[data-close]") : $("l-name")).focus(); }, 50);
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("inert", "");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.editingId = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  [form.elements.package, form.elements.plan].forEach(function (sel) {
    sel.addEventListener("change", function () {
      var v = autoValue(form.elements.package.value, form.elements.plan.value);
      if (v) form.elements.value.value = v;
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nameField = $("l-name").closest(".field");
    if (!$("l-name").value.trim()) {
      nameField.classList.add("invalid");
      $("l-name-err").textContent = "Add a name so you can find this lead later.";
      $("l-name").setAttribute("aria-invalid", "true");
      $("l-name").setAttribute("aria-describedby", "l-name-err");
      $("l-name").focus();
      return;
    }
    nameField.classList.remove("invalid");
    $("l-name").setAttribute("aria-invalid", "false");
    var data = {};
    ["name", "company", "phone", "email", "trade", "package", "plan", "stage", "serviceArea", "followUp", "message"].forEach(function (k) {
      data[k] = (form.elements[k].value || "").trim();
    });
    data.addons = [].map.call(form.querySelectorAll('input[name="addon"]:checked'), function (c) { return c.value; }).join(", ");
    data.value = Number(form.elements.value.value) || 0;

    var btn = form.querySelector('button[type="submit"]');
    var id = state.editingId;
    busy(btn, true);
    var op = id ? S.update(id, data) : S.add(Object.assign({ source: "manual" }, data));
    op.then(function (saved) {
      if (id) {
        leads = leads.map(function (l) { return l.id === id ? saved : l; });
      } else {
        ownIds[saved.id] = true;
        leads = [saved].concat(leads.filter(function (l) { return l.id !== saved.id; }));
      }
      busy(btn, false);
      closeDrawer();
      render();
      toast(id ? "Lead saved" : "Lead added");
    }).catch(function (err) {
      busy(btn, false);
      fail(err);
    });
  });

  $("note-btn").addEventListener("click", function () {
    var text = $("note-text").value.trim();
    var lead = byId(state.editingId);
    if (!text || !lead) return;
    var btn = $("note-btn");
    busy(btn, true, "Adding…");
    var notes = (lead.notes || []).concat([{ at: new Date().toISOString(), text: text }]);
    S.update(lead.id, { notes: notes }).then(function (updated) {
      leads = leads.map(function (l) { return l.id === updated.id ? updated : l; });
      $("note-text").value = "";
      renderNotes(updated);
      busy(btn, false);
      $("note-text").focus();
    }).catch(function (err) {
      busy(btn, false);
      fail(err);
    });
  });

  $("delete-btn").addEventListener("click", function () {
    var lead = byId(state.editingId);
    if (!lead || !confirm("Delete " + (lead.name || "this lead") + "? You can undo right after.")) return;
    S.remove(lead.id).then(function () {
      leads = leads.filter(function (l) { return l.id !== lead.id; });
      closeDrawer();
      render();
      toast("Lead deleted", "Undo", function () {
        S.add(lead).then(function (restored) {
          ownIds[restored.id] = true;
          leads = leads.concat([restored]).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
          render();
        }).catch(fail);
      });
    }).catch(fail);
  });

  drawer.addEventListener("click", function (e) {
    if (e.target === drawer || e.target.closest("[data-close]")) closeDrawer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
  });

  /* ---------- Board interactions ---------- */
  function moveLead(id, stage) {
    var lead = byId(id);
    if (!lead || lead.stage === stage) return;
    var notes = (lead.notes || []).concat([{ at: new Date().toISOString(), text: "Moved from " + stageLabel(lead.stage) + " to " + stageLabel(stage) }]);
    // Show the move right away, then save it.
    leads = leads.map(function (l) { return l.id === id ? Object.assign({}, l, { stage: stage, notes: notes }) : l; });
    render();
    S.update(id, { stage: stage, notes: notes }).then(function (saved) {
      leads = leads.map(function (l) { return l.id === id ? saved : l; });
      toast((lead.name || "Lead") + " moved to " + stageLabel(stage));
    }).catch(function (err) {
      leads = leads.map(function (l) { return l.id === id ? lead : l; });
      render();
      fail(err);
    });
  }

  document.addEventListener("click", function (e) {
    var tab = e.target.closest("#stage-tabs [data-stage]");
    if (tab) { state.activeStage = tab.dataset.stage; render(); return; }
    var open = e.target.closest(".open-btn");
    if (open) { openDrawer(open.closest(".lead-card").dataset.id); return; }
    var row = e.target.closest("#list tr[data-id]");
    if (row) { openDrawer(row.dataset.id); return; }
    var sortBtn = e.target.closest("[data-sort]");
    if (sortBtn) {
      var k = sortBtn.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === "desc" ? "asc" : "desc" };
      render();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.matches("[data-move]")) moveLead(e.target.dataset.move, e.target.value);
  });

  var dragId = null;
  document.addEventListener("dragstart", function (e) {
    var card = e.target.closest && e.target.closest(".lead-card");
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragId);
  });
  document.addEventListener("dragend", function () {
    dragId = null;
    document.querySelectorAll(".dragging, .drop-target").forEach(function (el) { el.classList.remove("dragging", "drop-target"); });
  });
  document.addEventListener("dragover", function (e) {
    var col = e.target.closest && e.target.closest(".column");
    if (!col || !dragId) return;
    e.preventDefault();
    document.querySelectorAll(".drop-target").forEach(function (el) { if (el !== col) el.classList.remove("drop-target"); });
    col.classList.add("drop-target");
  });
  document.addEventListener("drop", function (e) {
    var col = e.target.closest && e.target.closest(".column");
    if (!col || !dragId) return;
    e.preventDefault();
    moveLead(dragId, col.dataset.stage);
  });

  /* ---------- Toolbar ---------- */
  var qTimer;
  $("q").addEventListener("input", function (e) {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { state.q = e.target.value.trim(); render(); }, 150);
  });
  $("f-trade").addEventListener("change", function (e) { state.trade = e.target.value; render(); });
  $("f-pkg").addEventListener("change", function (e) { state.pkg = e.target.value; render(); });
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.view = b.dataset.view;
      document.querySelectorAll("[data-view]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      try { localStorage.setItem("tws_crm_view", state.view); } catch (err) {}
      render();
    });
  });
  try {
    if (localStorage.getItem("tws_crm_view") === "list") {
      state.view = "list";
      document.querySelectorAll("[data-view]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.view === "list")); });
    }
  } catch (err) {}

  $("add-btn").addEventListener("click", function () { openDrawer(null); });
  $("empty-add").addEventListener("click", function () { openDrawer(null); });

  /* ---------- Export ---------- */
  $("export-btn").addEventListener("click", function () {
    if (!leads.length) { toast("No leads to export yet"); return; }
    var cols = ["name", "company", "phone", "email", "trade", "package", "plan", "addons", "stage", "value", "serviceArea", "website", "timeline", "followUp", "source", "message", "createdAt"];
    var cell = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [cols.join(",")].concat(leads.map(function (l) {
      return cols.map(function (c) { return cell(c === "stage" ? stageLabel(l.stage) : c === "value" ? leadValue(l) : l[c]); }).join(",");
    }));
    var blob = new Blob([rows.join("\n")], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leads-" + today() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Exported " + leads.length + " leads");
  });

  /* ---------- Sample data (browser-only mode) ---------- */
  $("sample-btn").hidden = S.remote;
  $("sample-btn").addEventListener("click", function () {
    var day = 86400000, now = Date.now();
    var iso = function (msAgo) { return new Date(now - msAgo).toISOString(); };
    var samples = [
      { name: "Sample: Dana Ruiz", company: "Ruiz Heating & Air", phone: "555-201-1001", email: "dana@example.com", trade: "HVAC", package: "Standard", stage: "new", serviceArea: "Mesa, AZ", message: "Current site is 8 years old and not mobile friendly.", source: "sample", createdAt: iso(2 * 3600000) },
      { name: "Sample: Marcus Lee", company: "Lee Plumbing Co.", phone: "555-201-1002", email: "marcus@example.com", trade: "Plumbing", package: "Starter", stage: "contacted", serviceArea: "Raleigh, NC", followUp: today(), source: "sample", createdAt: iso(2 * day) },
      { name: "Sample: Tara Brooks", company: "Summit Roofing", phone: "555-201-1003", email: "tara@example.com", trade: "Roofing", package: "Plus", stage: "proposal", serviceArea: "Denver Metro", message: "Wants city pages for 4 suburbs.", source: "sample", createdAt: iso(5 * day) },
      { name: "Sample: Jake Moreno", company: "Moreno Mechanical", phone: "555-201-1004", trade: "HVAC", package: "Standard", plan: "Growth", addons: "AI chatbot / after-hours capture", stage: "won", source: "sample", createdAt: iso(12 * day) },
      { name: "Sample: Priya Shah", company: "FlowRight Drains", phone: "555-201-1005", trade: "Plumbing", package: "Plus", plan: "Growth", stage: "proposal", message: "[Founding client offer] Uses Jobber, wants leads sent there.", source: "sample", createdAt: iso(3 * day) },
      { name: "Sample: Ben Carter", company: "Carter Exteriors", phone: "555-201-1006", trade: "Roofing", package: "Starter", stage: "lost", source: "sample", createdAt: iso(20 * day) }
    ];
    Promise.all(samples.map(function (s) { return S.add(Object.assign({ value: autoValue(s.package, s.plan) }, s)); }))
      .then(reload)
      .then(function () { toast("Sample leads loaded"); })
      .catch(fail);
  });

  /* ---------- Live updates ---------- */
  var reloadTimer;
  function onRemoteChange(payload) {
    if (payload && payload.eventType === "INSERT" && payload.new && !ownIds[payload.new.id]) {
      toast("New lead: " + (payload.new.name || "website request"));
    }
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(reload, 300);
  }

  /* ---------- Start up / sign in ---------- */
  function showOnly(view) {
    $("loading").hidden = view !== "loading";
    $("auth-view").hidden = view !== "auth";
    $("app-view").hidden = view !== "app";
    $("top-actions").hidden = view !== "app";
  }

  function showAuth(panel) {
    showOnly("auth");
    $("login-form").hidden = panel !== "login";
    $("newpw-form").hidden = panel !== "newpw";
    $("denied").hidden = panel !== "denied";
    $("auth-title").textContent = panel === "newpw" ? "Set a new password" : panel === "denied" ? "No access yet" : "Team sign in";
    var focus = panel === "login" ? $("login-email") : panel === "newpw" ? $("new-password") : $("denied-signout");
    setTimeout(function () { focus.focus(); }, 30);
  }

  function startApp() {
    showOnly("app");
    if (started) return reload();
    started = true;
    S.subscribe(onRemoteChange);
    return reload();
  }

  function authStatus(id, kind, msg) {
    var el = $(id);
    el.className = "form-status " + kind + " show";
    el.textContent = msg;
  }

  function afterSignIn(session) {
    return S.auth.isTeamMember().then(function (ok) {
      if (ok) return startApp();
      $("denied-email").textContent = (session && session.user && session.user.email) || "this account";
      showAuth("denied");
    });
  }

  document.querySelectorAll("[data-pw]").forEach(function (b) {
    b.addEventListener("click", function () {
      var input = $(b.dataset.pw);
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      b.textContent = show ? "Hide" : "Show";
      b.setAttribute("aria-pressed", String(show));
      b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  if (!S.remote) {
    showNotice("", "<b>Browser-only mode.</b> Leads are saved in this browser, so you'll only see quote requests sent from this device. To get every visitor's leads on any device, add your Supabase settings in <code>build.js</code> (see the README).");
    startApp();
    return;
  }

  $("mode-notice").hidden = true;
  $("signout-btn").hidden = false;
  showOnly("loading");

  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("login-email").value.trim();
    var pw = $("login-password").value;
    if (!email || !pw) { authStatus("login-status", "error", "Enter your email and password."); return; }
    var btn = e.target.querySelector('button[type="submit"]');
    busy(btn, true, "Signing in…");
    S.auth.signIn(email, pw).then(function (session) {
      busy(btn, false);
      $("login-password").value = "";
      $("login-status").className = "form-status";
      return afterSignIn(session);
    }).catch(function (err) {
      busy(btn, false);
      authStatus("login-status", "error", /invalid/i.test(err.message) ? "That email and password don't match. Try again or reset your password." : err.message);
      $("login-password").focus();
    });
  });

  $("forgot-btn").addEventListener("click", function () {
    var email = $("login-email").value.trim();
    if (!email) { authStatus("login-status", "error", "Enter your email above first, then click \"Forgot password?\"."); $("login-email").focus(); return; }
    S.auth.resetPassword(email).then(function () {
      authStatus("login-status", "success", "If that email has an account, a reset link is on its way.");
    }).catch(function (err) { authStatus("login-status", "error", err.message); });
  });

  $("newpw-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("new-password").value;
    if (pw.length < 8) { authStatus("newpw-status", "error", "Use at least 8 characters."); $("new-password").focus(); return; }
    var btn = e.target.querySelector('button[type="submit"]');
    busy(btn, true);
    S.auth.updatePassword(pw).then(function () {
      busy(btn, false);
      $("new-password").value = "";
      toast("Password updated");
      return S.auth.session().then(afterSignIn);
    }).catch(function (err) {
      busy(btn, false);
      authStatus("newpw-status", "error", err.message);
    });
  });

  function signOut() {
    S.auth.signOut().then(function () {
      leads = [];
      showAuth("login");
    });
  }
  $("signout-btn").addEventListener("click", signOut);
  $("denied-signout").addEventListener("click", signOut);

  try {
    S.auth.onChange(function (event) {
      if (event === "PASSWORD_RECOVERY") showAuth("newpw");
    });
    S.auth.session().then(function (session) {
      if (!$("newpw-form").hidden) return;
      if (session) return afterSignIn(session);
      showAuth("login");
    }).catch(function (err) {
      showAuth("login");
      authStatus("login-status", "error", err.message);
    });
  } catch (err) {
    showAuth("login");
    authStatus("login-status", "error", err.message);
  }
})();
