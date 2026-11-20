-- =====================================================================
-- upgrade_from_phase1.sql
-- ONLY if you already ran the Phase 1 version of 01_schema.sql.
-- (Fresh install? Skip this file — 01_schema.sql already has everything.)
-- Safe to run more than once.
-- =====================================================================
alter table public.batches  add column if not exists show_on_page boolean not null default true;
alter table public.batches  add column if not exists page_note text;
alter table public.subjects add column if not exists seat_full boolean not null default false;
alter table public.enrol_requests add column if not exists whatsapp text;
alter table public.students add column if not exists whatsapp text;
alter table public.enrol_requests add column if not exists school text;

drop function if exists public.submit_enrolment(text, text, text, text, text, text, text);
drop table if exists public.course_info;

-- 8g. PUBLIC: enrolment page content (works without login).
--     Built from the centre's own batches: only batches switched "show on page";
--     each subject carries its seat_full flag; batch is full when every subject is full.
create or replace function public.get_public_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c centres; moved text;
begin
  select * into c from centres where slug = lower(p_slug);
  if not found then
    select ce.slug into moved from slug_history h join centres ce on ce.id = h.centre_id where h.old_slug = lower(p_slug);
    if moved is not null then return jsonb_build_object('redirect', moved); end if;
    return jsonb_build_object('error', 'not_found');
  end if;
  if c.status <> 'active' then return jsonb_build_object('error', 'inactive'); end if;
  return jsonb_build_object(
    'name', c.name, 'logo_url', c.logo_url, 'phone', c.phone, 'address', c.address, 'slug', c.slug,
    'batches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', b.name, 'label', b.label, 'note', b.page_note, 'full_course_on', b.full_course_on,
        'subjects', (select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'days', s.days,
                       'time', to_char(s.start_time, 'HH24:MI'), 'full', s.seat_full) order by s.sort), '[]'::jsonb)
                     from subjects s where s.batch_id = b.id),
        'all_full', not exists (select 1 from subjects s where s.batch_id = b.id and not s.seat_full)
                    and exists (select 1 from subjects s where s.batch_id = b.id),
        'fees', (select coalesce(jsonb_agg(jsonb_build_object('n', f.subject_count, 'monthly', f.monthly_fee,
                   'full', case when b.full_course_on then f.full_course_fee end) order by f.subject_count), '[]'::jsonb)
                 from fee_rules f where f.batch_id = b.id)
      ) order by b.sort, b.created_at)
      from batches b where b.centre_id = c.id and b.active and b.show_on_page), '[]'::jsonb));
end $$;

-- 8h. PUBLIC: submit an admission request (validated + rate limited)
--     Required: name, student phone, guardian phone. Optional: WhatsApp (number or username), school, message.
create or replace function public.submit_enrolment(p_slug text, p_name text, p_phone text, p_whatsapp text, p_school text,
                                                   p_guardian_phone text, p_message text, p_trap text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid; ph text; gph text;
begin
  if coalesce(p_trap, '') <> '' then return jsonb_build_object('ok', true); end if;      -- spam bot honeypot
  select id into cid from centres where slug = lower(p_slug) and status = 'active';
  if cid is null then raise exception 'not_found'; end if;
  ph := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if ph like '880%' then ph := substr(ph, 3); end if;
  if ph !~ '^01[3-9][0-9]{8}$' then raise exception 'bad_phone'; end if;
  gph := regexp_replace(coalesce(p_guardian_phone, ''), '[^0-9]', '', 'g');
  if gph like '880%' then gph := substr(gph, 3); end if;
  if gph !~ '^01[3-9][0-9]{8}$' then raise exception 'bad_guardian_phone'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'bad_name'; end if;
  if char_length(coalesce(p_message, '')) > 1000 or char_length(coalesce(p_whatsapp, '')) > 60
     or char_length(coalesce(p_school, '')) > 120 then raise exception 'too_long'; end if;
  if (select count(*) from enrol_requests where centre_id = cid and phone = ph and created_at > now() - interval '1 day') >= 3
     or (select count(*) from enrol_requests where centre_id = cid and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited'; end if;
  insert into enrol_requests (centre_id, name, phone, whatsapp, school, guardian_phone, message)
  values (cid, trim(p_name), ph, nullif(trim(coalesce(p_whatsapp, '')), ''), nullif(trim(coalesce(p_school, '')), ''),
          gph, nullif(trim(coalesce(p_message, '')), ''));
  return jsonb_build_object('ok', true);
end $$;

-- 8i. Names of people in a centre (to show "taken by" / "received by")
create or replace function public.centre_names(c uuid)
returns table (user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_member(c) or public.support_ok(c)) then raise exception 'not allowed'; end if;
  return query select m.user_id, coalesce(p.full_name, split_part(p.email, '@', 1))
               from members m join profiles p on p.id = m.user_id where m.centre_id = c;
end $$;

revoke all on function public.get_public_page(text), public.submit_enrolment(text, text, text, text, text, text, text, text), public.centre_names(uuid) from public, anon;
grant execute on function public.get_public_page(text) to anon, authenticated;
grant execute on function public.submit_enrolment(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.centre_names(uuid) to authenticated;
