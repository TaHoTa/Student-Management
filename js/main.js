// App entry: auth state, routing, layout, global event handling
import { getClient, configured, errText } from './db.js';
import { S, loadCentreData, isOwner, can, canSee, must, emptyData } from './store.js';
import { t, prefs, savePrefs, num } from './i18n.js';
import { ACT, INP, $, esc, svg, sheet, closeSheet, head, applyTheme, toast } from './ui.js';
import { authView, statusView } from './views/auth.js';
import { superView } from './views/super.js';
import { homeView } from './views/home.js';
import { batchesView } from './views/batches.js';
import { studentsView, studentView } from './views/students.js';
import { attendView } from './views/attend.js';
import { feesView } from './views/fees.js';
import { examsView } from './views/exams.js';
import { requestsView } from './views/requests.js';
import { staffView, resetStaff } from './views/staff.js';
import { settingsView } from './views/settings.js';

S.phase = 'loading';

// ---------- boot: who is logged in, which centre, what state ----------
let booting = false;
async function boot() {
  if (booting) return; booting = true;
  try {
    if (!configured()) { S.phase = 'auth'; return; }
    S.sb = S.sb || await getClient();
    const { data: { session } } = await S.sb.auth.getSession();
    S.user = session?.user || null;
    if (!S.user) { S.phase = 'auth'; return; }
    S.profile = await must(S.sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle());
    if (S.profile?.is_super_admin && !S.readOnly) { S.phase = 'super'; return; }
    const mems = await must(S.sb.from('members').select('role, perms, batch_ids, active, centre_id, centre:centres(*)').eq('user_id', S.user.id));
    const usable = mems.filter(m => m.centre);
    if (!usable.length) { S.phase = 'none'; return; }
    let saved = null; try { saved = localStorage.getItem('sm_centre'); } catch (e) {}
    const m = usable.find(x => x.centre_id === saved) || usable.find(x => x.centre.status === 'active' && x.active) || usable[0];
    S.member = m; S.centre = m.centre; resetStaff();
    try { localStorage.setItem('sm_centre', m.centre_id); } catch (e) {}
    if (S.centre.status === 'pending') { S.phase = 'pending'; return; }
    if (S.centre.status === 'suspended' || !m.active) { S.phase = 'suspended'; return; }
    await loadCentreData();
    S.phase = 'app';
  } catch (e) {
    toast(errText(e, t)); S.phase = S.user ? 'none' : 'auth';
  } finally { booting = false; render(); }
}
S.reload = boot;
S.reset = () => { Object.assign(S, { user: null, profile: null, centre: null, member: null, readOnly: false, phase: 'auth', names: {} });
  S.data = emptyData(); location.hash = ''; closeSheet(); render(); };

// ---------- routes ----------
const ROUTES = {
  home: () => true, attend: () => true, students: () => true, batches: () => true, exams: () => true, settings: () => true,
  fees: () => canSee('payments'), requests: () => isOwner() || S.readOnly || can('students'), staff: () => isOwner()
};
const VIEWS = { home: homeView, attend: attendView, fees: feesView, students: studentsView, exams: examsView, requests: requestsView, batches: batchesView, staff: staffView, settings: settingsView };
const newReqs = () => S.data.requests.filter(r => r.status === 'new').length;

function header() {
  const c = S.centre, nr = ROUTES.requests() ? newReqs() : 0;
  return `<header class="top">${c.logo_url ? `<img class="clogo sm" src="${esc(c.logo_url)}" alt="">` : `<div class="logo">${esc(c.name[0])}</div>`}
    <h1>${esc(c.name)}<small>${S.member?.role === 'staff' ? esc(S.profile?.full_name || '') + ' · ' + t('staffWord') : t('appName')}</small></h1>
    <button class="hb" data-act="toggleLang">${prefs.lang === 'bn' ? 'EN' : 'বাং'}</button>
    <button class="hb mob" data-act="more" aria-label="${t('more')}">${svg('more')}${nr ? `<span class="dot">${num(nr)}</span>` : ''}</button></header>`;
}
function nav(route) {
  const fourth = ROUTES.fees() ? 'fees' : 'exams', nr = ROUTES.requests() ? newReqs() : 0;
  const phone = ['home', 'attend', 'plus', fourth, 'students'];
  const desk = ['exams', 'requests', 'batches', 'staff', 'settings'].filter(k => k !== fourth && ROUTES[k]());
  const link = (k, cls = '') => `<a href="#${k}" class="${cls} ${k === route ? 'on' : ''}">${svg(k)}${t(k)}${k === 'requests' && nr ? `<span class="dot">${num(nr)}</span>` : ''}</a>`;
  return `<nav class="nav">${phone.map(k => (k === 'plus' ? (S.readOnly ? '<span></span>' : `<button class="navplus" data-act="plus" aria-label="${t('addNew')}">+<b>${t('addNew')}</b></button>`) : link(k))).join('')}${desk.map(k => link(k, 'desk')).join('')}</nav>`;
}

function render() {
  applyTheme();
  const root = $('#root');
  if (S.phase === 'loading') { root.className = 'plain'; root.innerHTML = `<div class="splash"><div class="logo big">${prefs.lang === 'bn' ? 'ক' : 'S'}</div><span class="spin"></span></div>`; return; }
  if (S.phase === 'auth' || S.recovery) { root.className = 'plain'; root.innerHTML = authView(); return; }
  if (['pending', 'suspended', 'none'].includes(S.phase)) { root.className = 'plain'; root.innerHTML = statusView(S.phase); return; }
  if (S.phase === 'super' && !S.readOnly) {
    root.className = 'plain';
    root.innerHTML = `<header class="top"><div class="logo">🛡️</div><h1>${t('appName')}<small>Super admin</small></h1><button class="hb" data-act="toggleLang">${prefs.lang === 'bn' ? 'EN' : 'বাং'}</button><button class="hb" data-act="logout">${t('logout')}</button></header><main class="narrow">${superView()}</main>`;
    return;
  }
  const h = location.hash.slice(1) || 'home';
  let route = h.startsWith('student-') ? 'students' : h;
  if (!ROUTES[route] || !ROUTES[route]()) route = 'home';
  const view = h.startsWith('student-') ? studentView(h.slice(8)) : VIEWS[route]();
  root.className = 'app';
  root.innerHTML = header() + nav(route) + `<main>${S.readOnly ? `<div class="banner">${svg('shield')} ${t('supportBanner')} <button class="btn sm" data-act="superExit">${t('exit')}</button></div>` : ''}${view}</main>`;
  const sp = $('#strip'); if (sp) { const sel = sp.querySelector('.sel'); if (sel) sp.scrollLeft = sel.offsetLeft - sp.clientWidth / 2; }
}
S.render = render;

// ---------- sheets: quick add (+) and more (⋯) ----------
ACT.plus = () => sheet(head(t('addNew')) + `<div class="qgrid sheetgrid">
  ${can('attendance') ? `<button class="qt" style="--h:155" data-act="qAttend">${svg('attend')}${t('qAttend')}</button>` : ''}
  ${can('payments') ? `<button class="qt" style="--h:38" data-act="pay">${svg('fees')}${t('qPay')}</button>` : ''}
  ${can('students') ? `<button class="qt" style="--h:215" data-act="newStudent">${svg('user')}${t('qStudent')}</button>` : ''}
  ${can('exams') ? `<button class="qt" style="--h:280" data-act="newExam">${svg('exams')}${t('newExam')}</button>` : ''}
  ${isOwner() ? `<button class="qt" style="--h:330" data-act="editBatch">${svg('batches')}${t('newBatch')}</button>` : ''}</div>`);
ACT.more = () => {
  const items = ['students', 'exams', 'requests', 'batches', 'staff', 'settings'].filter(k => ROUTES[k]()), nr = newReqs(), hues = [190, 280, 330, 155, 38, 215];
  sheet(head(t('more')) + `<div class="qgrid sheetgrid">${items.map((k, i) => `<button class="qt" style="--h:${hues[i]}" data-go="${k}">${svg(k)}${t(k)}${k === 'requests' && nr ? `<span class="dot">${num(nr)}</span>` : ''}</button>`).join('')}</div>`);
};
ACT.closeSheet = closeSheet;

// ---------- global events ----------
document.addEventListener('click', ev => {
  if (ev.target.id === 'sheet') return closeSheet();
  const a = ev.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) {
    if (a.disabled) return;
    if (a.tagName !== 'A' && a.tagName !== 'LABEL') ev.preventDefault();
    ACT[a.dataset.act](a, ev); return;
  }
  const g = ev.target.closest('[data-go]');
  if (g && !ev.target.closest('a,.btn:not([data-go])')) { closeSheet(); if (location.hash === '#' + g.dataset.go) render(); else location.hash = g.dataset.go; }
});
document.addEventListener('submit', ev => { const f = ev.target.closest('[data-form]'); if (!f) return; ev.preventDefault(); ACT[f.dataset.form] && ACT[f.dataset.form](f, ev); });
// both events: some phones only report "change" (date pickers, some keyboards)
const fire = ev => { const el = ev.target.closest('[data-inp]'); if (!el || !INP[el.dataset.inp]) return;
  const toggle = ['checkbox', 'radio', 'file'].includes(el.type) || el.tagName === 'SELECT';
  if (toggle ? ev.type === 'change' : true) INP[el.dataset.inp](el, ev); };
document.addEventListener('input', fire);
document.addEventListener('change', ev => { const el = ev.target.closest('[data-inp]'); if (el && (['checkbox', 'radio', 'file'].includes(el.type) || el.tagName === 'SELECT')) fire(ev); });
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if (ev.key === 'Enter' && ev.target.classList.contains('mk')) { ev.preventDefault(); const all = [...document.querySelectorAll('.mk:not([disabled])')], i = all.indexOf(ev.target); (all[i + 1] || document.querySelector('[data-act=marksSave]')).focus(); }
});
addEventListener('hashchange', () => { if (!location.hash.startsWith('#exams')) S.ui.ex = null; if (!location.hash.startsWith('#student-')) S.ui.ptab = 'att'; closeSheet(); render(); scrollTo(0, 0); });
ACT.toggleLang = () => { prefs.lang = prefs.lang === 'bn' ? 'en' : 'bn'; savePrefs(); render(); };

// ---------- start ----------
render();
(async () => {
  if (!configured()) { S.phase = 'auth'; render(); return; }
  S.sb = await getClient();
  let lastUser = null;
  S.sb.auth.onAuthStateChange((event, session) => {
    // never await Supabase calls inside this callback
    if (event === 'PASSWORD_RECOVERY') { S.recovery = true; S.user = session?.user || null; setTimeout(render, 0); return; }
    if (event === 'SIGNED_OUT') { lastUser = null; setTimeout(S.reset, 0); return; }
    const uid = session?.user?.id || null;
    if (uid !== lastUser || event === 'INITIAL_SESSION') { lastUser = uid; setTimeout(boot, 0); }
  });
})();
