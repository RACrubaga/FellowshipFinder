/* Fellowship Finder: shared helpers for the public page and the admin area.
   Calendar maths runs in Kampala time (UTC+3, no daylight saving). */
(function(){
  "use strict";
  const DAY = 864e5, EAT = 3 * 3600e3;
  const WD = ["SU","MO","TU","WE","TH","FR","SA"];
  const WD_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const WD_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ---------- Small utilities ----------
  const store = {
    get(k, d){ try { const v = localStorage.getItem("ff." + k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem("ff." + k, JSON.stringify(v)); } catch(e){} }
  };
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  // ---------- Dates ----------
  function todayMs(){ const d = new Date(Date.now() + EAT); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  function parseDate(iso){ if (!iso) return null; const [y,m,d] = String(iso).slice(0,10).split("-").map(Number); return Date.UTC(y, m-1, d); }
  function isoDate(dayMs){ return new Date(dayMs).toISOString().slice(0,10); }
  function hhmm(t){ return String(t || "00:00").slice(0,5); }
  function toInstant(dayMs, t){ const [h,m] = hhmm(t).split(":").map(Number); return dayMs + h*3600e3 + m*60e3 - EAT; }
  function mondayOf(ms){ const wd = (new Date(ms).getUTCDay() + 6) % 7; return ms - wd*DAY; }
  function sfx(n){ const t = n % 100; if (t >= 11 && t <= 13) return "th"; return {1:"st",2:"nd",3:"rd"}[n % 10] || "th"; }
  function ordHtml(n){ return n + "<sup>" + sfx(n) + "</sup>"; }
  const SUP = {st:"ˢᵗ", nd:"ⁿᵈ", rd:"ʳᵈ", th:"ᵗʰ"};
  function ordText(n){ return n + SUP[sfx(n)]; }
  function fmtTime(t){ let [h,m] = hhmm(t).split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return h + ":" + String(m).padStart(2,"0") + " " + ap; }
  function fmtDayText(dayMs){ const d = new Date(dayMs); return WD_SHORT[d.getUTCDay()] + " " + ordText(d.getUTCDate()) + " " + MON[d.getUTCMonth()]; }
  function fmtDayHtml(dayMs){ const d = new Date(dayMs); return WD_SHORT[d.getUTCDay()] + " " + ordHtml(d.getUTCDate()) + " " + MON[d.getUTCMonth()]; }
  function daysAgo(ts){ if (!ts) return null; return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / DAY)); }

  // ---------- Meeting patterns (iCalendar RRULE subset) ----------
  function parseRule(r){
    const o = {}; String(r || "").split(";").forEach(p => { const [k,v] = p.split("="); if (k) o[k] = v; });
    return {
      freq:o.FREQ, interval:+(o.INTERVAL || 1),
      byday:(o.BYDAY || "").split(",").filter(Boolean).map(t => { const m = t.match(/^(-?\d)?([A-Z]{2})$/); return m ? {n: m[1] ? +m[1] : 0, wd: WD.indexOf(m[2])} : null; }).filter(Boolean)
    };
  }
  function matches(rule, dayMs, anchorMs){
    const d = new Date(dayMs), wd = d.getUTCDay();
    if (rule.freq === "WEEKLY"){
      if (!rule.byday.some(b => b.wd === wd)) return false;
      if (rule.interval > 1){ const wk = Math.round((mondayOf(dayMs) - mondayOf(anchorMs)) / (7*DAY)); return wk >= 0 && wk % rule.interval === 0; }
      return true;
    }
    if (rule.freq === "MONTHLY"){
      const dom = d.getUTCDate(), dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
      return rule.byday.some(b => b.wd === wd && (
        b.n === 0 ||
        (b.n > 0 && Math.ceil(dom/7) === b.n) ||
        (b.n < 0 && dom + 7*(-b.n) > dim && dom + 7*(-b.n - 1) <= dim)));
    }
    return false;
  }
  // Simple builder used by the admin form
  // spec: {pattern:"weekly"|"biweekly"|"monthly", weekday:"TH", nths:[1,3,-1]}
  function buildRule(spec){
    if (spec.pattern === "monthly"){
      const n = (spec.nths && spec.nths.length ? spec.nths : [1]).slice().sort((a,b) => (a < 0 ? 9 : a) - (b < 0 ? 9 : b));
      return "FREQ=MONTHLY;BYDAY=" + n.map(x => x + spec.weekday).join(",");
    }
    return "FREQ=WEEKLY;" + (spec.pattern === "biweekly" ? "INTERVAL=2;" : "") + "BYDAY=" + spec.weekday;
  }
  function ruleToSpec(r){
    const rule = parseRule(r), wd = rule.byday[0] ? WD[rule.byday[0].wd] : "TH";
    if (rule.freq === "MONTHLY") return {pattern:"monthly", weekday:wd, nths:rule.byday.map(b => b.n || 1)};
    return {pattern: rule.interval === 2 ? "biweekly" : "weekly", weekday:wd, nths:[]};
  }
  function describeRule(r, html){
    const rule = parseRule(r); if (!rule.byday.length) return "Pattern not set";
    const day = WD_LONG[rule.byday[0].wd];
    if (rule.freq === "WEEKLY") return (rule.interval === 2 ? "Every other " : "Every ") + rule.byday.map(b => WD_LONG[b.wd]).join(" & ");
    const ord = n => n < 0 ? "Last" : (html ? ordHtml(n) : ordText(n));
    const ns = rule.byday.map(b => ord(b.n || 1));
    const joined = ns.length > 1 ? ns.slice(0, -1).join(", ") + " & " + ns[ns.length-1] : ns[0];
    return joined + " " + day + " of the month";
  }

  // Occurrences of a meeting over the next `days`, with one-off changes applied.
  // Returns items {day, time, start, end, venue_name, lat, lng, cancelled, moved, reason, originalDay}
  function occurrences(meeting, changes, opts){
    opts = opts || {};
    const days = opts.days || 70, rule = parseRule(meeting.rrule);
    const t0 = opts.from != null ? opts.from : todayMs();
    const anchor = parseDate(meeting.dtstart) ?? t0;
    const dur = (meeting.duration_minutes || 90) * 60e3;
    const byDate = {}; (changes || []).forEach(c => { byDate[c.original_date] = c; });
    const out = [];
    for (let i = 0; i < days; i++){
      const day = t0 + i*DAY;
      if (!matches(rule, day, anchor)) continue;
      const ch = byDate[isoDate(day)];
      const base = {day, originalDay:day, time:hhmm(meeting.start_time), venue_name:meeting.venue_name, lat:meeting.lat, lng:meeting.lng, change:ch || null};
      if (ch && ch.kind === "cancelled"){ base.cancelled = true; base.reason = ch.reason; }
      else if (ch && ch.kind === "moved"){
        base.moved = true; base.reason = ch.reason;
        if (ch.new_date) base.day = parseDate(ch.new_date);
        if (ch.new_time) base.time = hhmm(ch.new_time);
        if (ch.new_venue_name) base.venue_name = ch.new_venue_name;
        if (ch.new_lat != null && ch.new_lng != null){ base.lat = ch.new_lat; base.lng = ch.new_lng; }
      }
      base.start = toInstant(base.day, base.time); base.end = base.start + dur;
      out.push(base);
    }
    const now = Date.now();
    return out.filter(o => opts.includePast || o.end > now).sort((a,b) => a.start - b.start);
  }

  // ---------- Geometry ----------
  function haversine(a, b){
    const R = 6371, toR = Math.PI/180;
    const dLat = (b.lat - a.lat)*toR, dLng = (b.lng - a.lng)*toR;
    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  }
  function offsetKm(a, b){ return { x:(b.lng - a.lng)*111.32*Math.cos(a.lat*Math.PI/180), y:(b.lat - a.lat)*110.57 }; }
  function fmtKm(k){ return k < 1 ? Math.round(k*1000) + " m" : k.toFixed(k < 10 ? 1 : 0) + " km"; }
  function directionsUrl(lat, lng){ return "https://www.google.com/maps/dir/?api=1&destination=" + Number(lat).toFixed(5) + "," + Number(lng).toFixed(5); }
  // Accepts "0.31, 32.58", a Google Maps link with @lat,lng or q=lat,lng, or ?ll=
  function parseCoords(text){
    const t = String(text || "");
    const m = t.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
              t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const lat = +m[1], lng = +m[2];
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return {lat, lng};
  }

  // ---------- Theme toggle ----------
  const ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  function currentTheme(){
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function initTheme(btn){
    // Opens in light mode unless the person has switched to dark on this device
    const saved = store.get("theme", null);
    document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
    if (!btn) return;
    const paint = () => {
      const dark = currentTheme() === "dark";
      btn.innerHTML = (dark ? ICON_SUN : ICON_MOON) + "<span>" + (dark ? "Light mode" : "Dark mode") + "</span>";
      btn.setAttribute("aria-pressed", String(dark));
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    };
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next); store.set("theme", next); paint();
    });
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paint); } catch(e){}
    paint();
  }

  // ---------- Database client ----------
  let client;
  function db(){
    if (client !== undefined) return client;
    const c = window.FF_CONFIG || {};
    const ok = c.supabaseUrl && c.supabaseAnonKey && window.supabase && typeof window.supabase.createClient === "function";
    client = ok ? window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey) : null;
    return client;
  }
  function isConfigured(){ const c = window.FF_CONFIG || {}; return !!(c.supabaseUrl && c.supabaseAnonKey); }

  window.FF = {
    DAY, EAT, WD, WD_LONG, WD_SHORT, MON, store, esc,
    todayMs, parseDate, isoDate, hhmm, toInstant, ordHtml, ordText, fmtTime, fmtDayText, fmtDayHtml, daysAgo,
    parseRule, matches, buildRule, ruleToSpec, describeRule, occurrences,
    haversine, offsetKm, fmtKm, directionsUrl, parseCoords,
    initTheme, currentTheme, db, isConfigured
  };
})();
