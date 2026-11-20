// Shared UI: DOM helpers, action registry, sheets, dialogs, theme, avatars, calendars,
// and the in-app date / time pickers (phone pickers can be chosen in Settings).
import { prefs, t, isBn, num, fd, fdFull, MONF, DAY_MINI, WEEK, ftime } from './i18n.js';
import { today, addMonths, dim, pad } from './dates.js';
import { S } from './store.js';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };

// Every element with data-act="name" calls ACT.name(el, event); data-inp="name" calls INP.name(el) on input/change.
export const ACT = {};
export const INP = {};

// ---------- theme ----------
export const THEMES = [['Teal','টিল','#0f8b8d','#3cc7c9'],['Indigo','ইন্ডিগো','#4f46e5','#8b8ff5'],['Emerald','পান্না','#059669','#34d399'],['Crimson','লাল','#e11d48','#fb7185'],['Orange','কমলা','#ea580c','#fb923c'],['Violet','বেগুনি','#7c3aed','#a78bfa'],['Sky','আকাশি','#0284c7','#38bdf8'],['Rose','গোলাপি','#db2777','#f472b6'],['Slate','স্লেট','#334155','#94a3b8'],['Mustard','সরিষা','#b45309','#fbbf24']];
export const BNF = ['Baloo Da 2', 'Hind Siliguri', 'Noto Sans Bengali'];
export const ENF = ['Nunito', 'Poppins', 'Inter'];
export function applyTheme() {
  const th = THEMES[prefs.theme] || THEMES[0], r = document.documentElement;
  r.style.setProperty('--ac', `light-dark(${th[2]},${th[3]})`);
  r.style.setProperty('--hero', th[2]);
  r.style.setProperty('--en', `'${ENF[prefs.enf] || ENF[0]}'`);
  r.style.setProperty('--bn', `'${BNF[prefs.bnf] || BNF[0]}'`);
  if (prefs.mode === 'light' || prefs.mode === 'dark') r.dataset.theme = prefs.mode; else delete r.dataset.theme;
  r.lang = prefs.lang;
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = th[2];
}

// ---------- feedback ----------
export function toast(msg) { const e = $('#toast'); e.textContent = msg; e.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('show'), 2600); }
export function sheet(html) { $('#sbox').innerHTML = html; $('#sheet').hidden = false; $('#sbox').scrollTop = 0; }
export function closeSheet() { $('#sheet').hidden = true; $('#sbox').innerHTML = ''; }
export const sheetOpen = () => !$('#sheet').hidden;
export const head = title => `<div class="shead"><h3>${title}</h3><button class="ib" data-act="closeSheet" aria-label="close">✕</button></div>`;
export const redrawSheet = fn => { const y = $('#sbox').scrollTop; fn(); $('#sbox').scrollTop = y; };
export const keepScroll = fn => { const y = scrollY; fn(); scrollTo(0, y); };
export function ask(message, okLabel, danger = true) {
  return new Promise(res => {
    const d = $('#dialog');
    d.innerHTML = `<div class="dbox"><p>${esc(message)}</p><div class="bar end"><button class="btn" data-r="0">${t('cancel')}</button><button class="btn ${danger ? 'dangerfill' : 'pri'}" data-r="1">${esc(okLabel || t('del'))}</button></div></div>`;
    d.hidden = false;
    d.onclick = e => { const b = e.target.closest('[data-r]'); if (b || e.target === d) { d.hidden = true; d.onclick = null; res(!!(b && b.dataset.r === '1')); } };
  });
}
export function busy(btn, on) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
  else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}
export function confetti() {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  const box = document.createElement('div'); box.className = 'confetti'; const cols = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#facc15'];
  for (let i = 0; i < 44; i++) { const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % 6]; c.style.animationDelay = Math.random() * 0.3 + 's'; c.style.setProperty('--x', (Math.random() * 180 - 90) + 'px'); c.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg'); box.appendChild(c); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2200);
}
export const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };

// ---------- visuals ----------
const ini = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const hue = n => { let h = 7; for (const c of String(n)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const av = (name, cls = '') => `<span class="av ${cls}" style="--h:${hue(name)}">${esc(ini(name))}</span>`;
export const empty = (e, txt) => `<div class="empty"><div class="e">${e}</div><p>${txt}</p></div>`;
export function pill(f) {
  const x = f.status === 'due' ? t('due') + (f.lateDays ? ' · ' + num(f.lateDays) + ' ' + t('daysLate') : ' · ' + t('dueToday')) : f.status === 'soon' ? t('dueSoon') : t('paid');
  return `<span class="pill ${f.status}">${x}</span>`;
}
export const ring = (p, sz) => { const r = (sz - 12) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p)); return `<svg class="ring" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="11"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(sz / 4.4)}" font-weight="800" fill="#fff">${num(Math.round(v * 100))}%</text></svg>`; };
// month calendar; key = name of S.ui field holding "YYYY-MM"; cell(ds) → {cls, inner, attr}
export function cal(key, cell) {
  const ym = S.ui[key] || today().slice(0, 7), [y, m] = ym.split('-').map(Number), off = (new Date(y, m - 1, 1).getDay() + 1) % 7, n = dim(y, m - 1), T = today();
  let h = `<div class="calhead"><button class="ib" data-act="calNav" data-k="${key}" data-d="-1" aria-label="previous">‹</button><b>${MONF()[m - 1]} ${num(y)}</b><button class="ib" data-act="calNav" data-k="${key}" data-d="1" aria-label="next">›</button></div><div class="cal">`;
  h += WEEK.map(i => `<span class="cw">${DAY_MINI()[i]}</span>`).join('');
  for (let i = 0; i < off; i++) h += '<span></span>';
  for (let d = 1; d <= n; d++) { const ds = `${y}-${pad(m)}-${pad(d)}`, c = cell(ds) || {}; h += `<div class="cd ${c.cls || ''} ${ds === T ? 'today' : ''}" ${c.attr || ''}><span>${num(d)}</span>${c.inner || ''}</div>`; }
  return h + '</div>';
}
ACT.calNav = el => { const k = el.dataset.k; S.ui[k] = addMonths((S.ui[k] || today().slice(0, 7)) + '-01', +el.dataset.d).slice(0, 7); keepScroll(S.render); };

const ICON = {
  home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>', students: '<circle cx="9" cy="8" r="4"/><path d="M1 21c0-4 4-6 8-6s8 2 8 6M17 4a4 4 0 010 8M23 21c0-3-2-5-5-6"/>',
  attend: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M8 15l3 3 5-5"/>', fees: '<rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="3"/><path d="M2 10h3M19 10h3"/>',
  exams: '<path d="M9 4h6v3H9zM6 5H5a1 1 0 00-1 1v15h16V6a1 1 0 00-1-1h-1M8 13h8M8 17h5"/>', batches: '<path d="M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4"/>',
  requests: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>', staff: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0114 0v2M12 11v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6M19 3v6M16 6h6"/>', link: '<path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', shield: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>'
};
export const svg = k => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;

// ---------- phone helpers (Bangladesh) ----------
export const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('880')) d = d.slice(2); return d; };
export const validPhone = p => /^01[3-9]\d{8}$/.test(normPhone(p));
export const wa = (p, text) => 'https://wa.me/88' + normPhone(p) + (text ? '?text=' + encodeURIComponent(text) : '');
export const waBtn = (p, text, label, cls = 'sm') => (p ? `<a class="btn wa ${cls}" href="${wa(p, text)}" target="_blank" rel="noopener">${label}</a>` : '');

// =====================================================================
// DATE FIELD — in-app calendar by default; Settings can switch to the phone's own picker.
// Usage: dateField('admit', label, '2026-11-20') in a form; read with getDate('admit') on save.
// =====================================================================
const DP = {};
export function dateField(key, label, value) {
  if (prefs.picker === 'phone') return `<label>${label}<input type="date" id="d_${key}" value="${value || ''}"></label>`;
  DP[key] = { value: value || '', open: false, ym: (value || today()).slice(0, 7) };
  return `<div class="lab">${label}</div><div class="df" id="df_${key}">${dfInner(key)}</div>`;
}
function dfInner(key) {
  const d = DP[key];
  let h = `<button type="button" class="dfbtn ${d.open ? 'open' : ''}" data-act="dpToggle" data-k="${key}">📅 <span>${d.value ? fdFull(d.value) : t('pickDate')}</span><b>${d.open ? '▲' : '▼'}</b></button>`;
  if (!d.open) return h;
  const [y, m] = d.ym.split('-').map(Number), off = (new Date(y, m - 1, 1).getDay() + 1) % 7, n = dim(y, m - 1), T = today();
  h += `<div class="dp"><div class="calhead"><button type="button" class="ib" data-act="dpNav" data-k="${key}" data-d="-12" aria-label="previous year">«</button><button type="button" class="ib" data-act="dpNav" data-k="${key}" data-d="-1" aria-label="previous month">‹</button>
    <b>${MONF()[m - 1]} ${num(y)}</b><button type="button" class="ib" data-act="dpNav" data-k="${key}" data-d="1" aria-label="next month">›</button><button type="button" class="ib" data-act="dpNav" data-k="${key}" data-d="12" aria-label="next year">»</button></div><div class="cal">`;
  h += WEEK.map(i => `<span class="cw">${DAY_MINI()[i]}</span>`).join('');
  for (let i = 0; i < off; i++) h += '<span></span>';
  for (let k = 1; k <= n; k++) { const ds = `${y}-${pad(m)}-${pad(k)}`; h += `<button type="button" class="cd pick ${ds === d.value ? 'sel' : ''} ${ds === T ? 'today' : ''}" data-act="dpPick" data-k="${key}" data-v="${ds}"><span>${num(k)}</span></button>`; }
  return h + `</div><div class="bar end" style="margin:8px 0 0"><button type="button" class="btn sm" data-act="dpPick" data-k="${key}" data-v="${T}">${t('todayBtn')}</button>${d.value ? `<button type="button" class="btn sm ghost" data-act="dpPick" data-k="${key}" data-v="">${t('clear')}</button>` : ''}</div></div>`;
}
const dfDraw = key => { const box = document.getElementById('df_' + key); if (box) box.innerHTML = dfInner(key); };
export const getDate = key => { const n = document.getElementById('d_' + key); return n ? n.value : DP[key]?.value || ''; };
ACT.dpToggle = el => { const d = DP[el.dataset.k]; d.open = !d.open; if (d.open) d.ym = (d.value || today()).slice(0, 7); dfDraw(el.dataset.k); };
ACT.dpNav = el => { const d = DP[el.dataset.k]; d.ym = addMonths(d.ym + '-01', +el.dataset.d).slice(0, 7); dfDraw(el.dataset.k); };
ACT.dpPick = el => { const d = DP[el.dataset.k]; d.value = el.dataset.v; d.open = false; dfDraw(el.dataset.k); };

// =====================================================================
// TIME FIELD — tap hour, minute, AM/PM (no 24-hour confusion); or the phone picker.
// =====================================================================
const TP = {};
export function timeField(key, value) {
  if (prefs.picker === 'phone') return `<input type="time" id="t_${key}" value="${value || ''}" aria-label="${t('classTime')}">`;
  TP[key] = { value: value ? value.slice(0, 5) : '', open: false };
  return `<div class="df" id="tf_${key}">${tfInner(key)}</div>`;
}
function tfInner(key) {
  const d = TP[key];
  let h = `<button type="button" class="dfbtn ${d.value ? 'set' : ''}" data-act="tpToggle" data-k="${key}">🕒 <span>${d.value ? ftime(d.value) : t('setTime')}</span><b>${d.open ? '▲' : '▼'}</b></button>`;
  if (!d.open) return h;
  let H = 16, M = 0; if (d.value) [H, M] = d.value.split(':').map(Number);
  const h12 = H % 12 || 12, pm = H >= 12;
  h += `<div class="tp"><div class="tplab">${t('hour')}</div><div class="tpgrid">${[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(x => `<button type="button" class="tpb ${x === h12 ? 'on' : ''}" data-act="tpSet" data-k="${key}" data-f="h" data-v="${x}">${num(x)}</button>`).join('')}</div>
    <div class="tplab">${t('minute')}</div><div class="tpgrid four">${[0, 15, 30, 45].map(x => `<button type="button" class="tpb ${x === M ? 'on' : ''}" data-act="tpSet" data-k="${key}" data-f="m" data-v="${x}">${num(pad(x))}</button>`).join('')}</div>
    <div class="tpgrid two" style="margin-top:8px"><button type="button" class="tpb ${!pm ? 'on' : ''}" data-act="tpSet" data-k="${key}" data-f="p" data-v="am">AM${isBn() ? ' · সকাল' : ''}</button><button type="button" class="tpb ${pm ? 'on' : ''}" data-act="tpSet" data-k="${key}" data-f="p" data-v="pm">PM${isBn() ? ' · দুপুর-রাত' : ''}</button></div>
    <div class="bar end" style="margin:8px 0 0">${d.value ? `<button type="button" class="btn sm ghost" data-act="tpClear" data-k="${key}">${t('clear')}</button>` : ''}<button type="button" class="btn sm" data-act="tpToggle" data-k="${key}">✓ ${t('ok')}</button></div></div>`;
  return h;
}
const tfDraw = key => { const box = document.getElementById('tf_' + key); if (box) box.innerHTML = tfInner(key); };
export const getTime = key => { const n = document.getElementById('t_' + key); return n ? n.value || null : TP[key]?.value || null; };
ACT.tpToggle = el => { const d = TP[el.dataset.k]; d.open = !d.open; if (d.open && !d.value) d.value = '16:00'; tfDraw(el.dataset.k); };
ACT.tpClear = el => { const d = TP[el.dataset.k]; d.value = ''; d.open = false; tfDraw(el.dataset.k); };
ACT.tpSet = el => {
  const d = TP[el.dataset.k], f = el.dataset.f, v = el.dataset.v;
  let H = 16, M = 0; if (d.value) [H, M] = d.value.split(':').map(Number);
  let h12 = H % 12 || 12, pm = H >= 12;
  if (f === 'h') h12 = +v; if (f === 'm') M = +v; if (f === 'p') pm = v === 'pm';
  d.value = pad((h12 % 12) + (pm ? 12 : 0)) + ':' + pad(M); tfDraw(el.dataset.k);
};

// downscale an image file (max 256px) before upload
export function resizeImage(file, max = 256) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(b => (b ? res(b) : rej(new Error('image'))), 'image/png'); };
    img.onerror = rej; img.src = url;
  });
}
