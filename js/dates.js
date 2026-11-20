// Plain date helpers (local dates as "YYYY-MM-DD" strings)
const pad = n => String(n).padStart(2, '0');
export const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => iso(new Date());
export const parseD = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
export const dim = (y, m) => new Date(y, m + 1, 0).getDate();
// same day next month(s); clamps 31 → 30/28 etc.
export const addMonths = (s, n) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number); const t = new Date(y, m - 1 + n, 1);
  return iso(new Date(t.getFullYear(), t.getMonth(), Math.min(d, dim(t.getFullYear(), t.getMonth()))));
};
export const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
export { pad };
