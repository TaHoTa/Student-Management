// Home: greeting, month collection ring, quick actions, today's classes, fees pending
import { S, can, canSee, isOwner, myBatches, myStudents, subjectsOf, subjIdsOf, nameOf } from '../store.js';
import { t, num, tk, fd, dayLong, ftime } from '../i18n.js';
import { today, parseD } from '../dates.js';
import { esc, svg, av, empty, ring, pill } from '../ui.js';
import { feeState, owe } from '../logic.js';

export function homeView() {
  const T = today(), ym = T.slice(0, 7), studs = myStudents().filter(s => s.status === 'active');
  const showMoney = canSee('payments');
  let inc = 0, tg = 0, due = [], soon = [];
  if (showMoney) {
    inc = S.data.payments.filter(p => p.paid_on.startsWith(ym)).reduce((a, p) => a + Number(p.amount), 0);
    const all = studs.map(s => ({ s, f: feeState(s) }));
    all.forEach(({ f }) => f.sc.forEach(e => { if (e.due.slice(0, 7) === ym) tg += e.amount; }));
    due = all.filter(x => x.f.status === 'due').sort((a, b) => b.f.lateDays - a.f.lateDays);
    soon = all.filter(x => x.f.status === 'soon');
  }
  const wd = parseD(T).getDay(), classes = [];
  myBatches().forEach(b => subjectsOf(b.id).forEach(su => {
    if (!(su.days || []).includes(wd)) return;
    const n = studs.filter(s => s.batch_id === b.id && subjIdsOf(s.id).includes(su.id)).length;
    const ses = S.data.sessions.find(x => x.subject_id === su.id && x.held_on === T);
    const pres = ses ? S.data.attendance.filter(a => a.session_id === ses.id && a.present).length : 0;
    classes.push({ b, su, n, ses, pres });
  }));
  classes.sort((a, b) => (a.su.start_time || '').localeCompare(b.su.start_time || ''));
  const hr = new Date().getHours(), newReq = S.data.requests.filter(r => r.status === 'new').length;
  const me = (S.readOnly ? 'Support' : nameOf(S.user?.id) || S.profile?.full_name || '').split(' ')[0];
  const tiles = [
    can('attendance') && `<button class="qt" style="--h:155" data-act="qAttend">${svg('attend')}${t('qAttend')}</button>`,
    can('payments') && `<button class="qt" style="--h:38" data-act="pay">${svg('fees')}${t('qPay')}</button>`,
    can('students') && `<button class="qt" style="--h:215" data-act="newStudent">${svg('user')}${t('qStudent')}</button>`,
    canSee('exams') && `<button class="qt" style="--h:280" data-go="exams">${svg('exams')}${t('exams')}</button>`,
    (isOwner() || S.readOnly) && `<button class="qt" style="--h:330" data-go="requests">${svg('requests')}${t('requests')}${newReq ? `<span class="dot">${num(newReq)}</span>` : ''}</button>`,
    `<button class="qt" style="--h:190" data-go="students">${svg('students')}${t('students')}</button>`
  ].filter(Boolean).slice(0, 6).join('');
  return `<div class="hero"><div class="mut sm">${dayLong(T)}, ${fd(T)}</div><h2>${t(hr < 12 ? 'gm' : hr < 17 ? 'ga' : 'ge')}${me ? ', ' + esc(me) : ''}!</h2>
    <div class="mut">${t('nClassesToday', { n: num(classes.length) })}${showMoney ? ' · ' + t('nFeesPending', { n: num(due.length) }) : ''}</div>
    ${showMoney ? `<div class="herorow">${ring(tg ? inc / tg : 1, 100)}<div><div class="mut sm">${t('monthGoal')}</div><div class="big">${tk(inc)}</div><div class="sm mut">${t('target')} ${tk(tg)}${inc < tg ? ' · ' + t('stillLeft', { x: tk(tg - inc) }) : ''}</div></div></div>`
      : `<div class="trio"><div><b>${num(studs.length)}</b><span>${t('students')}</span></div><div><b>${num(myBatches().length)}</b><span>${t('batchesWord')}</span></div><div><b>${num(classes.length)}</b><span>${t('todayWord')}</span></div></div>`}</div>
  ${!S.data.batches.length && isOwner() ? `<button class="card startcard" data-act="editBatch">🚀 <b>${t('startHere')}</b> →</button>` : ''}
  <div class="qgrid">${tiles}</div>
  <div class="cols"><div class="card"><h3>${t('todaySched')}</h3>${classes.length ? classes.map(x => `<div class="row"><span class="time">${x.su.start_time ? ftime(x.su.start_time) : '—'}</span><div class="grow"><b>${esc(x.su.name)}</b><div class="sm mut">${esc(x.b.label || x.b.name)} · ${t('studentsN', { n: num(x.n) })}</div></div>
      ${x.ses ? `<button class="btn sm" data-act="goAttend" data-b="${x.b.id}" data-s="${x.su.id}">✓ ${num(x.pres)}/${num(x.n)}</button>` : can('attendance') ? `<button class="btn pri sm" data-act="goAttend" data-b="${x.b.id}" data-s="${x.su.id}">${t('qAttend')}</button>` : ''}</div>`).join('') : empty('☕', t('noClassToday'))}</div>
  ${showMoney ? `<div class="card"><h3>${t('dueList')} ${due.length ? `<span class="pill due">${num(due.length)}</span>` : ''}</h3>${due.concat(soon).length ? due.concat(soon).map(({ s, f }) => `<div class="row">${av(s.name)}<div class="grow click" data-go="student-${s.id}"><b>${esc(s.name)}</b><div class="sm"><b>${tk(owe(f))}</b> ${pill(f)}</div></div>${can('payments') ? `<button class="btn pri sm" data-act="pay" data-id="${s.id}">${t('collect')}</button>` : ''}</div>`).join('') : empty('🎉', t('allClear'))}</div>` : ''}</div>`;
}
