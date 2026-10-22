/* Du Aidai CRM – butai, užklausos, klientai, analitika */
"use strict";
const CSRF = document.querySelector('meta[name="csrf"]').content;
const $ = s => document.querySelector(s);
const APT_ST = ["Laisvas", "Rezervuotas", "Parduotas"];
const INQ_ST = [["nauja", "Nauja"], ["susisiekta", "Susisiekta"], ["uzdaryta", "Uždaryta"]];
const INQ_L = Object.fromEntries(INQ_ST);
const CL_ST = ["Potencialus", "Apžiūra", "Derybos", "Rezervavo", "Pirko", "Atsisakė"];
const ST_COLOR = { Laisvas: "var(--free)", Rezervuotas: "var(--res)", Parduotas: "var(--sold-strong)" };
const PLAN_DEFAULT = "/img/butas.webp";

/* ---------- DOM pagalbininkas ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const svgI = d => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 16 16"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.5"); s.setAttribute("aria-hidden", "true"); s.innerHTML = d; return s; };
const I = {
  del: () => svgI('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>'),
  tel: () => svgI('<path d="M5.5 2.5l1.5 3-1.5 1.2a8 8 0 0 0 3.8 3.8L10.5 9l3 1.5v2.2a1 1 0 0 1-1.1 1A11 11 0 0 1 2.3 3.6a1 1 0 0 1 1-1.1z"/>'),
  mail: () => svgI('<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M2.5 4.5L8 9l5.5-4.5"/>'),
  home: () => svgI('<path d="M2.5 7.5L8 3l5.5 4.5V13h-11z"/><path d="M6.5 13V9.5h3V13"/>'),
  bld: () => svgI('<path d="M2.5 13.5V5l4-2v10.5M9.5 13.5V3l4 2v8.5M1.5 13.5h13"/>'),
  inbox: () => svgI('<path d="M2 9l2-5.5h8L14 9v4H2z"/><path d="M2 9h3.5l1 1.5h3l1-1.5H14"/>'),
  user: () => svgI('<circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/>'),
  chart: () => svgI('<path d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5"/>'),
  gear: () => svgI('<circle cx="8" cy="8" r="2"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/>'),
  list: () => svgI('<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01"/>'),
  key: () => svgI('<circle cx="5" cy="10.5" r="2.5"/><path d="M7 8.5L13 2.5M11 4.5l1.5 1.5M9.5 6l1.5 1.5"/>'),
  dl: () => svgI('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
};

/* ---------- formatai ---------- */
const nf2 = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 0 });
const eur = n => n ? nf0.format(n) + " €" : "—";
const m2 = n => nf2.format(n || 0) + " m²";
const pad = n => String(n).padStart(2, "0");
const dt = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dOnly = t => dt(t).slice(0, 10);
function ago(t) {
  const s = (Date.now() - new Date(t)) / 1000;
  if (s < 60) return "ką tik";
  if (s < 3600) return "prieš " + Math.floor(s / 60) + " min.";
  if (s < 86400) return "prieš " + Math.floor(s / 3600) + " val.";
  if (s < 86400 * 7) return "prieš " + Math.floor(s / 86400) + " d.";
  return dOnly(t);
}
const num = s => { const n = parseFloat(String(s).replace(/\s|€|m²/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const digits = s => String(s || "").replace(/\D/g, "");
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const telHref = p => "tel:" + String(p).replace(/[^\d+]/g, "");
const fullName = c => (c.first + " " + c.last).trim();
const plural = (n, a, b, c) => n + " " + (n % 10 === 1 && n % 100 !== 11 ? a : (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19)) ? c : b);

/* ---------- API ---------- */
async function api(a, body, form) {
  let res;
  try {
    res = await fetch("api.php?a=" + a, {
      method: "POST", credentials: "same-origin",
      headers: form ? { "X-CSRF": CSRF } : { "X-CSRF": CSRF, "Content-Type": "application/json" },
      body: form ? body : JSON.stringify(body || {}),
    });
  } catch (e) { throw new Error("Nėra ryšio su serveriu. Patikrinkite internetą."); }
  let j = {};
  try { j = await res.json(); } catch (e) { j = { error: res.status === 413 ? "Failas per didelis." : "Serverio klaida (" + res.status + ")." }; }
  if (res.status === 401) { alert(j.error || "Sesija baigėsi."); location.href = "/crm/"; throw new Error("401"); }
  if (!res.ok || j.error) { const e = new Error(j.error || "Klaida"); e.status = res.status; e.data = j; throw e; }
  return j;
}
function toast(msg, bad) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast on" + (bad ? " bad" : "");
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.className = "toast", bad ? 6000 : 2600);
}
function dialog(title, body, actions) {
  return new Promise(res => {
    const d = h("dialog", { class: "dlg" });
    const acts = h("div", { class: "acts" }, ...actions.map(([label, val, cls]) => h("button", { class: "btn " + (cls || ""), type: "button", onclick: () => { d.close(); res(val); } }, label)));
    d.append(h("div", { class: "in" }, h("h3", {}, title), typeof body === "string" ? h("p", {}, body) : body, acts));
    d.addEventListener("close", () => { d.remove(); res(null); });
    document.body.append(d); d.showModal();
  });
}
const confirmDlg = (title, text, yes = "Taip", cls = "") => dialog(title, text, [["Atšaukti", false, "ghost"], [yes, true, cls]]);

/* ---------- būsena ---------- */
let S = null;                 /* visi duomenys iš serverio */
const aptById = id => S.apts.find(a => a.id === id);
const aptNo = id => aptById(id)?.no || "";
const inqsOf = id => S.inqs.filter(q => q.apt === id);
const newCount = () => S.inqs.filter(q => q.status === "nauja").length;
const replace = (list, rec) => { const i = list.findIndex(x => x.id === rec.id); if (i >= 0) list[i] = rec; else list.unshift(rec); };

/* neišsaugotų pakeitimų sargas (butas, klientas) */
let dirty = null;            /* { save: async fn } */
function setDirty(on, save) {
  dirty = on ? { save } : null;
  $("#savebar")?.classList.toggle("on", !!on);
}
addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && dirty) { e.preventDefault(); dirty.save(); }
});
function savebar(onSave, onCancel) {
  return h("div", { class: "savebar", id: "savebar" }, h("span", {}, "Yra neišsaugotų pakeitimų"),
    h("button", { class: "btn ghost small", type: "button", onclick: onCancel }, "Atšaukti"),
    h("button", { class: "btn small", type: "button", onclick: onSave, style: { background: "#fff", color: "var(--ink)", borderColor: "#fff" } }, "Išsaugoti"));
}

/* ---------- eksportas ---------- */
function csv(file, head, rows) {
  const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const body = "﻿" + [head, ...rows].map(r => r.map(q).join(";")).join("\r\n");
  const a = h("a", { href: URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" })), download: file });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
/* PDF: spausdinimo langas – „Išsaugoti kaip PDF“ (lietuviškos raidės be papildomų bibliotekų) */
function printSheet(title, sub, head, rows) {
  const sh = h("div", { class: "print-sheet" }, h("h1", {}, title), h("p", {}, sub),
    h("table", {}, h("thead", {}, h("tr", {}, ...head.map(x => h("th", {}, x)))), h("tbody", {}, ...rows.map(r => h("tr", {}, ...r.map(x => h("td", {}, x)))))));
  document.body.append(sh); document.body.classList.add("printing");
  const done = () => { sh.remove(); document.body.classList.remove("printing"); removeEventListener("afterprint", done); };
  addEventListener("afterprint", done);
  setTimeout(() => { print(); setTimeout(done, 1000); }, 50);
}
const today = () => dOnly(new Date());

/* ---------- laukai ---------- */
function fld(label, input, o = {}) {
  return h("label", { class: "f" + (o.wide ? " wide" : "") }, h("span", {}, label), o.suffix ? h("div", { class: "suffix" }, input, h("i", {}, o.suffix)) : input, o.hint ? h("small", {}, o.hint) : null);
}
function inputFor(obj, key, o = {}) {
  const x = o.area ? h("textarea", { rows: o.rows || 4 }) : o.options ? h("select", {}, ...o.options.map(v => Array.isArray(v) ? h("option", { value: v[0] }, v[1]) : h("option", { value: v }, v)))
    : h("input", { type: o.type || "text", inputmode: o.inputmode, placeholder: o.ph, autocomplete: "off" });
  x.value = o.num ? (obj[key] ? String(obj[key]).replace(".", ",") : "") : (obj[key] ?? "");
  const set = () => { obj[key] = o.num ? num(x.value) : x.value; o.on && o.on(x); };
  x.addEventListener("input", set); x.addEventListener("change", set);
  return x;
}
function stSelect(value, onchange) {
  const s = h("select", { class: "stsel " + value, "aria-label": "Būsena" }, ...APT_ST.map(v => h("option", { value: v, selected: v === value }, v)));
  s.onchange = () => { s.className = "stsel " + s.value; onchange(s.value, s); };
  return s;
}
const stTag = (s, label) => h("span", { class: "st " + s }, label || INQ_L[s] || s);
function aptOptions(sel, cur) {
  sel.append(h("option", { value: "" }, "— nepasirinktas —"));
  S.houses.forEach(hs => sel.append(h("optgroup", { label: hs.name }, ...S.apts.filter(a => a.house === hs.id).map(a =>
    h("option", { value: a.id, selected: a.id === cur }, `${a.no} · ${a.rooms} kamb. · ${nf2.format(a.area)} m² · ${a.status}`)))));
  return sel;
}

/* ---------- maršrutai ---------- */
let route = "", arg = "";
const NAV = () => [
  ["CRM", [["apzvalga", "Apžvalga", I.home], ["analitika", "Analitika", I.chart], ["uzklausos", "Užklausos", I.inbox, newCount()], ["butai", "Butai", I.bld], ["klientai", "Klientai", I.user]]],
  ["Sistema", [["nustatymai", "Nustatymai", I.gear], ["zurnalas", "Žurnalas", I.list], ["paskyros", "Paskyros", I.key], ["mano", "Mano paskyra", I.user]]],
];
const ALIAS = { butas: "butai", klientas: "klientai" };
function drawSide() {
  const side = $("#side"); side.innerHTML = "";
  for (const [title, items] of NAV()) {
    side.append(h("h4", {}, title));
    for (const [k, label, icon, cnt] of items) side.append(h("a", { href: "#" + k, class: (ALIAS[route] || route) === k ? "on" : "" }, icon(), label,
      cnt != null ? h("span", { class: "cnt" + (cnt ? "" : " z"), "aria-label": cnt + " naujos" }, cnt) : null));
  }
  side.append(h("div", { class: "out" }, h("button", { type: "button", onclick: async () => {
    if (dirty && !(await confirmDlg("Atsijungti?", "Turite neišsaugotų pakeitimų – jie dings.", "Atsijungti", "danger"))) return;
    dirty = null; $("#logoutForm").submit();
  } }, "Atsijungti (" + S.me.name + ")")));
  document.title = (newCount() ? "(" + newCount() + ") " : "") + "Du Aidai CRM";
}
function head(title, sub, ...acts) {
  return h("div", { class: "page-h" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), acts.length ? h("div", { class: "acts" }, ...acts) : null);
}
const card = (title, ...kids) => h("section", { class: "card" }, title ? h("h2", {}, ...[].concat(title)) : null, ...kids);
let lastHash = location.hash;
async function render(keepScroll) {
  const [path] = (location.hash.slice(1) || "apzvalga").split("?");
  const [r, ...rest] = path.split("/");
  route = r; arg = decodeURIComponent(rest.join("/"));
  document.body.classList.remove("nav-open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  setDirty(false);
  drawSide();
  const m = $("#main"), y = scrollY; m.innerHTML = "";
  const v = VIEWS[route] || VIEWS.apzvalga;
  m.append(...[].concat(v(arg)).filter(Boolean));
  scrollTo(0, keepScroll ? y : 0);
}
addEventListener("hashchange", async () => {
  if (dirty) {
    const ok = await confirmDlg("Išeiti neišsaugojus?", "Šiame lange yra neišsaugotų pakeitimų.", "Išeiti", "danger");
    if (!ok) { history.replaceState(null, "", lastHash); return; }
  }
  lastHash = location.hash; render();
});
/* meniu: telefone išsiskleidžia virš turinio, kompiuteryje paslepiamas / parodomas (prisimenama) */
const mobile = () => matchMedia("(max-width:860px)").matches;
try { if (localStorage.getItem("daSideHidden") === "1") document.body.classList.add("side-hidden"); } catch (e) {}
$("#menuBtn").onclick = () => {
  if (mobile()) { const o = document.body.classList.toggle("nav-open"); $("#menuBtn").setAttribute("aria-expanded", o); return; }
  const hidden = document.body.classList.toggle("side-hidden");
  $("#menuBtn").setAttribute("aria-label", hidden ? "Rodyti meniu" : "Slėpti meniu");
  try { localStorage.setItem("daSideHidden", hidden ? "1" : "0"); } catch (e) {}
};
/* sąrašo filtrų grupė su pavadinimu (Namas, Būsena) */
const fgroup = (label, ...chips) => h("div", { class: "fgroup" }, h("span", { class: "flbl" }, label), h("div", { class: "chips" }, ...chips));
/* filtras iš adreso, pvz. #butai?st=Rezervuotas – pritaikomas vieną kartą, adresas išvalomas */
function takeQuery(base) {
  const qs = new URLSearchParams(location.hash.split("?")[1] || "");
  if (![...qs.keys()].length) return null;
  lastHash = "#" + base; history.replaceState(null, "", lastHash);
  return qs;
}

const VIEWS = {};

/* =====================================================================
   APŽVALGA
   ===================================================================== */
function statusCounts(list) {
  const c = { Laisvas: [], Rezervuotas: [], Parduotas: [] };
  list.forEach(a => c[a.status].push(a));
  return c;
}
function stackBar(c, total) {
  return h("div", {}, h("div", { class: "stack", role: "img", "aria-label": APT_ST.map(s => `${s}: ${c[s].length}`).join(", ") },
    ...APT_ST.filter(s => c[s].length).map(s => h("i", { style: { flex: c[s].length, background: ST_COLOR[s] } }))),
  h("div", { class: "legend" }, ...APT_ST.map(s => h("span", {}, h("i", { style: { background: ST_COLOR[s] } }), `${s} ${c[s].length} (${total ? Math.round(c[s].length / total * 100) : 0} %)`))));
}
function kpiTiles() {
  const c = statusCounts(S.apts), n = newCount();
  const sum = (l, k) => l.reduce((s, a) => s + (a[k] || 0), 0);
  return h("div", { class: "kpis" },
    h("a", { class: "kpi" + (n ? " alert" : ""), href: "#uzklausos?st=nauja" }, h("div", { class: "k" }, "Naujos užklausos"), h("div", { class: "v" }, n), h("div", { class: "s" }, n ? "Laukia atsakymo →" : "Visos peržiūrėtos")),
    ...APT_ST.map(s => h("a", { class: "kpi", href: "#butai?st=" + encodeURIComponent(s) }, h("div", { class: "k" }, h("i", { style: { background: ST_COLOR[s] } }), s === "Laisvas" ? "Laisvi" : s === "Rezervuotas" ? "Rezervuoti" : "Parduoti"),
      h("div", { class: "v" }, c[s].length), h("div", { class: "s" }, m2(sum(c[s], "area")) + (s !== "Rezervuotas" ? " · " + eur(sum(c[s], "price")) : "")))));
}
VIEWS.apzvalga = () => {
  const c = statusCounts(S.apts);
  const kp = h("div", {}, kpiTiles());
  const stk = h("div", {}, stackBar(c, S.apts.length));
  const refreshTop = () => { kp.replaceChildren(kpiTiles()); stk.replaceChildren(stackBar(statusCounts(S.apts), S.apts.length)); };
  const latest = S.inqs.filter(q => q.status === "nauja").slice(0, 6);
  const per = aptInqCounts().slice(0, 10);
  return [
    head("Apžvalga", `Sveiki, ${S.me.name}. ${new Date().toLocaleDateString("lt-LT", { weekday: "long", month: "long", day: "numeric" })}.`),
    kp,
    h("div", { class: "cols2" },
      card(["Naujos užklausos", h("a", { href: "#uzklausos", style: { fontSize: "12px", textTransform: "none", letterSpacing: 0 } }, "Visos →")],
        latest.length ? h("div", { class: "mini" }, ...latest.map(q => h("a", { href: "#uzklausos/" + q.id },
          h("b", {}, q.name), h("small", {}, (q.apt ? aptNo(q.apt) + " · " : "") + ago(q.t) + " · " + (q.phone || q.email)), stTag(q.status)))) : h("p", { class: "muted" }, "Naujų užklausų nėra.")),
      card(["Užklausos pagal butą", h("small", {}, "visos užklausos")], per.length ? barList(per.map(([id, n]) => [aptNo(id) || "Be buto", n, id ? "#butas/" + id : "#uzklausos"])) : h("p", { class: "muted" }, "Užklausų dar nėra."))),
    card(["Greitas butų valdymas", h("small", {}, "pakeitimai išsaugomi iš karto ir matomi svetainėje")], stk, h("div", { class: "mt" }, quickTable(refreshTop))),
  ];
};
function aptInqCounts() {
  const m = new Map();
  S.inqs.forEach(q => m.set(q.apt, (m.get(q.apt) || 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
function barList(items) {
  const max = Math.max(1, ...items.map(x => x[1]));
  return h("div", { class: "bars" }, ...items.map(([l, n, href]) => h(href ? "a" : "div", { class: "bar", href, "aria-label": `${l}: ${n}` },
    h("span", {}, l), h("span", { class: "tr" }, h("i", { style: { width: (n / max * 100) + "%" } })), h("b", {}, n))));
}

/* greito valdymo lentelė: būsena, kaina, plotas */
let QF = { house: "", st: "" };
function quickTable(onChange) {
  const box = h("div");
  const draw = () => {
    box.innerHTML = "";
    const chips = h("div", { class: "filters" },
      fgroup("Namas", ...[["", "Visi"], ...S.houses.map(x => [x.id, x.id])].map(([v, l]) => h("button", { type: "button", class: "chip" + (QF.house === v ? " on" : ""), onclick: () => { QF.house = v; draw(); } }, l))),
      fgroup("Būsena", ...[["", "Visos"], ...APT_ST.map(s => [s, s])].map(([v, l]) => h("button", { type: "button", class: "chip" + (QF.st === v ? " on" : ""), onclick: () => { QF.st = v; draw(); } }, l, v ? h("b", {}, S.apts.filter(a => a.status === v && (!QF.house || a.house === QF.house)).length) : null))));
    const tb = h("tbody");
    const counts = Object.fromEntries(aptInqCounts());
    S.houses.filter(x => !QF.house || x.id === QF.house).forEach(hs => hs.floors.forEach(f => {
      const list = S.apts.filter(a => a.house === hs.id && a.floor === f && (!QF.st || a.status === QF.st));
      if (!list.length) return;
      tb.append(h("tr", { class: "grp" }, h("td", { colspan: 7 }, `${hs.name} · ${f} aukštas`)));
      list.forEach(a => {
        const tr = h("tr", { "data-id": a.id });
        const ppm = h("td", { class: "r muted hide-s nowrap" }, a.area && a.price ? nf0.format(a.price / a.area) + " €" : "—");
        const save = async (field, value) => {
          try {
            const r = await api("apt-quick", { id: a.id, field, value });
            Object.assign(a, r.apt); S.events = r.events;
            ppm.textContent = a.area && a.price ? nf0.format(a.price / a.area) + " €" : "—";
            tr.classList.remove("flash"); void tr.offsetWidth; tr.classList.add("flash");
            toast(`${a.no}: ${field === "status" ? "būsena – " + a.status : field === "price" ? "kaina – " + eur(a.price) : "plotas – " + m2(a.area)}`);
            onChange && onChange();
          } catch (e) { toast(e.message, true); }
        };
        const price = h("input", { class: "inp", inputmode: "numeric", value: a.price ? nf0.format(a.price) : "", "aria-label": a.no + " kaina", placeholder: "—" });
        price.onchange = () => { const v = Math.round(num(price.value)); price.value = v ? nf0.format(v) : ""; if (v !== a.price) save("price", v); };
        const area = h("input", { class: "inp", inputmode: "decimal", value: nf2.format(a.area), "aria-label": a.no + " plotas", style: { width: "112px" } });
        area.onchange = () => { const v = num(area.value); area.value = nf2.format(v); if (v !== a.area) save("area", v); };
        [price, area].forEach(x => x.addEventListener("keydown", e => { if (e.key === "Enter") x.blur(); }));
        const n = counts[a.id] || 0;
        tr.append(
          h("td", { class: "nowrap" }, h("a", { class: "no", href: "#butas/" + a.id }, a.no), h("span", { class: "muted hide-s" }, " · " + a.rooms + " k.")),
          h("td", {}, stSelect(a.status, v => save("status", v))),
          h("td", {}, h("div", { class: "suffix" }, price, h("i", {}, "€"))),
          h("td", {}, h("div", { class: "suffix" }, area, h("i", {}, "m²"))),
          ppm,
          h("td", { class: "r" }, n ? h("a", { class: "cnt-pill" + (inqsOf(a.id).some(q => q.status === "nauja") ? " hot" : ""), href: "#uzklausos?butas=" + a.id, "aria-label": n + " užklausos" }, n) : h("span", { class: "muted" }, "—")),
          h("td", { class: "r" }, h("a", { class: "icon-btn", href: "#butas/" + a.id, "aria-label": "Atidaryti " + a.no }, "›")));
        tb.append(tr);
      });
    }));
    box.append(chips, h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, h("th", {}, "Butas"), h("th", {}, "Būsena"), h("th", {}, "Kaina"), h("th", {}, "Plotas"), h("th", { class: "r hide-s" }, "€/m²"), h("th", { class: "r" }, "Užkl."), h("th", {}))), tb)));
  };
  draw();
  return box;
}

/* =====================================================================
   UŽKLAUSOS
   ===================================================================== */
let IF = { q: "", apt: "", st: "" , limit: 40 };
VIEWS.uzklausos = (a) => {
  /* #uzklausos/<id> – viena užklausa; #uzklausos?butas=A501 – filtras */
  const qs = takeQuery("uzklausos");
  if (qs) { IF.apt = qs.get("butas") ?? ""; IF.st = qs.get("st") ?? ""; IF.q = ""; }
  const only = a || "";
  const list = h("div");
  const counts = Object.fromEntries(INQ_ST.map(([k]) => [k, S.inqs.filter(q => q.status === k).length]));
  const filtered = () => {
    const nq = norm(IF.q), dq = digits(IF.q);
    return S.inqs.filter(q => (only ? q.id === only : true)
      && (!IF.st || q.status === IF.st)
      && (IF.apt === "" || (IF.apt === "-" ? !q.apt : q.apt === IF.apt))
      && (!nq || norm(q.name).includes(nq) || norm(q.email).includes(nq) || (dq.length >= 3 && digits(q.phone).includes(dq))));
  };
  const draw = () => {
    list.innerHTML = "";
    const f = filtered();
    if (!f.length) { list.append(h("p", { class: "empty" }, S.inqs.length ? "Pagal filtrus užklausų nerasta." : "Užklausų dar nėra. Kai kas nors užpildys formą svetainėje, ji atsiras čia.")); return; }
    f.slice(0, IF.limit).forEach(q => list.append(inqRow(q, draw)));
    if (f.length > IF.limit) list.append(h("div", { style: { textAlign: "center", paddingTop: "14px" } }, h("button", { class: "btn ghost", type: "button", onclick: () => { IF.limit += 40; draw(); } }, `Rodyti daugiau (${f.length - IF.limit})`)));
  };
  const search = h("input", { type: "search", class: "inp", placeholder: "Vardas, telefonas ar el. paštas", value: IF.q, "aria-label": "Paieška" });
  search.oninput = () => { IF.q = search.value; IF.limit = 40; draw(); };
  const aptSel = h("select", { class: "inp", "aria-label": "Butas" }, h("option", { value: "" }, "Visi butai"), h("option", { value: "-" }, "Be buto (bendros)"),
    ...[...new Set(S.inqs.map(q => q.apt).filter(Boolean))].sort().map(id => h("option", { value: id }, aptNo(id) + " (" + inqsOf(id).length + ")")));
  aptSel.value = IF.apt; aptSel.onchange = () => { IF.apt = aptSel.value; draw(); };
  const chips = h("div", { class: "chips" }, ...[["", "Visos", S.inqs.length], ...INQ_ST.map(([k, l]) => [k, l, counts[k]])].map(([k, l, n]) =>
    h("button", { type: "button", class: "chip" + (IF.st === k ? " on" : ""), onclick: () => { IF.st = k; render(true); } }, l, h("b", {}, n))));
  draw();
  return [
    head(only ? "Užklausa" : "Užklausos", only ? null : "Užklausos iš svetainės formos. Būsena ir pastabos matomos visiems administratoriams.",
      only ? h("a", { class: "btn ghost", href: "#uzklausos" }, "← Visos užklausos") : null,
      h("button", { class: "btn ghost", type: "button", onclick: () => {
        const f = filtered();
        csv(`uzklausos-${today()}.csv`, ["Data", "Butas", "Vardas ir pavardė", "Telefonas", "El. paštas", "Žinutė", "Būsena", "Pastabos", "Paskutinį kartą keitė", "Pakeista"],
          f.map(q => [dt(q.t), aptNo(q.apt), q.name, q.phone, q.email, q.msg, INQ_L[q.status], q.note, q.by, q.updated ? dt(q.updated) : ""]));
      } }, "Eksportuoti CSV")),
    only ? null : h("section", { class: "card filter-card" }, h("div", { class: "filters" }, search, aptSel, chips)),
    card(null, list),
  ];
};
function inqRow(q, redraw) {
  const apt = aptById(q.apt);
  const note = h("textarea", { placeholder: "Pastabos, pvz. „Skambinau, apžiūra penktadienį 14 val.“", "aria-label": "Pastabos" }); note.value = q.note;
  const by = h("div", { class: "inq-by" }, q.by ? `Keitė ${q.by} · ${ago(q.updated)}` : "Dar niekas neperėmė");
  const upd = async (patch) => {
    try {
      const r = await api("inq-update", { id: q.id, rev: q.rev, ...patch });
      Object.assign(q, r.inq); by.textContent = `Keitė ${q.by} · ${ago(q.updated)}`;
      drawSide(); return true;
    } catch (e) {
      if (e.status === 409 && e.data.current) { Object.assign(q, e.data.current); toast(e.message, true); redraw(); }
      else toast(e.message, true);
      return false;
    }
  };
  const seg = h("div", { class: "seg", role: "group", "aria-label": "Būsena" }, ...INQ_ST.map(([k, l]) => h("button", { type: "button", class: k + (q.status === k ? " on" : ""), "aria-pressed": q.status === k, onclick: async () => {
    if (q.status === k) return;
    if (await upd({ status: k })) { toast(`${q.name}: ${l}`); redraw(); }
  } }, l)));
  note.addEventListener("blur", async () => { if (note.value !== q.note && await upd({ note: note.value })) toast("Pastaba išsaugota"); });
  note.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) note.blur(); });
  const client = q.client && S.clients.find(c => c.id === q.client);
  return h("div", { class: "inq" + (q.status === "nauja" ? " is-new" : "") },
    h("div", {},
      h("div", { class: "inq-h" }, h("b", {}, q.name), apt ? h("a", { class: "inq-apt", href: "#butas/" + apt.id }, "Butas " + apt.no) : h("span", { class: "inq-apt", style: { background: "var(--soft)", color: "var(--ink-2)" } }, "Bendra"), h("time", { datetime: q.t }, dt(q.t))),
      h("div", { class: "inq-c" },
        q.phone ? h("a", { href: telHref(q.phone) }, I.tel(), q.phone) : null,
        q.email ? h("a", { href: "mailto:" + q.email + "?subject=" + encodeURIComponent("Du Aidai" + (apt ? " – butas " + apt.no : "")) }, I.mail(), q.email) : null),
      q.msg ? h("p", { class: "inq-msg" }, q.msg) : h("p", { class: "inq-msg muted" }, "(be komentaro)")),
    h("div", { class: "inq-side" }, seg, note, h("div", { class: "row-acts" }, by, h("span", { class: "sp" }),
      client ? h("a", { class: "btn ghost small", href: "#klientas/" + client.id }, "Kliento kortelė →")
        : h("button", { class: "btn ghost small", type: "button", onclick: () => importInq(q) }, "+ Į klientus"),
      h("button", { class: "icon-btn del", type: "button", "aria-label": "Ištrinti užklausą", onclick: async () => {
        if (!(await confirmDlg("Ištrinti užklausą?", `${q.name}, ${dt(q.t)}. Veiksmo atšaukti negalima.`, "Ištrinti", "danger"))) return;
        try { await api("inq-delete", { id: q.id }); S.inqs = S.inqs.filter(x => x.id !== q.id); drawSide(); redraw(); toast("Užklausa ištrinta"); } catch (e) { toast(e.message, true); }
      } }, I.del()))));
}
async function importInq(q) {
  try {
    const r = await api("client-from-inq", { id: q.id });
    replace(S.clients, r.client); if (r.inq) Object.assign(q, r.inq);
    toast(r.existed ? "Klientas jau buvo sukurtas" : "Klientas sukurtas iš užklausos");
    location.hash = "#klientas/" + r.client.id;
  } catch (e) { toast(e.message, true); }
}

/* =====================================================================
   KLIENTAI
   ===================================================================== */
let CF = { q: "", st: "", min: "", max: "", apt: "", sort: "upd" };
const SORTS = { upd: ["Naujausi pakeitimai", (a, b) => (b.updated || "").localeCompare(a.updated || "")], name: ["Pagal vardą", (a, b) => fullName(a).localeCompare(fullName(b), "lt")],
  pu: ["Kaina ↑", (a, b) => a.price - b.price], pd: ["Kaina ↓", (a, b) => b.price - a.price] };
VIEWS.klientai = () => {
  const tb = h("tbody"), sum = h("div", { class: "muted", style: { fontSize: "13px", marginTop: "10px" } });
  const filtered = () => {
    const nq = norm(CF.q), dq = digits(CF.q), mn = num(CF.min), mx = num(CF.max);
    return S.clients.filter(c => (!CF.st || c.status === CF.st) && (!CF.apt || c.apt === CF.apt)
      && (!CF.min || c.price >= mn) && (!CF.max || c.price <= mx)
      && (!nq || norm(fullName(c)).includes(nq) || norm(c.email).includes(nq) || (dq.length >= 3 && digits(c.phone).includes(dq)) || norm(aptNo(c.apt)).includes(nq)))
      .sort(SORTS[CF.sort][1]);
  };
  const draw = () => {
    tb.innerHTML = "";
    const f = filtered();
    if (!f.length) tb.append(h("tr", {}, h("td", { colspan: 7, class: "empty" }, S.clients.length ? "Pagal filtrus klientų nerasta." : "Klientų dar nėra. Sukurkite naują arba importuokite iš užklausos.")));
    f.forEach(c => tb.append(h("tr", { class: "click", onclick: e => { if (!e.target.closest("a")) location.hash = "#klientas/" + c.id; } },
      h("td", {}, h("a", { class: "no", href: "#klientas/" + c.id }, fullName(c) || "(be vardo)"), c.email ? h("div", { class: "muted", style: { fontSize: "12.5px" } }, c.email) : null),
      h("td", { class: "nowrap" }, c.phone ? h("a", { href: telHref(c.phone) }, c.phone) : "—"),
      h("td", { class: "nowrap" }, c.apt ? h("a", { href: "#butas/" + c.apt }, aptNo(c.apt)) : "—"),
      h("td", {}, stTag(c.status)),
      h("td", { class: "r nowrap" }, eur(c.price)),
      h("td", { class: "r hide-s" }, c.docs.length || "—"),
      h("td", { class: "muted nowrap hide-s" }, c.updated ? ago(c.updated) : ""))));
    const total = f.reduce((s, c) => s + c.price, 0);
    sum.textContent = `Rodoma ${plural(f.length, "klientas", "klientai", "klientų")}` + (total ? ` · sutartų kainų suma ${eur(total)}` : "");
  };
  const search = h("input", { type: "search", class: "inp", placeholder: "Vardas, telefonas, el. paštas ar butas", value: CF.q, "aria-label": "Paieška" });
  search.oninput = () => { CF.q = search.value; draw(); };
  const mk = (k, ph) => { const x = h("input", { class: "inp", inputmode: "numeric", placeholder: ph, value: CF[k], "aria-label": ph }); x.oninput = () => { CF[k] = x.value; draw(); }; return x; };
  const aptSel = h("select", { class: "inp", "aria-label": "Butas" }, h("option", { value: "" }, "Visi butai"), ...[...new Set(S.clients.map(c => c.apt).filter(Boolean))].sort().map(id => h("option", { value: id }, aptNo(id))));
  aptSel.value = CF.apt; aptSel.onchange = () => { CF.apt = aptSel.value; draw(); };
  const sortSel = h("select", { class: "inp", "aria-label": "Rikiavimas" }, ...Object.entries(SORTS).map(([k, [l]]) => h("option", { value: k, selected: CF.sort === k }, l)));
  sortSel.onchange = () => { CF.sort = sortSel.value; draw(); };
  const chips = h("div", { class: "chips" }, ...[["", "Visi", S.clients.length], ...CL_ST.map(s => [s, s, S.clients.filter(c => c.status === s).length])].map(([k, l, n]) =>
    h("button", { type: "button", class: "chip" + (CF.st === k ? " on" : ""), onclick: () => { CF.st = k; render(true); } }, l, h("b", {}, n))));
  const rows = () => filtered().map(c => [fullName(c), c.phone, c.email, aptNo(c.apt), c.status, c.price || "", c.comment, c.docs.length, c.updated ? dt(c.updated) : "", c.by]);
  draw();
  return [
    head("Klientai", "Pirkėjai ir potencialūs pirkėjai. Spauskite eilutę, kad atidarytumėte kortelę.",
      h("button", { class: "btn ghost", type: "button", onclick: pickInqToImport }, "Importuoti iš užklausos"),
      h("button", { class: "btn ghost", type: "button", onclick: () => csv(`klientai-${today()}.csv`, ["Vardas Pavardė", "Telefonas", "El. paštas", "Butas", "Statusas", "Sutarta kaina €", "Komentaras", "Dokumentų", "Atnaujinta", "Keitė"], rows()) }, "CSV"),
      h("button", { class: "btn ghost", type: "button", onclick: () => printSheet("Du Aidai – klientai", `Sudaryta ${dt(new Date())}` + (CF.st ? " · statusas: " + CF.st : "") + ((CF.min || CF.max) ? ` · kaina ${CF.min || 0}–${CF.max || "∞"} €` : ""),
        ["Klientas", "Telefonas", "El. paštas", "Butas", "Statusas", "Sutarta kaina", "Komentaras"], filtered().map(c => [fullName(c), c.phone, c.email, aptNo(c.apt), c.status, eur(c.price), c.comment.slice(0, 160)])) }, "PDF"),
      h("a", { class: "btn", href: "#klientas/naujas" }, "+ Naujas klientas")),
    h("section", { class: "card filter-card" },
      h("div", { class: "filters" }, search, aptSel, h("div", { class: "range" }, h("span", { class: "muted" }, "Sutarta kaina"), mk("min", "nuo €"), "–", mk("max", "iki €")), sortSel),
      h("div", { class: "filters", style: { marginTop: "12px" } }, chips)),
    card(null,
      h("div", { class: "tbl-wrap" }, h("table", { class: "tbl" }, h("thead", {}, h("tr", {}, h("th", {}, "Klientas"), h("th", {}, "Telefonas"), h("th", {}, "Butas"), h("th", {}, "Statusas"), h("th", { class: "r" }, "Sutarta kaina"), h("th", { class: "r hide-s" }, "Dok."), h("th", { class: "hide-s" }, "Atnaujinta"))), tb)), sum),
  ];
};
async function pickInqToImport() {
  const free = S.inqs.filter(q => !q.client || !S.clients.some(c => c.id === q.client));
  if (!free.length) { toast("Visos užklausos jau perkeltos į klientus"); return; }
  const d = h("div", { class: "pick-list" }, ...free.slice(0, 100).map(q => h("button", { type: "button", onclick: () => { dl.close(); importInq(q); } },
    h("b", {}, q.name), h("span", { class: "muted" }, q.apt ? aptNo(q.apt) : "Bendra"), h("small", {}, dt(q.t) + " · " + [q.phone, q.email].filter(Boolean).join(" · ")))));
  const p = dialog("Importuoti iš užklausos", h("div", {}, h("p", {}, "Pasirinkite užklausą – vardas, kontaktai, butas ir žinutė bus perkelti į naują kliento kortelę."), d), [["Uždaryti", null, "ghost"]]);
  const dl = document.querySelector("dialog.dlg"); await p;
}

VIEWS.klientas = (id) => {
  const isNew = id === "naujas";
  const orig = isNew ? { id: "", first: "", last: "", email: "", phone: "", apt: "", comment: "", status: "Potencialus", price: 0, docs: [], inq: "", rev: 0 } : S.clients.find(c => c.id === id);
  if (!orig) return [head("Klientas nerastas", "Gal jis buvo ištrintas."), h("a", { class: "btn ghost", href: "#klientai" }, "← Klientai")];
  const c = structuredClone(orig);
  const mark = () => setDirty(JSON.stringify(c) !== JSON.stringify(orig), save);
  const priceIn = inputFor(c, "price", { num: true, inputmode: "numeric", ph: "0", on: mark });
  const aptHint = h("small", {});
  const aptSel = aptOptions(h("select", {}), c.apt);
  const drawAptHint = () => {
    const a = aptById(c.apt); aptHint.innerHTML = "";
    if (a) aptHint.append(stTag(a.status), " ", a.price ? h("a", { href: "#", onclick: e => { e.preventDefault(); c.price = a.price; priceIn.value = String(a.price); mark(); } }, "Buto kaina " + eur(a.price) + " → įrašyti") : "Buto kaina nenurodyta");
  };
  aptSel.onchange = () => { c.apt = aptSel.value; drawAptHint(); if (!c.price && aptById(c.apt)?.price) { c.price = aptById(c.apt).price; priceIn.value = String(c.price); } mark(); };
  drawAptHint();
  const stSel = inputFor(c, "status", { options: CL_ST, on: mark });
  async function save() {
    try {
      const r = await api("client-save", { client: c });
      replace(S.clients, r.client);
      setDirty(false); toast(isNew ? "Klientas sukurtas" : "Išsaugota");
      await suggestAptStatus(r.client, orig);
      if (isNew) location.hash = "#klientas/" + r.client.id; else render(true);
    } catch (e) {
      if (e.status === 409 && e.data.current) { replace(S.clients, e.data.current); toast(e.message, true); setDirty(false); render(true); }
      else toast(e.message, true);
    }
  }
  const inq = c.inq && S.inqs.find(q => q.id === c.inq);
  const apt = aptById(c.apt);
  return [
    h("a", { class: "crumb", href: "#klientai" }, "← Klientai"),
    head(isNew ? "Naujas klientas" : fullName(orig) || "(be vardo)", isNew ? "Užpildykite bent vardą arba pavardę." : `Sukurta ${dOnly(orig.created)} · paskutinį kartą keitė ${orig.by} ${ago(orig.updated)}`,
      !isNew && orig.phone ? h("a", { class: "btn", href: telHref(orig.phone) }, I.tel(), "Skambinti") : null,
      !isNew && orig.email ? h("a", { class: "btn", href: "mailto:" + orig.email }, I.mail(), "Rašyti") : null),
    h("div", { class: "cols" },
      h("div", {},
        card("Kliento duomenys", h("div", { class: "grid2" },
          fld("Vardas", inputFor(c, "first", { on: mark })), fld("Pavardė", inputFor(c, "last", { on: mark })),
          fld("El. paštas", inputFor(c, "email", { type: "email", on: mark })), fld("Telefono numeris", inputFor(c, "phone", { type: "tel", ph: "+370", on: mark })),
          fld("Butas", aptSel, { hint: "" }), fld("Statusas", stSel),
          fld("Su klientu sutarta kaina", priceIn, { suffix: "€" }), h("div", { class: "f" }, h("span", {}, "Buto būsena"), aptHint),
          fld("Komentaras", inputFor(c, "comment", { area: true, rows: 5, on: mark }), { wide: true })),
          h("div", { class: "row-acts mt" }, h("button", { class: "btn", type: "button", onclick: save }, isNew ? "Sukurti klientą" : "Išsaugoti"), h("span", { class: "muted", style: { fontSize: "12.5px" } }, "Ctrl + S"))),
        isNew ? null : docsCard(orig)),
      h("div", {},
        apt ? card("Butas", h("div", { class: "link-card" }, h("a", { class: "no", href: "#butas/" + apt.id, style: { fontWeight: 800 } }, apt.no), stTag(apt.status), h("span", {}, `${apt.rooms} kamb. · ${m2(apt.area)} · ${eur(apt.price)}`))) : null,
        inq ? card("Užklausa, iš kurios sukurtas", h("div", { class: "muted", style: { fontSize: "13px" } }, dt(inq.t) + " · " + INQ_L[inq.status]), h("p", { class: "inq-msg mt" }, inq.msg || "(be komentaro)"), inq.note ? h("p", { class: "inq-msg mt" }, h("b", {}, "Pastaba: "), inq.note) : null,
          h("a", { class: "btn ghost small mt", href: "#uzklausos/" + inq.id }, "Atidaryti užklausą")) : null,
        isNew ? null : card("Kliento ištrinimas",h("button", { class: "btn danger", type: "button", onclick: async () => {
          if (!(await confirmDlg("Ištrinti klientą?", `${fullName(orig)} ir visi prisegti dokumentai bus ištrinti visam laikui.`, "Ištrinti", "danger"))) return;
          try { await api("client-delete", { id: orig.id }); S.clients = S.clients.filter(x => x.id !== orig.id); S.inqs.forEach(q => { if (q.client === orig.id) q.client = ""; }); setDirty(false); toast("Klientas ištrintas"); location.hash = "#klientai"; } catch (e) { toast(e.message, true); }
        } }, "Ištrinti klientą")))),
    savebar(save, () => { setDirty(false); render(true); }),
  ];
};
/* kliento statusas → pasiūlymas pakeisti buto būseną */
async function suggestAptStatus(c, before) {
  const a = aptById(c.apt);
  if (!a || (c.status === before.status && c.apt === before.apt)) return;
  const want = c.status === "Pirko" ? "Parduotas" : c.status === "Rezervavo" ? "Rezervuotas" : c.status === "Atsisakė" && a.status === "Rezervuotas" ? "Laisvas" : null;
  if (!want || a.status === want) return;
  const ok = await confirmDlg(`Pažymėti butą ${a.no} kaip „${want}“?`, `Klientas ${fullName(c)} – „${c.status}“. Dabar butas pažymėtas „${a.status}“. Pakeitimas iš karto matysis svetainėje.`, "Pažymėti");
  if (!ok) return;
  try { const r = await api("apt-quick", { id: a.id, field: "status", value: want }); Object.assign(a, r.apt); S.events = r.events; toast(`${a.no}: ${want}`); } catch (e) { toast(e.message, true); }
}
function docsCard(cl) {
  const box = h("div", { class: "docs" });
  const draw = () => {
    box.innerHTML = "";
    if (!cl.docs.length) box.append(h("p", { class: "muted", style: { margin: 0 } }, "Dokumentų dar nėra."));
    cl.docs.forEach(d => box.append(h("div", { class: "doc" },
      h("span", { class: "ext " + ({ doc: "w", docx: "w", odt: "w", xls: "x", xlsx: "x", ods: "x", csv: "x", pdf: "p" }[d.ext] || "") }, d.ext),
      h("div", { class: "nm" }, h("a", { href: `failas.php?c=${encodeURIComponent(cl.id)}&d=${encodeURIComponent(d.id)}` }, d.name), h("small", {}, `${(d.size / 1024 / 1024).toFixed(2).replace(".", ",")} MB · ${dt(d.t)} · ${d.by}`)),
      h("a", { class: "icon-btn", href: `failas.php?c=${encodeURIComponent(cl.id)}&d=${encodeURIComponent(d.id)}`, "aria-label": "Atsisiųsti" }, I.dl()),
      h("button", { class: "icon-btn del", type: "button", "aria-label": "Ištrinti dokumentą", onclick: async () => {
        if (!(await confirmDlg("Ištrinti dokumentą?", d.name, "Ištrinti", "danger"))) return;
        try { const r = await api("doc-delete", { client: cl.id, doc: d.id }); Object.assign(cl, r.client); draw(); toast("Dokumentas ištrintas"); } catch (e) { toast(e.message, true); }
      } }, I.del()))));
  };
  const up = async files => {
    for (const f of files) {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!S.docExt.includes(ext)) { toast(`„${f.name}“: tinka Word, Excel, PDF, OpenDocument ar CSV.`, true); continue; }
      if (f.size > S.docMax) { toast(`„${f.name}“ per didelis (daugiausia 10 MB).`, true); continue; }
      const fd = new FormData(); fd.append("client", cl.id); fd.append("file", f);
      toast("Įkeliama: " + f.name);
      try { const r = await api("doc-upload", fd, true); Object.assign(cl, r.client); replace(S.clients, cl); draw(); toast("Prisegta: " + f.name); } catch (e) { toast(e.message, true); }
    }
  };
  const picker = h("input", { type: "file", multiple: true, hidden: true, accept: S.docExt.map(x => "." + x).join(",") });
  picker.onchange = () => up([...picker.files]);
  const drop = h("div", { class: "drop", tabindex: 0, role: "button", onclick: () => picker.click(), onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picker.click(); } } },
    h("div", {}, h("b", {}, "Prisegti dokumentą"), h("div", { class: "muted", style: { fontSize: "13px" } }, "Nutempkite failą čia arba spauskite · Word, Excel, PDF iki 10 MB")));
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); up([...e.dataTransfer.files]); });
  draw();
  return card(["Dokumentai", h("small", {}, "sutartys, pasiūlymai, skaičiuoklės")], box, h("div", { class: "mt" }, drop, picker));
}

/* =====================================================================
   BUTAI
   ===================================================================== */
let BF = { house: "", st: "" };
VIEWS.butai = () => {
  const qs = takeQuery("butai");
  if (qs) { BF.st = APT_ST.includes(qs.get("st")) ? qs.get("st") : ""; BF.house = ""; }
  const box = h("div");
  S.houses.filter(x => !BF.house || x.id === BF.house).forEach(hs => {
    const all = S.apts.filter(a => a.house === hs.id), c = statusCounts(all);
    const sec = h("div", { class: "house" }, h("h3", {}, hs.name, h("span", { class: "muted", style: { fontSize: "13px", fontWeight: 600 } }, `${all.length} butai · ${c.Laisvas.length} laisvi · ${c.Rezervuotas.length} rezervuoti · ${c.Parduotas.length} parduoti`)), stackBar(c, all.length));
    hs.floors.forEach(f => {
      const list = all.filter(a => a.floor === f && (!BF.st || a.status === BF.st));
      if (!list.length) return;
      sec.append(h("div", { class: "floor" }, h("b", {}, f + " aukštas"), h("div", { class: "apts" }, ...list.map(a => {
        const n = inqsOf(a.id).length;
        return h("a", { class: "apt " + a.status, href: "#butas/" + a.id, "aria-label": `${a.no}, ${a.status}` },
          h("b", {}, a.no), h("span", {}, `${a.rooms} kamb. · ${nf2.format(a.area)} m²`), h("span", { class: "p" }, eur(a.price)),
          h("span", {}, a.status + (n ? ` · ${n} užkl.` : "")));
      }))));
    });
    box.append(card(null, sec));
  });
  return [
    head("Butai", "Butai suskirstyti pagal namą ir aukštą. Spauskite butą – keisite plotus, patalpas, kainą ir planą."),
    h("div", { class: "filters" },
      fgroup("Namas", ...[["", "Visi"], ...S.houses.map(x => [x.id, x.id])].map(([v, l]) => h("button", { type: "button", class: "chip" + (BF.house === v ? " on" : ""), onclick: () => { BF.house = v; render(true); } }, l))),
      fgroup("Būsena", ...[["", "Visos"], ...APT_ST.map(s => [s, s])].map(([v, l]) => h("button", { type: "button", class: "chip" + (BF.st === v ? " on" : ""), onclick: () => { BF.st = v; render(true); } }, l, v ? h("b", {}, S.apts.filter(a => a.status === v && (!BF.house || a.house === BF.house)).length) : null)))),
    box,
  ];
};
VIEWS.butas = (id) => {
  const orig = aptById(id);
  if (!orig) return [head("Butas nerastas"), h("a", { class: "btn ghost", href: "#butai" }, "← Butai")];
  const a = structuredClone(orig);
  const hs = S.houses.find(x => x.id === a.house);
  const mark = () => { setDirty(JSON.stringify(a) !== JSON.stringify(orig), save); drawSum(); ppm.textContent = a.area && a.price ? nf0.format(a.price / a.area) + " €/m²" : "—"; };
  async function save() {
    try {
      const r = await api("apt-save", { apt: a });
      Object.assign(orig, r.apt); S.events = r.events; setDirty(false); toast(`${orig.no}: išsaugota – svetainė atnaujinta`); render(true);
    } catch (e) {
      if (e.status === 409 && e.data.current) { Object.assign(orig, e.data.current); toast(e.message, true); setDirty(false); render(true); }
      else toast(e.message, true);
    }
  }
  const ppm = h("b", {}, a.area && a.price ? nf0.format(a.price / a.area) + " €/m²" : "—");
  const areaIn = inputFor(a, "area", { num: true, inputmode: "decimal", on: mark });
  /* patalpos */
  const prem = h("div", { class: "prem" }), sumBox = h("div");
  const drawPrem = () => {
    prem.innerHTML = "";
    a.premises.forEach((p, i) => prem.append(h("div", { class: "prem-row" }, h("span", { class: "n" }, i + 1),
      inputFor(p, "name", { ph: "Patalpa", on: mark }),
      h("div", { class: "suffix" }, inputFor(p, "area", { num: true, inputmode: "decimal", ph: "0", on: mark }), h("i", {}, "m²")),
      h("button", { class: "icon-btn del", type: "button", "aria-label": "Pašalinti patalpą", onclick: () => { a.premises.splice(i, 1); drawPrem(); mark(); } }, I.del()))));
    prem.querySelectorAll("input").forEach(x => x.classList.add("inp"));
  };
  const drawSum = () => {
    const s = Math.round(a.premises.reduce((t, p) => t + (p.area || 0), 0) * 100) / 100;
    const diff = Math.abs(s - a.area) > 0.01;
    sumBox.replaceChildren(h("div", { class: "prem-sum" + (diff && a.premises.length ? " warn" : "") },
      h("span", {}, "Patalpų suma: ", h("b", {}, m2(s)), diff && a.premises.length ? ` (bendras plotas ${m2(a.area)})` : " ✓ sutampa su bendru plotu"),
      diff && a.premises.length ? h("button", { class: "btn ghost small", type: "button", onclick: () => { a.area = s; areaIn.value = String(s).replace(".", ","); mark(); } }, "Naudoti sumą kaip bendrą plotą") : null));
  };
  drawPrem(); drawSum();
  /* planas */
  const img = h("img", { src: a.plan ? "/" + a.plan : PLAN_DEFAULT, alt: "Buto " + a.no + " planas" });
  const planNote = h("span", { class: "muted", style: { fontSize: "13px" } }, a.plan ? "Šio buto planas" : "Rodomas bendras planas (img/butas.webp)");
  const picker = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true });
  picker.onchange = async () => {
    const f = picker.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast("Nuotrauka per didelė (daugiausia 8 MB).", true); return; }
    const fd = new FormData(); fd.append("id", a.id); fd.append("file", f); toast("Įkeliama…");
    try { const r = await api("plan-upload", fd, true); a.plan = r.src; img.src = "/" + r.src; planNote.textContent = "Naujas planas – išsaugokite"; mark(); toast("Planas įkeltas – nepamirškite išsaugoti"); } catch (e) { toast(e.message, true); }
  };
  const sameFloor = S.apts.filter(x => x.house === a.house && x.floor === a.floor), idx = sameFloor.findIndex(x => x.id === a.id);
  const prev = sameFloor[idx - 1], next = sameFloor[idx + 1];
  const ev = S.events.filter(e => e.apt === a.id).slice(0, 30);
  const EVL = { status: "Būsena", price: "Kaina", area: "Plotas" };
  const evV = (f, v) => f === "price" ? eur(v) : f === "area" ? m2(v) : v;
  const inqs = inqsOf(a.id), cls = S.clients.filter(c => c.apt === a.id);
  return [
    h("a", { class: "crumb", href: "#butai" }, "← Butai"),
    head("Butas " + a.no, `${hs ? hs.name : ""} · ${a.floor} aukštas`,
      prev ? h("a", { class: "btn ghost small", href: "#butas/" + prev.id }, "← " + prev.no) : null,
      next ? h("a", { class: "btn ghost small", href: "#butas/" + next.id }, next.no + " →") : null,
      h("a", { class: "btn ghost small", href: "/#butas-" + a.id, target: "_blank", rel: "noopener" }, "Svetainėje ↗")),
    h("div", { class: "cols" },
      h("div", {},
        card("Pagrindiniai duomenys", h("div", { class: "grid3" },
          fld("Būsena", stSelect(a.status, v => { a.status = v; mark(); })),
          fld("Kaina", inputFor(a, "price", { num: true, inputmode: "numeric", ph: "Tuščia – nerodoma", on: mark }), { suffix: "€" }),
          h("div", { class: "f" }, h("span", {}, "Kaina už m²"), h("div", { style: { paddingTop: "9px" } }, ppm)),
          fld("Bendras plotas", areaIn, { suffix: "m²" }),
          fld("Kambariai", inputFor(a, "rooms", { num: true, inputmode: "numeric", on: mark })),
          fld("Balkonas / terasa", inputFor(a, "balcony", { num: true, inputmode: "decimal", on: mark }), { suffix: "m²" })),
          h("p", { class: "hint mt", style: { margin: "12px 0 0" } }, "Svetainėje kaina rodoma tik laisviems butams.")),
        card("Patalpos ir jų plotas", prem, h("button", { class: "btn ghost small mt", type: "button", onclick: () => { a.premises.push({ name: "", area: 0 }); drawPrem(); mark(); prem.querySelector(".prem-row:last-child input")?.focus(); } }, "+ Patalpa"), sumBox),
        card("Buto planas", h("div", { class: "plan" }, img), h("div", { class: "plan-acts" },
          h("button", { class: "btn ghost small", type: "button", onclick: () => picker.click() }, a.plan ? "Keisti planą" : "Įkelti šio buto planą"),
          a.plan ? h("button", { class: "btn ghost small", type: "button", onclick: () => { a.plan = ""; img.src = PLAN_DEFAULT; planNote.textContent = "Bus rodomas bendras planas – išsaugokite"; mark(); } }, "Naudoti bendrą planą") : null,
          planNote, picker), h("p", { class: "hint mt", style: { margin: "10px 0 0" } }, "JPG, PNG ar WebP iki 8 MB. Nuotrauka automatiškai sumažinama ir paverčiama WebP."))),
      h("div", {},
        card(["Užklausos", h("small", {}, inqs.length)], inqs.length ? h("div", { class: "mini" }, ...inqs.slice(0, 8).map(q => h("a", { href: "#uzklausos/" + q.id }, h("b", {}, q.name), h("small", {}, dt(q.t)), stTag(q.status))))
          : h("p", { class: "muted", style: { margin: 0 } }, "Užklausų dėl šio buto dar nėra."), inqs.length > 8 ? h("a", { class: "btn ghost small mt", href: "#uzklausos?butas=" + a.id }, "Visos " + inqs.length) : null),
        card(["Klientai", h("small", {}, cls.length)], cls.length ? h("div", { class: "mini" }, ...cls.map(c => h("a", { href: "#klientas/" + c.id }, h("b", {}, fullName(c)), h("small", {}, eur(c.price)), stTag(c.status))))
          : h("p", { class: "muted", style: { margin: 0 } }, "Su šiuo butu susietų klientų nėra.")),
        card("Pakeitimų istorija", ev.length ? h("div", { class: "timeline" }, ...ev.map(e => h("div", {}, h("time", {}, dt(e.t)), h("span", {}, h("b", {}, EVL[e.field]), ": ", evV(e.field, e.from), " → ", evV(e.field, e.to), h("span", { class: "muted" }, " · " + e.by)))))
          : h("p", { class: "muted", style: { margin: 0 } }, "Pakeitimų dar nebuvo."),
          orig.updated ? h("p", { class: "hint mt", style: { margin: "10px 0 0" } }, `Paskutinį kartą keitė ${orig.by}, ${dt(orig.updated)}`) : null))),
    savebar(save, () => { setDirty(false); render(true); }),
  ];
};

/* =====================================================================
   ANALITIKA
   ===================================================================== */
const chartTip = (() => { let t; return { show(text, x, y) { if (!t) { t = h("div", { class: "chart-tip", role: "tooltip" }); document.body.append(t); } t.textContent = text; t.hidden = false; t.style.left = Math.min(x + 14, innerWidth - t.offsetWidth - 8) + "px"; t.style.top = (y - 40) + "px"; }, hide() { t && (t.hidden = true); } }; })();
function colChart(items) { /* [label, value, tip] */
  const max = Math.max(1, ...items.map(x => x[1]));
  return h("div", {},
    h("div", { class: "cols-chart", role: "img", "aria-label": items.map(x => x[2]).join("; ") }, ...items.map(([l, v, tip], i) => {
      const c = h("div", { class: "c" }, v ? h("b", {}, v) : null, h("i", { class: i === items.length - 1 ? "cur" : "", style: { height: (v / max * 85) + "%" } }));
      c.addEventListener("pointermove", e => chartTip.show(tip, e.clientX, e.clientY)); c.addEventListener("pointerleave", chartTip.hide);
      return c;
    })),
    h("div", { class: "cols-lbl" }, ...items.map(([l]) => h("span", {}, l))));
}
const MON = ["saus.", "vas.", "kov.", "bal.", "geg.", "birž.", "liep.", "rugp.", "rugs.", "spal.", "lapkr.", "gruod."];
function lastMonths(n) { const out = [], d = new Date(); d.setDate(1); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push([x.getFullYear() + "-" + pad(x.getMonth() + 1), MON[x.getMonth()]]); } return out; }
VIEWS.analitika = () => {
  const c = statusCounts(S.apts), total = S.apts.length;
  const sum = (l, k) => l.reduce((s, a) => s + (a[k] || 0), 0);
  const d30 = Date.now() - 30 * 864e5, d90 = Date.now() - 90 * 864e5;
  const inq30 = S.inqs.filter(q => new Date(q.t) > d30).length;
  const resp = S.inqs.filter(q => q.contactedAt && new Date(q.t) > d90).map(q => (new Date(q.contactedAt) - new Date(q.t)) / 36e5);
  const avgResp = resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : null;
  const freeArea = sum(c.Laisvas, "area"), freeVal = sum(c.Laisvas, "price");
  const months = lastMonths(12);
  const perMonth = months.map(([k, l]) => { const n = S.inqs.filter(q => q.t.startsWith(k)).length; return [l, n, `${l} ${k.slice(0, 4)}: ${plural(n, "užklausa", "užklausos", "užklausų")}`]; });
  const salesMonth = months.map(([k, l]) => { const n = S.events.filter(e => e.field === "status" && e.to === "Parduotas" && e.t.startsWith(k)).length; return [l, n, `${l} ${k.slice(0, 4)}: parduota ${n}`]; });
  const funnel = [["Užklausos", S.inqs.length], ["Klientai", S.clients.length], ["Apžiūra / derybos", S.clients.filter(x => ["Apžiūra", "Derybos", "Rezervavo", "Pirko"].includes(x.status)).length],
    ["Rezervavo", S.clients.filter(x => ["Rezervavo", "Pirko"].includes(x.status)).length], ["Pirko", S.clients.filter(x => x.status === "Pirko").length]];
  const floorRows = [];
  S.houses.forEach(hs => hs.floors.forEach(f => {
    const l = S.apts.filter(a => a.house === hs.id && a.floor === f), cc = statusCounts(l);
    floorRows.push(h("tr", {}, h("td", { class: "nowrap" }, `${hs.name} · ${f} a.`), h("td", { style: { width: "40%" } }, h("div", { class: "stack", role: "img", "aria-label": APT_ST.map(s => `${s} ${cc[s].length}`).join(", ") }, ...APT_ST.filter(s => cc[s].length).map(s => h("i", { style: { flex: cc[s].length, background: ST_COLOR[s] } })))),
      ...APT_ST.map(s => h("td", { class: "r" }, cc[s].length)), h("td", { class: "r nowrap hide-s" }, eur(sum(cc.Parduotas, "price")))));
  }));
  return [
    head("Analitika", "Pardavimai, užklausos ir lankomumas."),
    h("div", { class: "kpis" },
      ...APT_ST.map(s => h("a", { class: "kpi", href: "#butai?st=" + encodeURIComponent(s) }, h("div", { class: "k" }, h("i", { style: { background: ST_COLOR[s] } }), s === "Laisvas" ? "Laisva" : s === "Rezervuotas" ? "Rezervuota" : "Parduota"),
        h("div", { class: "v" }, c[s].length, h("span", { style: { fontSize: "15px", color: "var(--ink-3)", fontWeight: 700 } }, ` / ${total}`)), h("div", { class: "s" }, `${total ? Math.round(c[s].length / total * 100) : 0} % · ${m2(sum(c[s], "area"))}`))),
      h("div", { class: "kpi" }, h("div", { class: "k" }, "Parduota už"), h("div", { class: "v" }, eur(sum(c.Parduotas, "price"))), h("div", { class: "s" }, "Laisvų vertė " + eur(freeVal))),
      h("div", { class: "kpi" }, h("div", { class: "k" }, "Laisvų vid. €/m²"), h("div", { class: "v" }, freeArea ? nf0.format(freeVal / freeArea) + " €" : "—"), h("div", { class: "s" }, "pagal nurodytas kainas")),
      h("div", { class: "kpi" }, h("div", { class: "k" }, "Užklausos per 30 d."), h("div", { class: "v" }, inq30), h("div", { class: "s" }, "iš viso " + S.inqs.length)),
      h("div", { class: "kpi" }, h("div", { class: "k" }, "Vid. reakcijos laikas"), h("div", { class: "v" }, avgResp == null ? "—" : avgResp < 1 ? Math.round(avgResp * 60) + " min" : nf2.format(Math.round(avgResp * 10) / 10) + " val"), h("div", { class: "s" }, "nuo užklausos iki „Susisiekta“ (90 d.)"))),
    card(["Butų būsenos pagal namą ir aukštą", h("small", {}, "")], stackBar(c, total), h("div", { class: "tbl-wrap mt" }, h("table", { class: "tbl" },
      h("thead", {}, h("tr", {}, h("th", {}, "Aukštas"), h("th", {}, "Pasiskirstymas"), h("th", { class: "r" }, "Laisvi"), h("th", { class: "r" }, "Rezerv."), h("th", { class: "r" }, "Parduoti"), h("th", { class: "r hide-s" }, "Parduota už"))), h("tbody", {}, ...floorRows)))),
    h("div", { class: "cols2" },
      card("Užklausos per mėnesį", colChart(perMonth)),
      card("Parduoti butai per mėnesį", S.events.some(e => e.to === "Parduotas") ? colChart(salesMonth) : h("p", { class: "muted" }, "Kai butą pažymėsite „Parduotas“, čia matysis pardavimų eiga."))),
    h("div", { class: "cols2" },
      card("Pardavimo piltuvėlis", barList(funnel.map(([l, n]) => [l, n])), h("p", { class: "hint mt", style: { margin: "12px 0 0" } }, S.inqs.length ? `Iš užklausų į pirkimą: ${nf2.format(Math.round(funnel[4][1] / S.inqs.length * 1000) / 10)} %` : "")),
      card("Užklausos pagal butą", aptInqCounts().length ? barList(aptInqCounts().slice(0, 12).map(([id, n]) => [aptNo(id) || "Be buto", n, id ? "#butas/" + id : null])) : h("p", { class: "muted" }, "Užklausų dar nėra."))),
    gaCard(),
  ];
};

/* Google Analytics – kol kas DEMO: netikri duomenys, kad matytųsi, kaip atrodys */
function rng(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gaCard() {
  const ga = structuredClone(S.settings.ga);
  const box = h("div");
  const draw = () => {
    box.innerHTML = "";
    const mid = h("input", { class: "inp", placeholder: "G-XXXXXXXXXX", value: ga.measurementId, "aria-label": "Measurement ID" });
    const pid = h("input", { class: "inp", placeholder: "123456789", value: ga.propertyId, "aria-label": "Property ID" });
    const key = h("textarea", { class: "inp", rows: 2, placeholder: "{ \"type\": \"service_account\", … }  (paslaugos paskyros JSON raktas)", style: { height: "auto", padding: "8px 12px", fontSize: "13px" }, "aria-label": "Paslaugos paskyros raktas" });
    box.append(h("div", { class: "grid3" }, fld("Measurement ID", mid), fld("Property ID", pid), fld("API raktas", key)),
      h("div", { class: "row-acts mt" },
        h("button", { class: "btn" + (ga.connected ? " ghost" : ""), type: "button", onclick: async () => {
          ga.measurementId = mid.value.trim(); ga.propertyId = pid.value.trim(); ga.connected = !ga.connected;
          if (ga.connected && !/^G-[A-Z0-9]{4,}$/i.test(ga.measurementId)) { ga.connected = false; toast("Įveskite Measurement ID (G-…)", true); return; }
          try { const r = await api("settings-save", { ...S.settings, ga }); S.settings = r.settings; toast(ga.connected ? "Prijungta (demo)" : "Atjungta"); draw(); } catch (e) { toast(e.message, true); }
        } }, ga.connected ? "Atjungti" : "Prijungti"),
        h("span", { class: "muted", style: { fontSize: "13px" } }, "API raktas nesaugomas – tai tik demonstracinis langas. Tikram prijungimui reikės Google Analytics Data API prieigos.")));
    if (!ga.connected) { box.append(h("p", { class: "muted mt" }, "Įveskite Measurement ID ir spauskite „Prijungti“, kad pamatytumėte, kaip atrodys statistika.")); return; }
    const R = rng(ga.measurementId || "demo");
    const days = Array.from({ length: 30 }, (_, i) => Math.round(80 + 60 * R() + 25 * Math.sin(i / 3) + i * 2.2));
    const users = days.reduce((a, b) => a + b, 0), sess = Math.round(users * 1.34), views = Math.round(sess * 3.8);
    const W = 600, H = 120, max = Math.max(...days) * 1.1, x = i => i / 29 * W, y = v => H - v / max * H;
    const sp = document.createElementNS("http://www.w3.org/2000/svg", "svg"); sp.setAttribute("viewBox", `0 0 ${W} ${H}`); sp.setAttribute("preserveAspectRatio", "none"); sp.setAttribute("class", "spark");
    sp.setAttribute("role", "img"); sp.setAttribute("aria-label", "Lankytojai per 30 dienų (demo)");
    sp.innerHTML = `<path d="M0,${H} ${days.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${W},${H}Z" fill="rgba(31,77,58,.10)"/><path d="${days.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="#1f4d3a" stroke-width="2" vector-effect="non-scaling-stroke"/><line id="gaX" y1="0" y2="${H}" stroke="#7c8680" stroke-width="1" vector-effect="non-scaling-stroke" visibility="hidden"/>`;
    sp.addEventListener("pointermove", e => {
      const r = sp.getBoundingClientRect(), i = Math.max(0, Math.min(29, Math.round((e.clientX - r.left) / r.width * 29)));
      const ln = sp.querySelector("#gaX"); ln.setAttribute("x1", x(i)); ln.setAttribute("x2", x(i)); ln.setAttribute("visibility", "visible");
      const d = new Date(Date.now() - (29 - i) * 864e5); chartTip.show(`${dOnly(d)}: ${days[i]} lankytojų (demo)`, e.clientX, e.clientY);
    });
    sp.addEventListener("pointerleave", () => { sp.querySelector("#gaX").setAttribute("visibility", "hidden"); chartTip.hide(); });
    const src = [["Google paieška", .42], ["Tiesioginis", .21], ["Facebook / Instagram", .18], ["Aruodas.lt", .12], ["Kita", .07]].map(([l, p]) => [l, Math.round(users * p * (0.85 + R() * 0.3))]);
    const top = [...S.apts].sort(() => R() - .5).slice(0, 6).map(a => ["Butas " + a.no, Math.round(views * (0.01 + R() * 0.03)), "#butas/" + a.id]).sort((a, b) => b[1] - a[1]);
    box.append(
      h("div", { class: "kpis mt" },
        h("div", { class: "kpi" }, h("div", { class: "k" }, "Lankytojai (30 d.)"), h("div", { class: "v" }, nf0.format(users)), h("div", { class: "s" }, "+" + Math.round(4 + R() * 18) + " % nei prieš tai")),
        h("div", { class: "kpi" }, h("div", { class: "k" }, "Sesijos"), h("div", { class: "v" }, nf0.format(sess))),
        h("div", { class: "kpi" }, h("div", { class: "k" }, "Puslapių peržiūros"), h("div", { class: "v" }, nf0.format(views))),
        h("div", { class: "kpi" }, h("div", { class: "k" }, "Vid. trukmė"), h("div", { class: "v" }, `${1 + Math.floor(R() * 3)}:${pad(Math.floor(R() * 60))}`)),
        h("div", { class: "kpi" }, h("div", { class: "k" }, "Formos konversija"), h("div", { class: "v" }, nf2.format(Math.round((1.2 + R() * 2) * 10) / 10) + " %"))),
      h("div", { class: "f" }, h("span", {}, "Lankytojai per dieną"), sp),
      h("div", { class: "cols2 mt" }, h("div", {}, h("div", { class: "f" }, h("span", {}, "Srauto šaltiniai")), h("div", { class: "mt" }, barList(src))),
        h("div", {}, h("div", { class: "f" }, h("span", {}, "Dažniausiai žiūrimi butai")), h("div", { class: "mt" }, barList(top)))));
  };
  draw();
  return card(["Google Analytics", h("span", { class: "demo" }, "Demo · netikri duomenys")], box);
}

/* =====================================================================
   NUSTATYMAI, ŽURNALAS
   ===================================================================== */
VIEWS.nustatymai = () => {
  const st = structuredClone(S.settings);
  const emails = [0, 1, 2, 3, 4].map(i => h("input", { class: "inp", type: "email", placeholder: i ? "" : "vardas@pastas.lt", value: st.notify[i] || "", "aria-label": "Gavėjas " + (i + 1) }));
  const ret = h("select", { class: "inp", style: { maxWidth: "280px" } }, ...[[6, "6 mėn."], [12, "12 mėn."], [18, "18 mėn."], [24, "24 mėn. (rekomenduojama)"], [36, "36 mėn."], [0, "Netrinti automatiškai"]].map(([v, l]) => h("option", { value: v, selected: st.retentionMonths === v }, l)));
  const save = async () => {
    try {
      const r = await api("settings-save", { retentionMonths: +ret.value, notify: emails.map(x => x.value.trim()).filter(Boolean), ga: st.ga });
      S.settings = r.settings; toast("Nustatymai išsaugoti"); render(true);
    } catch (e) { toast(e.message, true); }
  };
  return [
    head("Nustatymai"),
    card("Pranešimai apie naujas užklausas", h("p", { class: "hint" }, "Gavus užklausą iš svetainės, laiškas išsiunčiamas šiais adresais (iki 5)."),
      h("div", { class: "grid3" }, ...emails), S.settings.notifyEnv ? h("p", { class: "hint mt" }, "Taip pat: " + S.settings.notifyEnv + " (nustatyta serveryje, FORM_TO_EMAIL)") : null),
    card("Asmens duomenys (BDAR)", h("p", { class: "hint" }, "Senos užklausos ištrinamos automatiškai kartą per parą. Prie formos svetainėje parašyta, kad duomenys naudojami tik atsakymui. Kliento kortelės (sudarius sutartį) nėra trinamos automatiškai."),
      fld("Laikyti užklausas", ret),
      h("div", { class: "row-acts mt" }, h("span", {}, "Pagal dabartinį nustatymą senų užklausų: ", h("b", {}, S.settings.oldCount)),
        S.settings.oldCount ? h("button", { class: "btn danger small", type: "button", onclick: async () => {
          if (!(await confirmDlg("Ištrinti senas užklausas dabar?", `Bus ištrinta ${S.settings.oldCount}.`, "Ištrinti", "danger"))) return;
          try { const r = await api("cleanup-now"); S.settings = r.settings; S = await api("state"); toast("Ištrinta: " + r.deleted); render(true); } catch (e) { toast(e.message, true); }
        } }, "Ištrinti dabar") : null)),
    card("Apsauga nuo šlamšto", h("ul", { style: { margin: 0, paddingLeft: "20px", color: "var(--ink-2)", lineHeight: 1.8 } },
      h("li", {}, "Nematomas laukelis-spąstai: jį užpildo tik robotai – tokia užklausa tyliai atmetama."),
      h("li", {}, "Per greitai (per 3 s) užpildyta forma laikoma robotu."),
      h("li", {}, "Iš vieno IP – ne daugiau kaip 3 užklausos per 10 min. ir 10 per parą (saugoma tik IP maiša)."),
      h("li", {}, "Žinutės su daug nuorodų atmetamos. „reCAPTCHA“ paveikslėlių nereikia."))),
    h("button", { class: "btn", type: "button", onclick: save }, "Išsaugoti nustatymus"),
  ];
};
function logList(items) {
  if (!items.length) return h("p", { class: "muted" }, "Kol kas nieko.");
  return h("div", { class: "hist" }, ...items.map(l => h("div", {}, h("time", {}, dt(l.t)), h("span", {}, h("b", {}, l.who), " · ", l.what))));
}
VIEWS.zurnalas = () => [head("Žurnalas", "Kas ir ką keitė CRM (paskutiniai 80 įrašų)."), card(null, logList(S.log))];

/* =====================================================================
   PASKYROS
   ===================================================================== */
VIEWS.paskyros = () => {
  const box = h("div", { class: "users" });
  const showTemp = (u, temp) => dialog("Laikinas slaptažodis", h("div", {},
    h("p", {}, `Perduokite ${u} šį slaptažodį (geriausia telefonu ar asmeniškai). Prisijungus sistema paprašys susikurti savo.`),
    h("div", { class: "secret" }, temp)), [["Nukopijavau", true]]);
  const draw = () => {
    box.innerHTML = "";
    S.users.forEach(u => box.append(h("div", { class: "user" },
      h("div", { class: "who" }, h("b", {}, u.name + (u.me ? " (jūs)" : "")), h("small", {}, u.email)),
      u.twofa ? h("span", { class: "tag ok" }, "2FA įjungta") : h("span", { class: "tag" }, "Be 2FA"),
      u.mustChange ? h("span", { class: "tag" }, "Laukia prisijungimo") : null,
      u.disabled ? h("span", { class: "tag bad" }, "Išjungta") : null,
      u.owner ? h("span", { class: "tag ok" }, "Pagrindinis administratorius") : null,
      u.me || u.owner || !S.me.owner ? null : h("span", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
        h("button", { class: "btn ghost small", type: "button", onclick: async () => {
          const ck = h("input", { type: "checkbox" });
          const ok = await dialog("Naujas laikinas slaptažodis", h("div", {}, h("p", {}, `${u.name} bus atjungtas ir turės prisijungti su nauju laikinu slaptažodžiu.`),
            u.twofa ? h("label", { style: { display: "flex", gap: "8px", alignItems: "center" } }, ck, "Taip pat išjungti 2FA (jei pametė telefoną)") : ""), [["Atšaukti", false, "ghost"], ["Sukurti", true]]);
          if (!ok) return;
          try { const r = await api("user-reset", { id: u.id, reset2fa: ck.checked }); S.users = r.users; draw(); showTemp(u.name, r.temp); } catch (e) { toast(e.message, true); }
        } }, "Laikinas slaptažodis"),
        h("button", { class: "btn ghost small", type: "button", onclick: async () => { try { const r = await api("user-toggle", { id: u.id }); S.users = r.users; draw(); } catch (e) { toast(e.message, true); } } }, u.disabled ? "Įjungti" : "Išjungti"),
        h("button", { class: "btn danger small", type: "button", onclick: async () => {
          if (!(await confirmDlg("Ištrinti paskyrą?", `${u.name} (${u.email}) nebegalės prisijungti.`, "Ištrinti", "danger"))) return;
          try { const r = await api("user-delete", { id: u.id }); S.users = r.users; draw(); } catch (e) { toast(e.message, true); }
        } }, "Ištrinti")))));
  };
  draw();
  const nu = { name: "", email: "" };
  return [
    head("Paskyros", S.me.owner ? "Visi administratoriai mato ir keičia visus CRM duomenis. Paskyras kuriate ir valdote tik jūs." : "Paskyras kuria ir valdo pagrindinis administratorius."),
    card("Administratoriai", box),
    !S.me.owner ? null : card("Nauja paskyra", h("p", { class: "hint" }, "Sistema sukurs laikiną slaptažodį – perduokite jį žmogui. Prisijungęs jis susikurs savo."),
      h("div", { class: "grid2" }, fld("Vardas", inputFor(nu, "name")), fld("El. paštas", inputFor(nu, "email", { type: "email" }))),
      h("button", { class: "btn mt", type: "button", onclick: async () => {
        try { const r = await api("user-add", nu); S.users = r.users; draw(); showTemp(nu.name, r.temp); } catch (e) { toast(e.message, true); }
      } }, "Sukurti paskyrą")),
  ];
};
VIEWS.mano = () => {
  const pw = { old: "", new: "", rep: "" };
  const tf = h("div");
  const drawTF = () => {
    tf.innerHTML = "";
    if (S.me.twofa) {
      const p = { password: "" };
      tf.append(h("p", {}, h("span", { class: "tag ok" }, "Įjungta"), " Prisijungiant reikia kodo iš telefono. Atsarginių kodų liko: ", h("b", {}, S.me.backupLeft), "."),
        h("div", { style: { maxWidth: "360px" } }, fld("Slaptažodis išjungimui", inputFor(p, "password", { type: "password" }))),
        h("button", { class: "btn danger mt", type: "button", onclick: async () => {
          try { const r = await api("2fa-disable", p); S.me = r.me; toast("Dviejų žingsnių patvirtinimas išjungtas"); drawTF(); } catch (e) { toast(e.message, true); }
        } }, "Išjungti 2FA"));
    } else {
      tf.append(h("p", { class: "hint" }, "Be slaptažodžio prisijungiant reikės 6 skaitmenų kodo iš telefono programėlės (Google Authenticator, Microsoft Authenticator ar iPhone „Slaptažodžiai“). Kadangi CRM yra klientų asmens duomenys – rekomenduojama."),
        h("button", { class: "btn", type: "button", onclick: async () => {
          let r; try { r = await api("2fa-setup"); } catch (e) { toast(e.message, true); return; }
          const qr = qrcode(0, "M"); qr.addData(r.uri); qr.make();
          const c = { code: "" };
          tf.innerHTML = "";
          tf.append(h("div", { class: "twocol" }, h("div", { class: "qr", html: qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) }),
            h("div", {}, h("ol", { style: { margin: "0 0 14px", paddingLeft: "20px", lineHeight: "1.8" } },
              h("li", {}, "Atsidarykite programėlę telefone ir pasirinkite „+“ / „Pridėti paskyrą“."),
              h("li", {}, "Nuskenuokite QR kodą (arba įveskite raktą ranka)."),
              h("li", {}, "Įveskite programėlėje rodomą 6 skaitmenų kodą.")),
              h("div", { class: "secret" }, r.secret.replace(/(.{4})/g, "$1 ").trim()),
              h("div", { style: { maxWidth: "220px" }, class: "mt" }, fld("Kodas", inputFor(c, "code", { inputmode: "numeric" }))),
              h("button", { class: "btn mt", type: "button", onclick: async () => {
                try {
                  const x = await api("2fa-enable", c);
                  S.me.twofa = true; S.me.backupLeft = x.codes.length;
                  await dialog("Atsarginiai kodai", h("div", {}, h("p", {}, "Išsisaugokite šiuos kodus. Kiekvienas tinka vieną kartą, jei neturėsite telefono."),
                    h("div", { class: "codes" }, ...x.codes.map(k => h("span", {}, k)))), [["Išsisaugojau", true]]);
                  drawTF(); toast("Dviejų žingsnių patvirtinimas įjungtas");
                } catch (e) { toast(e.message, true); }
              } }, "Patvirtinti"))));
        } }, "Įjungti 2FA"));
    }
  };
  drawTF();
  return [
    head("Mano paskyra", S.me.name + " · " + S.me.email),
    card("Slaptažodžio keitimas", h("div", { style: { maxWidth: "420px", display: "grid", gap: "14px" } },
      fld("Dabartinis slaptažodis", inputFor(pw, "old", { type: "password" })), fld("Naujas slaptažodis", inputFor(pw, "new", { type: "password" }), { hint: "Bent 10 simbolių" }), fld("Pakartokite", inputFor(pw, "rep", { type: "password" }))),
      h("button", { class: "btn mt", type: "button", onclick: async () => {
        if (pw.new !== pw.rep) { toast("Slaptažodžiai nesutampa.", true); return; }
        try { await api("password", { old: pw.old, new: pw.new }); toast("Slaptažodis pakeistas. Kituose įrenginiuose būsite atjungti."); render(); } catch (e) { toast(e.message, true); }
      } }, "Pakeisti slaptažodį")),
    card("Dviejų žingsnių patvirtinimas (2FA)", tf),
  ];
};

/* ---------- greita paieška viršuje ---------- */
(() => {
  const q = $("#q"), res = $("#qRes");
  let items = [], sel = -1;
  const close = () => { res.hidden = true; sel = -1; };
  const go = i => { const it = items[i]; if (!it) return; close(); q.value = ""; location.hash = it.href; };
  q.addEventListener("input", () => {
    const s = q.value.trim(); if (!s || !S) { close(); return; }
    const n = norm(s), d = digits(s);
    const hit = (...f) => f.some(v => norm(v).includes(n)) || (d.length >= 3 && f.some(v => digits(v).includes(d) && /\d/.test(v)));
    const groups = [
      ["Butai", S.apts.filter(a => norm(a.no).replace("-", "").includes(n.replace("-", ""))).slice(0, 5).map(a => ({ label: "Butas " + a.no, sub: `${a.status} · ${eur(a.price)}`, href: "#butas/" + a.id }))],
      ["Klientai", S.clients.filter(c => hit(fullName(c), c.email, c.phone)).slice(0, 6).map(c => ({ label: fullName(c), sub: [c.phone, aptNo(c.apt), c.status].filter(Boolean).join(" · "), href: "#klientas/" + c.id }))],
      ["Užklausos", S.inqs.filter(x => hit(x.name, x.email, x.phone)).slice(0, 6).map(x => ({ label: x.name, sub: [aptNo(x.apt), dOnly(x.t), INQ_L[x.status]].filter(Boolean).join(" · "), href: "#uzklausos/" + x.id }))],
    ];
    items = groups.flatMap(g => g[1]); sel = items.length ? 0 : -1;
    res.innerHTML = ""; let k = 0;
    groups.forEach(([t, l]) => { if (!l.length) return; res.append(h("h5", {}, t)); l.forEach(it => { const i = k++; res.append(h("a", { href: it.href, class: i === sel ? "on" : "", onclick: e => { e.preventDefault(); go(i); } }, it.label, h("small", {}, it.sub))); }); });
    if (!items.length) res.append(h("p", {}, "Nieko nerasta."));
    res.hidden = false;
  });
  q.addEventListener("keydown", e => {
    if (e.key === "Escape") { q.value = ""; close(); q.blur(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!items.length) return; sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; res.querySelectorAll("a").forEach((a, i) => a.classList.toggle("on", i === sel)); }
    else if (e.key === "Enter") { e.preventDefault(); go(sel); }
  });
  q.addEventListener("blur", () => setTimeout(close, 150));
  addEventListener("keydown", e => { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
})();

/* ---------- pradžia ir atnaujinimas (kiti administratoriai, naujos užklausos) ---------- */
async function poll() {
  if (document.hidden) return;
  try {
    const p = await api("ping");
    if (p.sig === S.sig) return;
    const before = newCount();
    const fresh = await api("state");
    const added = fresh.inqs.filter(q => q.status === "nauja").length - before;
    if (dirty || document.activeElement?.matches("input,textarea,select")) { S.inqs = fresh.inqs; S.sig = fresh.sig; drawSide(); }
    else { S = fresh; render(true); }
    if (added > 0) toast(added === 1 ? "Gauta nauja užklausa" : `Gautos ${added} naujos užklausos`);
  } catch (e) { /* ryšio klaidos – bandoma vėl kitą kartą */ }
}
(async () => {
  try {
    S = await api("state");
    render();
    setInterval(poll, 45000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  } catch (e) { $("#main").innerHTML = ""; $("#main").append(h("p", { class: "note bad" }, e.message)); }
})();
