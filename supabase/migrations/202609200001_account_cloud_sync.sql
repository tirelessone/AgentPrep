-- AgentPrep stores only per-user learning state in Supabase. The question bank stays in PWA assets.

create table public.study_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  question_id text not null,
  question_version text not null,
  attempted_at timestamptz not null,
  selected_choice_ids jsonb not null check (jsonb_typeof(selected_choice_ids) = 'array'),
  response jsonb,
  correct boolean not null,
  primary key (user_id, id)
);

create index study_attempts_user_attempted_at_idx
  on public.study_attempts (user_id, attempted_at);
create index study_attempts_user_question_attempted_at_idx
  on public.study_attempts (user_id, question_id, attempted_at);

create table public.favorite_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  is_favorite boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, question_id)
);

create index favorite_states_user_updated_at_idx
  on public.favorite_states (user_id, updated_at);

create table public.user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, key)
);

alter table public.study_attempts enable row level security;
alter table public.favorite_states enable row level security;
alter table public.user_settings enable row level security;

-- Browser access is safe only because every operation is constrained to auth.uid().
create policy "study_attempts_select_own" on public.study_attempts
  for select to authenticated using (auth.uid() = user_id);
create policy "study_attempts_insert_own" on public.study_attempts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "study_attempts_update_own" on public.study_attempts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_attempts_delete_own" on public.study_attempts
  for delete to authenticated using (auth.uid() = user_id);

create policy "favorite_states_select_own" on public.favorite_states
  for select to authenticated using (auth.uid() = user_id);
create policy "favorite_states_insert_own" on public.favorite_states
  for insert to authenticated with check (auth.uid() = user_id);
create policy "favorite_states_update_own" on public.favorite_states
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorite_states_delete_own" on public.favorite_states
  for delete to authenticated using (auth.uid() = user_id);

create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.study_attempts to authenticated;
grant select, insert, update, delete on public.favorite_states to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
