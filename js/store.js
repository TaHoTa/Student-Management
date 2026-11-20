// App state, permissions and data loading for the current centre
import { today, addDays } from './dates.js';

export const S = {
  sb: null, user: null, profile: null, centre: null, member: null,
  readOnly: false,     // super admin viewing through support access
  recovery: false,     // password-reset mode
  data: emptyData(),
  names: {},           // user_id -> name (taken by / received by)
  ui: { q: '', fb: 'all', authMode: 'login', superTab: 'pending', rtab: 'new' }
};
export function emptyData() {
  return { batches: [], subjects: [], feeRules: [], examTypes: [], students: [], studSubj: [], feeHist: [],
           payments: [], sessions: [], attendance: [], exams: [], marks: [], requests: [] };
}

// ---------- permissions ----------
export const isOwner = () => !S.readOnly && S.member?.role === 'owner';
export const can = p => !S.readOnly && (S.member?.role === 'owner' || !!S.member?.perms?.[p]);
export const canSee = p => S.readOnly || can(p);                  // view-only checks
export const myBatchIds = () => (S.member?.role === 'staff' ? S.member.batch_ids || [] : S.data.batches.map(b => b.id));
export const myBatches = () => S.data.batches.filter(b => myBatchIds().includes(b.id));

// ---------- loading ----------
export async function must(q) { const { data, error } = await q; if (error) throw error; return data; }
// Supabase returns max 1000 rows per request: page through bigger tables
export async function fetchAll(make) {
  const out = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const rows = await must(make().range(from, from + size - 1));
    out.push(...rows); if (rows.length < size) break;
  }
  return out;
}
export const ATT_DAYS = 150;   // attendance window kept in memory (full history loads per student)

export async function loadCentreData() {
  const sb = S.sb, c = S.centre.id, since = addDays(today(), -ATT_DAYS);
  const [batches, subjects, feeRules, examTypes, students, studSubj, feeHist, payments, sessions, attendance, exams, marks, requests, names] = await Promise.all([
    must(sb.from('batches').select('*').eq('centre_id', c).order('sort').order('created_at')),
    must(sb.from('subjects').select('*').eq('centre_id', c).order('sort')),
    must(sb.from('fee_rules').select('*').eq('centre_id', c)),
    must(sb.from('exam_types').select('*').eq('centre_id', c)),
    fetchAll(() => sb.from('students').select('*').eq('centre_id', c).order('name')),
    fetchAll(() => sb.from('student_subjects').select('*').eq('centre_id', c)),
    fetchAll(() => sb.from('fee_history').select('*').eq('centre_id', c)),
    fetchAll(() => sb.from('payments').select('*').eq('centre_id', c).order('paid_on')),
    fetchAll(() => sb.from('class_sessions').select('*').eq('centre_id', c).gte('held_on', since)),
    fetchAll(() => sb.from('attendance').select('session_id,student_id,present,class_sessions!inner(held_on)').eq('centre_id', c).gte('class_sessions.held_on', since)),
    must(sb.from('exams').select('*').eq('centre_id', c).order('held_on', { ascending: false })),
    fetchAll(() => sb.from('marks').select('*').eq('centre_id', c)),
    must(sb.from('enrol_requests').select('*').eq('centre_id', c).order('created_at', { ascending: false }).limit(300)),
    S.sb.rpc('centre_names', { c }).then(r => r.data || [])
  ]);
  attendance.forEach(a => delete a.class_sessions);
  S.data = { batches, subjects, feeRules, examTypes, students, studSubj, feeHist, payments, sessions, attendance, exams, marks, requests };
  S.names = Object.fromEntries(names.map(n => [n.user_id, n.full_name]));
}

// ---------- lookups ----------
export const batchOf = id => S.data.batches.find(b => b.id === id);
export const subjectOf = id => S.data.subjects.find(s => s.id === id);
export const subjectsOf = batchId => S.data.subjects.filter(s => s.batch_id === batchId).sort((a, b) => a.sort - b.sort);
export const studentOf = id => S.data.students.find(s => s.id === id);
export const subjIdsOf = sid => S.data.studSubj.filter(x => x.student_id === sid).map(x => x.subject_id);
export const subjectsOfStudent = sid => { const ids = new Set(subjIdsOf(sid)); return S.data.subjects.filter(s => ids.has(s.id)).sort((a, b) => a.sort - b.sort); };
export const typesOf = batchId => S.data.examTypes.filter(x => x.batch_id === batchId);
export const myStudents = () => { const ids = new Set(myBatchIds()); return S.data.students.filter(s => ids.has(s.batch_id)); };
export const feeFor = (batchId, count, plan) => {
  const r = S.data.feeRules.find(f => f.batch_id === batchId && f.subject_count === count);
  if (!r) return null;
  return plan === 'full' ? r.full_course_fee : r.monthly_fee;
};
export const batchTitle = b => (b ? b.name + (b.label ? ` (${b.label})` : '') : '—');
export const nameOf = uid => S.names[uid] || '';
