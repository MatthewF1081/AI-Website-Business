/*
 * Lead store shared by the public forms and the CRM dashboard.
 *
 * Database mode (SITE_CONFIG.supabaseUrl + supabaseAnonKey set in build.js):
 *   - Website forms insert leads into Supabase. Visitors can only add leads,
 *     never read them (row level security, see supabase/schema.sql).
 *   - The CRM signs in a team member and reads/updates leads from Supabase.
 * Local mode (no Supabase settings): leads are kept in this browser's
 * localStorage, which is handy for demos and testing.
 *
 * Every CRM method returns a Promise.
 */
(function () {
  var cfg = window.SITE_CONFIG || {};
  var KEY = "tws_crm_leads_v1";
  var STAGES = [
    { id: "new", label: "New" },
    { id: "contacted", label: "Contacted" },
    { id: "proposal", label: "Proposal sent" },
    { id: "won", label: "Won" },
    { id: "lost", label: "Lost" }
  ];
  var remote = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  /* ---------- Field mapping (camelCase in the app, snake_case in the DB) ---------- */
  var COLUMNS = {
    id: "id", name: "name", company: "company", email: "email", phone: "phone",
    trade: "trade", package: "package", plan: "plan", addons: "addons", website: "website", serviceArea: "service_area",
    timeline: "timeline", message: "message", source: "source", stage: "stage",
    value: "value", followUp: "follow_up", notes: "notes", createdAt: "created_at"
  };
  var PUBLIC_FIELDS = ["name", "company", "email", "phone", "trade", "package", "plan", "addons", "website", "serviceArea", "timeline", "message", "source"];

  function toRow(obj, fields) {
    var row = {};
    (fields || Object.keys(COLUMNS)).forEach(function (k) {
      if (obj[k] === undefined) return;
      var v = obj[k];
      if (k === "followUp" && !v) v = null;
      if (k === "value") v = Number(v) || 0;
      row[COLUMNS[k]] = v;
    });
    return row;
  }

  function fromRow(row) {
    var lead = {};
    Object.keys(COLUMNS).forEach(function (k) {
      var v = row[COLUMNS[k]];
      lead[k] = v == null ? (k === "notes" ? [] : k === "value" ? 0 : "") : v;
    });
    lead.value = Number(lead.value) || 0;
    lead.updatedAt = row.updated_at;
    return lead;
  }

  /* ---------- Local (browser) storage ---------- */
  function localLoad() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function localSave(leads) {
    try {
      localStorage.setItem(KEY, JSON.stringify(leads));
      return true;
    } catch (e) {
      return false;
    }
  }

  function uid() {
    return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function localAdd(data) {
    var leads = localLoad();
    var now = new Date().toISOString();
    var lead = Object.assign({ id: uid(), stage: "new", value: 0, notes: [], createdAt: now, updatedAt: now }, data);
    leads.unshift(lead);
    leads.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
    localSave(leads);
    return lead;
  }

  /* ---------- Supabase ---------- */
  var client = null;
  function db() {
    if (!client) {
      if (!window.supabase || !window.supabase.createClient) throw new Error("The database library didn't load. Check your internet connection and reload.");
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    return client;
  }

  function check(res) {
    if (res.error) throw new Error(res.error.message || "Database error");
    return res.data;
  }

  // Public website form: insert only, no read-back (visitors can't read leads).
  function submit(data) {
    if (!remote) {
      localAdd(data);
      return Promise.resolve();
    }
    var headers = { "Content-Type": "application/json", "apikey": cfg.supabaseAnonKey, "Prefer": "return=minimal" };
    // Legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys don't.
    if (cfg.supabaseAnonKey.indexOf("sb_") !== 0) headers.Authorization = "Bearer " + cfg.supabaseAnonKey;
    return fetch(cfg.supabaseUrl + "/rest/v1/leads", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(toRow(data, PUBLIC_FIELDS))
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error("Lead not saved (" + r.status + "): " + t); });
    });
  }

  function list() {
    if (!remote) return Promise.resolve(localLoad());
    return db().from("leads").select("*").order("created_at", { ascending: false }).then(function (res) {
      return check(res).map(fromRow);
    });
  }

  // Also used to restore a deleted lead (keeps its id and createdAt).
  function add(data) {
    if (!remote) return Promise.resolve(localAdd(data));
    var row = toRow(data);
    if (!row.id || String(row.id).charAt(0) === "L") delete row.id;
    if (!row.created_at) delete row.created_at;
    return db().from("leads").insert(row).select().single().then(function (res) { return fromRow(check(res)); });
  }

  function update(id, patch) {
    if (!remote) {
      var leads = localLoad();
      for (var i = 0; i < leads.length; i++) {
        if (leads[i].id === id) {
          leads[i] = Object.assign({}, leads[i], patch, { updatedAt: new Date().toISOString() });
          localSave(leads);
          return Promise.resolve(leads[i]);
        }
      }
      return Promise.reject(new Error("Lead not found"));
    }
    var row = toRow(patch);
    delete row.id;
    delete row.created_at;
    return db().from("leads").update(row).eq("id", id).select().single().then(function (res) { return fromRow(check(res)); });
  }

  function remove(id) {
    if (!remote) {
      localSave(localLoad().filter(function (l) { return l.id !== id; }));
      return Promise.resolve();
    }
    return db().from("leads").delete().eq("id", id).then(check);
  }

  /* ---------- Team login (database mode only) ---------- */
  var auth = {
    session: function () {
      return db().auth.getSession().then(function (res) { return check(res).session; });
    },
    signIn: function (email, password) {
      return db().auth.signInWithPassword({ email: email, password: password }).then(function (res) { return check(res).session; });
    },
    signOut: function () {
      return db().auth.signOut();
    },
    resetPassword: function (email) {
      return db().auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] }).then(check);
    },
    updatePassword: function (password) {
      return db().auth.updateUser({ password: password }).then(check);
    },
    onChange: function (cb) {
      return db().auth.onAuthStateChange(cb);
    },
    // True when the signed-in email is listed in team_members.
    isTeamMember: function () {
      return db().from("team_members").select("email").limit(1).then(function (res) {
        return check(res).length > 0;
      });
    }
  };

  // Calls cb() whenever any lead is added, changed or deleted.
  function subscribe(cb) {
    if (!remote) {
      window.addEventListener("storage", function (e) { if (e.key === KEY) cb({ eventType: "local" }); });
      return;
    }
    db().channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, cb)
      .subscribe();
  }

  window.LeadStore = {
    STAGES: STAGES,
    remote: remote,
    submit: submit,
    list: list,
    add: add,
    update: update,
    remove: remove,
    subscribe: subscribe,
    auth: remote ? auth : null,
    // Raw Supabase client for other team pages (client briefs).
    db: remote ? db : null
  };
})();
