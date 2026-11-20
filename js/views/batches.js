// Batches: subjects (days + time + seat full), fee table by number of subjects, exam types,
// course dates, and what shows on the public enrolment page.
import { S, isOwner, loadCentreData, subjectsOf, typesOf, must } from '../store.js';
import { t, num, tk, fd, WEEK, dayShort, subjSched } from '../i18n.js';
import { today, addDays, addMonths } from '../dates.js';
import { ACT, INP, esc, toast, sheet, closeSheet, head, ask, busy, empty, val, dateField, getDate, timeField, getTime, redrawSheet, $ } from '../ui.js';
import { errText } from '../db.js';

export function batchesView() {
  const bs = S.data.batches;
  return `<div class="bar"><h2 class="grow" style="margin:0">${t('batches')}</h2>${isOwner() ? `<button class="btn pri sm" data-act="editBatch">+ ${t('newBatch')}</button>` : ''}</div>
  ${isOwner() ? `<p class="sm mut" style="margin-top:0">${t('batchesHint')}</p>` : ''}
  ${bs.length ? bs.map(b => {
    const subs = subjectsOf(b.id), n = S.data.students.filter(s => s.batch_id === b.id && s.status === 'active').length;
    const allFull = subs.length && subs.every(s => s.seat_full);
    const fr = S.data.feeRules.filter(f => f.batch_id === b.id).sort((a, c) => a.subject_count - c.subject_count);
    return `<div class="card"><div class="bar" style="margin:0 0 6px"><h3 class="grow" style="margin:0">${esc(b.name)} ${b.label ? `<span class="pill ac">${esc(b.label)}</span>` : ''}</h3>${isOwner() ? `<button class="btn sm" data-act="editBatch" data-id="${b.id}">✎ ${t('edit')}</button>` : ''}</div>
      <div class="sm mut">${b.start_date ? fd(b.start_date) + ' – ' + (b.end_date ? fd(b.end_date) : '…') + ' · ' : ''}${t('studentsN', { n: num(n) })}</div>
      <div class="bar" style="margin:6px 0 0">${b.show_on_page ? `<span class="pill ok">👁 ${t('onPage')}</span>` : `<span class="pill">🙈 ${t('hiddenPage')}</span>`}${allFull ? `<span class="pill due">${t('batchFull')}</span>` : ''}</div>
      ${subs.map(s => `<div class="row tight"><span class="subj">${esc(s.name)}</span><span class="sm grow">${subjSched(s) || `<span class="mut">${t('noTime')}</span>`}</span>${s.seat_full ? `<span class="pill due">${t('seatFull')}</span>` : ''}</div>`).join('')}
      ${fr.length ? `<div class="feegrid">${fr.map(f => `<div><span class="mut sm">${t('nSubj', { n: num(f.subject_count) })}</span><b>${f.monthly_fee != null ? tk(f.monthly_fee) + `<small>${t('perMonth')}</small>` : '—'}</b>${b.full_course_on && f.full_course_fee != null ? `<span class="sm">${t('fullCourse')}: ${tk(f.full_course_fee)}</span>` : ''}</div>`).join('')}</div>` : ''}
      ${typesOf(b.id).length ? `<div style="margin-top:8px">${typesOf(b.id).map(x => `<span class="pill" style="margin:2px">${esc(x.name)}</span>`).join('')}</div>` : ''}
      ${b.page_note ? `<div class="sm mut" style="margin-top:6px">📝 ${esc(b.page_note)}</div>` : ''}
    </div>`;
  }).join('') : empty('📚', isOwner() ? t('startHere') : t('none'))}`;
}

// ---------- editor ----------
let E = null, seq = 0;
function openEditor(id) {
  const b = id ? S.data.batches.find(x => x.id === id) : null, subs = id ? subjectsOf(id) : [];
  const fees = {}; S.data.feeRules.filter(f => f.batch_id === id).forEach(f => (fees[f.subject_count] = { m: f.monthly_fee ?? '', f: f.full_course_fee ?? '' }));
  E = { id: id || null, name: b?.name || '', label: b?.label || '', start: b?.start_date || today(), end: b?.end_date || addDays(addMonths(today(), 12), -1),
    full: !!b?.full_course_on, show: b ? !!b.show_on_page : true, note: b?.page_note || '', fees, removed: [], removedTypes: [],
    types: id ? typesOf(id).map(x => ({ id: x.id, name: x.name })) : [{ id: null, name: t('defType') }],
    subjects: subs.length ? subs.map(s => ({ id: s.id, key: ++seq, name: s.name, days: [...(s.days || [])], time: s.start_time ? s.start_time.slice(0, 5) : '', full: !!s.seat_full }))
                          : [{ id: null, key: ++seq, name: '', days: [], time: '', full: false }] };
  draw(true);
}
// read every box on screen into E (so nothing typed is ever lost, whatever the keyboard or picker)
function sync() {
  if (!$('#bName')) return;
  E.name = val('bName'); E.label = val('bLabel'); E.note = val('bNote');
  E.start = getDate('bStart'); E.end = getDate('bEnd');
  E.full = $('#bFull').checked; E.show = $('#bShow').checked;
  E.subjects.forEach(s => { const n = document.getElementById('sn_' + s.key); if (n) s.name = n.value; s.time = getTime('s' + s.key) || ''; const f = document.getElementById('sf_' + s.key); if (f) s.full = f.checked; });
  E.subjects.forEach((_, i) => { const c = i + 1, m = document.getElementById('fm_' + c), f = document.getElementById('ff_' + c); E.fees[c] = { m: m ? m.value : E.fees[c]?.m ?? '', f: f ? f.value : E.fees[c]?.f ?? '' }; });
}
function draw(top) {
  if (!top) sync();
  const go = () => {
    const n = E.subjects.length;
    sheet(head(E.id ? t('editBatch') : t('newBatch')) + `
    <label>${t('batchName')} *<input id="bName" value="${esc(E.name)}" placeholder="Aspirants Prime Batch"></label>
    <label>${t('label')}<input id="bLabel" value="${esc(E.label)}" placeholder="HSC 28"></label>
    <div class="row2"><div>${dateField('bStart', t('start'), E.start)}</div><div>${dateField('bEnd', t('end'), E.end)}</div></div>
    <div class="lab">${t('subjects')} *</div>
    ${E.subjects.map((s, i) => `<div class="slot">
      <div class="slotrow"><input id="sn_${s.key}" value="${esc(s.name)}" placeholder="${t('subjectName')}"><button class="ib" data-act="rmSubj" data-i="${i}" aria-label="${t('del')}">✕</button></div>
      <div class="sm mut" style="margin:8px 0 2px">${t('classDays')}</div>
      <div class="days">${WEEK.map(d => `<button type="button" class="dchip ${s.days.includes(d) ? 'on' : ''}" data-act="sDay" data-i="${i}" data-d="${d}">${dayShort(d)}</button>`).join('')}</div>
      <div class="sm mut" style="margin:2px 0 4px">${t('classTime')}</div>${timeField('s' + s.key, s.time)}
      <label class="switch small"><input type="checkbox" id="sf_${s.key}" ${s.full ? 'checked' : ''}><span></span>${t('seatFullSwitch')}</label>
    </div>`).join('')}
    <button class="btn sm" style="margin-top:8px" data-act="addSubj">+ ${t('addSubject')}</button>
    <label class="switch"><input type="checkbox" id="bFull" data-inp="bRedraw" ${E.full ? 'checked' : ''}><span></span>${t('fullCourseOn')}</label>
    <div class="lab">${t('feeTable')}</div>
    <div class="feetable"><div class="fh"><span></span><span>${t('monthly')}</span><span>${E.full ? t('fullCourse') : ''}</span></div>
    ${Array.from({ length: n }, (_, k) => k + 1).map(c => `<div class="fr"><span>${t('nSubj', { n: num(c) })}</span><input id="fm_${c}" type="number" inputmode="numeric" min="0" value="${E.fees[c]?.m ?? ''}" placeholder="৳">${E.full ? `<input id="ff_${c}" type="number" inputmode="numeric" min="0" value="${E.fees[c]?.f ?? ''}" placeholder="৳">` : '<span></span>'}</div>`).join('')}</div>
    <div class="lab">${t('examTypes')}</div>
    <div class="chips wrap" style="margin-top:6px">${E.types.map((x, i) => `<button type="button" class="chip" data-act="rmType" data-i="${i}">${esc(x.name)} ✕</button>`).join('') || `<span class="sm mut">—</span>`}</div>
    <div class="slotrow"><input id="newType" placeholder="${t('addTypeHint')}"><button type="button" class="btn" data-act="addType">+</button></div>
    <div class="lab">${t('enrolPage')}</div>
    <label class="switch" style="margin-top:6px"><input type="checkbox" id="bShow" ${E.show ? 'checked' : ''}><span></span>${t('showOnPage')}</label>
    <label>${t('pageNote')}<input id="bNote" value="${esc(E.note)}" placeholder="${t('pageNoteHint')}"></label>
    <button class="btn pri wide huge" data-act="saveBatch">✓ ${t('save')}</button>
    ${E.id ? `<button class="btn ghost danger wide" data-act="delBatch">${t('delBatch')}</button>` : ''}`);
  };
  top ? go() : redrawSheet(go);
}

ACT.editBatch = el => { closeSheet(); openEditor(el.dataset.id); };
INP.bRedraw = () => draw();
ACT.sDay = el => { const s = E.subjects[+el.dataset.i], d = +el.dataset.d; s.days = s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d]; el.classList.toggle('on'); };
ACT.addSubj = () => { sync(); E.subjects.push({ id: null, key: ++seq, name: '', days: [], time: '', full: false }); draw(); };
ACT.rmSubj = async el => {
  sync(); const i = +el.dataset.i, s = E.subjects[i];
  if (s.id) { if (!(await ask(t('confirmDelSubj'), t('del')))) return; E.removed.push(s.id); }
  E.subjects.splice(i, 1); if (!E.subjects.length) E.subjects.push({ id: null, key: ++seq, name: '', days: [], time: '', full: false });
  draw();
};
ACT.addType = () => { sync(); const v = val('newType').trim(); if (v) { E.types.push({ id: null, name: v }); draw(); } };
ACT.rmType = el => { sync(); const x = E.types.splice(+el.dataset.i, 1)[0]; if (x?.id) E.removedTypes.push(x.id); draw(); };

ACT.saveBatch = async el => {
  sync();
  const pending = val('newType').trim(); if (pending) E.types.push({ id: null, name: pending });
  const subs = E.subjects.filter(s => s.name.trim());
  if (!E.name.trim() || !subs.length) return toast(t('needBatch'));
  if (E.start && E.end && E.end < E.start) return toast(t('badDates'));
  busy(el, true);
  const sb = S.sb, cid = S.centre.id;
  try {
    const row = { centre_id: cid, name: E.name.trim(), label: E.label.trim() || null, start_date: E.start || null, end_date: E.end || null,
      full_course_on: E.full, show_on_page: E.show, page_note: E.note.trim() || null };
    let bid = E.id;
    if (bid) await must(sb.from('batches').update(row).eq('id', bid));
    else bid = (await must(sb.from('batches').insert({ ...row, sort: S.data.batches.length }).select('id').single())).id;
    if (E.removed.length) await must(sb.from('subjects').delete().in('id', E.removed));
    for (const [k, s] of subs.entries()) {
      const r = { centre_id: cid, batch_id: bid, name: s.name.trim(), days: s.days, start_time: s.time || null, seat_full: s.full, sort: k };
      if (s.id) await must(sb.from('subjects').update(r).eq('id', s.id)); else await must(sb.from('subjects').insert(r));
    }
    await must(sb.from('fee_rules').delete().eq('batch_id', bid));
    const rules = subs.map((_, k) => k + 1).map(c => ({ centre_id: cid, batch_id: bid, subject_count: c,
      monthly_fee: E.fees[c]?.m === '' || E.fees[c]?.m == null ? null : Number(E.fees[c].m),
      full_course_fee: !E.full || E.fees[c]?.f === '' || E.fees[c]?.f == null ? null : Number(E.fees[c].f) }))
      .filter(r => r.monthly_fee != null || r.full_course_fee != null);
    if (rules.length) await must(sb.from('fee_rules').insert(rules));
    if (E.removedTypes.length) await must(sb.from('exam_types').delete().in('id', E.removedTypes));
    const newTypes = E.types.filter(x => !x.id && x.name.trim()).map(x => ({ centre_id: cid, batch_id: bid, name: x.name.trim() }));
    if (newTypes.length) await must(sb.from('exam_types').insert(newTypes));
    await loadCentreData(); closeSheet(); toast(t('saved')); S.render();
  } catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.delBatch = async el => {
  if (!(await ask(t('confirmDelBatch'), t('delBatch')))) return;
  busy(el, true);
  try { await must(S.sb.from('batches').delete().eq('id', E.id)); await loadCentreData(); closeSheet(); toast(t('saved')); S.render(); }
  catch (e) { busy(el, false); toast(errText(e, t)); }
};
