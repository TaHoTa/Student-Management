// Exams: type per batch, subject, MCQ / Written / both, pass mark per part (empty = BD 33%),
// marks entry, BD grade (A+…F; fail any part = F), rank, top-3 podium.
import { S, can, myBatches, subjectsOf, typesOf, subjIdsOf, studentOf, batchOf, subjectOf, batchTitle, must, loadCentreData } from '../store.js';
import { t, num, fd } from '../i18n.js';
import { today } from '../dates.js';
import { ACT, INP, esc, toast, sheet, closeSheet, head, busy, empty, av, val, dateField, getDate, redrawSheet, confetti, ask, $, $$ } from '../ui.js';
import { results, partPass, gradeCls, GPA, examFull } from '../logic.js';
import { errText } from '../db.js';

const typeName = id => S.data.examTypes.find(x => x.id === id)?.name || '';
const mine = () => S.data.exams.filter(e => myBatches().some(b => b.id === e.batch_id));

export function examsView() {
  if (S.ui.ex) { const e = S.data.exams.find(x => x.id === S.ui.ex); if (e && mine().includes(e)) return S.ui.exEdit && can('exams') ? marksEntry(e) : examDetail(e); S.ui.ex = null; }
  const fb = S.ui.exb || 'all', list = mine().filter(e => fb === 'all' || e.batch_id === fb);
  return `<div class="bar"><h2 class="grow" style="margin:0">${t('exams')}</h2>${can('exams') ? `<button class="btn pri sm" data-act="newExam">+ ${t('newExam')}</button>` : ''}</div>
  <div class="chips"><button class="chip ${fb === 'all' ? 'on' : ''}" data-act="exFilter" data-v="all">${t('all')}</button>${myBatches().map(b => `<button class="chip ${fb === b.id ? 'on' : ''}" data-act="exFilter" data-v="${b.id}">${esc(b.label || b.name)}</button>`).join('')}</div>
  ${list.length ? list.map(e => { const r = results(e), top = r.ok[0], avg = r.ok.length ? r.ok.reduce((a, x) => a + x.pct, 0) / r.ok.length : 0, pass = r.ok.filter(x => x.g !== 'F').length;
    return `<div class="card click" data-act="openExam" data-id="${e.id}"><div class="bar" style="margin:0"><span class="subj">${esc(subjectOf(e.subject_id)?.name || '—')}</span>${e.exam_type_id ? `<span class="pill">${esc(typeName(e.exam_type_id))}</span>` : ''}<span class="sm mut grow" style="text-align:right">${fd(e.held_on)}</span></div>
      <h3 style="margin:6px 0 2px">${esc(e.topic || '')}</h3><div class="sm mut">${esc(batchTitle(batchOf(e.batch_id)))} · ${parts(e)}</div>
      <div class="bar" style="margin:10px 0 0">${top ? `<span class="pill ok">🏆 ${esc(studentOf(top.sid)?.name.split(' ')[0] || '')} ${num(top.tot)}</span>` : `<span class="pill soon">${t('noMarksYet')}</span>`}${r.ok.length ? `<span class="sm mut">${t('avg')} ${num(Math.round(avg))}% · ${t('passed')} ${num(pass)}/${num(r.ok.length)}</span>` : ''}</div></div>`; }).join('') : empty('📝', t('noExam'))}`;
}
const parts = e => [e.has_mcq ? `MCQ ${num(e.mcq_full)}` : '', e.has_written ? `${t('written')} ${num(e.written_full)}` : ''].filter(Boolean).join(' + ') + ` = ${num(examFull(e))}`;
const partPills = e => `${e.has_mcq ? `<span class="pill">MCQ ${num(e.mcq_full)} · ${t('passMark')} ${num(partPass(e.mcq_full, e.mcq_pass))}</span> ` : ''}${e.has_written ? `<span class="pill">${t('written')} ${num(e.written_full)} · ${t('passMark')} ${num(partPass(e.written_full, e.written_pass))}</span>` : ''}`;

function examDetail(e) {
  const r = results(e), H = [66, 96, 50], C = ['#94a3b8', '#eab308', '#c2763a'], M = ['🥈', '🥇', '🥉'], pod = [r.ok[1], r.ok[0], r.ok[2]];
  return `<div class="bar"><button class="ib" data-act="closeExam" aria-label="${t('back')}">‹</button><div class="grow"><h2 style="margin:0">${esc(e.topic || subjectOf(e.subject_id)?.name || '')}</h2>
    <div class="sm mut">${esc(typeName(e.exam_type_id))}${e.exam_type_id ? ' · ' : ''}${esc(subjectOf(e.subject_id)?.name || '')} · ${esc(batchTitle(batchOf(e.batch_id)))} · ${fd(e.held_on)}</div></div>${can('exams') ? `<button class="btn sm" data-act="editExam" data-id="${e.id}">✎</button>` : ''}</div>
  <div class="bar">${partPills(e)}</div>
  <div class="cols"><div>${r.ok.length ? `<div class="card"><div class="podium">${pod.map((x, i) => (x ? `<div class="pod"><span style="font-size:26px">${M[i]}</span>${av(studentOf(x.sid)?.name || '?')}<b style="font-size:14px">${esc((studentOf(x.sid)?.name || '').split(' ')[0])}</b><div class="blk" style="height:${H[i]}px;background:${C[i]}">${num(x.tot)}</div></div>` : '<div></div>')).join('')}</div>
      <p class="sm mut" style="text-align:center;margin:8px 0 0">${t('avg')} ${num(Math.round(r.ok.reduce((a, x) => a + x.pct, 0) / r.ok.length))}% · ${t('highest')} ${num(r.ok[0].tot)}/${num(r.full)} · ${t('passed')} ${num(r.ok.filter(x => x.g !== 'F').length)}/${num(r.ok.length)}</p></div>` : ''}
    ${can('exams') ? `<button class="btn pri wide huge" style="margin:0 0 14px" data-act="marksOn">✎ ${t('enterMarks')}</button>` : ''}</div>
  <div class="card"><h3>${t('results')}</h3>${r.rows.map(x => { const s = studentOf(x.sid); if (!s) return ''; return `<div class="row">${x.ab ? '<span class="av" style="--h:0">–</span>' : `<span class="av" style="--h:${x.rank <= 3 ? 45 : 200}">${num(x.rank)}</span>`}<div class="grow"><b>${esc(s.name)}</b>
      ${x.ab ? `<div class="sm mut">${t('absent')}</div>` : `<div class="sm mut">${e.has_mcq ? `MCQ ${num(x.mcq ?? 0)}` : ''}${e.has_mcq && e.has_written ? ' + ' : ''}${e.has_written ? `${t('written')} ${num(x.wr ?? 0)}` : ''} = <b style="color:var(--ink)">${num(x.tot)}</b>/${num(r.full)} · ${num(Math.round(x.pct))}%${x.failPart ? ` · <span style="color:var(--bad)">${t('failPart')}</span>` : ''}</div>`}</div>
      ${x.ab ? '' : `<div style="text-align:center"><span class="grade ${gradeCls(x.g)}">${x.g}</span><div class="sm mut">${GPA[x.g]}</div></div>`}</div>`; }).join('') || empty('📝', t('noMarksYet'))}</div></div>`;
}

// ---------- marks entry ----------
let MK = null;
function marksEntry(e) {
  if (!MK || MK.id !== e.id) { MK = { id: e.id, ab: new Set(S.data.marks.filter(m => m.exam_id === e.id && m.absent).map(m => m.student_id)) }; }
  const list = S.data.students.filter(s => s.batch_id === e.batch_id && (s.status === 'active' || S.data.marks.some(m => m.exam_id === e.id && m.student_id === s.id)) && (!e.subject_id || subjIdsOf(s.id).includes(e.subject_id)));
  const get = (sid, k) => { const m = S.data.marks.find(x => x.exam_id === e.id && x.student_id === sid); return m && m[k] != null ? Number(m[k]) : ''; };
  return `<div class="bar"><button class="ib" data-act="marksOff" aria-label="${t('back')}">‹</button><div class="grow"><h2 style="margin:0">${t('enterMarks')}</h2><div class="sm mut">${esc(e.topic || '')} · ${esc(subjectOf(e.subject_id)?.name || '')}</div></div></div>
  <div class="card"><div class="bar">${partPills(e)}</div><p class="sm mut" style="margin:0 0 6px">⌨️ ${t('enterHint')}</p>
  ${list.map(s => { const ab = MK.ab.has(s.id); return `<div class="row">${av(s.name)}<div class="grow"><b>${esc(s.name)}</b></div>
    ${e.has_mcq ? `<input class="mk" id="mm_${s.id}" data-max="${e.mcq_full}" type="number" inputmode="decimal" enterkeyhint="next" placeholder="MCQ" value="${ab ? '' : get(s.id, 'mcq')}" ${ab ? 'disabled' : ''} aria-label="MCQ">` : ''}
    ${e.has_written ? `<input class="mk" id="mw_${s.id}" data-max="${e.written_full}" type="number" inputmode="decimal" enterkeyhint="next" placeholder="${t('written')}" value="${ab ? '' : get(s.id, 'written')}" ${ab ? 'disabled' : ''} aria-label="${t('written')}">` : ''}
    <button class="abs ${ab ? 'on' : ''}" data-act="absTog" data-id="${s.id}">${t('ab')}</button></div>`; }).join('') || empty('🙂', t('none'))}
  <button class="btn pri wide huge" data-act="marksSave" data-id="${e.id}">✓ ${t('saveMarks')}</button></div>`;
}
ACT.absTog = el => {
  const id = el.dataset.id, on = !MK.ab.has(id); on ? MK.ab.add(id) : MK.ab.delete(id);
  el.classList.toggle('on', on); ['mm_', 'mw_'].forEach(p => { const i = document.getElementById(p + id); if (i) { i.disabled = on; if (on) i.value = ''; } });
};
ACT.marksSave = async el => {
  const e = S.data.exams.find(x => x.id === el.dataset.id), c = S.centre.id, up = [], del = [];
  const list = new Set([...$$('.mk')].map(i => i.id.slice(3)).concat([...MK.ab]));
  const clamp = (v, max) => (v === '' ? null : Math.max(0, Math.min(Number(max), Number(v))));
  list.forEach(sid => {
    if (MK.ab.has(sid)) { up.push({ centre_id: c, exam_id: e.id, student_id: sid, absent: true, mcq: null, written: null }); return; }
    const m = document.getElementById('mm_' + sid), w = document.getElementById('mw_' + sid);
    const mv = m ? clamp(m.value.trim(), m.dataset.max) : null, wv = w ? clamp(w.value.trim(), w.dataset.max) : null;
    if (mv == null && wv == null) del.push(sid); else up.push({ centre_id: c, exam_id: e.id, student_id: sid, absent: false, mcq: mv, written: wv });
  });
  busy(el, true);
  try {
    if (up.length) await must(S.sb.from('marks').upsert(up, { onConflict: 'exam_id,student_id' }));
    if (del.length) await must(S.sb.from('marks').delete().eq('exam_id', e.id).in('student_id', del));
    S.data.marks = S.data.marks.filter(m => m.exam_id !== e.id).concat(up);
    S.ui.exEdit = false; MK = null; S.render(); scrollTo(0, 0); confetti(); toast(t('saved'));
  } catch (x) { busy(el, false); toast(errText(x, t)); }
};
ACT.marksOn = () => { S.ui.exEdit = true; MK = null; S.render(); scrollTo(0, 0); };
ACT.marksOff = () => { S.ui.exEdit = false; S.render(); };
ACT.openExam = el => { S.ui.ex = el.dataset.id; S.ui.exEdit = false; S.render(); scrollTo(0, 0); };
ACT.closeExam = () => { S.ui.ex = null; S.render(); };
ACT.exFilter = el => { S.ui.exb = el.dataset.v; S.render(); };

// ---------- create / edit exam ----------
let X = null;
function openExamForm(id) {
  const e = id ? S.data.exams.find(x => x.id === id) : null, b = e ? batchOf(e.batch_id) : myBatches()[0];
  if (!b) return toast(t('noBatches'));
  const subs = subjectsOf(b.id);
  X = e ? { id: e.id, batch: e.batch_id, subj: e.subject_id, type: e.exam_type_id, topic: e.topic || '', date: e.held_on,
            mcq: { on: e.has_mcq, full: e.mcq_full ?? 25, pass: e.mcq_pass ?? '' }, wr: { on: e.has_written, full: e.written_full ?? 50, pass: e.written_pass ?? '' } }
        : { id: null, batch: b.id, subj: subs[0]?.id || null, type: typesOf(b.id)[0]?.id || null, topic: '', date: today(), mcq: { on: true, full: 25, pass: '' }, wr: { on: true, full: 50, pass: '' } };
  draw(true);
}
function sync() {
  if (!$('#xTopic')) return;
  X.topic = val('xTopic'); X.date = getDate('xDate') || X.date;
  ['mcq', 'wr'].forEach(k => { const on = document.getElementById('x_' + k); if (on) X[k].on = on.checked; const f = document.getElementById('xf_' + k), p = document.getElementById('xp_' + k); if (f) X[k].full = f.value; if (p) X[k].pass = p.value; });
}
function draw(top) {
  if (!top) sync();
  const go = () => {
    const b = batchOf(X.batch), subs = subjectsOf(X.batch), types = typesOf(X.batch);
    const part = (k, label) => `<div class="slot"><label class="switch" style="margin:0"><input type="checkbox" id="x_${k}" data-inp="xRedraw" ${X[k].on ? 'checked' : ''}><span></span>${label}</label>
      ${X[k].on ? `<div class="row2"><label>${t('fullMarks')}<input id="xf_${k}" type="number" inputmode="numeric" value="${X[k].full}"></label><label>${t('passMark')}<input id="xp_${k}" type="number" inputmode="numeric" value="${X[k].pass}" placeholder="${num(Math.ceil((Number(X[k].full) || 0) * 0.33))}"></label></div><div class="sm mut">${t('passHint')}</div>` : ''}</div>`;
    sheet(head(X.id ? t('editExam') : t('newExam')) + `
      <div class="lab">${t('batch')}</div><div class="chips wrap">${myBatches().map(x => `<button class="chip ${x.id === X.batch ? 'on' : ''}" data-act="xBatch" data-v="${x.id}">${esc(batchTitle(x))}</button>`).join('')}</div>
      <div class="lab">${t('subject')}</div><div class="chips wrap">${subs.map(x => `<button class="chip ${x.id === X.subj ? 'on' : ''}" data-act="xSubj" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div>
      <div class="lab">${t('examType')}</div><div class="chips wrap">${types.map(x => `<button class="chip ${x.id === X.type ? 'on' : ''}" data-act="xType" data-v="${x.id}">${esc(x.name)}</button>`).join('') || `<span class="sm mut">${t('noTypes')}</span>`}</div>
      <label>${t('topic')}<input id="xTopic" value="${esc(X.topic)}" placeholder="Vector"></label>
      ${dateField('xDate', t('date'), X.date)}
      ${part('mcq', 'MCQ')}${part('wr', t('written'))}
      <div class="info">${t('gradeRule')}</div>
      <button class="btn pri wide huge" data-act="xSave">✓ ${t('save')}</button>${X.id ? `<button class="btn ghost danger wide" data-act="xDelete">${t('delExam')}</button>` : ''}`);
  };
  top ? go() : redrawSheet(go);
}
ACT.newExam = () => { closeSheet(); openExamForm(); };
ACT.editExam = el => openExamForm(el.dataset.id);
INP.xRedraw = () => draw();
ACT.xBatch = el => { sync(); X.batch = el.dataset.v; X.subj = subjectsOf(X.batch)[0]?.id || null; X.type = typesOf(X.batch)[0]?.id || null; draw(); };
ACT.xSubj = el => { sync(); X.subj = el.dataset.v; draw(); };
ACT.xType = el => { sync(); X.type = X.type === el.dataset.v ? null : el.dataset.v; draw(); };
ACT.xSave = async el => {
  sync();
  const full = (X.mcq.on ? Number(X.mcq.full) || 0 : 0) + (X.wr.on ? Number(X.wr.full) || 0 : 0);
  if (!X.subj || !full) return toast(t('needPart'));
  const n = v => (v === '' || v == null ? null : Number(v));
  const row = { centre_id: S.centre.id, batch_id: X.batch, subject_id: X.subj, exam_type_id: X.type, topic: X.topic.trim() || null, held_on: X.date || today(),
    has_mcq: X.mcq.on, mcq_full: X.mcq.on ? n(X.mcq.full) : null, mcq_pass: X.mcq.on ? n(X.mcq.pass) : null,
    has_written: X.wr.on, written_full: X.wr.on ? n(X.wr.full) : null, written_pass: X.wr.on ? n(X.wr.pass) : null };
  busy(el, true);
  try {
    let id = X.id;
    if (id) await must(S.sb.from('exams').update(row).eq('id', id)); else id = (await must(S.sb.from('exams').insert(row).select('id').single())).id;
    await loadCentreData(); closeSheet(); S.ui.ex = id; S.ui.exEdit = !X.id;
    location.hash === '#exams' ? S.render() : (location.hash = 'exams'); scrollTo(0, 0);
  } catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.xDelete = async el => {
  if (!(await ask(t('confirmDelExam'), t('delExam')))) return;
  busy(el, true);
  try { await must(S.sb.from('exams').delete().eq('id', X.id)); await loadCentreData(); closeSheet(); S.ui.ex = null; S.render(); }
  catch (e) { busy(el, false); toast(errText(e, t)); }
};
