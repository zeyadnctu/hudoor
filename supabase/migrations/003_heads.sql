-- HUDOOR migration 003: department + faculty heads
alter table departments add column if not exists head_id uuid references profiles(id) on delete set null;
create index if not exists idx_dept_head on departments(head_id);
alter table faculties add column if not exists head_id uuid references profiles(id) on delete set null;
create index if not exists idx_fac_head on faculties(head_id);
