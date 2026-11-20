# Pendaftaran pengguna beta
- Masuk → Daftar Akun → isi nama, email, kata sandi beserta konfirmasi, unit, dan jabatan yang diajukan.
- Supabase Auth membuat identitas; trigger hanya membuat profil USER nonaktif dan permintaan pemeriksaan.
- Verifikasi email mengikuti konfigurasi Auth existing, tidak dinonaktifkan.
- Super Admin → Akun Pengguna → periksa identitas → pilih unit/jabatan yang sah → catatan → Aktifkan Akun atau Tolak.
- Aktivasi menambahkan penugasan baru; banyak pegawai dapat memakai unit/jabatan yang sama. Akun/surat lama tidak diganti.
- Tidak ada pemberian otomatis Super Admin, mandat pemeriksa, delegasi, atau penandatangan resmi.
- RPC keputusan hanya service_role; server memperoleh aktor dari sesi Auth dan requireSuperAdmin. RLS menutup daftar permintaan serta direktori pegawai bagi akun pending.
- Uji otomatis: validasi masukan; PostgreSQL trigger, eskalasi metadata, keputusan ilegal, aktivasi, retry, audit tunggal, penolakan dan RLS; browser halaman publik desktop/mobile.
- Uji email sungguhan, aktivasi melalui UI lintas akun, dan login akun baru memerlukan email yang dapat menerima pesan. Jangan mengklaim pengiriman email berhasil hanya dari respons signup.
