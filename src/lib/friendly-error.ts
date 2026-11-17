/**
 * Menerjemahkan pesan kesalahan teknis / database ke bahasa Indonesia yang jelas,
 * sopan, dan mudah dipahami oleh pengguna.
 */
export function formatFriendlyErrorMessage(err: unknown): string {
  const msg = typeof err === 'string' ? err : (err as any)?.message || '';
  if (!msg) return 'Terjadi kendala saat memproses permintaan Anda. Silakan coba kembali.';

  if (
    msg.includes('letters_official_number_key') ||
    msg.includes('duplicate key value violates unique constraint')
  ) {
    return 'Nomor surat resmi pada tanggal tersebut telah terbit sebelumnya. Sistem telah menyesuaikan nomor ke urutan berikutnya, silakan klik tombol kembali untuk melanjutkan.';
  }

  if (msg.includes('check constraint') || msg.includes('violates check constraint')) {
    return 'Data yang Anda masukkan tidak sesuai ketentuan (misalnya tanggal sebelum hari ini atau format yang belum tepat). Mohon periksa kembali isian formulir.';
  }

  if (msg.includes('foreign key') || msg.includes('violates foreign key constraint')) {
    return 'Data penugasan, unit kerja, atau jabatan yang dipilih tidak valid atau telah dinonaktifkan.';
  }

  if (
    msg.includes('null value in column') ||
    msg.includes('violates not-null constraint')
  ) {
    return 'Masih ada kolom penting yang belum terisi. Mohon lengkapi seluruh isian bertanda bintang (*).';
  }

  return msg;
}
