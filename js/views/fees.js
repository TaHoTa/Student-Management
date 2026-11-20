// Fees (cash): month total vs target, dues, by batch, payment list; "collect fee" sheet with receipt
import { S, can, canSee, isOwner, loadCentreData, batchOf, studentOf, myStudents, batchTitle, nameOf, must } from '../store.js';
import { t, num, tk, fd, MONF } from '../i18n.js';
import { today, addMonths } from '../dates.js';
import { ACT, INP, esc, toast, sheet, closeSheet, head, busy, empty, av, pill, ring, waBtn, val, dateField, getDate, keepScroll, confetti, $ } from '../ui.js';
import { feeState, owe, suggestAmount } from '../logic.js';
import { errText } from '../db.js';

export const eLabel = e => (e.full ? t('fullCourse') : fd(e.from) + ' – ' + fd(e.to));

export function feesView() {
  if (!S.ui.fm) S.ui.fm = today().slice(0, 7);
  const ym = S.ui.fm, [y, m] = ym.split('-').map(Number);
  const ps = S.data.payments.filter(p => p.paid_on.startsWith(ym)).sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1));
  const tot = ps.reduce((a, p) => a + Number(p.amount), 0);
  const act = myStudents().filter(s => s.status === 'active');
  let tg = 0; if (ym <= today().slice(0, 7)) act.forEach(s => feeState(s).sc.forEach(e => { if (e.due.slice(0, 7) === ym) tg += e.amount; }));
  const g = {}; ps.forEach(p => { const s = studentOf(p.student_id); const k = s ? batchTitle(batchOf(s.batch_id)) : '?'; g[k] = (g[k] || 0) + Number(p.amount); });
  const dues = act.map(s => ({ s, f: feeState(s) })).filter(x => x.f.status !== 'ok').sort((a, b) => (a.f.status === 'due' ? 0 : 1) - (b.f.status === 'due' ? 0 : 1) || b.f.lateDays - a.f.lateDays);
  const navBtn = d => `<button class="ib" data-act="fmNav" data-d="${d}" style="background:rgba(255,255,255,.18);color:#fff;border:0" aria-label="${d < 0 ? 'previous' : 'next'}">${d < 0 ? '‹' : '›'}</button>`;
  return `<div class="hero"><div class="calhead">${navBtn(-1)}<b>${MONF()[m - 1]} ${num(y)}</b>${navBtn(1)}</div>
    <div class="herorow" style="margin-top:4px">${tg ? ring(tot / tg, 100) : ''}<div><div class="mut sm">${t('collected')} (${t('cash')})</div><div class="big">${tk(tot)}</div>${tg ? `<div class="sm mut">${t('target')} ${tk(tg)}</div>` : ''}<div class="sm mut">${t('nPayments', { n: num(ps.length) })}</div></div></div></div>
  ${can('payments') ? `<button class="btn pri wide huge" style="margin:0 0 14px" data-act="pay">৳ ${t('qPay')}</button>` : ''}
  <div class="cols"><div>
    <div class="card"><h3>${t('dueList')} ${dues.filter(x => x.f.status === 'due').length ? `<span class="pill due">${num(dues.filter(x => x.f.status === 'due').length)}</span>` : ''}</h3>
    ${dues.length ? dues.map(({ s, f }) => `<div class="row">${av(s.name)}<div class="grow click" data-go="student-${s.id}"><b>${esc(s.name)}</b><div>${pill(f)}</div></div><b>${tk(owe(f))}</b>
      ${f.status === 'due' ? waBtn(s.guardian_phone || s.phone, t('msgRemind', { c: S.centre.name, n: s.name, x: tk(f.dueAmt), p: f.over.map(eLabel).join(', ') }), '💬') : ''}
      ${can('payments') ? `<button class="btn sm" data-act="pay" data-id="${s.id}">${t('collect')}</button>` : ''}</div>`).join('') : empty('🎉', t('allClear'))}</div>
    <div class="card"><h3>${t('byBatch')}</h3>${Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div style="margin:10px 0"><div class="bar" style="margin:0 0 4px"><span class="grow">${esc(k)}</span><b>${tk(v)}</b></div><div class="meter ac"><i style="width:${tot ? (v / tot) * 100 : 0}%"></i></div></div>`).join('') || empty('🪙', t('noPay'))}</div></div>
  <div class="card"><h3>${t('payHistory')}</h3>${ps.length ? ps.map(p => { const s = studentOf(p.student_id); return s ? `<div class="row click" data-go="student-${s.id}">${av(s.name)}<div class="grow"><b>${esc(s.name)}</b><div class="sm mut">${fd(p.paid_on)}${nameOf(p.received_by) ? ' · ' + esc(nameOf(p.received_by)) : ''}${p.note ? ' · ' + esc(p.note) : ''}</div></div><b>${tk(p.amount)}</b></div>` : ''; }).join('') : empty('🪙', t('noPay'))}</div></div>`;
}
ACT.fmNav = el => { S.ui.fm = addMonths(S.ui.fm + '-01', +el.dataset.d).slice(0, 7); keepScroll(S.render); };

// ---------- collect fee sheet ----------
let Pay = null;
ACT.pay = el => { closeSheet(); Pay = { sid: el.dataset.id || null, n: 1, q: '', step: el.dataset.id ? 'form' : 'pick', amt: null, date: today() }; draw(); };
function list() {
  const q = Pay.q.toLowerCase(), o = { due: 0, soon: 1, ok: 2 };
  return myStudents().filter(s => s.status === 'active').map(s => ({ s, f: feeState(s) }))
    .filter(x => !q || x.s.name.toLowerCase().includes(q) || x.s.phone.includes(q))
    .sort((a, b) => o[a.f.status] - o[b.f.status] || a.s.name.localeCompare(b.s.name))
    .map(({ s, f }) => `<div class="row click" data-act="payPick" data-id="${s.id}">${av(s.name)}<div class="grow"><b>${esc(s.name)}</b><div class="sm mut">${esc(batchOf(s.batch_id)?.label || '')}</div></div><div style="text-align:right">${f.status !== 'ok' ? `<b>${tk(owe(f))}</b><div>${pill(f)}</div>` : pill(f)}</div></div>`).join('') || empty('🔍', t('none'));
}
function draw() {
  if (Pay.step === 'pick') { sheet(head(t('whoPays')) + `<input type="search" data-inp="payQ" placeholder="🔍 ${t('search')}" value="${esc(Pay.q)}" style="margin-top:6px"><div id="plist">${list()}</div>`); return; }
  const s = studentOf(Pay.sid), f = feeState(s), isM = s.plan === 'monthly';
  if (Pay.step === 'done') {
    const p = S.data.payments.find(x => x.id === Pay.pid); if (!p) return closeSheet();
    const cv = (f.cov[p.id] || []).map(i => eLabel(f.sc[i])).join(', ') || t('advance');
    sheet(`<div class="done"><div class="bigcheck">✓</div><div class="big">${tk(p.amount)}</div><h3 style="justify-content:center;margin:4px 0">${t('received')}</h3><p style="margin:0"><b>${esc(s.name)}</b> · ${t('cash')}</p>
      <p class="mut sm" style="margin:4px 0 0">${cv}${f.paidUntil ? '<br>' + t('paidUntil') + ': <b>' + fd(f.paidUntil) + '</b>' : ''}</p>
      ${waBtn(s.guardian_phone || s.phone, t('msgReceipt', { c: S.centre.name, n: s.name, x: tk(p.amount), d: fd(p.paid_on), p: cv }), '🧾 ' + t('sendReceipt'), 'wide huge')}
      <button class="btn pri wide" data-act="closeSheet">${t('done')}</button>${isOwner() ? `<button class="btn ghost wide" data-act="payUndo">↩ ${t('undo')}</button>` : ''}</div>`);
    return;
  }
  if (Pay.amt == null) Pay.amt = suggestAmount(s, f, Pay.n);
  sheet(head(t('qPay')) + `<div class="who">${av(s.name, 'big')}<div class="grow"><b style="font-size:18px">${esc(s.name)}</b><div class="sm mut">${esc(batchTitle(batchOf(s.batch_id)))}</div><div class="sm mut">${t(s.plan === 'full' ? 'fullCourse' : 'monthly')} · ${tk(s.fee)}${isM ? t('perMonth') : ''}</div></div><button class="btn sm" data-act="payChange">${t('change')}</button></div>
    ${f.dueAmt ? `<div class="info bad">${t('due')}: <b>${tk(f.dueAmt)}</b> — ${f.over.map(eLabel).join(', ')}</div>` : f.next ? `<div class="info">${t('nextDue')}: <b>${eLabel(f.next)}</b></div>` : `<div class="info good">✓ ${t('paid')}</div>`}
    ${isM ? `<div class="lab">${t('months')}</div><div class="chips" style="margin-top:6px">${[1, 2, 3, 4, 6].map(k => `<button class="chip ${k === Pay.n ? 'on' : ''}" data-act="payMonths" data-n="${k}" style="min-width:52px">${num(k)}</button>`).join('')}</div>` : ''}
    <div class="lab">৳ ${t('cash')}</div><div class="amtbox"><span>৳</span><input id="payAmt" data-inp="payAmt" type="number" inputmode="numeric" value="${Pay.amt}" aria-label="${t('amount')}"></div>
    ${dateField('payDate', t('date'), Pay.date)}
    <label>${t('note')}<input id="payNote" placeholder="${t('optional')}"></label>
    <button class="btn pri wide huge" id="payBtn" data-act="paySave">✓ ${t('receive')} ${tk(Pay.amt)}</button>`);
}
INP.payQ = el => { Pay.q = el.value; $('#plist').innerHTML = list(); };
INP.payAmt = el => { Pay.amt = Number(el.value) || 0; $('#payBtn').textContent = '✓ ' + t('receive') + ' ' + tk(Pay.amt); };
ACT.payPick = el => { Pay.sid = el.dataset.id; Pay.step = 'form'; Pay.amt = null; draw(); };
ACT.payChange = () => { Pay.step = 'pick'; draw(); };
ACT.payMonths = el => { Pay.date = getDate('payDate') || Pay.date; Pay.n = +el.dataset.n; Pay.amt = null; const y = $('#sbox').scrollTop; draw(); $('#sbox').scrollTop = y; };
ACT.paySave = async el => {
  const amt = Number(val('payAmt')); if (!(amt > 0)) return toast(t('needAmount'));
  busy(el, true);
  try {
    const row = { centre_id: S.centre.id, student_id: Pay.sid, amount: amt, paid_on: getDate('payDate') || today(), method: 'Cash', note: val('payNote').trim() || null };
    const p = await must(S.sb.from('payments').insert(row).select().single());
    S.data.payments.push(p); Pay.step = 'done'; Pay.pid = p.id; keepScroll(S.render); draw(); confetti();
  } catch (e) { busy(el, false); toast(errText(e, t)); }
};
ACT.payUndo = async el => {
  busy(el, true);
  try { await must(S.sb.from('payments').delete().eq('id', Pay.pid)); S.data.payments = S.data.payments.filter(x => x.id !== Pay.pid); closeSheet(); keepScroll(S.render); toast(t('undone')); }
  catch (e) { busy(el, false); toast(errText(e, t)); }
};
