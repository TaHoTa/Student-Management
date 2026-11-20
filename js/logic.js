// Business rules: fee cycles & dues, exam results (BD SSC/HSC grading)
import { S, batchOf } from './store.js';
import { today, addDays, addMonths, diffDays } from './dates.js';

// ---------- fees ----------
// Monthly: anniversary cycles (admitted 15 Jan → 15 Jan–14 Feb, 15 Feb–14 Mar …), due on the first day of each cycle.
// Full course: one payment due on admission. Fee changes (fee_history) apply from their effective date.
// Pure versions (also used by the public student page): s = student, endDate = batch end,
// pays = this student's payments, hist = this student's fee_history rows.
function feeAt(s, hist, date) {
  const h = hist.filter(x => x.effective_from <= date).sort((a, b) => (a.effective_from < b.effective_from ? -1 : 1));
  return h.length ? Number(h[h.length - 1].fee) : Number(s.fee);
}
export function scheduleFor(s, endDate, hist) {
  const T = today(), out = [];
  if (s.plan === 'monthly') {
    for (let k = 0; k < 120; k++) {
      const from = addMonths(s.admit_date, k);
      if (endDate && from > endDate) break;
      if (s.status === 'left' && from > T) break;
      out.push({ from, to: addDays(addMonths(s.admit_date, k + 1), -1), due: from, amount: feeAt(s, hist, from) });
      if (from > T) break;
    }
  } else out.push({ full: true, due: s.admit_date, amount: Number(s.fee) });
  return out;
}
export function feeStateFor(s, endDate, payments, hist) {
  const T = today(), sc = scheduleFor(s, endDate, hist);
  const pays = payments.slice().sort((a, b) => (a.paid_on < b.paid_on ? -1 : 1));
  let pool = pays.reduce((a, p) => a + Number(p.amount), 0); const totalPaid = pool;
  sc.forEach(e => { e.paid = Math.min(pool, e.amount); pool -= e.paid; });
  const cov = {}; let i = 0, left = sc[0] ? sc[0].amount : 0;
  pays.forEach(p => { let a = Number(p.amount); cov[p.id] = []; while (a > 0 && i < sc.length) { const x = Math.min(a, left); if (x > 0) cov[p.id].push(i); a -= x; left -= x; if (left <= 0) { i++; left = sc[i] ? sc[i].amount : 0; } } });
  const unpaid = sc.filter(e => e.paid < e.amount), over = unpaid.filter(e => e.due <= T), next = unpaid[0];
  const dueAmt = over.reduce((a, e) => a + e.amount - e.paid, 0);
  const status = s.status === 'left' && !over.length ? 'ok' : over.length ? 'due' : next && diffDays(T, next.due) <= 5 ? 'soon' : 'ok';
  const done = sc.filter(e => e.paid >= e.amount);
  return { sc, cov, over, next, unpaid, dueAmt, status, totalPaid, advance: pool,
    lateDays: over.length ? diffDays(over[0].due, T) : 0,
    paidUntil: s.plan === 'monthly' && done.length ? done[done.length - 1].to : null };
}
// App versions (read from the loaded centre data)
export const schedule = s => scheduleFor(s, batchOf(s.batch_id)?.end_date, S.data.feeHist.filter(h => h.student_id === s.id));
export const feeState = s => feeStateFor(s, batchOf(s.batch_id)?.end_date, S.data.payments.filter(p => p.student_id === s.id), S.data.feeHist.filter(h => h.student_id === s.id));
export const owe = f => (f.status === 'due' ? f.dueAmt : f.next ? f.next.amount - f.next.paid : 0);
// suggested amount for n months (or what is due for a full-course student)
export function suggestAmount(s, f, n) {
  if (s.plan !== 'monthly') return f.dueAmt || (f.unpaid[0] ? f.unpaid[0].amount - f.unpaid[0].paid : 0);
  let a = 0; f.unpaid.slice(0, n).forEach(e => (a += e.amount - e.paid));
  return a + Math.max(0, n - f.unpaid.length) * Number(s.fee);
}
// the first day of the next cycle after today (used when a monthly fee changes)
export function nextCycleStart(s) {
  const T = today(); for (let k = 0; k < 240; k++) { const d = addMonths(s.admit_date, k); if (d > T) return d; } return T;
}

// ---------- exams ----------
export const partPass = (full, pass) => (pass != null && pass !== '' ? Number(pass) : Math.ceil(Number(full) * 0.33));
export const bdGrade = pct => (pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'A-' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : pct >= 33 ? 'D' : 'F');
export const GPA = { 'A+': '5.00', A: '4.00', 'A-': '3.50', B: '3.00', C: '2.00', D: '1.00', F: '0.00' };
export const gradeCls = g => 'g-' + g.replace('+', 'p').replace('-', 'm');
export const examFull = e => (e.has_mcq ? Number(e.mcq_full) || 0 : 0) + (e.has_written ? Number(e.written_full) || 0 : 0);
export function results(e) {
  const full = examFull(e);
  const rows = S.data.marks.filter(m => m.exam_id === e.id).map(m => {
    if (m.absent) return { sid: m.student_id, ab: true };
    const mcq = e.has_mcq ? Number(m.mcq) || 0 : 0, wr = e.has_written ? Number(m.written) || 0 : 0, tot = mcq + wr;
    const pct = full ? (tot * 100) / full : 0;
    const failPart = (e.has_mcq && mcq < partPass(e.mcq_full, e.mcq_pass)) || (e.has_written && wr < partPass(e.written_full, e.written_pass));
    return { sid: m.student_id, mcq: m.mcq, wr: m.written, tot, pct, g: failPart ? 'F' : bdGrade(pct), failPart };
  });
  const ok = rows.filter(r => !r.ab).sort((a, b) => b.tot - a.tot);
  ok.forEach(r => (r.rank = 1 + ok.filter(x => x.tot > r.tot).length));
  return { full, ok, rows: ok.concat(rows.filter(r => r.ab)) };
}
// grade one student's marks for one exam (used by the public student page)
export function gradeOne(e, mcq, written) {
  const full = examFull(e), m = e.has_mcq ? Number(mcq) || 0 : 0, w = e.has_written ? Number(written) || 0 : 0, tot = m + w, pct = full ? (tot * 100) / full : 0;
  const failPart = (e.has_mcq && m < partPass(e.mcq_full, e.mcq_pass)) || (e.has_written && w < partPass(e.written_full, e.written_pass));
  return { full, tot, pct, failPart, g: failPart ? 'F' : bdGrade(pct) };
}
