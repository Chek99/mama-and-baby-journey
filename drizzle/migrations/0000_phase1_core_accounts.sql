-- Phase 1: facilities, accounts, roles, sign-in security, audit log, settings.

create type public.app_role as enum ('system_admin', 'hospital_admin', 'clinician', 'chv', 'mother');

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- FACILITIES ---------------------------------------------------------------
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mfl_code text unique,
  county text not null,
  sub_county text,
  ward text,
  phone text,
  email text,
  address text,
  services text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.facilities to authenticated;
grant all on public.facilities to service_role;
alter table public.facilities enable row level security;
create trigger facilities_touch before update on public.facilities
  for each row execute function public.touch_updated_at();

-- PROFILES -----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text unique,
  staff_id text unique,
  facility_id uuid references public.facilities(id),
  licence_number text,
  cadre text,
  language text not null default 'en' check (language in ('en', 'sw')),
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  activated_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_facility_idx on public.profiles(facility_id);
create unique index profiles_email_lower_idx on public.profiles (lower(email)) where email is not null;
create unique index profiles_staff_id_lower_idx on public.profiles (lower(staff_id)) where staff_id is not null;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ROLES (separate table, never on profiles) ---------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  facility_id uuid references public.facilities(id),
  ward text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_facility_idx on public.user_roles(facility_id);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- VERIFIED SESSIONS (password + second factor completed) ---------------------
create table public.verified_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  method text not null,
  ip text,
  device text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index verified_sessions_user_idx on public.verified_sessions(user_id);
grant all on public.verified_sessions to service_role;
alter table public.verified_sessions enable row level security;

-- STAFF 2FA CHALLENGES -----------------------------------------------------
create table public.login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  purpose text not null default 'staff_2fa',
  expires_at timestamptz not null,
  attempts int not null default 0,
  resend_count int not null default 0,
  last_sent_at timestamptz not null default now(),
  remember_device boolean not null default false,
  used_at timestamptz,
  ip text,
  created_at timestamptz not null default now()
);
create index login_challenges_user_idx on public.login_challenges(user_id);
grant all on public.login_challenges to service_role;
alter table public.login_challenges enable row level security;

-- SMS ONE-TIME CODES -------------------------------------------------------
create table public.sms_otps (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null,
  code_hash text not null,
  purpose text not null check (purpose in ('sign_in', 'activate', 'pin_reset')),
  expires_at timestamptz not null,
  attempts int not null default 0,
  used_at timestamptz,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index sms_otps_phone_idx on public.sms_otps(phone_hash, created_at desc);
grant all on public.sms_otps to service_role;
alter table public.sms_otps enable row level security;

-- BACKUP CODES -------------------------------------------------------------
create table public.backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index backup_codes_user_idx on public.backup_codes(user_id);
grant all on public.backup_codes to service_role;
alter table public.backup_codes enable row level security;

-- TRUSTED DEVICES ("remember this device") ---------------------------------
create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null unique,
  device text,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index trusted_devices_user_idx on public.trusted_devices(user_id);
grant all on public.trusted_devices to service_role;
alter table public.trusted_devices enable row level security;

-- PASSWORD HISTORY (last 5) ------------------------------------------------
create table public.password_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  hash text not null,
  created_at timestamptz not null default now()
);
create index password_history_user_idx on public.password_history(user_id, created_at desc);
grant all on public.password_history to service_role;
alter table public.password_history enable row level security;

-- RATE LIMITS --------------------------------------------------------------
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0,
  locked_until timestamptz
);
grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(_key text, _max int, _window_seconds int, _lock_seconds int)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  r public.rate_limits%rowtype;
begin
  insert into public.rate_limits(key, window_start, count) values (_key, now(), 0)
  on conflict (key) do nothing;
  select * into r from public.rate_limits where key = _key for update;
  if r.locked_until is not null and r.locked_until > now() then
    return r.locked_until;
  end if;
  if r.window_start < now() - make_interval(secs => _window_seconds) or r.locked_until is not null then
    update public.rate_limits set window_start = now(), count = 1, locked_until = null where key = _key;
    return null;
  end if;
  if r.count + 1 > _max then
    update public.rate_limits set count = r.count + 1, locked_until = now() + make_interval(secs => _lock_seconds) where key = _key;
    return now() + make_interval(secs => _lock_seconds);
  end if;
  update public.rate_limits set count = r.count + 1 where key = _key;
  return null;
end $$;
revoke execute on function public.rate_limit_hit(text, int, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int, int) to service_role;

-- SMS LOG (never stores message bodies) ------------------------------------
create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_message_id text,
  phone_hash text not null,
  purpose text not null,
  status text not null,
  attempts int not null default 1,
  error text,
  facility_id uuid references public.facilities(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.sms_log to service_role;
alter table public.sms_log enable row level security;

-- AUDIT LOG (append-only) --------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  actor_role text,
  facility_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  success boolean not null default true,
  ip text,
  device text,
  metadata jsonb not null default '{}'::jsonb
);
create index audit_logs_at_idx on public.audit_logs(at desc);
create index audit_logs_facility_idx on public.audit_logs(facility_id, at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_user_id, at desc);
grant select on public.audit_logs to authenticated;
grant select, insert on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

create or replace function public.audit_logs_block_changes()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_block_changes();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.audit_logs_block_changes();

-- APP SETTINGS -------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;

insert into public.app_settings(key, value, description) values
  ('mother_can_view_full_schedule', 'false'::jsonb, 'When on, mothers can see the full upcoming vaccine schedule. Off by default.'),
  ('staff_idle_timeout_minutes', '15'::jsonb, 'Health worker screens sign out after this many idle minutes.'),
  ('mother_idle_timeout_minutes', '30'::jsonb, 'Mother / guardian screens sign out after this many idle minutes.');

-- HELPER FUNCTIONS (security definer, avoid recursive RLS) -----------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_session_verified()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.verified_sessions vs
    join public.profiles p on p.id = vs.user_id
    where vs.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and vs.user_id = auth.uid()
      and vs.revoked_at is null
      and vs.expires_at > now()
      and p.is_active
  )
$$;

create or replace function public.my_facility_id()
returns uuid language sql stable security definer set search_path = public as $$
  select facility_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_session_verified() to authenticated, service_role;
grant execute on function public.my_facility_id() to authenticated, service_role;

-- RLS POLICIES (reads only; all writes go through checked server actions) ---
create policy "Verified users read facilities in scope" on public.facilities
  for select to authenticated
  using (
    public.is_session_verified()
    and (public.has_role(auth.uid(), 'system_admin') or id = public.my_facility_id())
  );

create policy "Users read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "Admins read profiles in scope" on public.profiles
  for select to authenticated
  using (
    public.is_session_verified()
    and (
      public.has_role(auth.uid(), 'system_admin')
      or (public.has_role(auth.uid(), 'hospital_admin') and facility_id = public.my_facility_id())
    )
  );

create policy "Users read own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

create policy "Admins read roles in scope" on public.user_roles
  for select to authenticated
  using (
    public.is_session_verified()
    and (
      public.has_role(auth.uid(), 'system_admin')
      or (public.has_role(auth.uid(), 'hospital_admin') and facility_id = public.my_facility_id())
    )
  );

create policy "Admins read audit log in scope" on public.audit_logs
  for select to authenticated
  using (
    public.is_session_verified()
    and (
      public.has_role(auth.uid(), 'system_admin')
      or (public.has_role(auth.uid(), 'hospital_admin') and facility_id = public.my_facility_id())
    )
  );

create policy "Verified users read settings" on public.app_settings
  for select to authenticated
  using (public.is_session_verified());
