-- Hardening dari pemeriksaan advisor setelah REV-01..07.
alter function public.protect_final_letter() set search_path=public;
-- Rutin baru tidak boleh mendapat akses anon/authenticated dari default lama.
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges in schema public grant execute on functions to service_role;
