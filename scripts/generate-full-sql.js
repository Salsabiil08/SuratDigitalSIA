import fs from 'node:fs';

const migFiles = [
  'supabase/migrations/20261111000001_schema.sql',
  'supabase/migrations/20261111000002_constraints.sql',
  'supabase/migrations/20261111000003_functions.sql',
  'supabase/migrations/20261111000004_rls.sql',
  'supabase/migrations/20261114000001_r04.sql',
  'supabase/migrations/20261114000002_m2_rls.sql',
  'supabase/seed.sql'
];

let fullSql = `-- ========================================================
-- SIADocs PT Semen Indonesia Aceh (Blueprint R.04)
-- SETUP LENGKAP DATABASE SUPABASE (ONE-CLICK EXECUTION)
-- ========================================================

-- 0. Ekstensi & Reset Schema Bersih
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres;
grant all on schema public to public;
grant all on schema public to anon, authenticated, service_role;

`;

for (const f of migFiles) {
  fullSql += `\n-- ========================================================\n`;
  fullSql += `-- MODUL: ${f}\n`;
  fullSql += `-- ========================================================\n\n`;
  fullSql += fs.readFileSync(f, 'utf-8') + '\n';
}

fullSql += `
-- ========================================================
-- POST-SETUP: GRANT PRIVILEGES TO SUPABASE POSTGREST
-- ========================================================
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;
`;

fs.writeFileSync('supabase/full_schema_setup.sql', fullSql, 'utf-8');
console.log('full_schema_setup.sql updated, size:', fullSql.length, 'bytes');

