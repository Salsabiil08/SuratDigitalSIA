import { getCurrentUser } from '@/server/auth';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { logoutAction } from '@/server/actions/auth';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();

  const profileData = user || {
    id: 'demo',
    fullName: 'Pengguna Contoh SIA',
    email: 'user@sia.co.id',
    systemRole: 'USER' as const,
    isActive: true,
    position: { id: 'p1', code: 'GM', name: 'GM / Kepala Unit', level: 2 },
    unit: { id: 'u1', code: 'ACH', name: 'Accounting' },
    isOfficialSigner: false,
    isSuperAdmin: false,
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <PageHeader
        title="Profil Pengguna"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Kartu Ringkasan Pengguna */}
        <Card className="p-6 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#121A22] to-[#B30B0B] text-white text-2xl font-bold flex items-center justify-center shadow-md mb-4">
            {profileData.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <h2 className="text-lg font-bold text-neutral-900 m-0">{profileData.fullName}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{profileData.email}</p>
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {profileData.isSuperAdmin ? (
              <Chip variant="red">Super Administrator</Chip>
            ) : profileData.position?.level === 4 ? (
              <Chip variant="red">Direktur Utama (Level 4)</Chip>
            ) : profileData.position?.level === 3 ? (
              <Chip variant="amber">Senior Manager (Level 3)</Chip>
            ) : profileData.position?.level === 2 ? (
              <Chip variant="blue">General Manager (Level 2)</Chip>
            ) : (
              <Chip variant="gray">Staff Pelaksana (Level 1)</Chip>
            )}

            {profileData.isOfficialSigner && (
              <Chip variant="green">Pejabat Penandatangan Sah</Chip>
            )}
          </div>

          <form action={logoutAction} className="w-full mt-6 pt-6 border-t border-[#EEEEEA]">
            <Button type="submit" variant="outline" size="sm" className="w-full text-red-600 hover:bg-red-50 hover:border-red-200">
              Keluar dari Akun
            </Button>
          </form>
        </Card>

        {/* Rincian Penugasan & Kewenangan Organisasi */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Struktur Organisasi & Penugasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Unit Kerja</span>
                  <span className="font-medium text-neutral-900 mt-1 block">
                    {profileData.unit ? `${profileData.unit.name} (${profileData.unit.code})` : 'Belum Ditugaskan'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Jabatan & Level Hierarki</span>
                  <span className="font-medium text-neutral-900 mt-1 block">
                    {profileData.position ? `${profileData.position.name} (Level ${profileData.position.level})` : 'Staf'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Kewenangan Tanda Tangan Resmi</span>
                  <span className="font-medium text-neutral-900 mt-1 block">
                    {profileData.isOfficialSigner ? 'Berwenang (Senior Manager / Direktur Utama)' : 'Tidak Berwenang'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 font-semibold uppercase tracking-wider block">Status Keaktifan Akun</span>
                  <span className="font-medium text-neutral-900 mt-1 block">
                    {profileData.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-lg border border-[#EEEEEA] text-xs text-neutral-600 mt-4 leading-relaxed">
                <b>Catatan Sistem:</b> SIADocs tidak menyimpan gambar tanda tangan atau stempel pada profil. Tanda tangan dokumen selalu dilakukan di luar sistem oleh pejabat penandatangan yang sah. Perubahan unit kerja atau jabatan hanya dapat dilakukan oleh Super Admin melalui Master Organisasi.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

