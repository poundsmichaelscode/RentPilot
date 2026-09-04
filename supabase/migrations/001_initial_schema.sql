-- supabase SQL migration file for initial schema setup


create extension if not exists "pgcrypto";

create type public.user_role as enum ('landlord','tenant','manager');

create type public.plan_type as enum ('free','premium');

create type public.approval_status as enum ('pending','approved','rejected');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade,email text not null unique, full_name text not null default '',phone text not null default '',role user_role not null default 'landlord',plan plan_type not null default 'free',avatar_url text,address text,kyc_status text not null default 'not_started',created_at timestamptz not null default now());

create table public.properties (id uuid primary key default gen_random_uuid(),landlord_id uuid not null references public.profiles(id) on delete cascade,name text not null,address text not null,monthly_rent numeric(12,2) not null check(monthly_rent>=0),units int not null default 1 check(units>0),images text[] not null default '{}',is_published boolean not null default false,created_at timestamptz not null default now());

create table public.tenancies (id uuid primary key default gen_random_uuid(),property_id uuid not null references public.properties(id) on delete cascade,landlord_id uuid not null references public.profiles(id),tenant_id uuid not null references public.profiles(id),unit text not null,rent_amount numeric(12,2) not null,due_day int not null default 1 check(due_day between 1 and 28),status text not null default 'active',created_at timestamptz not null default now());

create table public.rent_records (id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies(id) on delete cascade,amount numeric(12,2) not null,period date not null,method text not null,receipt_url text,status approval_status not null default 'pending',confirmed_at timestamptz,created_at timestamptz not null default now());

create table public.complaints (id uuid primary key default gen_random_uuid(),tenancy_id uuid not null references public.tenancies(id) on delete cascade,tenant_id uuid not null references public.profiles(id),subject text not null,details text not null,priority text not null default 'normal',status text not null default 'open',created_at timestamptz not null default now());

create table public.subscriptions (id uuid primary key default gen_random_uuid(),landlord_id uuid not null references public.profiles(id) on delete cascade,provider text not null,provider_reference text not null unique,status text not null default 'pending',current_period_end timestamptz,created_at timestamptz not null default now());

create index properties_landlord_idx on public.properties(landlord_id);

create index tenancies_tenant_idx on public.tenancies(tenant_id);

create index tenancies_landlord_idx on public.tenancies(landlord_id);

alter table public.profiles enable row level security;

alter table public.properties enable row level security;

alter table public.tenancies enable row level security;

alter table public.rent_records enable row level security;

alter table public.complaints enable row level security;

create policy "profiles own read" on public.profiles for select using (id=auth.uid());

create policy "marketplace or owner read" on public.properties for select using (is_published or landlord_id=auth.uid());

create policy "landlords manage properties" on public.properties for all using (landlord_id=auth.uid()) with check (landlord_id=auth.uid());

create policy "parties read tenancies" on public.tenancies for select using (landlord_id=auth.uid() or tenant_id=auth.uid());

insert into storage.buckets(id,name,public) values ('property-images','property-images',true),('receipts','receipts',false),('kyc','kyc',false) on conflict do nothing;
