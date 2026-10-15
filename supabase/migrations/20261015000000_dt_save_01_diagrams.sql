-- DT-SAVE-01 (#66): Cloud diagrams store + RLS + locked-down share token RPC.
-- Payload stores one portable board document (docs/board-format.md v3.0, kind: "board")
-- produced by buildBoardDocument(). Do not invent a second board schema.

create table if not exists public.diagrams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  payload jsonb not null,
  share_token text unique null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagrams_payload_is_board_doc check (
    jsonb_typeof(payload) = 'object'
    and payload->>'kind' = 'board'
  ),
  constraint diagrams_payload_size_cap check (
    octet_length(payload::text) <= 1572864
  )
);

create index if not exists diagrams_user_id_updated_at_idx
  on public.diagrams (user_id, updated_at desc);

alter table public.diagrams enable row level security;

-- Owner CRUD: authenticated users may only read/write/delete their own rows.
-- Anonymous users have NO direct SELECT policy on public.diagrams (prevents listing shared boards).
drop policy if exists "diagrams_owner_select" on public.diagrams;
create policy "diagrams_owner_select"
  on public.diagrams
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "diagrams_owner_insert" on public.diagrams;
create policy "diagrams_owner_insert"
  on public.diagrams
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "diagrams_owner_update" on public.diagrams;
create policy "diagrams_owner_update"
  on public.diagrams
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "diagrams_owner_delete" on public.diagrams;
create policy "diagrams_owner_delete"
  on public.diagrams
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Share read: locked-down security definer RPC returning at most one row for an exact token match.
-- Does not expose user_id or allow listing shared rows.
create or replace function public.get_diagram_by_share_token(p_token text)
returns table (
  id uuid,
  title text,
  payload jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.title,
    d.payload,
    d.updated_at
  from public.diagrams as d
  where d.share_token is not null
    and p_token is not null
    and length(btrim(p_token)) > 0
    and d.share_token = btrim(p_token)
  limit 1;
$$;

revoke all on function public.get_diagram_by_share_token(text) from public;
grant execute on function public.get_diagram_by_share_token(text) to anon, authenticated;
