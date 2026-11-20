// Staff logins: owner adds an email, ticks permissions and batches. Staff sign up with that email.
import { S, isOwner, must } from '../store.js';
import { t, num } from '../i18n.js';
import { ACT, esc, toast, sheet, closeSheet, head, busy, empty, av, ask, val, redrawSheet, $ } from '../ui.js';
import { errText } from '../db.js';

const PERMS = [['attendance', 'pAttendance'], ['exams', 'pExams'], ['payments', 'pPayments'], ['students', 'pStudents']];
let list = null;
async function load() { const { data, error } = await S.sb.rpc('centre_staff', { c: S.centre.id }); if (error) { toast(errText(error, t)); list = []; } else list = data; }

export function staffView() {
  if (!isOwner()) return empty('🔒', t('errDenied'));
  if (!list) { load().then(S.render); return `<h2>${t('staff')}</h2><p class="mut">${t('loading')}</p>`; }
  const bname = id => { const b = S.data.batches.find(x => x.id === id); return b ? b.label || b.name : '?'; };
  return `<div class="bar"><h2 class="grow" style="margin:0">${t('staff')}</h2><button class="btn pri sm" data-act="staffEdit">+ ${t('addStaff')}</button></div><p class="mut" style="margin-top:0">${t('staffHint')}</p>
  ${list.length ? list.map((s, i) => `<div class="card"><div class="row" style="padding:0;border:0">${av(s.full_name || s.email)}<div class="grow"><b>${esc(s.full_name || s.email.split('@')[0])}</b><div class="sm mut">${esc(s.email)}</div>
    ${s.pending ? `<span class="pill soon">${t('invited')}</span>` : !s.active ? `<span class="pill">${t('paused')}</span>` : ''}</div><button class="btn sm" data-act="staffEdit" data-i="${i}">✎</button></div>
    <div style="margin-top:8px">${PERMS.filter(([k]) => s.perms?.[k]).map(([, l]) => `<span class="pill ok" style="margin:2px">✓ ${t(l)}</span>`).join('') || `<span class="sm mut">${t('noPerms')}</span>`}</div>
    <div style="margin-top:6px">${(s.batch_ids || []).map(id => `<span class="pill ac" style="margin:2px">${esc(bname(id))}</span>`).join('')}</div></div>`).join('') : empty('🧑‍🏫', t('noStaff'))}`;
}

let F = null;
ACT.staffEdit = el => {
  const s = el.dataset.i != null ? list[+el.dataset.i] : null;
  F = s ? { ...s, perms: { ...s.perms }, batch_ids: [...(s.batch_ids || [])], isNew: false } : { email: '', full_name: '', perms: { attendance: true }, batch_ids: [], active: true, isNew: true };
  draw(true);
};
function draw(top) {
  if (!top && $('#stEmail')) { F.email = val('stEmail'); F.full_name = val('stName'); }
  const go = () => sheet(head(F.isNew ? t('addStaff') : t('editStaff')) + `
    <label>${t('staffName')}<input id="stName" value="${esc(F.full_name || '')}"></label>
    <label>${t('email')}<input id="stEmail" type="email" value="${esc(F.email)}" ${F.isNew ? '' : 'disabled'} autocapitalize="off"></label>
    <div class="lab">${t('whatCan')}</div><div class="checks">${PERMS.map(([k, l]) => `<button type="button" class="check ${F.perms[k] ? 'on' : ''}" data-act="stPerm" data-k="${k}"><i>${F.perms[k] ? '✓' : ''}</i><span><b>${t(l)}</b></span></button>`).join('')}</div>
    <div class="lab">${t('whichBatches')}</div><div class="checks">${S.data.batches.map(b => `<button type="button" class="check ${F.batch_ids.includes(b.id) ? 'on' : ''}" data-act="stBatch" data-v="${b.id}"><i>${F.batch_ids.includes(b.id) ? '✓' : ''}</i><span><b>${esc(b.name)}${b.label ? ' (' + esc(b.label) + ')' : ''}</b></span></button>`).join('')}</div>
    <button class="btn pri wide huge" data-act="stSave">✓ ${t('save')}</button>
    ${!F.isNew && !F.pending ? `<button class="btn wide" data-act="stPause">${F.active ? t('pauseLogin') : t('resumeLogin')}</button>` : ''}
    ${!F.isNew ? `<button class="btn ghost danger wide" data-act="stRemove">${t('removeStaff')}</button>` : ''}`);
  top ? go() : redrawSheet(go);
}
ACT.stPerm = el => { F.perms[el.dataset.k] = !F.perms[el.dataset.k]; draw(); };
ACT.stBatch = el => { const v = el.dataset.v; F.batch_ids = F.batch_ids.includes(v) ? F.batch_ids.filter(x => x !== v) : [...F.batch_ids, v]; draw(); };
ACT.stSave = async el => {
  F.email = val('stEmail').trim().toLowerCase(); F.full_name = val('stName').trim();
  if (!/^\S+@\S+\.\S+$/.test(F.email)) return toast(t('badEmail'));
  if (!F.batch_ids.length) return toast(t('needBatchPick'));
  busy(el, true);
  try {
    if (!F.isNew && F.user_id) await must(S.sb.from('members').update({ perms: F.perms, batch_ids: F.batch_ids }).eq('centre_id', S.centre.id).eq('user_id', F.user_id));
    else { const { data, error } = await S.sb.rpc('invite_staff', { c: S.centre.id, p_email: F.email, p_name: F.full_name || null, p_perms: F.perms, p_batches: F.batch_ids }); if (error) throw error; toast(data === 'linked' ? t('staffLinked') : t('staffInvited')); }
    await load(); closeSheet(); S.render();
  } catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.stPause = async el => {
  busy(el, true);
  try { await must(S.sb.from('members').update({ active: !F.active }).eq('centre_id', S.centre.id).eq('user_id', F.user_id)); await load(); closeSheet(); S.render(); }
  catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.stRemove = async el => {
  if (!(await ask(t('confirmRemoveStaff'), t('removeStaff')))) return;
  busy(el, true);
  try {
    if (F.pending) await must(S.sb.from('staff_invites').delete().eq('centre_id', S.centre.id).eq('email', F.email));
    else await must(S.sb.from('members').delete().eq('centre_id', S.centre.id).eq('user_id', F.user_id));
    await load(); closeSheet(); S.render();
  } catch (e) { busy(el, false); toast(errText(e, t)); }
};
export const resetStaff = () => { list = null; };
