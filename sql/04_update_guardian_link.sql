-- =====================================================================
-- 04_update_guardian_link.sql
-- Run ONCE in Supabase → SQL Editor (after 01/02 or the Phase 1 upgrade).
-- Adds: private guardian link per student (student.html?k=…).
-- Payment correction needs no database change (owner could already edit/delete).
-- Safe to run more than once.
-- =====================================================================
alter table public.students add column if not exists share_key text;
create unique index if not exists students_share_key_idx on public.students (share_key);

-- 8j. Guardian link: create (or reset) the private key for one student's read-only page.
--     Owner, or staff with the "students" permission for that batch.
create or replace function public.student_share_key(p_student uuid, p_reset boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare st students; k text;
begin
  select * into st from students where id = p_student;
  if not found or not (public.has_perm(st.centre_id, 'students') and public.batch_ok(st.centre_id, st.batch_id)) then
    raise exception 'not allowed'; end if;
  if st.share_key is not null and not p_reset then return st.share_key; end if;
  -- 64 random hex characters (two random UUIDs) — impossible to guess
  k := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update students set share_key = k where id = p_student;
  perform public.audit(st.centre_id, case when p_reset then 'share_link_reset' else 'share_link_created' end, jsonb_build_object('student', p_student));
  return k;
end $$;

-- 8k. PUBLIC: one student's read-only page (student.html?k=…). No phone numbers, notes or other students' names.
create or replace function public.get_student_page(p_key text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s students; c centres; b batches;
begin
  if p_key is null or char_length(p_key) < 32 then return jsonb_build_object('error', 'not_found'); end if;
  select * into s from students where share_key = p_key;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  select * into c from centres where id = s.centre_id;
  if c.status <> 'active' then return jsonb_build_object('error', 'inactive'); end if;
  select * into b from batches where id = s.batch_id;
  return jsonb_build_object(
    'centre', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'phone', c.phone, 'address', c.address),
    'student', jsonb_build_object('name', s.name, 'admit_date', s.admit_date, 'status', s.status, 'plan', s.plan, 'fee', s.fee, 'school', s.school),
    'batch', jsonb_build_object('name', b.name, 'label', b.label, 'end_date', b.end_date),
    'subjects', (select coalesce(jsonb_agg(jsonb_build_object('id', sj.id, 'name', sj.name, 'days', sj.days, 'time', to_char(sj.start_time, 'HH24:MI')) order by sj.sort), '[]'::jsonb)
                 from student_subjects ss join subjects sj on sj.id = ss.subject_id where ss.student_id = s.id),
    'attendance', (select coalesce(jsonb_agg(jsonb_build_object('d', cs.held_on, 's', cs.subject_id, 'p', a.present) order by cs.held_on), '[]'::jsonb)
                   from attendance a join class_sessions cs on cs.id = a.session_id where a.student_id = s.id and cs.held_on >= s.admit_date),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'paid_on', p.paid_on, 'amount', p.amount) order by p.paid_on), '[]'::jsonb)
                 from payments p where p.student_id = s.id),
    'fee_history', (select coalesce(jsonb_agg(jsonb_build_object('effective_from', h.effective_from, 'fee', h.fee)), '[]'::jsonb)
                    from fee_history h where h.student_id = s.id),
    'exams', (select coalesce(jsonb_agg(q.x order by q.d desc), '[]'::jsonb) from (
       select e.held_on as d, jsonb_build_object('topic', e.topic, 'held_on', e.held_on, 'type', et.name, 'subject', sj.name,
         'has_mcq', e.has_mcq, 'mcq_full', e.mcq_full, 'mcq_pass', e.mcq_pass, 'has_written', e.has_written, 'written_full', e.written_full, 'written_pass', e.written_pass,
         'mcq', m.mcq, 'written', m.written, 'absent', m.absent,
         'rank', case when m.absent then null else 1 + (select count(*) from marks m2 where m2.exam_id = e.id and not m2.absent
                   and coalesce(case when e.has_mcq then m2.mcq end, 0) + coalesce(case when e.has_written then m2.written end, 0)
                     > coalesce(case when e.has_mcq then m.mcq end, 0) + coalesce(case when e.has_written then m.written end, 0)) end,
         'of', (select count(*) from marks m3 where m3.exam_id = e.id and not m3.absent)) as x
       from marks m join exams e on e.id = m.exam_id
       left join exam_types et on et.id = e.exam_type_id left join subjects sj on sj.id = e.subject_id
       where m.student_id = s.id) q));
end $$;

revoke all on function public.student_share_key(uuid, boolean), public.get_student_page(text) from public, anon;
grant execute on function public.student_share_key(uuid, boolean) to authenticated;
grant execute on function public.get_student_page(text) to anon, authenticated;
