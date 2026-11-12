/* Fellowship Finder: "Import from Excel" for site admins.
   Reads the import template (or a similar sheet), shows a checked preview, then saves clubs and meetings. */
(function(){
  "use strict";
  const F = window.FF, esc = F.esc;
  const TEMPLATE_URL = "assets/templates/fellowship-finder-import-template.xlsx";
  const LIB_URL = "assets/vendor/xlsx.full.min.js";
  const DAY = F.DAY;

  // ---------- Column names the importer understands ----------
  const FIELDS = {
    name: ["club name", "club", "name"],
    type: ["club type", "type"],
    ri: ["ri club number", "ri number", "club number", "ri club no", "club no", "ri"],
    area: ["area", "club area"],
    city: ["city", "town", "city or town"],
    label: ["meeting name", "meeting"],
    often: ["how often", "frequency", "pattern"],
    day: ["meeting day", "day"],
    weeks: ["which weeks", "weeks", "weeks of the month"],
    anchor: ["one meeting date", "first meeting date", "start date", "date"],
    time: ["start time", "time"],
    length: ["length (minutes)", "length", "duration", "duration (minutes)"],
    format: ["format", "mode"],
    venue: ["venue", "venue name"],
    venueArea: ["venue area"],
    lat: ["latitude", "lat"],
    lng: ["longitude", "lng", "long"],
    maps: ["google maps link", "map link", "maps link", "location link", "venue map link", "google maps"],
    directions: ["directions note", "directions"],
    online: ["online note", "online joining note"],
    website: ["website", "web"],
    whatsapp: ["club whatsapp", "whatsapp", "phone"],
    email: ["club email", "email"],
    publish: ["show contacts publicly", "publish contacts", "show contacts"]
  };
  const norm = h => String(h == null ? "" : h).toLowerCase().replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const ALIAS = {}; Object.keys(FIELDS).forEach(k => FIELDS[k].forEach(a => { ALIAS[a] = k; }));

  // ---------- Value parsers ----------
  const str = v => v == null ? "" : String(v).trim();
  function parseTime(v){
    if (v == null || v === "") return null;
    if (typeof v === "number"){ const mins = Math.round((v % 1) * 1440) % 1440; return pad(Math.floor(mins/60)) + ":" + pad(mins % 60); }
    const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
    const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/);
    if (!m) return null;
    let h = +m[1]; const min = m[2] ? +m[2] : 0, ap = m[3] ? m[3].replace(/\./g, "") : "";
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return pad(h) + ":" + pad(min);
  }
  function pad(n){ return String(n).padStart(2, "0"); }
  function parseDate(v){
    if (v == null || v === "") return null;
    if (typeof v === "number") return F.isoDate(Date.UTC(1899, 11, 30) + Math.round(v) * DAY);
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return F.isoDate(Date.UTC(+m[1], +m[2]-1, +m[3]));
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);           // day/month/year (Uganda)
    if (m) return F.isoDate(Date.UTC(+m[3], +m[2]-1, +m[1]));
    return null;
  }
  const DAYS = {mo:"MO", tu:"TU", we:"WE", th:"TH", fr:"FR", sa:"SA", su:"SU"};
  function parseDay(v){ const s = str(v).toLowerCase(); return DAYS[s.slice(0, 2)] || null; }
  function parseOften(v, hasWeeks){
    const s = str(v).toLowerCase();
    if (/other|fortnight|bi-?week|alternate/.test(s)) return "biweekly";
    if (/month|weeks of/.test(s)) return "monthly";
    if (/week|every|daily/.test(s)) return "weekly";
    return hasWeeks ? "monthly" : "weekly";
  }
  function parseWeeks(v){
    const s = str(v).toLowerCase(); if (!s) return [];
    const out = new Set();
    if (/last/.test(s)) out.add(-1);
    const words = {first:1, second:2, third:3, fourth:4, fifth:5};
    Object.keys(words).forEach(w => { if (s.includes(w)) out.add(words[w]); });
    (s.match(/[1-5]/g) || []).forEach(d => out.add(+d));
    return [...out];
  }
  function parseFormat(v){
    const s = str(v).toLowerCase();
    if (!s) return "in_person";
    if (/\+|hybrid|and online|& online|both/.test(s)) return "hybrid";
    if (/online|virtual|zoom/.test(s)) return "online";
    return "in_person";
  }
  function parseType(v){
    const s = str(v).toLowerCase();
    if (/rotaract/.test(s)) return "rotaract";
    if (/rotary/.test(s)) return "rotary";
    return null;
  }
  function num(v){ if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; }

  // ---------- Read the workbook into checked rows ----------
  function readWorkbook(wb, existingClubs){
    const names = wb.SheetNames;
    const sheetName = names.find(n => /^clubs?$/i.test(n.trim())) || names.find(n => !/instruction|example|readme|help/i.test(n)) || names[0];
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, raw:true, defval:null, blankrows:false});
    const hIdx = grid.findIndex(r => (r || []).some(c => ALIAS[norm(c)] === "name"));
    if (hIdx < 0) return {fatal: "Couldn't find a header row with a \"Club name\" column in the sheet \"" + sheetName + "\". Use the template, or make sure the first row has the column names."};
    const header = grid[hIdx].map(c => ALIAS[norm(c)] || null);
    const missingCols = ["name", "type", "day", "time"].filter(k => !header.includes(k));
    if (missingCols.length) return {fatal: "These columns are missing: " + missingCols.map(k => FIELDS[k][0]).join(", ") + ". Add them, or use the template."};

    const rows = [], clubs = new Map();
    const exByRi = new Map(), exByName = new Map();
    existingClubs.forEach(c => { if (c.ri_club_number) exByRi.set(+c.ri_club_number, c); exByName.set(c.name.trim().toLowerCase(), c); });

    grid.slice(hIdx + 1).forEach((cells, i) => {
      const get = {}; header.forEach((k, j) => { if (k && get[k] == null) get[k] = cells[j]; });
      if (!Object.values(get).some(v => v != null && String(v).trim() !== "")) return;    // empty row
      const rowNum = hIdx + i + 2, errors = [], warnings = [];
      const name = str(get.name), type = parseType(get.type);
      const riRaw = str(get.ri).replace(/[^\d]/g, ""), ri = riRaw ? parseInt(riRaw, 10) : null;
      if (name.length < 3) errors.push("Club name is missing");
      if (!type) errors.push("Club type should be Rotaract or Rotary");

      // Club details
      let website = str(get.website); if (website && !/^https?:\/\//i.test(website)) website = "https://" + website.replace(/^\/+/, "");
      let whatsapp = str(get.whatsapp).replace(/[^\d+ ]/g, "").trim();
      if (whatsapp && !/^\+?[0-9 ]{7,20}$/.test(whatsapp)){ warnings.push("WhatsApp number not recognised, left out"); whatsapp = ""; }
      let email = str(get.email);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ warnings.push("Club email not recognised, left out"); email = ""; }
      const club = {
        name, type, ri_club_number: ri, area: str(get.area).slice(0, 80) || null, city: str(get.city).slice(0, 80) || null,
        website: website || null, contact_whatsapp: whatsapp || null, contact_email: email || null,
        publish_contacts: /^y/i.test(str(get.publish))
      };

      // Meeting
      const day = parseDay(get.day), time = parseTime(get.time);
      const weeks = parseWeeks(get.weeks), often = parseOften(get.often, weeks.length > 0);
      const mode = parseFormat(get.format);
      if (!day) errors.push("Meeting day is missing or not a weekday");
      if (!time) errors.push("Start time is missing or not understood (use e.g. 18:00 or 6:00 PM)");
      if (often === "monthly" && !weeks.length) errors.push("Which weeks is needed for 'Certain weeks of the month' (e.g. 1st & 3rd)");
      let anchor = parseDate(get.anchor);
      if (often === "biweekly" && !anchor){ warnings.push("No meeting date for 'Every other week'; counting from this week"); anchor = F.isoDate(F.todayMs()); }
      let lat = num(get.lat), lng = num(get.lng);
      if ((lat == null || lng == null) && get.maps){ const c = F.parseCoords(str(get.maps)); if (c){ lat = c.lat; lng = c.lng; } }
      if (lat != null && lng != null && Math.abs(lat) > 20 && Math.abs(lng) < 20){ const t = lat; lat = lng; lng = t; warnings.push("Latitude and longitude looked swapped, so they were switched"); }
      if (lat != null && (Math.abs(lat) > 90 || lng == null || Math.abs(lng) > 180)){ lat = null; lng = null; }
      const venue = str(get.venue).slice(0, 120);
      let meeting = null, meetingNote = "";
      if (!errors.length){
        if (mode !== "online" && !venue) errors.push("Venue is missing");
        else if (mode !== "online" && (lat == null || lng == null)){
          const shortLink = /goo\.gl|maps\.app/i.test(str(get.maps));
          meetingNote = shortLink
            ? "Meeting not imported: short Google Maps links (maps.app.goo.gl) can't be read. Open the link in a browser and copy the full address from the address bar, or add Latitude and Longitude."
            : "Meeting not imported: no map location. Add Latitude and Longitude, or add the meeting in the admin area after importing.";
        } else {
          const lengthMin = Math.round(num(get.length) || 90);
          meeting = {
            label: (str(get.label) || "Fellowship").slice(0, 60),
            rrule: F.buildRule({pattern: often, weekday: day, nths: weeks}),
            dtstart: often === "biweekly" ? anchor : F.isoDate(F.todayMs()),
            start_time: time, duration_minutes: Math.min(600, Math.max(15, lengthMin)), mode,
            venue_name: mode === "online" ? null : venue,
            area: mode === "online" ? null : ((str(get.venueArea) || str(get.area)).slice(0, 80) || null),
            lat: mode === "online" ? null : lat, lng: mode === "online" ? null : lng,
            directions_note: mode === "online" ? null : (str(get.directions).slice(0, 300) || null),
            online_note: mode === "in_person" ? null : (str(get.online).slice(0, 300) || null),
            is_active: true
          };
        }
      }

      const row = {rowNum, name, errors, warnings, meeting, meetingNote, club, often, day, time, mode, venue};
      rows.push(row);
      if (errors.length) return;

      // Group rows into clubs
      // Same club if the name matches, or the RI club number matches
      const lname = name.toLowerCase();
      let g = [...clubs.values()].find(x => x.lname === lname || (ri && x.club.ri_club_number === ri));
      if (!g){
        const key = "c" + clubs.size;
        const ex = (ri && exByRi.get(ri)) || exByName.get(name.toLowerCase()) || null;
        g = {key, lname, club: Object.assign({}, club), existing: ex, meetings: [], rows: []};
        clubs.set(key, g);
      } else {
        Object.keys(club).forEach(k => { if (g.club[k] == null || g.club[k] === "" ) g.club[k] = club[k]; });
        if (club.publish_contacts) g.club.publish_contacts = true;
      }
      if (meeting) g.meetings.push(meeting);
      g.rows.push(row);
      row.group = g;
    });
    return {sheetName, rows, clubs: [...clubs.values()]};
  }

  // ---------- UI ----------
  let ctx, parsed = null, fileName = "";
  function loadLib(){
    if (window.XLSX) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = LIB_URL; s.onload = res; s.onerror = () => rej(new Error("Couldn't load the spreadsheet reader. Check your connection and try again.")); document.head.appendChild(s); });
  }
  function start(context){
    ctx = context; parsed = null;
    const el = ctx.container;
    el.innerHTML =
      '<div class="stack"><div><h2>Import from Excel</h2><p class="msg" style="color:var(--muted)">Add or update many clubs and meetings at once. Nothing is saved until you check the preview and click Import.</p></div>' +
      '<ol class="imp-steps">' +
        '<li><strong>Download the template</strong> and fill in one row per meeting. Hover over the column headers in Excel for help.<div class="row" style="margin-top:8px"><a class="btn ghost small" href="' + TEMPLATE_URL + '" download>Download template (.xlsx)</a></div></li>' +
        '<li><strong>Choose your filled-in file.</strong> Excel (.xlsx, .xls) or CSV.' +
          '<label class="imp-drop" id="impDrop"><input type="file" id="impFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"><span>Tap to choose a file, or drop it here</span></label></li>' +
        '<li><strong>Check the preview</strong> and click Import.</li>' +
      '</ol><p class="msg" id="impMsg" aria-live="polite"></p><div id="impPreview"></div></div>';
    const input = el.querySelector("#impFile"), drop = el.querySelector("#impDrop");
    input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); });
    ["dragover", "dragenter"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); });
  }
  function setMsg(text, kind){ const m = ctx.container.querySelector("#impMsg"); m.className = "msg" + (kind ? " " + kind : ""); m.textContent = text; }
  async function handleFile(file){
    fileName = file.name;
    if (file.size > 5 * 1024 * 1024){ setMsg("That file is over 5 MB. Remove extra sheets or images and try again.", "err"); return; }
    setMsg("Reading " + file.name + "…");
    try {
      await loadLib();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:"array", cellDates:false});
      const res = readWorkbook(wb, ctx.getClubs());
      if (res.fatal){ setMsg(res.fatal, "err"); ctx.container.querySelector("#impPreview").innerHTML = ""; return; }
      if (!res.rows.length){ setMsg("The sheet \"" + res.sheetName + "\" has no club rows yet.", "err"); return; }
      parsed = res; setMsg(""); renderPreview();
    } catch(err){ console.error(err); setMsg(err && err.message && /reader/.test(err.message) ? err.message : "Couldn't read that file. Save it as .xlsx from Excel and try again.", "err"); }
  }
  function patternText(r){
    if (!r.meeting) return "";
    return F.describeRule(r.meeting.rrule, true) + ", " + F.fmtTime(r.meeting.start_time);
  }
  function renderPreview(){
    const p = parsed, clubs = p.clubs;
    const samples = ctx.getClubs().filter(c => c.is_sample);
    const newC = clubs.filter(g => !g.existing).length, upd = clubs.length - newC;
    const meetings = clubs.reduce((n, g) => n + g.meetings.length, 0);
    const bad = p.rows.filter(r => r.errors.length).length, noLoc = p.rows.filter(r => r.meetingNote).length;
    const sampleMatch = clubs.filter(g => g.existing && g.existing.is_sample).length;
    let html = '<div class="imp-summary">' +
      '<span class="pill approved">' + newC + ' new club' + (newC === 1 ? "" : "s") + '</span>' +
      (upd ? '<span class="pill">' + upd + ' to update</span>' : "") +
      '<span class="pill">' + meetings + ' meeting' + (meetings === 1 ? "" : "s") + '</span>' +
      (noLoc ? '<span class="pill pending">' + noLoc + ' without a map location</span>' : "") +
      (bad ? '<span class="pill rejected">' + bad + ' row' + (bad === 1 ? "" : "s") + ' with problems</span>' : "") +
      '</div>' +
      '<p class="msg" style="color:var(--muted)">From <strong>' + esc(fileName) + '</strong>, sheet "' + esc(p.sheetName) + '". New clubs are approved and appear on the public page straight away. Updated clubs keep their status; their meetings are replaced by the ones in this file.</p>' +
      (samples.length ? '<label class="check"><input type="checkbox" id="impRemoveSamples" checked><span>Remove the ' + samples.length + ' sample club' + (samples.length === 1 ? "" : "s") + ' first</span></label>' : "") +
      '<div class="imp-table-wrap"><table class="imp-table"><thead><tr><th>Row</th><th>Club</th><th>Meeting</th><th>Result</th></tr></thead><tbody>' +
      p.rows.map(r => {
        let status, cls;
        if (r.errors.length){ status = "Skipped: " + r.errors.join("; "); cls = "bad"; }
        else if (r.meetingNote){ status = (r.group.existing ? "Club updated. " : "Club added. ") + r.meetingNote; cls = "warn"; }
        else { status = r.group.existing ? (r.group.existing.is_sample ? "Updates a sample club" : "Updates existing club") : "New"; cls = "ok"; }
        const meet = r.meeting ? (esc(r.meeting.label) + ": " + patternText(r) + (r.meeting.venue_name ? " · " + esc(r.meeting.venue_name) : " · Online")) : (r.errors.length ? "" : esc(r.venue || ""));
        return '<tr class="' + cls + '"><td class="n">' + r.rowNum + '</td><td>' + esc(r.name || "(no name)") + (r.club.type ? '<br><small>' + (r.club.type === "rotary" ? "Rotary" : "Rotaract") + (r.club.ri_club_number ? " · " + r.club.ri_club_number : "") + '</small>' : "") + '</td>' +
          '<td>' + meet + '</td><td><span class="imp-status ' + cls + '">' + esc(status) + '</span>' +
          (r.warnings.length ? '<small class="imp-warn">' + r.warnings.map(esc).join("<br>") + '</small>' : "") + '</td></tr>';
      }).join("") +
      '</tbody></table></div>' +
      (sampleMatch ? '<p class="note warn">' + sampleMatch + ' club' + (sampleMatch === 1 ? " matches a sample club" : "s match sample clubs") + '. If you remove the samples, ' + (sampleMatch === 1 ? "it is" : "they are") + ' added as new instead.</p>' : "") +
      '<div class="row"><button class="btn" type="button" id="impGo"' + (clubs.length ? "" : " disabled") + '>Import ' + clubs.length + ' club' + (clubs.length === 1 ? "" : "s") + '</button>' +
      '<button class="btn ghost" type="button" id="impAgain">Choose another file</button></div>';
    const box = ctx.container.querySelector("#impPreview"); box.innerHTML = html;
    box.querySelector("#impAgain").addEventListener("click", () => start(ctx));
    box.querySelector("#impGo").addEventListener("click", e => runImport(e.target));
  }

  async function runImport(btn){
    const db = ctx.db, removeSamples = !!(ctx.container.querySelector("#impRemoveSamples") || {}).checked;
    btn.disabled = true; ctx.container.querySelector("#impAgain").disabled = true;
    const log = [], fail = [];
    const progress = t => { btn.textContent = t; };
    try {
      if (removeSamples){
        progress("Removing sample clubs…");
        const { error } = await db.from("clubs").delete().eq("is_sample", true);
        if (error) throw error;
        log.push("Removed the sample clubs");
      }
      const now = new Date().toISOString();
      let i = 0;
      for (const g of parsed.clubs){
        i++; progress("Importing " + i + " of " + parsed.clubs.length + "…");
        const ex = g.existing && !(removeSamples && g.existing.is_sample) ? g.existing : null;
        try {
          let clubId;
          if (ex){
            const upd = {}; Object.keys(g.club).forEach(k => { const v = g.club[k]; if (v !== null && v !== "" && !(k === "publish_contacts" && !v && ex.publish_contacts)) upd[k] = v; });
            upd.verified_at = now; upd.is_active = true;
            const r1 = await db.from("clubs").update(upd).eq("id", ex.id); if (r1.error) throw r1.error;
            clubId = ex.id;
            if (g.meetings.length){
              const r2 = await db.from("meetings").delete().eq("club_id", clubId); if (r2.error) throw r2.error;
            }
          } else {
            clubId = crypto.randomUUID();
            const row = Object.assign({}, g.club, {id: clubId, status: "approved", is_active: true, verified_at: now});
            if (!row.city) row.city = "Kampala";
            const r1 = await db.from("clubs").insert(row); if (r1.error) throw r1.error;
          }
          if (g.meetings.length){
            const r3 = await db.from("meetings").insert(g.meetings.map(m => Object.assign({club_id: clubId}, m))); if (r3.error) throw r3.error;
          }
          log.push((ex ? "Updated " : "Added ") + g.club.name + " (" + g.meetings.length + " meeting" + (g.meetings.length === 1 ? "" : "s") + ")");
        } catch(err){ fail.push(g.club.name + ": " + ctx.friendly(err)); }
      }
    } catch(err){ fail.unshift(ctx.friendly(err)); }
    await ctx.onDone();
    const skipped = parsed.rows.filter(r => r.errors.length || r.meetingNote);
    ctx.container.innerHTML = '<div class="stack"><h2>Import ' + (fail.length ? "finished with problems" : "complete") + '</h2>' +
      (log.length ? '<p class="note ok">' + log.length + ' change' + (log.length === 1 ? "" : "s") + ' saved.</p><ul class="imp-log">' + log.map(t => '<li>' + esc(t) + '</li>').join("") + '</ul>' : "") +
      (fail.length ? '<p class="note bad">These couldn\'t be saved:</p><ul class="imp-log">' + fail.map(t => '<li>' + esc(t) + '</li>').join("") + '</ul>' : "") +
      (skipped.length ? '<p class="note warn">Still to do: ' + skipped.length + ' row' + (skipped.length === 1 ? "" : "s") + ' weren\'t fully imported.</p><ul class="imp-log">' +
        skipped.map(r => '<li>Row ' + r.rowNum + ', ' + esc(r.name || "no name") + ': ' + esc(r.errors.length ? r.errors.join("; ") : "meeting needs a map location") + '</li>').join("") + '</ul>' : "") +
      '<div class="row"><button class="btn" type="button" id="impDone">Done</button><button class="btn ghost" type="button" id="impMore">Import another file</button></div></div>';
    ctx.container.querySelector("#impDone").addEventListener("click", ctx.onClose);
    ctx.container.querySelector("#impMore").addEventListener("click", () => start(ctx));
  }

  window.FFImport = { start, _readWorkbook: readWorkbook, _parseTime: parseTime };
})();
