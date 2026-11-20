// Students: list, profile (attendance calendar / fees / marks) and add-edit form
// Form: batch → tick subjects → fee comes from the batch fee table (editable).
import { S, can, canSee, isOwner, loadCentreData, batchOf, subjectsOf, subjectsOfStudent, subjIdsOf, studentOf, feeFor, batchTitle, myBatches, myStudents, must } from '../store.js';
import { t, num, tk, fd, subjSched } from '../i18n.js';
import { today } from '../dates.js';
import { ACT, INP, esc, toast, sheet, closeSheet, head, ask, busy, empty, av, pill, cal, normPhone, validPhone, wa, waBtn, val, dateField, getDate, redrawSheet, confetti, keepScroll, $ } from '../ui.js';
import { feeState, owe, results, gradeCls, GPA, nextCycleStart } from '../logic.js';
import { errText } from '../db.js';
import { eLabel } from './fees.js';

function listRows() {
  const q = S.ui.q.trim().toLowerCase(), fb = S.ui.fb;
  const rows = myStudents().filter(s => (fb === 'left' ? s.status === 'left' : s.status === 'active') &&
    (fb === 'all' || fb === 'left' || (fb === 'due' ? feeState(s).status === 'due' : s.batch_id === fb)) &&
    (!q || s.name.toLowerCase().includes(q) || s.phone.includes(q) || (s.guardian_phone || '').includes(q)));
  if (!rows.length) return empty('🔍', S.data.students.length ? t('none') : t('noStudents'));
  return rows.map(s => { const b = batchOf(s.batch_id);
    return `<div class="row click" data-go="student-${s.id}">${av(s.name)}<div class="grow"><b>${esc(s.name)}</b><div class="sm mut">${esc(b?.label || b?.name || '')} · ${num(s.phone)}</div>
      <div>${subjectsOfStudent(s.id).map(x => `<span class="subj xs">${esc(x.name)}</span>`).join('')}</div></div>${canSee('payments') ? pill(feeState(s)) : '<span class="chev">›</span>'}</div>`; }).join('');
}
export function studentsView() {
  const act = myStudents().filter(s => s.status === 'active'), nLeft = myStudents().length - act.length;
  const nDue = canSee('payments') ? act.filter(s => feeState(s).status === 'due').length : 0;
  return `<div class="bar"><h2 class="grow" style="margin:0">${t('students')} <span class="mut" style="font-size:18px">${num(act.length)}</span></h2>${can('students') ? `<button class="btn pri sm" data-act="newStudent">+ ${t('qStudent')}</button>` : ''}</div>
  <input type="search" data-inp="sq" placeholder="🔍 ${t('search')}" value="${esc(S.ui.q)}" style="margin-bottom:10px">
  <div class="chips"><button class="chip ${S.ui.fb === 'all' ? 'on' : ''}" data-act="fb" data-v="all">${t('all')}</button>
    ${canSee('payments') ? `<button class="chip ${S.ui.fb === 'due' ? 'on' : ''}" data-act="fb" data-v="due">${t('feeDue')} (${num(nDue)})</button>` : ''}
    ${myBatches().map(b => `<button class="chip ${S.ui.fb === b.id ? 'on' : ''}" data-act="fb" data-v="${b.id}">${esc(b.label || b.name)}</button>`).join('')}
    ${nLeft ? `<button class="chip ${S.ui.fb === 'left' ? 'on' : ''}" data-act="fb" data-v="left">${t('left')} (${num(nLeft)})</button>` : ''}</div>
  <div class="card list" id="slist">${listRows()}</div>`;
}
INP.sq = el => { S.ui.q = el.value; $('#slist').innerHTML = listRows(); };
ACT.fb = el => { S.ui.fb = el.dataset.v; S.render(); };

// ---------- profile ----------
let P = { sid: null, loading: false, ses: [], att: [] };
async function loadProfile(sid) {
  P = { sid, loading: true, ses: [], att: [] };
  try {
    const ids = subjIdsOf(sid);
    const [ses, att] = await Promise.all([
      ids.length ? must(S.sb.from('class_sessions').select('id,subject_id,held_on').in('subject_id', ids)) : [],
      must(S.sb.from('attendance').select('session_id,present').eq('student_id', sid))]);
    P = { sid, loading: false, ses, att };
  } catch (e) { P.loading = false; toast(errText(e, t)); }
  if (location.hash === '#student-' + sid) keepScroll(S.render);
}
export function studentView(id) {
  const s = studentOf(id);
  if (!s || !myStudents().includes(s)) return empty('🤷', t('none'));
  if (P.sid !== id) { loadProfile(id); }
  const b = batchOf(s.batch_id), subs = subjectsOfStudent(s.id), money = canSee('payments'), f = money ? feeState(s) : null;
  const presentBy = new Map(P.att.map(a => [a.session_id, a.present]));
  const mine = P.ses.filter(x => x.held_on >= s.admit_date && presentBy.has(x.id));
  const pres = mine.filter(x => presentBy.get(x.id)).length, pct = mine.length ? Math.round((pres / mine.length) * 100) : 0;
  const exams = S.data.exams.filter(e => S.data.marks.some(m => m.exam_id === e.id && m.student_id === s.id)).map(e => { const r = results(e); return { e, r: r.rows.find(x => x.sid === s.id), n: r.ok.length }; });
  const okEx = exams.filter(x => !x.r.ab), avgP = okEx.length ? Math.round(okEx.reduce((a, x) => a + x.r.pct, 0) / okEx.length) : null;
  const tabs = [['att', '📅 ' + t('attend')], ...(money ? [['fee', '৳ ' + t('fees')]] : []), ['marks', '📝 ' + t('marks')]];
  if (!tabs.some(x => x[0] === S.ui.ptab)) S.ui.ptab = 'att';
  let tab = '';
  if (S.ui.ptab === 'att') {
    const payDays = new Set(S.data.payments.filter(p => p.student_id === s.id).map(p => p.paid_on));
    tab = `<div class="card">${P.loading ? `<p class="mut">${t('loading')}</p>` : `<div class="bar"><b class="grow" style="font-size:20px">${num(pct)}% ${t('present')}</b><span class="sm mut">${num(pres)}/${num(mine.length)}</span></div><div class="meter" style="margin-bottom:14px"><i style="width:${pct}%"></i></div>`}
      ${cal('pm', ds => { const xs = mine.filter(x => x.held_on === ds); let cls = ''; if (xs.length) cls = xs.every(x => presentBy.get(x.id)) ? 'p' : 'a'; return { cls, inner: money && payDays.has(ds) ? '<i class="tk">৳</i>' : '' }; })}
      <div class="legend"><span><i style="background:var(--ok)"></i>${t('present')}</span><span><i style="background:color-mix(in srgb,var(--bad) 35%,transparent)"></i>${t('absent')}</span>${money ? `<span><b style="color:var(--warn)">৳</b> ${t('payment')}</span>` : ''}</div></div>`;
  } else if (S.ui.ptab === 'fee') {
    const pays = S.data.payments.filter(p => p.student_id === s.id).sort((a, c) => (a.paid_on < c.paid_on ? 1 : -1)), sc = s.plan === 'monthly' ? f.sc.slice().reverse().slice(0, 10) : f.sc;
    tab = `<div class="card"><div class="sm mut">${t('plan')}: <b style="color:var(--ink)">${t(s.plan === 'full' ? 'fullCourse' : 'monthly')}</b> · ${tk(s.fee)}${s.plan === 'monthly' ? t('perMonth') : ''} · ${t('cash')}</div>
      ${f.dueAmt ? `<div class="info bad"><b>${t('due')}: ${tk(f.dueAmt)}</b><br>${f.over.map(e => eLabel(e)).join(', ')}</div>` : `<div class="info good">✓ ${f.paidUntil ? t('paidUntil') + ' ' + fd(f.paidUntil) : t('paid')}</div>`}
      <div class="bar" style="margin:12px 0 0">${can('payments') ? `<button class="btn pri" style="flex:1" data-act="pay" data-id="${s.id}">৳ ${t('qPay')}</button>` : ''}${f.dueAmt ? waBtn(s.guardian_phone || s.phone, remindText(s, f), '💬 ' + t('remind'), '') : ''}</div></div>
      <div class="card"><h3>${t('feeSchedule')}</h3>${sc.map(e => { const cl = e.paid >= e.amount ? 'ok' : e.due <= today() ? 'due' : 'soon'; return `<div class="row"><div class="grow"><b>${eLabel(e)}</b><div class="sm mut">${fd(e.due)}</div></div><div style="text-align:right"><b>${tk(e.amount)}</b><div><span class="pill ${cl}">${e.paid >= e.amount ? '✓ ' + t('paid') : e.paid > 0 ? tk(e.paid) + ' ' + t('paid') : e.due <= today() ? t('due') : t('dueSoon')}</span></div></div></div>`; }).join('')}</div>
      <div class="card"><h3>${t('payHistory')}</h3>${pays.map(p => { const cv = (f.cov[p.id] || []).map(i => eLabel(f.sc[i])).join(', ') || t('advance'); return `<div class="row"><div class="grow"><b>${tk(p.amount)}</b> <span class="sm mut">· ${fd(p.paid_on)}</span><div class="sm mut">${t('covers')}: ${cv}${p.note ? ' · ' + esc(p.note) : ''}</div></div>${waBtn(s.guardian_phone || s.phone, receiptText(s, p, cv), '🧾')}${isOwner() ? `<button class="btn sm" data-act="payEdit" data-id="${p.id}" aria-label="${t('editPayment')}">✎</button>` : ''}</div>`; }).join('') || empty('🪙', t('noPay'))}</div>`;
  } else {
    tab = `<div class="card">${exams.length ? exams.map(({ e, r, n }) => `<div class="row"><div class="grow"><div><span class="subj">${esc(S.data.subjects.find(x => x.id === e.subject_id)?.name || '')}</span><b>${esc(e.topic || '')}</b></div>
      <div class="sm mut">${esc(S.data.examTypes.find(x => x.id === e.exam_type_id)?.name || '')} · ${fd(e.held_on)}${r.ab ? '' : ` · ${t('rank')} ${num(r.rank)}/${num(n)}`}</div>
      ${r.ab ? '' : `<div class="sm">${e.has_mcq ? `MCQ ${num(r.mcq ?? 0)}/${num(e.mcq_full)} ` : ''}${e.has_written ? `· ${t('written')} ${num(r.wr ?? 0)}/${num(e.written_full)}` : ''}</div>`}</div>
      ${r.ab ? `<span class="pill due">${t('absent')}</span>` : `<div style="text-align:right"><span class="grade ${gradeCls(r.g)}">${r.g}</span><div class="sm mut">${num(Math.round(r.pct))}%</div></div>`}</div>`).join('') : empty('📝', t('noExam'))}</div>`;
  }
  const contact = (label, phone) => (phone ? `<div class="row"><div class="grow"><div class="sm mut">${label}</div><b>${num(phone)}</b></div><a class="btn sm" href="tel:${esc(phone)}">📞</a>${waBtn(phone, '', 'WhatsApp')}</div>` : '');
  return `<div class="bar"><button class="ib" data-go="students" aria-label="${t('back')}">‹</button><span class="grow"></span>${can('students') ? `<button class="btn sm" data-act="editStudent" data-id="${s.id}">✎ ${t('edit')}</button>` : ''}</div>
  <div class="cols"><div><div class="hero"><div style="display:flex;gap:14px;align-items:center">${av(s.name, 'big')}<div><h2 style="margin:0">${esc(s.name)}</h2><div class="mut sm">${esc(batchTitle(b))}${s.status === 'left' ? ' · ' + t('left') : ''}</div></div></div>
    <div style="margin-top:12px">${subs.map(x => `<div class="schedrow"><b>${esc(x.name)}</b><span>${subjSched(x) || '—'}</span></div>`).join('')}</div>
    <div class="trio"><div><b>${num(pct)}%</b><span>${t('attendance')}</span></div>${money ? `<div><b>${s.plan === 'monthly' ? (f.paidUntil ? fd(f.paidUntil) : '—') : f.dueAmt ? t('due') : '✓'}</b><span>${t('paidUntil')}</span></div>` : ''}<div><b>${avgP == null ? '—' : num(avgP) + '%'}</b><span>${t('avgMarks')}</span></div></div></div>
    <div class="card">${contact(t('phone'), s.phone)}${s.whatsapp ? `<div class="row"><div class="grow"><div class="sm mut">WhatsApp</div><b>${esc(num(s.whatsapp))}</b></div></div>` : ''}${contact(t('guardianPhone') + (s.guardian_name ? ' · ' + esc(s.guardian_name) : ''), s.guardian_phone)}
      <div class="sm mut" style="margin-top:6px">${t('admit')}: ${fd(s.admit_date)}${s.school ? ' · ' + esc(s.school) : ''}</div>${s.note ? `<div class="sm mut">📝 ${esc(s.note)}</div>` : ''}</div>${shareCard(s)}</div>
  <div><div class="tabs ${tabs.length === 2 ? 'two' : ''}">${tabs.map(([k, l]) => `<button class="${S.ui.ptab === k ? 'on' : ''}" data-act="ptab" data-v="${k}">${l}</button>`).join('')}</div>${tab}</div></div>`;
}
// ---------- guardian link (read-only page for student & guardian) ----------
export const shareUrl = k => location.origin + location.pathname.replace(/[^/]*$/, '') + 'student.html?k=' + k;
function shareCard(s) {
  if (!can('students')) return '';
  const top = `<div class="card"><h3>🔗 ${t('shareTitle')}</h3><p class="sm mut" style="margin-top:0">${t('shareHint')}</p>`;
  if (!s.share_key) return top + `<button class="btn pri wide" data-act="shareCreate" data-id="${s.id}">${t('createLink')}</button></div>`;
  const u = shareUrl(s.share_key);
  return top + `<div class="linkbox"><code>${esc(u)}</code></div>
    <div class="bar" style="margin:10px 0 0">${waBtn(s.guardian_phone || s.phone, t('msgShare', { c: S.centre.name, n: s.name, u }), '💬 ' + t('shareWa'), '')}
    <button class="btn" data-act="shareCopy" data-id="${s.id}">${t('copy')}</button><a class="btn" href="${esc(u)}" target="_blank" rel="noopener">👁 ${t('preview')}</a></div>
    <button class="btn ghost danger wide" data-act="shareReset" data-id="${s.id}">${t('resetLink')}</button></div>`;
}
async function shareKey(el, reset) {
  busy(el, true);
  const { data, error } = await S.sb.rpc('student_share_key', { p_student: el.dataset.id, p_reset: reset });
  busy(el, false);
  if (error) return toast(errText(error, t));
  studentOf(el.dataset.id).share_key = data; toast(reset ? t('linkReset') : t('linkCreated')); keepScroll(S.render);
}
ACT.shareCreate = el => shareKey(el, false);
ACT.shareReset = async el => { if (await ask(t('confirmResetLink'), t('resetLink'))) shareKey(el, true); };
ACT.shareCopy = async el => { const u = shareUrl(studentOf(el.dataset.id).share_key); try { await navigator.clipboard.writeText(u); toast(t('copied')); } catch (e) { toast(u); } };
ACT.ptab = el => { S.ui.ptab = el.dataset.v; keepScroll(S.render); };
export const remindText = (s, f) => { const per = f.over.map(e => eLabel(e)).join(', '); return t('msgRemind', { c: S.centre.name, n: s.name, x: tk(f.dueAmt), p: per }); };
export const receiptText = (s, p, cv) => t('msgReceipt', { c: S.centre.name, n: s.name, x: tk(p.amount), d: fd(p.paid_on), p: cv });

// ---------- form ----------
let F = null;
function openForm(id, pre) {
  const bs = myBatches(); if (!bs.length) return toast(t('noBatches'));
  const s = id ? studentOf(id) : null;
  const batchId = s?.batch_id || (S.ui.fb && bs.some(b => b.id === S.ui.fb) ? S.ui.fb : bs[0].id);
  F = { id: id || null, req: pre?.req || null, msg: pre?.msg || '', batchId, plan: s?.plan === 'full' ? 'full' : 'monthly', touched: !!s,
    subj: new Set(s ? subjIdsOf(s.id) : subjectsOf(batchId).map(x => x.id)), fee: s ? Number(s.fee) : null,
    v: { name: s?.name || pre?.name || '', phone: s?.phone || pre?.phone || '', whatsapp: s?.whatsapp || pre?.whatsapp || '', school: s?.school || pre?.school || '',
         guardian_name: s?.guardian_name || '', guardian_phone: s?.guardian_phone || pre?.guardian_phone || '', note: s?.note || '', admit: s?.admit_date || today() } };
  if (!s) F.fee = autoFee();
  drawForm(true);
}
const autoFee = () => feeFor(F.batchId, F.subj.size, F.plan);
function syncForm() {
  if (!$('#sfName')) return;
  F.v = { name: val('sfName'), phone: val('sfPhone'), whatsapp: val('sfWa'), school: val('sfSchool'), guardian_name: val('sfGName'), guardian_phone: val('sfGPhone'), note: val('sfNote'), admit: getDate('sfAdmit') || F.v.admit };
  const fe = $('#sfFee'); if (fe) { const n = fe.value === '' ? null : Number(fe.value); if (n !== F.fee) { F.fee = n; F.touched = true; } }
}
function drawForm(top) {
  if (!top) syncForm();
  const go = () => {
    const b = batchOf(F.batchId), subs = subjectsOf(F.batchId), auto = autoFee(), v = F.v;
    const inp = (id, label, value, extra = '') => `<label>${label}<input id="${id}" value="${esc(value)}" ${extra}></label>`;
    sheet(head(F.id ? t('edit') : t('qStudent')) + (F.msg ? `<div class="msg">📝 ${esc(F.msg)}</div>` : '') + `
      ${inp('sfName', t('name') + ' *', v.name, 'autocomplete="off"')}
      <div class="row2">${inp('sfPhone', t('phone') + ' *', v.phone, 'type="tel" inputmode="tel" placeholder="01XXXXXXXXX"')}${inp('sfWa', t('whatsapp'), v.whatsapp, 'placeholder="01… / @username" autocapitalize="off"')}</div>
      <div class="row2">${inp('sfGPhone', t('guardianPhone'), v.guardian_phone, 'type="tel" inputmode="tel" placeholder="01XXXXXXXXX"')}${inp('sfGName', t('guardianName'), v.guardian_name)}</div>
      ${inp('sfSchool', t('school'), v.school)}
      <div class="lab">${t('batch')} *</div>
      <div class="chips wrap">${myBatches().map(x => `<button class="chip ${x.id === F.batchId ? 'on' : ''}" data-act="sfBatch" data-v="${x.id}">${esc(batchTitle(x))}</button>`).join('')}</div>
      <div class="lab">${t('chooseSubjects')} *</div>
      <div class="checks">${subs.map(x => `<button type="button" class="check ${F.subj.has(x.id) ? 'on' : ''}" data-act="sfSubj" data-v="${x.id}"><i>${F.subj.has(x.id) ? '✓' : ''}</i><span><b>${esc(x.name)}</b><small>${subjSched(x)}</small></span></button>`).join('') || `<p class="sm mut">${t('noSubjects')}</p>`}</div>
      ${can('payments') ? `<div class="lab">${t('plan')}</div>
      <div class="chips wrap"><button class="chip ${F.plan === 'monthly' ? 'on' : ''}" data-act="sfPlan" data-v="monthly">${t('monthly')}</button>${b?.full_course_on || F.plan === 'full' ? `<button class="chip ${F.plan === 'full' ? 'on' : ''}" data-act="sfPlan" data-v="full">${t('fullCourse')}</button>` : ''}</div>
      <label>${t('fee')}<input id="sfFee" type="number" inputmode="numeric" min="0" value="${F.fee ?? ''}"></label>
      ${auto != null ? `<div class="sm mut">${t('feeFromTable', { x: tk(auto) })}${Number(F.fee) !== Number(auto) ? ` · <button class="linkbtn" data-act="sfUseAuto">${t('useThis')}</button>` : ''}</div>` : ''}` : ''}
      ${dateField('sfAdmit', t('admit'), v.admit)}
      ${inp('sfNote', t('note'), v.note)}
      <button class="btn pri wide huge" data-act="saveStudent">✓ ${t('save')}</button>
      ${F.id && can('students') ? `<button class="btn wide" data-act="toggleLeft">${studentOf(F.id).status === 'left' ? t('markActive') : t('markLeft')}</button>` : ''}
      ${F.id && isOwner() ? `<button class="btn ghost danger wide" data-act="delStudent">${t('delStudent')}</button>` : ''}`);
  };
  top ? go() : redrawSheet(go);
}
ACT.newStudent = () => { closeSheet(); openForm(); };
ACT.editStudent = el => openForm(el.dataset.id);
export const openStudentForm = openForm;
const refee = () => { if (!F.touched || F.fee == null) F.fee = autoFee(); };
ACT.sfBatch = el => { syncForm(); if (F.batchId === el.dataset.v) return; F.batchId = el.dataset.v; F.subj = new Set(subjectsOf(F.batchId).map(x => x.id)); F.touched = false; if (F.plan === 'full' && !batchOf(F.batchId)?.full_course_on) F.plan = 'monthly'; refee(); drawForm(); };
ACT.sfSubj = el => { syncForm(); const v = el.dataset.v; F.subj.has(v) ? F.subj.delete(v) : F.subj.add(v); F.touched = false; refee(); drawForm(); };
ACT.sfPlan = el => { syncForm(); F.plan = el.dataset.v; F.touched = false; refee(); drawForm(); };
ACT.sfUseAuto = () => { syncForm(); F.fee = autoFee(); F.touched = false; drawForm(); };

ACT.saveStudent = async el => {
  syncForm(); const v = F.v;
  if (!v.name.trim() || !validPhone(v.phone) || !F.subj.size) return toast(t('needStudent'));
  if (v.guardian_phone.trim() && !validPhone(v.guardian_phone)) return toast(t('badGuardian'));
  busy(el, true);
  const cid = S.centre.id, row = { centre_id: cid, batch_id: F.batchId, name: v.name.trim(), phone: normPhone(v.phone), whatsapp: v.whatsapp.trim() || null,
    guardian_name: v.guardian_name.trim() || null, guardian_phone: v.guardian_phone.trim() ? normPhone(v.guardian_phone) : null,
    school: v.school.trim() || null, admit_date: v.admit || today(), note: v.note.trim() || null };
  if (can('payments')) { row.plan = F.plan; row.fee = Number(F.fee) || 0; }
  try {
    let id = F.id;
    if (id) {
      const old = studentOf(id);
      // monthly fee change applies from the next cycle; keep the old fee for earlier months
      if (can('payments') && old.plan === 'monthly' && row.plan === 'monthly' && Number(old.fee) !== row.fee) {
        if (!S.data.feeHist.some(h => h.student_id === id)) await must(S.sb.from('fee_history').insert({ centre_id: cid, student_id: id, effective_from: old.admit_date, fee: old.fee }));
        await must(S.sb.from('fee_history').insert({ centre_id: cid, student_id: id, effective_from: nextCycleStart(old), fee: row.fee }));
      }
      await must(S.sb.from('students').update(row).eq('id', id));
    } else {
      id = (await must(S.sb.from('students').insert(row).select('id').single())).id;
    }
    await must(S.sb.from('student_subjects').delete().eq('student_id', id));
    await must(S.sb.from('student_subjects').insert([...F.subj].map(sid => ({ centre_id: cid, student_id: id, subject_id: sid }))));
    if (F.req) await must(S.sb.from('enrol_requests').update({ status: 'student', student_id: id }).eq('id', F.req));
    const isNew = !F.id;
    await loadCentreData(); closeSheet(); toast(t('saved')); if (isNew) confetti();
    P.sid = null;
    if (location.hash === '#student-' + id) S.render(); else location.hash = 'student-' + id;
  } catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.toggleLeft = async el => {
  const s = studentOf(F.id); busy(el, true);
  try { await must(S.sb.from('students').update({ status: s.status === 'left' ? 'active' : 'left' }).eq('id', s.id)); await loadCentreData(); closeSheet(); toast(t('saved')); S.render(); }
  catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.delStudent = async el => {
  if (!(await ask(t('confirmDelStudent'), t('delStudent')))) return;
  busy(el, true);
  try { await must(S.sb.from('students').delete().eq('id', F.id)); await loadCentreData(); closeSheet(); location.hash = 'students'; toast(t('saved')); }
  catch (e) { busy(el, false); toast(errText(e, t)); }
};
export { owe };
