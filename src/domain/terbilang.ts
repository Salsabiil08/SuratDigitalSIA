/**
 * Fungsi utilitas konversi angka nominal rupiah ke teks terbilang bahasa Indonesia.
 * Digunakan secara otomatis pada Surat Pengantar Tagihan (Blueprint R.04).
 */

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

function konversiRatusan(n: number): string {
  let hasil = '';

  if (n >= 1000) {
    throw new Error('Nilai melebihi ratusan');
  }

  if (n >= 100) {
    const ratus = Math.floor(n / 100);
    hasil += (ratus === 1 ? 'seratus' : `${SATUAN[ratus]} ratus`) + ' ';
    n %= 100;
  }

  if (n >= 20) {
    const puluh = Math.floor(n / 10);
    hasil += `${SATUAN[puluh]} puluh `;
    n %= 10;
  }

  if (n > 0) {
    if (n < 12) {
      hasil += `${SATUAN[n]} `;
    } else {
      // 12..19
      hasil += `${SATUAN[n % 10]} belas `;
    }
  }

  return hasil.trim();
}

/**
 * Mengubah angka bulat nominal (misal 1500000) menjadi kalimat terbilang rupiah.
 * Contoh: 1500000 -> "Satu juta lima ratus ribu rupiah"
 */
export function terbilangRupiah(nominal: number): string {
  if (nominal === 0) return 'Nol rupiah';
  if (nominal < 0) return `Minus ${terbilangRupiah(Math.abs(nominal))}`;

  // Pembulatan ke bilangan bulat untuk rupiah
  const bulat = Math.floor(nominal);

  const skala = [
    { batas: 1000000000000, nama: 'triliun' },
    { batas: 1000000000, nama: 'miliar' },
    { batas: 1000000, nama: 'juta' },
    { batas: 1000, nama: 'ribu' },
  ];

  let sisa = bulat;
  let bagian: string[] = [];

  for (const s of skala) {
    if (sisa >= s.batas) {
      const jumlah = Math.floor(sisa / s.batas);
      sisa %= s.batas;

      if (s.nama === 'ribu' && jumlah === 1) {
        bagian.push('seribu');
      } else {
        bagian.push(`${konversiRatusan(jumlah)} ${s.nama}`);
      }
    }
  }

  if (sisa > 0) {
    bagian.push(konversiRatusan(sisa));
  }

  const teks = bagian.join(' ').replace(/\s+/g, ' ').trim();
  // Huruf kapital di awal kalimat dan akhiran 'rupiah'
  return teks.charAt(0).toUpperCase() + teks.slice(1) + ' rupiah';
}

