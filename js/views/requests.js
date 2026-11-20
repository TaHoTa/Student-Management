// Admission requests from the public enrolment page
import { S, can, must, loadCentreData } from '../store.js';
import { t, num, fd } from '../i18n.js';
import { ACT, esc, toast, empty, av, waBtn, ask, svg, keepScroll } from '../ui.js';
import { errText } from '../db.js';
import { openStudentForm } from './students.js';
import { enrolUrl } from './settings.js';

const isWaNumber = v => /^(\+?880|0)?1[3-9]\d{8}$/.test(String(v || '').replace(/[\s-]/g, ''));
const ago = ts => { const h = Math.floor((Date.now() - new Date(ts).getTime()) / 36e5); return h < 1 ? t('justNow') : h < 48 ? t('hoursAgo', { n: num(h) }) : fd(ts.slice(0, 10)); };

export function requestsView() {
  const tab = S.ui.rtab, groups = { new: r => r.status === 'new', contacted: r => r.status === 'contacted', done: r => ['student', 'rejected'].includes(r.status) };
  const list = S.data.requests.filter(groups[tab]);
  return `<div class="bar"><h2 class="grow" style="margin:0">${t('requests')}</h2><a class="btn sm" href="${enrolUrl(S.centre.slug)}" target="_blank" rel="noopener">${svg('link')} ${t('openPage')}</a></div>
  <div class="tabs">${[['new', t('newReq')], ['contacted', t('contacted')], ['done', t('closed')]].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="rTab" data-v="${k}">${l} (${num(S.data.requests.filter(groups[k]).length)})</button>`).join('')}</div>
  ${list.length ? list.map(r => `<div class="card"><div class="row" style="padding:0;border:0;align-items:flex-start">${av(r.name)}<div class="grow"><b>${esc(r.name)}</b>
    ${r.status === 'student' ? ` <span class="pill ok">${t('admitted')}</span>` : r.status === 'rejected' ? ` <span class="pill">${t('notAdmitted')}</span>` : ''}
    <div class="sm mut">📞 ${num(r.phone)}${r.whatsapp ? ' · 💬 ' + esc(num(r.whatsapp)) : ''}${r.school ? ' · 🏫 ' + esc(r.school) : ''}</div>
    <div class="sm mut">👪 ${r.guardian_phone ? num(r.guardian_phone) : '—'} · ${ago(r.created_at)}</div>
    ${r.message ? `<div class="msg">${esc(r.message)}</div>` : ''}
    ${can('students') && ['new', 'contacted'].includes(r.status) ? `<div class="bar" style="margin:10px 0 0"><a class="btn sm" href="tel:${esc(r.phone)}">📞 ${t('call')}</a>${waBtn(isWaNumber(r.whatsapp) ? r.whatsapp : r.phone, '', 'WhatsApp')}
      ${r.status === 'new' ? `<button class="btn sm" data-act="rContacted" data-id="${r.id}">✓ ${t('markContacted')}</button>` : ''}
      <button class="btn pri sm" data-act="rMake" data-id="${r.id}">+ ${t('makeStudent')}</button><button class="btn ghost danger sm" data-act="rReject" data-id="${r.id}">${t('reject')}</button></div>` : ''}
    ${r.student_id ? `<button class="btn sm" style="margin-top:8px" data-go="student-${r.student_id}">${t('openProfile')} →</button>` : ''}</div></div></div>`).join('') : empty('📭', t('noReq'))}`;
}
ACT.rTab = el => { S.ui.rtab = el.dataset.v; S.render(); };
async function setStatus(id, status) {
  try { await must(S.sb.from('enrol_requests').update({ status }).eq('id', id)); const r = S.data.requests.find(x => x.id === id); if (r) r.status = status; keepScroll(S.render); }
  catch (e) { toast(errText(e, t)); await loadCentreData().catch(() => {}); S.render(); }
}
ACT.rContacted = el => setStatus(el.dataset.id, 'contacted');
ACT.rReject = async el => { if (await ask(t('confirmReject'), t('reject'))) setStatus(el.dataset.id, 'rejected'); };
ACT.rMake = el => {
  const r = S.data.requests.find(x => x.id === el.dataset.id);
  openStudentForm(null, { req: r.id, name: r.name, phone: r.phone, whatsapp: r.whatsapp || '', school: r.school || '', guardian_phone: r.guardian_phone || '', msg: r.message || '' });
};
