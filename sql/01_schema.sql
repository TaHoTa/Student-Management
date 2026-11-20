-- =====================================================================
-- Student Management / কোচিং ব্যবস্থাপনা
-- 01_schema.sql — run once in Supabase → SQL Editor (as a whole file)
-- Covers ALL phases (1–5) so the database never needs restructuring.
-- Every centre-owned table carries centre_id; Row Level Security (RLS)
-- makes sure one coaching centre can never read another's data.
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+ (no extension needed)

-- ---------------------------------------------------------------------
-- 1. PLATFORM TABLES
-- ---------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  full_name      text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.centres (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 120),
  logo_url        text,
  phone           text,
  address         text,
  slug            text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  status          text not null default 'pending' check (status in ('pending','active','suspended')),
  owner_id        uuid references auth.users(id) on delete set null,
  support_until   timestamptz,                       -- super admin may read data until this time
  plan            text not null default 'free',      -- premium: hidden for now
  expires_at      timestamptz,
  premium_enabled boolean not null default false,
  created_at      timestamptz not null default now(),
  approved_at     timestamptz
);

create table public.slug_history (
  old_slug   text primary key,
  centre_id  uuid not null references public.centres(id) on delete cascade,
  changed_at timestamptz not null default now()
);

create table public.members (
  centre_id  uuid not null references public.centres(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','staff')),
  perms      jsonb not null default '{}'::jsonb,   -- staff: {"students":bool,"attendance":bool,"exams":bool,"payments":bool}
  batch_ids  uuid[] not null default '{}',         -- staff: batches they may work with
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (centre_id, user_id)
);

create table public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid not null references public.centres(id) on delete cascade,
  email       text not null,
  full_name   text,
  perms       jsonb not null default '{}'::jsonb,
  batch_ids   uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (centre_id, email)
);

create table public.app_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.app_settings values ('show_premium','false'::jsonb), ('trial_days','0'::jsonb);

create table public.audit_log (
  id        bigserial primary key,
  centre_id uuid references public.centres(id) on delete cascade,
  user_id   uuid default auth.uid(),
  action    text not null,
  detail    jsonb,
  at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. TEACHING TABLES  (composite FKs keep every child in the same centre)
-- ---------------------------------------------------------------------
create table public.batches (
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null references public.centres(id) on delete cascade,
  name           text not null,                    -- Aspirants Prime Batch
  label          text,                             -- HSC 28 / SSC 28 / Class 9
  start_date     date,
  end_date       date,
  full_course_on boolean not null default false,
  show_on_page   boolean not null default true,     -- advertise on the public enrolment page
  page_note      text,                              -- short note shown under the batch on that page
  active         boolean not null default true,
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  unique (id, centre_id)
);

create table public.subjects (
  id         uuid primary key default gen_random_uuid(),
  centre_id  uuid not null,
  batch_id   uuid not null,
  name       text not null,
  days       smallint[] not null default '{}',     -- 0=Sun … 6=Sat
  start_time time,
  seat_full  boolean not null default false,       -- shows "seat full" on the enrolment page
  sort       int not null default 0,
  unique (id, centre_id),
  foreign key (batch_id, centre_id) references public.batches(id, centre_id) on delete cascade
);

create table public.fee_rules (
  centre_id       uuid not null,
  batch_id        uuid not null,
  subject_count   smallint not null check (subject_count between 1 and 20),
  monthly_fee     numeric(10,2),
  full_course_fee numeric(10,2),
  primary key (batch_id, subject_count),
  foreign key (batch_id, centre_id) references public.batches(id, centre_id) on delete cascade
);

create table public.students (
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null references public.centres(id) on delete cascade,
  batch_id       uuid not null,
  name           text not null,
  phone          text not null,
  whatsapp       text,                             -- WhatsApp number or username
  guardian_name  text,
  guardian_phone text,
  school         text,
  admit_date     date not null default current_date,
  plan           text not null default 'monthly' check (plan in ('monthly','full','half','inst3','inst4')),
  fee            numeric(10,2) not null default 0,
  status         text not null default 'active' check (status in ('active','left')),
  note           text,
  created_at     timestamptz not null default now(),
  unique (id, centre_id),
  foreign key (batch_id, centre_id) references public.batches(id, centre_id)
);

create table public.student_subjects (
  centre_id  uuid not null,
  student_id uuid not null,
  subject_id uuid not null,
  primary key (student_id, subject_id),
  foreign key (student_id, centre_id) references public.students(id, centre_id) on delete cascade,
  foreign key (subject_id, centre_id) references public.subjects(id, centre_id) on delete cascade
);

create table public.fee_history (               -- fee changes take effect from a date (next cycle)
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null,
  student_id     uuid not null,
  effective_from date not null,
  fee            numeric(10,2) not null,
  note           text,
  created_at     timestamptz not null default now(),
  foreign key (student_id, centre_id) references public.students(id, centre_id) on delete cascade
);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  centre_id   uuid not null,
  student_id  uuid not null,
  paid_on     date not null default current_date,
  amount      numeric(10,2) not null check (amount > 0),
  method      text not null default 'Cash',
  note        text,
  received_by uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (student_id, centre_id) references public.students(id, centre_id) on delete cascade
);

create table public.class_sessions (
  id         uuid primary key default gen_random_uuid(),
  centre_id  uuid not null,
  batch_id   uuid not null,
  subject_id uuid,
  held_on    date not null,
  taken_by   uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, centre_id),
  unique (batch_id, subject_id, held_on),
  foreign key (batch_id, centre_id) references public.batches(id, centre_id) on delete cascade,
  foreign key (subject_id, centre_id) references public.subjects(id, centre_id) on delete set null (subject_id)
);

create table public.attendance (
  centre_id  uuid not null,
  session_id uuid not null,
  student_id uuid not null,
  present    boolean not null default true,
  primary key (session_id, student_id),
  foreign key (session_id, centre_id) references public.class_sessions(id, centre_id) on delete cascade,
  foreign key (student_id, centre_id) references public.students(id, centre_id) on delete cascade
);

create table public.exam_types (
  id        uuid primary key default gen_random_uuid(),
  centre_id uuid not null,
  batch_id  uuid not null,
  name      text not null,
  unique (id, centre_id),
  foreign key (batch_id, centre_id) references public.batches(id, centre_id) on delete cascade
);

create table public.exams (
  id           uuid primary key default gen_random_uuid(),
  centre_id    uuid not null,
  batch_id     uuid not null,
  subject_id   uuid,
  exam_type_id uuid,
  topic        text,
  held_on      date not null default current_date,
  has_mcq      boolean not null default true,
  mcq_full     numeric(6,2),
  mcq_pass     numeric(6,2),
  has_written  boolean not null default false,
  written_full numeric(6,2),
  written_pass numeric(6,2),
  created_at   timestamptz not null default now(),
  unique (id, centre_id),
  check (has_mcq or has_written),
  foreign key (batch_id, centre_id) references public.batches(id, centre_id) on delete cascade,
  foreign key (subject_id, centre_id) references public.subjects(id, centre_id) on delete set null (subject_id),
  foreign key (exam_type_id, centre_id) references public.exam_types(id, centre_id) on delete set null (exam_type_id)
);

create table public.marks (
  centre_id  uuid not null,
  exam_id    uuid not null,
  student_id uuid not null,
  mcq        numeric(6,2),
  written    numeric(6,2),
  absent     boolean not null default false,
  primary key (exam_id, student_id),
  foreign key (exam_id, centre_id) references public.exams(id, centre_id) on delete cascade,
  foreign key (student_id, centre_id) references public.students(id, centre_id) on delete cascade
);

create table public.enrol_requests (
  id             uuid primary key default gen_random_uuid(),
  centre_id      uuid not null references public.centres(id) on delete cascade,
  name           text not null,
  phone          text not null,
  guardian_name  text,
  guardian_phone text,
  whatsapp       text,
  school         text,
  message        text,
  status         text not null default 'new' check (status in ('new','contacted','student','rejected')),
  student_id     uuid references public.students(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- indexes
create index on public.members (user_id);
create index on public.subjects (batch_id);
create index on public.students (centre_id, batch_id);
create index on public.payments (centre_id, paid_on);
create index on public.payments (student_id);
create index on public.class_sessions (centre_id, held_on);
create index on public.attendance (student_id);
create index on public.exams (centre_id, batch_id);
create index on public.marks (student_id);
create index on public.enrol_requests (centre_id, status, created_at);
create index on public.audit_log (centre_id, at);

-- ---------------------------------------------------------------------
-- 3. HELPER FUNCTIONS used by the security rules
-- ---------------------------------------------------------------------
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;

-- role of the current user in an ACTIVE centre ('owner' | 'staff' | null)
create or replace function public.my_role(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from members m join centres ce on ce.id = m.centre_id
  where m.centre_id = c and m.user_id = auth.uid() and m.active and ce.status = 'active'
$$;

create or replace function public.is_owner(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role(c) = 'owner', false)
$$;

create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role(c) is not null
$$;

-- owner: always true; staff: only if that permission is ticked
create or replace function public.has_perm(c uuid, p text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role(c)
    when 'owner' then true
    when 'staff' then coalesce((select (perms ->> p)::boolean from members where centre_id = c and user_id = auth.uid()), false)
    else false end
$$;

-- owner: every batch; staff: only assigned batches
create or replace function public.batch_ok(c uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role(c)
    when 'owner' then true
    when 'staff' then exists (select 1 from members where centre_id = c and user_id = auth.uid() and b = any(batch_ids))
    else false end
$$;

-- super admin may READ a centre's data only while the owner allows support
create or replace function public.support_ok(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_super() and exists (select 1 from centres where id = c and support_until > now())
$$;

create or replace function public.student_batch(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select batch_id from students where id = s
$$;

create or replace function public.session_batch(s uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select batch_id from class_sessions where id = s
$$;

create or replace function public.exam_batch(e uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select batch_id from exams where id = e
$$;

create or replace function public.audit(c uuid, a text, d jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (centre_id, action, detail) values (c, a, d)
$$;

-- ---------------------------------------------------------------------
-- 4. GUARD TRIGGERS (columns users must not change directly)
-- ---------------------------------------------------------------------
create or replace function public.guard_centre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass', true), '') = 'on' or public.is_super() then
    return new;
  end if;
  -- owners may edit name, logo, phone, address only
  new.status := old.status; new.slug := old.slug; new.owner_id := old.owner_id;
  new.support_until := old.support_until; new.plan := old.plan; new.expires_at := old.expires_at;
  new.premium_enabled := old.premium_enabled; new.approved_at := old.approved_at; new.created_at := old.created_at;
  return new;
end $$;
create trigger guard_centre before update on public.centres for each row execute function public.guard_centre();

create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.bypass', true), '') <> 'on' then
    new.is_super_admin := old.is_super_admin;   -- nobody can promote themselves
    new.email := old.email;
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

create or replace function public.check_student_subject() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select batch_id from subjects where id = new.subject_id) is distinct from
     (select batch_id from students where id = new.student_id) then
    raise exception 'subject_not_in_student_batch';
  end if;
  return new;
end $$;
create trigger check_student_subject before insert or update on public.student_subjects
for each row execute function public.check_student_subject();

-- ---------------------------------------------------------------------
-- 5. SIGN-UP: create profile; owners get a PENDING centre; invited staff get linked
-- ---------------------------------------------------------------------
create or replace function public.slugify(t text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text; s text; cid uuid; inv record;
begin
  insert into profiles (id, email, full_name) values (new.id, lower(new.email), meta ->> 'full_name')
  on conflict (id) do nothing;

  -- invited staff: link to every centre that invited this email
  for inv in select * from staff_invites where email = lower(new.email) and accepted_at is null loop
    insert into members (centre_id, user_id, role, perms, batch_ids)
    values (inv.centre_id, new.id, 'staff', inv.perms, inv.batch_ids) on conflict do nothing;
    update staff_invites set accepted_at = now() where id = inv.id;
  end loop;

  -- coaching owner sign-up
  if coalesce(meta ->> 'signup_type', '') = 'owner' and coalesce(meta ->> 'centre_name', '') <> '' then
    base := left(public.slugify(meta ->> 'centre_name'), 30);
    if char_length(base) < 3 then base := 'centre'; end if;
    loop
      s := base || '-' || substr(md5(random()::text), 1, 4);
      exit when not exists (select 1 from centres where slug = s) and not exists (select 1 from slug_history where old_slug = s);
    end loop;
    insert into centres (name, slug, owner_id, phone)
    values (left(meta ->> 'centre_name', 120), s, new.id, meta ->> 'phone') returning id into cid;
    insert into members (centre_id, user_id, role) values (cid, new.id, 'owner');
    insert into audit_log (centre_id, user_id, action) values (cid, new.id, 'centre_registered');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.centres         enable row level security;
alter table public.slug_history    enable row level security;
alter table public.members         enable row level security;
alter table public.staff_invites   enable row level security;
alter table public.app_settings    enable row level security;
alter table public.audit_log       enable row level security;
alter table public.batches         enable row level security;
alter table public.subjects        enable row level security;
alter table public.fee_rules       enable row level security;
alter table public.students        enable row level security;
alter table public.student_subjects enable row level security;
alter table public.fee_history     enable row level security;
alter table public.payments        enable row level security;
alter table public.class_sessions  enable row level security;
alter table public.attendance      enable row level security;
alter table public.exam_types      enable row level security;
alter table public.exams           enable row level security;
alter table public.marks           enable row level security;
alter table public.enrol_requests  enable row level security;

-- profiles
create policy p_sel on public.profiles for select using (id = auth.uid() or public.is_super());
create policy p_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- centres: own centre (even while pending), or super admin
create policy c_sel on public.centres for select
  using (owner_id = auth.uid() or public.is_super()
         or exists (select 1 from members m where m.centre_id = centres.id and m.user_id = auth.uid() and m.active));
create policy c_upd on public.centres for update
  using (public.is_super() or owner_id = auth.uid()) with check (public.is_super() or owner_id = auth.uid());
create policy c_del on public.centres for delete using (public.is_super());

create policy sh_sel on public.slug_history for select using (public.is_owner(centre_id) or public.is_super());

-- members / invites
create policy m_sel on public.members for select
  using (user_id = auth.uid() or public.is_owner(centre_id) or public.is_super());
create policy m_upd on public.members for update
  using (public.is_owner(centre_id) and role = 'staff') with check (public.is_owner(centre_id) and role = 'staff');
create policy m_del on public.members for delete using (public.is_owner(centre_id) and role = 'staff');

create policy si_all on public.staff_invites for all
  using (public.is_owner(centre_id)) with check (public.is_owner(centre_id));

-- settings / audit
create policy as_sel on public.app_settings for select using (auth.role() = 'authenticated');
create policy as_all on public.app_settings for all using (public.is_super()) with check (public.is_super());
create policy al_sel on public.audit_log for select using (public.is_owner(centre_id) or public.is_super());

-- batches & their setup: read = owner / assigned staff / support; write = owner
create policy b_sel on public.batches for select using (public.batch_ok(centre_id, id) or public.support_ok(centre_id));
create policy b_ins on public.batches for insert with check (public.is_owner(centre_id));
create policy b_upd on public.batches for update using (public.is_owner(centre_id)) with check (public.is_owner(centre_id));
create policy b_del on public.batches for delete using (public.is_owner(centre_id));

create policy sj_sel on public.subjects for select using (public.batch_ok(centre_id, batch_id) or public.support_ok(centre_id));
create policy sj_all on public.subjects for all using (public.is_owner(centre_id)) with check (public.is_owner(centre_id));

create policy fr_sel on public.fee_rules for select using (public.batch_ok(centre_id, batch_id) or public.support_ok(centre_id));
create policy fr_all on public.fee_rules for all using (public.is_owner(centre_id)) with check (public.is_owner(centre_id));

create policy et_sel on public.exam_types for select using (public.batch_ok(centre_id, batch_id) or public.support_ok(centre_id));
create policy et_all on public.exam_types for all
  using (public.has_perm(centre_id, 'exams') and public.batch_ok(centre_id, batch_id))
  with check (public.has_perm(centre_id, 'exams') and public.batch_ok(centre_id, batch_id));

-- students: everyone working with the batch can read names; editing needs the "students" permission
create policy st_sel on public.students for select using (public.batch_ok(centre_id, batch_id) or public.support_ok(centre_id));
create policy st_ins on public.students for insert
  with check (public.has_perm(centre_id, 'students') and public.batch_ok(centre_id, batch_id));
create policy st_upd on public.students for update
  using (public.has_perm(centre_id, 'students') and public.batch_ok(centre_id, batch_id))
  with check (public.has_perm(centre_id, 'students') and public.batch_ok(centre_id, batch_id));
create policy st_del on public.students for delete using (public.is_owner(centre_id));

create policy ss_sel on public.student_subjects for select
  using (public.batch_ok(centre_id, public.student_batch(student_id)) or public.support_ok(centre_id));
create policy ss_all on public.student_subjects for all
  using (public.has_perm(centre_id, 'students') and public.batch_ok(centre_id, public.student_batch(student_id)))
  with check (public.has_perm(centre_id, 'students') and public.batch_ok(centre_id, public.student_batch(student_id)));

-- money: only owner or staff with "payments"
create policy fh_sel on public.fee_history for select
  using ((public.has_perm(centre_id, 'payments') and public.batch_ok(centre_id, public.student_batch(student_id))) or public.support_ok(centre_id));
create policy fh_all on public.fee_history for all using (public.is_owner(centre_id)) with check (public.is_owner(centre_id));

create policy pay_sel on public.payments for select
  using ((public.has_perm(centre_id, 'payments') and public.batch_ok(centre_id, public.student_batch(student_id))) or public.support_ok(centre_id));
create policy pay_ins on public.payments for insert
  with check (public.has_perm(centre_id, 'payments') and public.batch_ok(centre_id, public.student_batch(student_id)));
create policy pay_upd on public.payments for update using (public.is_owner(centre_id)) with check (public.is_owner(centre_id));
create policy pay_del on public.payments for delete using (public.is_owner(centre_id));

-- attendance
create policy cs_sel on public.class_sessions for select
  using ((public.has_perm(centre_id, 'attendance') and public.batch_ok(centre_id, batch_id)) or public.support_ok(centre_id)
         or (public.batch_ok(centre_id, batch_id) and public.has_perm(centre_id, 'students')));
create policy cs_all on public.class_sessions for all
  using (public.has_perm(centre_id, 'attendance') and public.batch_ok(centre_id, batch_id))
  with check (public.has_perm(centre_id, 'attendance') and public.batch_ok(centre_id, batch_id));

create policy at_sel on public.attendance for select
  using ((public.batch_ok(centre_id, public.session_batch(session_id))
          and (public.has_perm(centre_id, 'attendance') or public.has_perm(centre_id, 'students')))
         or public.support_ok(centre_id));
create policy at_all on public.attendance for all
  using (public.has_perm(centre_id, 'attendance') and public.batch_ok(centre_id, public.session_batch(session_id)))
  with check (public.has_perm(centre_id, 'attendance') and public.batch_ok(centre_id, public.session_batch(session_id)));

-- exams & marks
create policy ex_sel on public.exams for select
  using (public.batch_ok(centre_id, batch_id) or public.support_ok(centre_id));
create policy ex_all on public.exams for all
  using (public.has_perm(centre_id, 'exams') and public.batch_ok(centre_id, batch_id))
  with check (public.has_perm(centre_id, 'exams') and public.batch_ok(centre_id, batch_id));

create policy mk_sel on public.marks for select
  using (public.batch_ok(centre_id, public.exam_batch(exam_id)) or public.support_ok(centre_id));
create policy mk_all on public.marks for all
  using (public.has_perm(centre_id, 'exams') and public.batch_ok(centre_id, public.exam_batch(exam_id)))
  with check (public.has_perm(centre_id, 'exams') and public.batch_ok(centre_id, public.exam_batch(exam_id)));

-- enrolment requests: inserted only through submit_enrolment()
create policy er_sel on public.enrol_requests for select
  using (public.has_perm(centre_id, 'students') or public.support_ok(centre_id));
create policy er_upd on public.enrol_requests for update
  using (public.has_perm(centre_id, 'students')) with check (public.has_perm(centre_id, 'students'));
create policy er_del on public.enrol_requests for delete using (public.is_owner(centre_id));

-- ---------------------------------------------------------------------
-- 7. EXAM RESULTS (BD SSC/HSC grading) — view respects RLS of caller
-- ---------------------------------------------------------------------
create or replace function public.bd_grade(pct numeric) returns text language sql immutable as $$
  select case when pct is null then null when pct >= 80 then 'A+' when pct >= 70 then 'A' when pct >= 60 then 'A-'
              when pct >= 50 then 'B' when pct >= 40 then 'C' when pct >= 33 then 'D' else 'F' end
$$;
create or replace function public.bd_point(g text) returns numeric language sql immutable as $$
  select case g when 'A+' then 5.0 when 'A' then 4.0 when 'A-' then 3.5 when 'B' then 3.0
                when 'C' then 2.0 when 'D' then 1.0 when 'F' then 0 end
$$;

create or replace view public.exam_results with (security_invoker = true) as
with base as (
  select m.centre_id, m.exam_id, m.student_id, m.absent,
         case when e.has_mcq then m.mcq end as mcq,
         case when e.has_written then m.written end as written,
         coalesce(case when e.has_mcq then m.mcq end, 0) + coalesce(case when e.has_written then m.written end, 0) as total,
         coalesce(case when e.has_mcq then e.mcq_full end, 0) + coalesce(case when e.has_written then e.written_full end, 0) as full_marks,
         -- pass mark per part: manual value, otherwise BD default 33%
         (not e.has_mcq or coalesce(m.mcq, 0) >= coalesce(e.mcq_pass, ceil(e.mcq_full * 0.33))) and
         (not e.has_written or coalesce(m.written, 0) >= coalesce(e.written_pass, ceil(e.written_full * 0.33))) as passed_parts
  from marks m join exams e on e.id = m.exam_id
), calc as (
  select *, case when full_marks > 0 then round(total * 100.0 / full_marks, 2) end as pct from base
)
select centre_id, exam_id, student_id, absent, mcq, written,
       case when absent then null else total end as total, full_marks,
       case when absent then null else pct end as pct,
       case when absent then null when not passed_parts then 'F' else public.bd_grade(pct) end as grade,
       case when absent then null when not passed_parts then 0 else public.bd_point(public.bd_grade(pct)) end as gpa,
       case when absent then null else rank() over (partition by exam_id, absent order by total desc) end as rank
from calc;

-- ---------------------------------------------------------------------
-- 8. RPC FUNCTIONS (called from the app)
-- ---------------------------------------------------------------------
-- 8a. Super admin: list all centres with counts (no student data exposed)
create or replace function public.super_centres()
returns table (id uuid, name text, slug text, status text, logo_url text, phone text, owner_email text, owner_name text,
               students bigint, created_at timestamptz, approved_at timestamptz, support_until timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception 'not allowed'; end if;
  return query
    select c.id, c.name, c.slug, c.status, c.logo_url, c.phone, p.email, p.full_name,
           (select count(*) from students s where s.centre_id = c.id and s.status = 'active'),
           c.created_at, c.approved_at, c.support_until
    from centres c left join profiles p on p.id = c.owner_id
    order by (c.status = 'pending') desc, c.created_at desc;
end $$;

-- 8b. Super admin: approve / suspend / reactivate
create or replace function public.set_centre_status(c uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception 'not allowed'; end if;
  if new_status not in ('active','suspended','pending') then raise exception 'bad status'; end if;
  update centres set status = new_status,
         approved_at = case when new_status = 'active' and approved_at is null then now() else approved_at end
  where id = c;
  perform public.audit(c, 'status_' || new_status);
end $$;

-- 8c. Owner: allow support access for 3 days, or stop it now
create or replace function public.set_support(c uuid, allow boolean) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare u timestamptz;
begin
  if not exists (select 1 from centres where id = c and owner_id = auth.uid()) then raise exception 'not allowed'; end if;
  perform set_config('app.bypass', 'on', true);
  update centres set support_until = case when allow then now() + interval '3 days' else null end
  where id = c returning support_until into u;
  perform public.audit(c, case when allow then 'support_allowed' else 'support_stopped' end);
  return u;
end $$;

-- 8d. Owner: change the enrolment link name (old link keeps redirecting)
create or replace function public.change_slug(c uuid, new_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare old text; s text := lower(trim(new_slug));
begin
  if not public.is_owner(c) and not exists (select 1 from centres where id = c and owner_id = auth.uid()) then
    raise exception 'not allowed'; end if;
  if s !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception 'invalid_slug'; end if;
  if s in ('admin','app','api','login','signup','e','enroll','www','support','super') then raise exception 'reserved_slug'; end if;
  select slug into old from centres where id = c;
  if old = s then return s; end if;
  if exists (select 1 from centres where slug = s)
     or exists (select 1 from slug_history where old_slug = s and centre_id <> c) then raise exception 'slug_taken'; end if;
  delete from slug_history where old_slug = s;
  insert into slug_history (old_slug, centre_id) values (old, c) on conflict (old_slug) do update set centre_id = excluded.centre_id;
  perform set_config('app.bypass', 'on', true);
  update centres set slug = s where id = c;
  perform public.audit(c, 'slug_changed', jsonb_build_object('from', old, 'to', s));
  return s;
end $$;

-- 8e. Owner: add staff by email (links immediately if the person already has an account)
create or replace function public.invite_staff(c uuid, p_email text, p_name text, p_perms jsonb, p_batches uuid[])
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; e text := lower(trim(p_email));
begin
  if not public.is_owner(c) then raise exception 'not allowed'; end if;
  if exists (select 1 from unnest(p_batches) b where not exists (select 1 from batches where id = b and centre_id = c)) then
    raise exception 'bad batch'; end if;
  select id into uid from auth.users where lower(email) = e;
  if uid is not null then
    if exists (select 1 from members where centre_id = c and user_id = uid and role = 'owner') then raise exception 'is_owner'; end if;
    insert into members (centre_id, user_id, role, perms, batch_ids) values (c, uid, 'staff', p_perms, p_batches)
    on conflict (centre_id, user_id) do update set perms = excluded.perms, batch_ids = excluded.batch_ids, active = true;
    perform public.audit(c, 'staff_linked', jsonb_build_object('email', e));
    return 'linked';
  end if;
  insert into staff_invites (centre_id, email, full_name, perms, batch_ids) values (c, e, p_name, p_perms, p_batches)
  on conflict (centre_id, email) do update set perms = excluded.perms, batch_ids = excluded.batch_ids, full_name = excluded.full_name, accepted_at = null;
  perform public.audit(c, 'staff_invited', jsonb_build_object('email', e));
  return 'invited';
end $$;

-- 8f. Owner: list staff with their emails
create or replace function public.centre_staff(c uuid)
returns table (user_id uuid, email text, full_name text, perms jsonb, batch_ids uuid[], active boolean, pending boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_owner(c) then raise exception 'not allowed'; end if;
  return query
    select m.user_id, p.email, p.full_name, m.perms, m.batch_ids, m.active, false
      from members m join profiles p on p.id = m.user_id where m.centre_id = c and m.role = 'staff'
    union all
    select null, i.email, i.full_name, i.perms, i.batch_ids, true, true
      from staff_invites i where i.centre_id = c and i.accepted_at is null;
end $$;

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

-- ---------------------------------------------------------------------
-- 9. PERMISSIONS for API roles
-- ---------------------------------------------------------------------
revoke all on all functions in schema public from public, anon;
grant execute on function public.get_public_page(text) to anon, authenticated;
grant execute on function public.submit_enrolment(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.super_centres(), public.set_centre_status(uuid, text), public.set_support(uuid, boolean),
  public.change_slug(uuid, text), public.centre_names(uuid), public.invite_staff(uuid, text, text, jsonb, uuid[]), public.centre_staff(uuid),
  public.is_super(), public.my_role(uuid), public.is_owner(uuid), public.is_member(uuid), public.has_perm(uuid, text),
  public.batch_ok(uuid, uuid), public.support_ok(uuid), public.student_batch(uuid), public.session_batch(uuid),
  public.exam_batch(uuid), public.bd_grade(numeric), public.bd_point(text), public.slugify(text)
  to authenticated;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
