// Super admin panel: approve / pause / reactivate centres, open support view
import { S, loadCentreData, emptyData } from '../store.js';
import { t, num, fd, prefs } from '../i18n.js';
import { ACT, esc, toast, ask, busy, empty, svg } from '../ui.js';
import { errText } from '../db.js';

let list = null;

export async function loadSuper() {
  const { data, error } = await S.sb.rpc('super_centres');
  if (error) { toast(errText(error, t)); list = []; } else list = data;
}

export function superView() {
  if (!list) { loadSuper().then(S.render); return `<p class="mut">${t('loading')}</p>`; }
  const tab = S.ui.superTab;
  const count = s => list.filter(c => c.status === s).length;
  const rows = list.filter(c => c.status === tab);
  const now = Date.now();
  return `<div class="bar"><h2 class="grow" style="margin:0">${t('superTitle')}</h2><button class="ib" data-act="superRefresh" aria-label="refresh">↻</button></div>
  <div class="chips">${['pending', 'active', 'suspended'].map(s => `<button class="chip ${tab === s ? 'on' : ''}" data-act="superTab" data-v="${s}">${t(s)} (${num(count(s))})</button>`).join('')}</div>
  ${rows.length ? rows.map(c => {
    const sup = c.support_until && new Date(c.support_until).getTime() > now;
    return `<div class="card"><div class="row" style="padding-top:0">${c.logo_url ? `<img class="clogo sm" src="${esc(c.logo_url)}" alt="">` : `<span class="logo">${esc((c.name || '?')[0])}</span>`}
      <div class="grow"><b style="font-size:17px">${esc(c.name)}</b><div class="sm mut">${t('owner')}: ${esc(c.owner_name || '')} · ${esc(c.owner_email || '')}</div>
      <div class="sm mut">${c.phone ? '📞 ' + esc(c.phone) + ' · ' : ''}${t('registered')}: ${fd(c.created_at)} · ${t('studentsN', { n: num(c.students) })}</div>
      <div class="sm mut">🔗 /${esc(c.slug)}</div>
      ${sup ? `<span class="pill ok">${svg('shield')} ${t('supportOpen')} ${new Date(c.support_until).toLocaleString(prefs.lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>` : ''}</div></div>
      <div class="bar end" style="margin:8px 0 0">
        ${sup ? `<button class="btn sm" data-act="superOpen" data-id="${c.id}">👁 ${t('openData')}</button>` : ''}
        ${c.status === 'pending' ? `<button class="btn pri sm" data-act="superStatus" data-id="${c.id}" data-v="active">✓ ${t('approve')}</button>` : ''}
        ${c.status === 'active' ? `<button class="btn danger sm" data-act="superStatus" data-id="${c.id}" data-v="suspended">${t('suspend')}</button>` : ''}
        ${c.status === 'suspended' ? `<button class="btn pri sm" data-act="superStatus" data-id="${c.id}" data-v="active">${t('reactivate')}</button>` : ''}
      </div></div>`;
  }).join('') : empty('🗂️', t('none'))}`;
}

ACT.superTab = el => { S.ui.superTab = el.dataset.v; S.render(); };
ACT.superRefresh = async () => { await loadSuper(); S.render(); };
ACT.superStatus = async el => {
  if (el.dataset.v === 'suspended' && !(await ask(t('confirmSuspend'), t('suspend')))) return;
  busy(el, true);
  const { error } = await S.sb.rpc('set_centre_status', { c: el.dataset.id, new_status: el.dataset.v });
  if (error) { busy(el, false); return toast(errText(error, t)); }
  await loadSuper(); toast(t('saved')); S.render();
};
// read-only support view of a centre (only works while the owner allows support)
ACT.superOpen = async el => {
  busy(el, true);
  const { data, error } = await S.sb.from('centres').select('*').eq('id', el.dataset.id).single();
  if (error) { busy(el, false); return toast(errText(error, t)); }
  S.centre = data; S.member = null; S.readOnly = true; S.ui.ex = null;
  try { await loadCentreData(); } catch (e) { toast(errText(e, t)); }
  location.hash = 'home'; S.render();
};
ACT.superExit = () => { S.centre = null; S.member = null; S.readOnly = false; S.data = emptyData(); S.names = {}; location.hash = 'home'; S.render(); };
