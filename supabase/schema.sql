-- =====================================================================
-- SecureVault Pro — Supabase schema
-- Run in Supabase SQL editor (or `supabase db push`) on a fresh project.
--
-- Design goal: the clearance model is enforced at the DATABASE layer via
-- Row Level Security, not just in application code. This is the fix for
-- the IDOR / broken-access-control issues found in the Zite prototype:
-- even a compromised or buggy frontend cannot read/write rows a user's
-- clearance doesn't allow, because Postgres itself rejects the query.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type role_t as enum ('Guest', 'Employee', 'Manager', 'Security Officer', 'Administrator');
create type classification_t as enum ('Public', 'Internal', 'Confidential', 'Restricted');
create type permission_t as enum ('Read Only', 'Editable');
create type user_status_t as enum ('Active', 'Locked', 'Disabled');
create type risk_level_t as enum ('Normal', 'Elevated', 'Suspicious', 'Critical');
create type alert_severity_t as enum ('Critical', 'High', 'Medium', 'Info');
create type alert_status_t as enum ('Active', 'Acknowledged', 'Resolved', 'Dismissed');
create type announcement_target_t as enum ('All Employees', 'Specific Department', 'Clearance Level');
create type announcement_priority_t as enum ('Normal', 'Important', 'Urgent');
create type notification_type_t as enum ('Share', 'Security', 'System', 'Download');
create type signature_status_t as enum ('Pending', 'Verified', 'Unverified');

-- ---------------------------------------------------------------------
-- CORE TABLES
-- ---------------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  phone text,
  role role_t not null default 'Employee',
  department uuid references departments(id) on delete set null,
  status user_status_t not null default 'Active',
  risk_score int not null default 0,
  profile_photo_url text,
  employee_id int,
  suspended_at timestamptz,
  suspension_reason text,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

create table id_ranges (
  id uuid primary key default gen_random_uuid(),
  range_label text not null,
  start_id int not null,
  end_id int not null,
  department uuid references departments(id) on delete set null,
  next_available_id int not null,
  is_active boolean not null default true,
  check (start_id < end_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_path text not null,               -- path inside the 'documents' storage bucket
  owner uuid not null references profiles(id) on delete cascade,
  department uuid references departments(id) on delete set null,
  classification classification_t not null default 'Internal',
  file_type text not null default 'Other',
  size_bytes bigint not null default 0,
  sha256_hash text,
  hmac_signature text,
  signature_status signature_status_t not null default 'Pending',
  version int not null default 1,
  retention_period text default '3 years',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table document_versions (
  id uuid primary key default gen_random_uuid(),
  document uuid not null references documents(id) on delete cascade,
  version_label text,
  version_number int not null,
  file_path text not null,
  uploaded_by uuid not null references profiles(id),
  sha256_hash text,
  created_at timestamptz not null default now()
);

create table shared_documents (
  id uuid primary key default gen_random_uuid(),
  share_label text,
  document uuid not null references documents(id) on delete cascade,
  shared_by uuid not null references profiles(id),
  shared_with_user uuid references profiles(id) on delete cascade,
  shared_with_department uuid references departments(id) on delete cascade,
  permission permission_t not null default 'Read Only',
  expires_at timestamptz,
  download_limit int,
  downloads_used int not null default 0,
  no_download boolean not null default false,
  no_share boolean not null default false,
  created_at timestamptz not null default now(),
  check (shared_with_user is not null or shared_with_department is not null)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  details text,
  ip_address text,
  browser text,
  status text not null default 'Success',
  risk_level risk_level_t not null default 'Normal',
  created_at timestamptz not null default now()
);

create table security_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity alert_severity_t not null default 'Info',
  rule text,
  description text,
  affected_user uuid references profiles(id) on delete set null,
  alert_status alert_status_t not null default 'Active',
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text,
  recipient uuid not null references profiles(id) on delete cascade,
  type notification_type_t not null default 'System',
  is_read boolean not null default false,
  link_url text,
  created_at timestamptz not null default now()
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  posted_by uuid not null references profiles(id),
  target_type announcement_target_t not null default 'All Employees',
  target_department uuid references departments(id),
  target_clearance role_t,
  priority announcement_priority_t not null default 'Normal',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_documents_owner on documents(owner);
create index idx_shared_documents_user on shared_documents(shared_with_user);
create index idx_shared_documents_doc on shared_documents(document);
create index idx_audit_logs_user on audit_logs(user_id);
create index idx_notifications_recipient on notifications(recipient, is_read);

-- ---------------------------------------------------------------------
-- HELPER FUNCTIONS (security definer, used inside RLS policies)
-- ---------------------------------------------------------------------

-- Current user's role. STABLE + SECURITY DEFINER so it can be used freely
-- inside RLS policies without recursive-RLS problems on `profiles`.
create or replace function auth_role() returns role_t
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_status() returns user_status_t
language sql stable security definer set search_path = public as $$
  select status from profiles where id = auth.uid();
$$;

create or replace function is_admin_or_security() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() in ('Administrator', 'Security Officer');
$$;

create or replace function clearance_level(r role_t) returns int
language sql immutable as $$
  select case r
    when 'Guest' then 0 when 'Employee' then 1 when 'Manager' then 2
    when 'Security Officer' then 3 when 'Administrator' then 4 end;
$$;

create or replace function classification_level(c classification_t) returns int
language sql immutable as $$
  select case c
    when 'Public' then 0 when 'Internal' then 1
    when 'Confidential' then 2 when 'Restricted' then 3 end;
$$;

-- A document is "in clearance" for the caller if their role's level meets
-- the document's classification level. This is the core MAC-style rule
-- that the original app only checked in application code (and then only
-- on the share endpoints, not on search/read) — here it's enforced on
-- every single SELECT via policy.
create or replace function has_clearance_for(doc_classification classification_t) returns boolean
language sql stable security definer set search_path = public as $$
  select clearance_level(auth_role()) >= classification_level(doc_classification);
$$;

create or replace function is_active_account() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_status() = 'Active';
$$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table departments enable row level security;
alter table id_ranges enable row level security;
alter table documents enable row level security;
alter table document_versions enable row level security;
alter table shared_documents enable row level security;
alter table audit_logs enable row level security;
alter table security_alerts enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;

-- profiles: everyone can read their own row; admins/security officers
-- can read everyone (for the admin console); nobody can write role/status/
-- risk_score/employee_id directly — that goes through SECURITY DEFINER
-- RPCs below so business rules (7-day suspension wait, ID range locking,
-- "can't demote an admin", etc.) can't be bypassed by a raw UPDATE.
create policy "profiles_select_self_or_admin" on profiles for select
  using (id = auth.uid() or is_admin_or_security());

create policy "profiles_update_self_limited" on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles p where p.id = auth.uid())
    and status = (select status from profiles p where p.id = auth.uid())
    and risk_score = (select risk_score from profiles p where p.id = auth.uid())
    and employee_id is not distinct from (select employee_id from profiles p where p.id = auth.uid())
  );

create policy "departments_select_all" on departments for select using (is_active_account());

create policy "id_ranges_admin_only" on id_ranges for all
  using (auth_role() = 'Administrator') with check (auth_role() = 'Administrator');

-- documents: owner, or explicit share, or department-wide share, gated by
-- clearance either way. This single policy is what fixes the searchDocuments
-- and deleteDocuments IDOR bugs from the prototype — there is no code path
-- that returns/deletes a row the caller isn't entitled to, because the
-- database itself won't return it.
create policy "documents_select_scoped" on documents for select
  using (
    is_active_account() and (
      owner = auth.uid()
      or is_admin_or_security()
      or (has_clearance_for(classification) and exists (
            select 1 from shared_documents sd
            where sd.document = documents.id
              and (sd.shared_with_user = auth.uid() or sd.shared_with_department = (select department from profiles where id = auth.uid()))
              and (sd.expires_at is null or sd.expires_at > now())
          ))
    )
  );

create policy "documents_insert_own" on documents for insert
  with check (owner = auth.uid() and is_active_account());

create policy "documents_delete_owner_or_admin" on documents for delete
  using (owner = auth.uid() or auth_role() = 'Administrator');

create policy "documents_update_owner_or_admin" on documents for update
  using (owner = auth.uid() or auth_role() = 'Administrator');

create policy "document_versions_select_via_document" on document_versions for select
  using (exists (select 1 from documents d where d.id = document_versions.document));

create policy "document_versions_insert_owner" on document_versions for insert
  with check (exists (select 1 from documents d where d.id = document and d.owner = auth.uid()));

-- shared_documents: visible to the sharer, the recipient, or admins.
-- Clearance is checked in the share_document() RPC (not just logged after
-- the fact like the prototype did) — see below.
create policy "shares_select_participant" on shared_documents for select
  using (shared_by = auth.uid() or shared_with_user = auth.uid() or is_admin_or_security());

create policy "shares_delete_owner" on shared_documents for delete
  using (shared_by = auth.uid() or auth_role() = 'Administrator');

-- audit_logs / security_alerts: admin & security officer only. Regular
-- users cannot read the audit trail (fixes info disclosure) and nobody
-- can write directly — all writes happen via SECURITY DEFINER RPCs so a
-- user can't forge a "Normal" risk_level for their own suspicious action.
create policy "audit_logs_admin_read" on audit_logs for select using (is_admin_or_security());
create policy "security_alerts_admin_read" on security_alerts for select using (is_admin_or_security());
create policy "security_alerts_admin_update" on security_alerts for update using (is_admin_or_security());

create policy "notifications_select_own" on notifications for select using (recipient = auth.uid());
create policy "notifications_update_own" on notifications for update using (recipient = auth.uid());

create policy "announcements_select_all" on announcements for select using (is_active_account());
create policy "announcements_insert_admin_manager" on announcements for insert
  with check (auth_role() in ('Administrator', 'Manager') and posted_by = auth.uid());

-- ---------------------------------------------------------------------
-- BUSINESS-LOGIC RPCs (SECURITY DEFINER — bypass RLS deliberately, but
-- enforce the exact same rules the prototype tried, and failed, to
-- enforce only in the React layer)
-- ---------------------------------------------------------------------

create or replace function log_audit(p_action text, p_details text, p_status text default 'Success', p_risk risk_level_t default 'Normal')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs(user_id, action, details, status, risk_level)
  values (auth.uid(), p_action, p_details, p_status, p_risk);
end; $$;

-- Share a document with one or more recipients. Unlike the prototype,
-- a clearance violation is BLOCKED by default, not merely logged — the
-- caller must pass allow_override => true (Manager/Admin only) to push
-- it through, and that override itself is always audited + alerted.
create or replace function share_document(
  p_document_id uuid,
  p_recipients jsonb, -- [{ "user_id": uuid, "permission": text }]
  p_no_download boolean default false,
  p_no_share boolean default false,
  p_expires_at timestamptz default null,
  p_download_limit int default null,
  p_allow_override boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  doc documents%rowtype;
  rec jsonb;
  recipient profiles%rowtype;
  blocked jsonb := '[]'::jsonb;
  shared_count int := 0;
begin
  select * into doc from documents where id = p_document_id;
  if doc.id is null then raise exception 'Document not found'; end if;
  if doc.owner <> auth.uid() and not is_admin_or_security() then
    raise exception 'Only the document owner can share this file';
  end if;

  for rec in select * from jsonb_array_elements(p_recipients) loop
    select * into recipient from profiles where id = (rec->>'user_id')::uuid;
    if recipient.id is null then continue; end if;

    if clearance_level(recipient.role) < classification_level(doc.classification) then
      if not (p_allow_override and auth_role() in ('Administrator', 'Manager')) then
        blocked := blocked || jsonb_build_object('name', recipient.first_name || ' ' || recipient.last_name, 'role', recipient.role);
        continue;
      end if;

      insert into security_alerts(title, severity, rule, description, affected_user)
      values (
        'Clearance override: ' || doc.classification || ' shared with ' || recipient.role,
        case when classification_level(doc.classification) >= 3 then 'Critical' else 'High' end,
        'clearance_override',
        auth.uid()::text || ' overrode clearance to share "' || doc.filename || '" with ' || recipient.email,
        recipient.id
      );
      update profiles set risk_score = risk_score + 25 where id = auth.uid();
    end if;

    insert into shared_documents(share_label, document, shared_by, shared_with_user, permission, expires_at, download_limit, no_download, no_share)
    values (doc.filename || ' share', p_document_id, auth.uid(), recipient.id, (rec->>'permission')::permission_t, p_expires_at, p_download_limit, p_no_download, p_no_share);

    insert into notifications(title, message, recipient, type, link_url)
    values ('Document shared with you', doc.filename || ' — ' || (rec->>'permission'), recipient.id, 'Share', '/documents/' || p_document_id);

    shared_count := shared_count + 1;
  end loop;

  perform log_audit('Share', 'Shared "' || doc.filename || '" with ' || shared_count || ' recipient(s)', 'Success', case when jsonb_array_length(blocked) > 0 then 'Elevated' else 'Normal' end);

  return jsonb_build_object('shared', shared_count, 'blocked', blocked);
end; $$;

-- Broadcast: unlike the prototype, this now filters recipients by
-- clearance instead of blasting a Restricted doc to every Guest account.
create or replace function broadcast_document(
  p_document_id uuid, p_permission permission_t, p_no_download boolean default false,
  p_no_share boolean default true, p_message text default null
) returns int language plpgsql security definer set search_path = public as $$
declare
  doc documents%rowtype;
  sent int := 0;
begin
  if auth_role() not in ('Administrator', 'Manager') then raise exception 'Only Administrators and Managers can broadcast'; end if;
  select * into doc from documents where id = p_document_id;
  if doc.id is null then raise exception 'Document not found'; end if;

  insert into shared_documents(share_label, document, shared_by, shared_with_user, permission, no_download, no_share)
  select 'Broadcast: ' || doc.filename, p_document_id, auth.uid(), p.id, p_permission, p_no_download, p_no_share
  from profiles p
  where p.status = 'Active' and p.id <> auth.uid()
    and clearance_level(p.role) >= classification_level(doc.classification); -- clearance now enforced

  get diagnostics sent = row_count;

  insert into notifications(title, message, recipient, type, link_url)
  select '📢 Broadcast: ' || doc.filename, coalesce(p_message, 'Permission: ' || p_permission), p.id, 'System', '/documents/' || p_document_id
  from profiles p
  where p.status = 'Active' and p.id <> auth.uid()
    and clearance_level(p.role) >= classification_level(doc.classification);

  perform log_audit('Share', 'Broadcast "' || doc.filename || '" to ' || sent || ' cleared employees', 'Success', 'Elevated');
  return sent;
end; $$;

create or replace function admin_update_user(p_user_id uuid, p_role role_t default null, p_department uuid default null, p_assign_employee_id boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target profiles%rowtype;
  new_emp_id int;
  rng id_ranges%rowtype;
begin
  if not is_admin_or_security() then raise exception 'Insufficient clearance to modify users'; end if;
  select * into target from profiles where id = p_user_id;
  if target.id is null then raise exception 'User not found'; end if;

  if p_role is not null and p_role <> target.role then
    if p_role in ('Administrator', 'Security Officer') and auth_role() <> 'Administrator' then
      raise exception 'Only Administrators can assign high-clearance roles';
    end if;
    update profiles set role = p_role where id = p_user_id;
  end if;

  if p_department is not null then
    update profiles set department = p_department where id = p_user_id;
  end if;

  if p_assign_employee_id and target.employee_id is null then
    select * into rng from id_ranges where department = coalesce(p_department, target.department) and is_active limit 1;
    if rng.id is not null then
      if rng.next_available_id > rng.end_id then raise exception 'ID range exhausted for this department'; end if;
      new_emp_id := rng.next_available_id;
      update id_ranges set next_available_id = next_available_id + 1 where id = rng.id;
    else
      select coalesce(max(employee_id), 0) + 1 into new_emp_id from profiles;
    end if;
    update profiles set employee_id = new_emp_id where id = p_user_id;
  end if;

  if p_role is not null and p_role <> target.role then
    insert into notifications(title, message, recipient, type)
    values ('Your clearance level has been updated', 'Your role is now ' || p_role, p_user_id, 'System');
  end if;

  perform log_audit('Admin Action', 'Updated user ' || target.email, 'Success', case when p_role in ('Administrator','Security Officer') then 'Elevated' else 'Normal' end);
  select * into target from profiles where id = p_user_id;
  return to_jsonb(target);
end; $$;

create or replace function admin_suspend_user(p_user_id uuid, p_action text, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare target profiles%rowtype;
begin
  if auth_role() <> 'Administrator' then raise exception 'Only Administrators can suspend accounts'; end if;
  select * into target from profiles where id = p_user_id;
  if target.id is null then raise exception 'User not found'; end if;
  if target.role = 'Administrator' then raise exception 'Cannot suspend another administrator'; end if;

  if p_action = 'suspend' then
    update profiles set status = 'Locked', suspended_at = now(), suspension_reason = coalesce(p_reason, 'Suspended by administrator') where id = p_user_id;
    insert into security_alerts(title, severity, rule, description, affected_user)
    values ('Account suspended: ' || target.email, 'High', 'account_suspension', 'Suspended by ' || auth.uid()::text || '. Reason: ' || coalesce(p_reason, 'N/A'), p_user_id);
    insert into notifications(title, message, recipient, type) values ('Your account has been suspended', coalesce(p_reason, 'Contact your administrator'), p_user_id, 'Security');
    perform log_audit('Admin Action', 'Suspended ' || target.email, 'Success', 'Elevated');
    return target.email || ' has been suspended. Permanent deletion available after 7 days.';
  else
    update profiles set status = 'Active', suspended_at = null, suspension_reason = null where id = p_user_id;
    perform log_audit('Admin Action', 'Unsuspended ' || target.email, 'Success', 'Normal');
    return target.email || ' has been reactivated.';
  end if;
end; $$;

create or replace function admin_delete_user(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare target profiles%rowtype; days_since numeric;
begin
  if auth_role() <> 'Administrator' then raise exception 'Only Administrators can delete accounts'; end if;
  select * into target from profiles where id = p_user_id;
  if target.id is null then raise exception 'User not found'; end if;
  if target.role = 'Administrator' then raise exception 'Cannot delete another administrator'; end if;
  if target.status <> 'Locked' or target.suspended_at is null then
    raise exception 'User must be suspended for 7 days before deletion';
  end if;
  days_since := extract(epoch from (now() - target.suspended_at)) / 86400;
  if days_since < 7 then
    raise exception 'Cannot delete yet. % day(s) remaining.', ceil(7 - days_since);
  end if;

  update profiles set status = 'Disabled' where id = p_user_id;
  perform log_audit('Admin Action', 'Permanently disabled ' || target.email, 'Success', 'Critical');
  return target.email || ' has been permanently disabled.';
end; $$;

create or replace function admin_compare_users(p_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb := '[]'::jsonb; uid uuid; u profiles%rowtype;
begin
  if not is_admin_or_security() then raise exception 'Only Administrators and Security Officers can compare users'; end if;
  foreach uid in array p_user_ids loop
    select * into u from profiles where id = uid;
    if u.id is null then continue; end if;
    result := result || jsonb_build_object(
      'id', u.id, 'name', trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')), 'email', u.email,
      'role', u.role, 'employeeId', u.employee_id, 'status', u.status, 'riskScore', u.risk_score,
      'stats', jsonb_build_object(
        'logins', (select count(*) from audit_logs where user_id = uid and action = 'Login'),
        'uploads', (select count(*) from audit_logs where user_id = uid and action = 'Upload'),
        'downloads', (select count(*) from audit_logs where user_id = uid and action = 'Download'),
        'shares', (select count(*) from audit_logs where user_id = uid and action = 'Share'),
        'failedActions', (select count(*) from audit_logs where user_id = uid and status = 'Failed'),
        'suspiciousActions', (select count(*) from audit_logs where user_id = uid and risk_level in ('Suspicious','Critical')),
        'totalActions', (select count(*) from audit_logs where user_id = uid)
      )
    );
  end loop;
  return result;
end; $$;

create or replace function manage_id_ranges(p_action text, p_id uuid default null, p_label text default null, p_start int default null, p_end int default null, p_department uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth_role() <> 'Administrator' then raise exception 'Only Administrators can manage ID ranges'; end if;

  if p_action = 'create' then
    if p_label is null or p_start is null or p_end is null then raise exception 'Label, start, end required'; end if;
    if p_start >= p_end then raise exception 'Start ID must be less than end ID'; end if;
    insert into id_ranges(range_label, start_id, end_id, department, next_available_id) values (p_label, p_start, p_end, p_department, p_start);
  elsif p_action = 'delete' and p_id is not null then
    delete from id_ranges where id = p_id;
  end if;

  return (select jsonb_agg(to_jsonb(r) || jsonb_build_object('departmentName', d.name))
          from id_ranges r left join departments d on d.id = r.department);
end; $$;

create or replace function create_announcement(p_title text, p_message text, p_target_type announcement_target_t, p_target_department uuid default null, p_target_clearance role_t default null, p_priority announcement_priority_t default 'Normal')
returns int language plpgsql security definer set search_path = public as $$
declare notified int;
begin
  if auth_role() not in ('Administrator', 'Manager') then raise exception 'Only Administrators and Managers can post announcements'; end if;

  insert into announcements(title, message, posted_by, target_type, target_department, target_clearance, priority)
  values (p_title, p_message, auth.uid(), p_target_type, p_target_department, p_target_clearance, p_priority);

  insert into notifications(title, message, recipient, type, link_url)
  select ('📢 ' || case when p_priority = 'Urgent' then '🔴 URGENT: ' else '' end || p_title), left(p_message, 200), p.id, 'System', '/notifications'
  from profiles p
  where p.status = 'Active' and p.id <> auth.uid()
    and (p_target_type = 'All Employees'
      or (p_target_type = 'Specific Department' and p.department = p_target_department)
      or (p_target_type = 'Clearance Level' and p.role = p_target_clearance));

  get diagnostics notified = row_count;
  perform log_audit('Admin Action', 'Posted announcement "' || p_title || '" to ' || notified || ' users', 'Success', 'Normal');
  return notified;
end; $$;

-- Auto-create a profile row whenever a new auth.users row appears
-- (Supabase Auth signup / magic link / OAuth all funnel through this).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role, status)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name',
    'Employee', 'Active'
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- STORAGE
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- Files are stored at `${owner_uuid}/${document_id}/${filename}` — the
-- policies below key off the folder name matching auth.uid(), and admins
-- get a blanket read for the admin console / broadcast downloads.
create policy "storage_read_own_or_shared" on storage.objects for select
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin_or_security()));

create policy "storage_insert_own_folder" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "storage_delete_own_folder" on storage.objects for delete
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or auth_role() = 'Administrator'));

-- ---------------------------------------------------------------------
-- SEED DATA (safe to skip in production; handy for a demo/defense)
-- ---------------------------------------------------------------------
insert into departments (name) values ('Engineering'), ('Finance'), ('Human Resources'), ('Legal'), ('Operations')
  on conflict do nothing;

-- After creating your first user via Supabase Auth, promote it manually:
--   update profiles set role = 'Administrator' where email = 'you@example.com';
