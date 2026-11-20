// Public read-only page for one student and their guardian: student.html?k=<private key>
// Attendance calendar, fees (paid until / due / payments) and exam results. No login.
import { getClient, configured } from './db.js';
import { prefs, savePrefs, isBn, num, tk, fd, subjSched } from './i18n.js';
import { S } from './store.js';
import { today } from './dates.js';
import { $, esc, applyTheme, av, cal, keepScroll, ACT } from './ui.js';
import { feeStateFor, gradeOne, gradeCls, GPA } from './logic.js';

const TX = {
  title: ['Student page', 'শিক্ষার্থীর পেজ'], private: ['Private page — please do not share', 'ব্যক্তিগত পেজ — অন্যকে শেয়ার করবেন না'],
  attend: ['Attendance', 'হাজিরা'], fees: ['Fees', 'বেতন'], marks: ['Marks', 'নম্বর'], present: ['Present', 'উপস্থিত'], absent: ['Absent', 'অনুপস্থিত'],
  payment: ['Payment', 'পেমেন্ট'], paidUntil: ['Paid until', 'পরিশোধিত'], avgMarks: ['Avg marks', 'গড় নম্বর'], attendance: ['Attendance', 'উপস্থিতি'],
  bySubject: ['By subject', 'বিষয় অনুযায়ী'], noClass: ['No classes recorded yet', 'এখনো কোনো ক্লাস রেকর্ড হয়নি'],
  plan: ['Payment plan', 'পেমেন্ট পদ্ধতি'], monthly: ['Monthly', 'মাসিক'], full: ['Full course', 'পুরো কোর্স'], perMonth: ['/month', '/মাস'], cash: ['paid in cash at the centre', 'সেন্টারে নগদ পরিশোধ'],
  due: ['Due', 'বাকি'], paid: ['Paid', 'পরিশোধিত'], dueSoon: ['Due soon', 'শীঘ্রই'], allPaid: ['All fees paid', 'সব বেতন পরিশোধিত'], schedule: ['Fee schedule', 'বেতনের হিসাব'],
  payments: ['Payments received', 'জমা দেওয়া টাকা'], noPay: ['No payments yet', 'এখনো কোনো পেমেন্ট নেই'], nextDue: ['Next', 'পরবর্তী'],
  noExam: ['No exam results yet', 'এখনো কোনো পরীক্ষার ফল নেই'], written: ['Written', 'লিখিত'], rank: ['Rank', 'মেধাক্রম'], failPart: ['Failed a part', 'একটি অংশে ফেল'],
  admitted: ['Admitted', 'ভর্তি'], left: ['No longer studying here', 'এখন আর এখানে পড়ছে না'], call: ['Call the centre', 'সেন্টারে কল করুন'],
  notFound: ['This link is not valid or was replaced. Ask the coaching centre for the new link.', 'এই লিংকটি সঠিক নয় বা বদলানো হয়েছে। নতুন লিংকের জন্য কোচিং সেন্টারে যোগাযোগ করুন।'],
  inactive: ['This page is not available right now.', 'এই পেজটি এখন দেখা যাচ্ছে না।'], err: ['Could not load. Check internet and try again.', 'লোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'],
  loading: ['Loading…', 'লোড হচ্ছে…'], setup: ['Setup needed: add Supabase URL and key in js/config.js', 'সেটআপ বাকি: js/config.js ফাইলে Supabase URL ও key দিন']
};
const tx = k => TX[k][isBn() ? 1 : 0];
let D = null, error = null;
S.ui.ptab = 'att';

const eLabel = e => (e.full ? tx('full') : fd(e.from) + ' – ' + fd(e.to));
function render() {
  applyTheme();
  const top = `<div class="top2"><span class="sm mut">🔒 ${tx('private')}</span><button class="hb" data-a="lang">${isBn() ? 'EN' : 'বাং'}</button></div>`;
  if (!D) { $('#root').innerHTML = `<main class="pub">${top}<div class="card center"><div class="e">${error ? '🔗' : '⏳'}</div><p>${tx(error || 'loading')}</p></div></main>`; return; }
  const c = D.centre, s = D.student; document.title = s.name + ' · ' + c.name;
  // attendance
  const att = D.attendance, pres = att.filter(a => a.p).length, pct = att.length ? Math.round((pres / att.length) * 100) : 0;
  const byDay = {}; att.forEach(a => (byDay[a.d] = byDay[a.d] || []).push(a.p));
  // fees
  const f = feeStateFor(s, D.batch.end_date, D.payments, D.fee_history);
  // exams
  const ex = D.exams.map(e => (e.absent ? { e, ab: true } : { e, ...gradeOne(e, e.mcq, e.written) }));
  const okEx = ex.filter(x => !x.ab), avg = okEx.length ? Math.round(okEx.reduce((a, x) => a + x.pct, 0) / okEx.length) : null;
  const tabs = [['att', '📅 ' + tx('attend')], ['fee', '৳ ' + tx('fees')], ['marks', '📝 ' + tx('marks')]];
  let tab = '';
  if (S.ui.ptab === 'att') {
    const payDays = new Set(D.payments.map(p => p.paid_on));
    tab = `<div class="card">${att.length ? `<div class="bar"><b class="grow" style="font-size:20px">${num(pct)}% ${tx('present')}</b><span class="sm mut">${num(pres)}/${num(att.length)}</span></div><div class="meter" style="margin-bottom:14px"><i style="width:${pct}%"></i></div>` : `<p class="mut">${tx('noClass')}</p>`}
      ${cal('pm', ds => { const xs = byDay[ds]; return { cls: xs ? (xs.every(Boolean) ? 'p' : 'a') : '', inner: payDays.has(ds) ? '<i class="tk">৳</i>' : '' }; })}
      <div class="legend"><span><i style="background:var(--ok)"></i>${tx('present')}</span><span><i style="background:color-mix(in srgb,var(--bad) 35%,transparent)"></i>${tx('absent')}</span><span><b style="color:var(--warn)">৳</b> ${tx('payment')}</span></div></div>
      ${D.subjects.length > 1 && att.length ? `<div class="card"><h3>${tx('bySubject')}</h3>${D.subjects.map(su => { const a = att.filter(x => x.s === su.id), p = a.filter(x => x.p).length, q = a.length ? Math.round((p / a.length) * 100) : 0;
        return `<div style="margin:10px 0"><div class="bar" style="margin:0 0 4px"><span class="grow">${esc(su.name)}</span><b>${num(q)}%</b><span class="sm mut">${num(p)}/${num(a.length)}</span></div><div class="meter"><i style="width:${q}%"></i></div></div>`; }).join('')}</div>` : ''}`;
  } else if (S.ui.ptab === 'fee') {
    const sc = s.plan === 'monthly' ? f.sc.slice().reverse().slice(0, 12) : f.sc, pays = D.payments.slice().sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1));
    tab = `<div class="card"><div class="sm mut">${tx('plan')}: <b style="color:var(--ink)">${tx(s.plan === 'full' ? 'full' : 'monthly')}</b> · ${tk(s.fee)}${s.plan === 'monthly' ? tx('perMonth') : ''} · ${tx('cash')}</div>
      ${f.dueAmt ? `<div class="info bad"><b>${tx('due')}: ${tk(f.dueAmt)}</b><br>${f.over.map(eLabel).join(', ')}</div>` : `<div class="info good">✓ ${f.paidUntil ? tx('paidUntil') + ' ' + fd(f.paidUntil) : tx('allPaid')}</div>`}
      ${!f.dueAmt && f.next ? `<div class="sm mut" style="margin-top:8px">${tx('nextDue')}: ${eLabel(f.next)} · ${tk(f.next.amount - f.next.paid)}</div>` : ''}</div>
      <div class="card"><h3>${tx('schedule')}</h3>${sc.map(e => { const cl = e.paid >= e.amount ? 'ok' : e.due <= today() ? 'due' : 'soon'; return `<div class="row"><div class="grow"><b>${eLabel(e)}</b><div class="sm mut">${fd(e.due)}</div></div><div style="text-align:right"><b>${tk(e.amount)}</b><div><span class="pill ${cl}">${e.paid >= e.amount ? '✓ ' + tx('paid') : e.paid > 0 ? tk(e.paid) + ' ' + tx('paid') : e.due <= today() ? tx('due') : tx('dueSoon')}</span></div></div></div>`; }).join('')}</div>
      <div class="card"><h3>${tx('payments')}</h3>${pays.length ? pays.map(p => `<div class="row"><div class="grow">${fd(p.paid_on)}</div><b>${tk(p.amount)}</b></div>`).join('') : `<p class="mut">${tx('noPay')}</p>`}</div>`;
  } else {
    tab = `<div class="card">${ex.length ? ex.map(x => { const e = x.e; return `<div class="row"><div class="grow"><div>${e.subject ? `<span class="subj">${esc(e.subject)}</span>` : ''}<b>${esc(e.topic || '')}</b></div>
      <div class="sm mut">${e.type ? esc(e.type) + ' · ' : ''}${fd(e.held_on)}${x.ab ? '' : ` · ${tx('rank')} ${num(e.rank)}/${num(e.of)}`}</div>
      ${x.ab ? '' : `<div class="sm">${e.has_mcq ? `MCQ ${num(Number(e.mcq) || 0)}/${num(Number(e.mcq_full))}` : ''}${e.has_mcq && e.has_written ? ' · ' : ''}${e.has_written ? `${tx('written')} ${num(Number(e.written) || 0)}/${num(Number(e.written_full))}` : ''} · <b>${num(x.tot)}/${num(x.full)}</b>${x.failPart ? ` · <span style="color:var(--bad)">${tx('failPart')}</span>` : ''}</div>`}</div>
      ${x.ab ? `<span class="pill due">${tx('absent')}</span>` : `<div style="text-align:center"><span class="grade ${gradeCls(x.g)}">${x.g}</span><div class="sm mut">${num(Math.round(x.pct))}% · ${GPA[x.g]}</div></div>`}</div>`; }).join('') : `<p class="mut">${tx('noExam')}</p>`}</div>`;
  }
  $('#root').innerHTML = `<main class="pub">${top}
    <div class="hero"><div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">${c.logo_url ? `<img class="clogo sm" src="${esc(c.logo_url)}" alt="">` : `<div class="logo" style="background:#fff;color:var(--hero)">${esc(c.name[0])}</div>`}<b>${esc(c.name)}</b></div>
      <div style="display:flex;gap:14px;align-items:center">${av(s.name, 'big')}<div><h2 style="margin:0">${esc(s.name)}</h2><div class="mut sm">${esc(D.batch.name)}${D.batch.label ? ' (' + esc(D.batch.label) + ')' : ''}</div>
      <div class="mut sm">${tx('admitted')}: ${fd(s.admit_date)}${s.status === 'left' ? ' · ' + tx('left') : ''}</div></div></div>
      <div style="margin-top:12px">${D.subjects.map(x => `<div class="schedrow"><b>${esc(x.name)}</b><span>${subjSched(x) || '—'}</span></div>`).join('')}</div>
      <div class="trio"><div><b>${num(pct)}%</b><span>${tx('attendance')}</span></div><div><b>${f.dueAmt ? tk(f.dueAmt) : s.plan === 'monthly' ? (f.paidUntil ? fd(f.paidUntil) : '—') : '✓'}</b><span>${f.dueAmt ? tx('due') : tx('paidUntil')}</span></div><div><b>${avg == null ? '—' : num(avg) + '%'}</b><span>${tx('avgMarks')}</span></div></div></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="${S.ui.ptab === k ? 'on' : ''}" data-a="tab" data-v="${k}">${l}</button>`).join('')}</div>${tab}
    ${c.phone ? `<a class="btn wide" href="tel:${esc(c.phone)}">📞 ${tx('call')} · ${num(esc(c.phone))}</a>` : ''}</main>`;
}
S.render = render;
document.addEventListener('click', e => {
  const n = e.target.closest('[data-act=calNav]'); if (n) { e.preventDefault(); return ACT.calNav(n); }
  const a = e.target.closest('[data-a]'); if (!a) return; e.preventDefault();
  if (a.dataset.a === 'lang') { prefs.lang = isBn() ? 'en' : 'bn'; savePrefs(); render(); }
  if (a.dataset.a === 'tab') { S.ui.ptab = a.dataset.v; keepScroll(render); }
});
(async () => {
  render();
  const key = new URLSearchParams(location.search).get('k') || '';
  if (!configured()) { error = 'setup'; return render(); }
  try {
    const sb = await getClient();
    const { data, error: err } = await sb.rpc('get_student_page', { p_key: key });
    if (err) error = 'err'; else if (data.error) error = data.error === 'inactive' ? 'inactive' : 'notFound'; else D = data;
  } catch (e) { error = 'err'; }
  render();
})();
