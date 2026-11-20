// Attendance, one class = one subject on one day.
// Tap "Class happened" → everyone who takes the subject is marked present → tap the absent ones (saves by itself).
import { S, can, myBatches, subjectsOf, subjIdsOf, studentOf, nameOf, must, loadCentreData } from '../store.js';
import { t, num, fd, dayShort, dayLong, ftime } from '../i18n.js';
import { today, addDays, parseD } from '../dates.js';
import { ACT, esc, toast, busy, empty, av, waBtn, keepScroll, confetti, buzz, ask, $ } from '../ui.js';
import { errText } from '../db.js';

const expected = (b, su, date) => S.data.students.filter(s => s.batch_id === b && s.status === 'active' && s.admit_date <= date && subjIdsOf(s.id).includes(su));

export function attendView() {
  const bs = myBatches(); if (!bs.length) return `<h2>${t('attend')}</h2>` + empty('📚', t('noBatches'));
  if (!S.ui.ad) S.ui.ad = today();
  if (!S.ui.ab || !bs.some(b => b.id === S.ui.ab)) S.ui.ab = bs[0].id;
  const subs = subjectsOf(S.ui.ab); if (!subs.length) return `<h2>${t('attend')}</h2>` + empty('📚', t('noSubjects'));
  if (!S.ui.as || !subs.some(s => s.id === S.ui.as)) { const wd = parseD(S.ui.ad).getDay(); S.ui.as = (subs.find(s => (s.days || []).includes(wd)) || subs[0]).id; }
  const su = subs.find(s => s.id === S.ui.as), ad = S.ui.ad;
  const cur = S.data.sessions.find(x => x.subject_id === su.id && x.held_on === ad);
  const list = expected(S.ui.ab, su.id, ad);
  const presentSet = new Set(cur ? S.data.attendance.filter(a => a.session_id === cur.id && a.present).map(a => a.student_id) : []);
  let strip = '';
  for (let o = -27; o <= 0; o++) {
    const ds = addDays(today(), o), held = S.data.sessions.some(x => x.subject_id === su.id && x.held_on === ds), sch = (su.days || []).includes(parseD(ds).getDay());
    strip += `<button class="dday ${ds === ad ? 'sel' : ''}" data-act="attDay" data-d="${ds}"><small>${dayShort(parseD(ds).getDay())}</small><b>${num(parseD(ds).getDate())}</b><i class="dt ${held ? 'h' : sch ? 'm' : ''}"></i></button>`;
  }
  let body;
  if (cur) {
    const shown = list.concat(S.data.students.filter(s => presentSet.has(s.id) && !list.includes(s)));
    const pc = shown.length ? presentSet.size / shown.length : 0, absent = shown.filter(s => !presentSet.has(s.id));
    body = `<div class="bar" style="margin-bottom:6px"><span class="pill ok">✓ ${t('classHeld')}</span><span class="sm mut grow">${can('attendance') ? t('autoSaved') + ' · ' : ''}${nameOf(cur.taken_by) ? t('takenBy', { x: esc(nameOf(cur.taken_by)) }) : ''}</span><b style="font-size:20px">${num(presentSet.size)}/${num(shown.length)}</b></div>
      <div class="meter"><i style="width:${pc * 100}%"></i></div>
      ${can('attendance') ? `<p class="sm mut" style="margin:10px 0 0">👆 ${t('tapHint')}</p>` : ''}
      <div class="tiles">${shown.map(s => { const on = presentSet.has(s.id); return `<button class="tile ${on ? '' : 'off'}" data-act="attTog" data-id="${s.id}" ${can('attendance') ? '' : 'disabled'}><i class="mark">${on ? '✓' : '✕'}</i>${av(s.name, 'big')}<span class="tn">${esc(s.name.split(' ')[0])}</span></button>`; }).join('') || empty('🙂', t('none'))}</div>
      ${can('attendance') ? `<div class="bar" style="margin:14px 0 0"><button class="btn" style="flex:1" data-act="attAll">✓ ${t('allPresent')}</button><button class="btn ghost danger" data-act="attRemove">${t('noClass')}</button></div>` : ''}
      ${absent.length ? `<div style="margin-top:14px"><h3>${t('absentees')} (${num(absent.length)})</h3>${absent.map(s => `<div class="row">${av(s.name)}<div class="grow">${esc(s.name)}</div>${waBtn(s.guardian_phone || s.phone, t('msgAbsent', { c: S.centre.name, n: s.name, d: fd(ad), s: su.name }), '💬 ' + t('notify'))}</div>`).join('')}</div>` : ''}`;
  } else {
    body = `<div class="empty" style="padding:6px 0 0"><div class="e">📋</div><p style="margin:6px 0 2px"><b>${t('notTaken')}</b></p><p class="sm" style="margin:0">${t('takeN', { n: num(list.length) })}</p></div>
      <div style="display:flex;justify-content:center;margin:10px 0">${list.slice(0, 10).map(s => av(s.name, 'xs')).join('')}</div>
      ${can('attendance') ? `<button class="btn pri wide huge" data-act="attStart" ${list.length ? '' : 'disabled'}>✓ ${t('startClass')}</button>` : ''}`;
  }
  return `<h2>${t('attend')}</h2>
  <div class="chips">${bs.map(x => `<button class="chip ${x.id === S.ui.ab ? 'on' : ''}" data-act="attBatch" data-v="${x.id}">${esc(x.label || x.name)}</button>`).join('')}</div>
  <div class="chips">${subs.map(x => `<button class="chip ${x.id === su.id ? 'on' : ''}" data-act="attSubj" data-v="${x.id}">${esc(x.name)}${(x.days || []).length ? ` <small style="opacity:.8">· ${(x.days || []).map(dayShort).join(', ')}</small>` : ''}</button>`).join('')}</div>
  <div class="strip" id="strip">${strip}</div>
  <div class="card"><div class="bar" style="margin-bottom:8px"><h3 class="grow" style="margin:0">${esc(su.name)} · ${dayLong(ad)}, ${fd(ad)}</h3><span class="sm mut">${ftime(su.start_time)}</span></div>${body}</div>`;
}

ACT.qAttend = () => {
  const wd = parseD(today()).getDay();
  for (const b of myBatches()) { const su = subjectsOf(b.id).find(s => (s.days || []).includes(wd)); if (su) { S.ui.ab = b.id; S.ui.as = su.id; break; } }
  S.ui.ad = today(); location.hash === '#attend' ? S.render() : (location.hash = 'attend');
};
ACT.goAttend = el => { S.ui.ab = el.dataset.b; S.ui.as = el.dataset.s; S.ui.ad = today(); location.hash = 'attend'; };
ACT.attBatch = el => { S.ui.ab = el.dataset.v; S.ui.as = null; keepScroll(S.render); };
ACT.attSubj = el => { S.ui.as = el.dataset.v; keepScroll(S.render); };
ACT.attDay = el => { S.ui.ad = el.dataset.d; keepScroll(S.render); };

const curSession = () => S.data.sessions.find(x => x.subject_id === S.ui.as && x.held_on === S.ui.ad);
async function guard(fn) { try { await fn(); } catch (e) { toast(errText(e, t)); await loadCentreData().catch(() => {}); } keepScroll(S.render); }

ACT.attStart = el => guard(async () => {
  busy(el, true);
  const list = expected(S.ui.ab, S.ui.as, S.ui.ad), c = S.centre.id;
  const ses = await must(S.sb.from('class_sessions').insert({ centre_id: c, batch_id: S.ui.ab, subject_id: S.ui.as, held_on: S.ui.ad }).select().single());
  const rows = list.map(s => ({ centre_id: c, session_id: ses.id, student_id: s.id, present: true }));
  if (rows.length) await must(S.sb.from('attendance').insert(rows));
  S.data.sessions.push(ses); S.data.attendance.push(...rows.map(({ session_id, student_id, present }) => ({ session_id, student_id, present })));
  toast('👆 ' + t('nowTapAbsent'));
});
ACT.attTog = el => guard(async () => {
  const ses = curSession(); if (!ses) return; const sid = el.dataset.id;
  let a = S.data.attendance.find(x => x.session_id === ses.id && x.student_id === sid);
  if (!a) { a = { session_id: ses.id, student_id: sid, present: false }; S.data.attendance.push(a); }
  a.present = !a.present; buzz(); keepScroll(S.render);
  await must(S.sb.from('attendance').upsert({ centre_id: S.centre.id, session_id: ses.id, student_id: sid, present: a.present }, { onConflict: 'session_id,student_id' }));
});
ACT.attAll = () => guard(async () => {
  const ses = curSession(); if (!ses) return;
  const ids = expected(S.ui.ab, S.ui.as, S.ui.ad).map(s => s.id);
  ids.forEach(id => { const a = S.data.attendance.find(x => x.session_id === ses.id && x.student_id === id); if (a) a.present = true; else S.data.attendance.push({ session_id: ses.id, student_id: id, present: true }); });
  keepScroll(S.render); confetti();
  await must(S.sb.from('attendance').upsert(ids.map(id => ({ centre_id: S.centre.id, session_id: ses.id, student_id: id, present: true })), { onConflict: 'session_id,student_id' }));
});
ACT.attRemove = async () => {
  if (!(await ask(t('confirmNoClass'), t('noClass')))) return;
  guard(async () => {
    const ses = curSession(); if (!ses) return;
    await must(S.sb.from('class_sessions').delete().eq('id', ses.id));
    S.data.sessions = S.data.sessions.filter(x => x.id !== ses.id); S.data.attendance = S.data.attendance.filter(a => a.session_id !== ses.id);
  });
};
export { studentOf };
