import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite();
const owner = 'b0000000-0000-0000-0000-000000000001';
const other = 'b0000000-0000-0000-0000-000000000002';
const inactive = 'b0000000-0000-0000-0000-000000000003';
const n = 'b0000000-0000-0000-0000-000000000010';
const query = async (sql: string) => (await db.query<any>(sql)).rows;
async function asUser(id: string, sql: string, role = 'authenticated') {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    await db.exec(`set local role ${role}`);
    return await query(sql);
  } finally { await db.exec('rollback'); }
}
beforeAll(async () => {
  await db.exec(readFileSync('supabase/tests/00_stub_supabase.sql', 'utf8'));
  const files = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
  for (const f of files.filter(f => !f.includes('notifications_event_authorization')))
    await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'));
  await db.exec(`grant usage on schema public, auth to authenticated, anon;
    grant select on profiles to authenticated;
    grant all on notifications to anon, authenticated, service_role;
    insert into auth.users(id,email) values ('${owner}','owner@test'),('${other}','other@test'),('${inactive}','inactive@test');
    insert into profiles(id,email,full_name,is_active,system_role) values
      ('${owner}','owner@test','Owner',true,'USER'),('${other}','other@test','Admin',true,'SUPER_ADMIN'),('${inactive}','inactive@test','Inactive',false,'USER');
    insert into notifications(id,recipient_id,event_type,title,is_read) values ('${n}','${owner}','APPROVE','Status surat diperbarui: IN_REVIEW',false);`);
  // Forward migration: existing notification and broad hosted grants already exist.
  const before = await query('select * from notifications');
  for (const f of files.filter(f => f.includes('notifications_event_authorization')))
    await db.exec(readFileSync('supabase/migrations/' + f, 'utf8'));
  expect(await query('select * from notifications')).toEqual(before);
}, 30000);
afterAll(() => db.close());
it('penerima dapat membaca miliknya; admin dan akun lain tidak mendapat akses otomatis', async () => {
  expect(await asUser(owner, 'select id from notifications')).toHaveLength(1);
  expect(await asUser(other, 'select id from notifications')).toHaveLength(0);
  expect(await asUser(inactive, 'select id from notifications')).toHaveLength(0);
});
it('akun nonaktif tidak dapat membaca atau menandai bahkan notifikasi miliknya', async () => {
  await db.exec(`insert into notifications(recipient_id,event_type,title,is_read) values ('${inactive}','APPROVE','Tes',false)`);
  expect(await asUser(inactive, 'select id from notifications')).toHaveLength(0);
  expect(await asUser(inactive, 'update notifications set is_read=true returning id')).toHaveLength(0);
});
it('anon tidak dapat membaca/menandai notifikasi', async () => {
  await expect(asUser('', 'select * from notifications', 'anon')).rejects.toThrow(/permission denied/);
});
it('ID asing tidak dapat ditandai; tidak ada kebocoran keberadaan', async () => {
  expect(await asUser(other, `update notifications set is_read=true where id='${n}' returning id`)).toHaveLength(0);
});
it('penerima dapat menandai miliknya; waktu dari database bukan payload', async () => {
  const rows = await asUser(owner, `update notifications set is_read=true,read_at='2000-01-01' where id='${n}' returning is_read,read_at`);
  expect(rows[0].is_read).toBe(true);
  expect(new Date(rows[0].read_at).getUTCFullYear()).toBeGreaterThan(2020);
});
it('retry mempertahankan waktu pertama dibaca', async () => {
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true)`);
  try {
    const first = await query(`update notifications set is_read=true where id='${n}' returning read_at`);
    const next = await query(`update notifications set is_read=true,read_at='2000-01-01' where id='${n}' returning read_at`);
    expect(next).toEqual(first);
  } finally { await db.exec('rollback'); }
});
it.each(['title', 'event_type', 'recipient_id', 'letter_id', 'disposition_id', 'channels_sent', 'created_at'])('kolom event %s tidak dapat dipalsukan', async col => {
  await expect(asUser(owner, `update notifications set ${col}=${col} where id='${n}'`)).rejects.toThrow(/permission denied/);
});
it.each(['insert into notifications(recipient_id,is_read) values (\'' + owner + '\',false)', 'delete from notifications', 'truncate notifications'])('tidak dapat membuat/menghapus event: %s', async sql => {
  await expect(asUser(owner, sql)).rejects.toThrow(/permission denied/);
});
it('tidak dapat membalik menjadi belum dibaca', async () => {
  await expect(asUser(owner, `update notifications set is_read=false where id='${n}'`)).rejects.toThrow(/sudah dibaca/);
});
it('trigger membatasi perubahan event bahkan bila hak UPDATE luas diberikan kembali', async () => {
  await db.exec('grant update on notifications to authenticated');
  try {
    await expect(asUser(owner, `update notifications set title='Palsu' where id='${n}'`)).rejects.toThrow(/tidak dapat diubah/);
  } finally { await db.exec('revoke update on notifications from authenticated; grant update(is_read,read_at) on notifications to authenticated'); }
});
it('hak fungsi trigger tidak menjadi RPC publik', async () => {
  const r = await query("select has_function_privilege('authenticated','app.guard_notification_read_update()','execute') allowed");
  expect(r[0].allowed).toBe(false);
});

it('ACL service-role untuk event transaksi tetap dipertahankan', async () => {
  const r = await query("select has_table_privilege('service_role','notifications','INSERT') allowed");
  expect(r[0].allowed).toBe(true);
});
