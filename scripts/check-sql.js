import fs from 'node:fs';

const sql = fs.readFileSync('supabase/full_schema_setup.sql', 'utf-8');
console.log('SQL Size:', sql.length, 'bytes');

// Cari create policy
const policyMatches = [...sql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+([a-zA-Z0-9_]+)/gi)];
console.log('Total policies:', policyMatches.length);

const seen = new Set();
let hasDupes = false;
for (const match of policyMatches) {
  const key = `${match[1]} on ${match[2]}`.toLowerCase();
  if (seen.has(key)) {
    console.warn('Duplicate policy detected:', key);
    hasDupes = true;
  }
  seen.add(key);
}
if (!hasDupes) {
  console.log('Semua policy RLS unik dan valid.');
}

// Cari fungsi
const funcMatches = [...sql.matchAll(/create\s+(or\s+replace\s+)?function\s+([a-zA-Z0-9_]+)/gi)];
console.log('Total functions:', funcMatches.length);
for (const f of funcMatches) {
  console.log('Function:', f[2], f[1] ? '(or replace)' : '(direct create)');
}

