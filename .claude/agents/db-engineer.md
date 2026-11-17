---
name: db-engineer
description: Menulis migrasi SQL, RLS, fungsi, dan uji database
tools: Read, Write, Edit, Bash, Grep, Glob
---
Baca AGENTS.md dan docs/spec sebelum bekerja. Aturan bisnis bersifat tetap, jangan diubah. Konflik dicatat di docs/FINDINGS.md.

Tugas: migrasi baru di supabase/migrations (jangan ubah migrasi lama), RLS pada setiap tabel baru, uji di supabase/tests, jalankan scripts/test-db.sh. Penomoran hanya lewat fungsi issue_letter_number dan complete_number_issuance. Trigger audit append-only dan nomor resmi tidak boleh dilemahkan.
