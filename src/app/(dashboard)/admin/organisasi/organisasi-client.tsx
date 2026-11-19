'use client';
import {ActionNotice} from "@/components/ui/action-notice";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Chip } from '@/components/ui/chip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  createUnitAction,
  updateUnitAction,
  deleteUnitAction,
  createPositionAction,
  updatePositionAction,
  deletePositionAction,
} from '@/server/actions/master-organisasi';

export interface UnitItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface PositionItem {
  id: string;
  code: string;
  name: string;
  level: number;
  isActive: boolean;
}

interface OrganisasiClientProps {
  initialUnits: UnitItem[];
  initialPositions: PositionItem[];
}

export function OrganisasiClient({ initialUnits, initialPositions }: OrganisasiClientProps) {
  const router = useRouter();
  const [units, setUnits] = React.useState<UnitItem[]>(initialUnits);
  const [positions, setPositions] = React.useState<PositionItem[]>(initialPositions);

  // Alert message
  const [alert, setAlert] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Modal State - Unit Kerja
  const [isUnitModalOpen, setIsUnitModalOpen] = React.useState(false);
  const [editingUnit, setEditingUnit] = React.useState<UnitItem | null>(null);
  const [unitCode, setUnitCode] = React.useState('');
  const [unitName, setUnitName] = React.useState('');
  const [unitIsActive, setUnitIsActive] = React.useState(true);

  // Modal State - Jabatan
  const [isPositionModalOpen, setIsPositionModalOpen] = React.useState(false);
  const [editingPosition, setEditingPosition] = React.useState<PositionItem | null>(null);
  const [positionCode, setPositionCode] = React.useState('');
  const [positionName, setPositionName] = React.useState('');
  const [positionLevel, setPositionLevel] = React.useState<number>(1);
  const [positionIsActive, setPositionIsActive] = React.useState(true);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = React.useState<{
    type: 'unit' | 'position';
    id: string;
    name: string;
  } | null>(null);

  // Sinkronkan state lokal bila props server berubah (misal setelah refresh)
  React.useEffect(() => {
    setUnits(initialUnits);
  }, [initialUnits]);

  React.useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  // Posisi aktif untuk bagan hirarki
  const dirPosition = positions.find((p) => p.level === 4 && p.isActive);
  const smPosition = positions.find((p) => p.level === 3 && p.isActive);
  const gmPosition = positions.find((p) => p.level === 2 && p.isActive);
  const stfPosition = positions.find((p) => p.level === 1 && p.isActive);

  // -------------------------------------------------------------
  // Unit Handlers
  // -------------------------------------------------------------
  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitCode('');
    setUnitName('');
    setUnitIsActive(true);
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnit = (unit: UnitItem) => {
    setEditingUnit(unit);
    setUnitCode(unit.code);
    setUnitName(unit.name);
    setUnitIsActive(unit.isActive);
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitCode.trim() || !unitName.trim()) {
      setAlert({ text: 'Kode dan nama unit kerja wajib diisi.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setAlert(null);

    try {
      if (editingUnit) {
        const res = await updateUnitAction({
          id: editingUnit.id,
          code: unitCode,
          name: unitName,
          isActive: unitIsActive,
        });

        if (res.success) {
          const updated = res.data as any;
          setUnits((prev) =>
            prev.map((u) =>
              u.id === editingUnit.id
                ? {
                    ...u,
                    code: updated?.code || unitCode.toUpperCase(),
                    name: updated?.name || unitName,
                    isActive: updated?.is_active ?? unitIsActive,
                  }
                : u
            ).sort((a, b) => a.code.localeCompare(b.code))
          );
          setAlert({ text: `Unit kerja "${unitCode.toUpperCase()}" berhasil diperbarui.`, type: 'success' });
          setIsUnitModalOpen(false);
          router.refresh();
        } else {
          setAlert({ text: res.error || 'Gagal memperbarui unit kerja.', type: 'error' });
        }
      } else {
        const res = await createUnitAction({
          code: unitCode,
          name: unitName,
        });

        if (res.success) {
          const inserted = res.data as any;
          const newUnit: UnitItem = {
            id: inserted?.id || 'unit-' + Date.now(),
            code: inserted?.code || unitCode.toUpperCase(),
            name: inserted?.name || unitName,
            isActive: inserted?.is_active ?? true,
          };
          setUnits((prev) =>
            [...prev.filter((u) => u.id !== newUnit.id), newUnit].sort((a, b) =>
              a.code.localeCompare(b.code)
            )
          );
          setAlert({ text: `Unit kerja "${unitCode.toUpperCase()}" berhasil ditambahkan.`, type: 'success' });
          setIsUnitModalOpen(false);
          router.refresh();
        } else {
          setAlert({ text: res.error || 'Gagal menambahkan unit kerja.', type: 'error' });
        }
      }
    } catch (err: any) {
      setAlert({ text: err.message || 'Terjadi kesalahan sistem.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Position Handlers
  // -------------------------------------------------------------
  const handleOpenAddPosition = () => {
    setEditingPosition(null);
    setPositionCode('');
    setPositionName('');
    setPositionLevel(1);
    setPositionIsActive(true);
    setIsPositionModalOpen(true);
  };

  const handleOpenEditPosition = (pos: PositionItem) => {
    setEditingPosition(pos);
    setPositionCode(pos.code);
    setPositionName(pos.name);
    setPositionLevel(pos.level);
    setPositionIsActive(pos.isActive);
    setIsPositionModalOpen(true);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!positionCode.trim() || !positionName.trim()) {
      setAlert({ text: 'Kode dan nama jabatan wajib diisi.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setAlert(null);

    try {
      if (editingPosition) {
        const res = await updatePositionAction({
          id: editingPosition.id,
          code: positionCode,
          name: positionName,
          level: positionLevel,
          isActive: positionIsActive,
        });

        if (res.success) {
          const updated = res.data as any;
          setPositions((prev) =>
            prev.map((p) =>
              p.id === editingPosition.id
                ? {
                    ...p,
                    code: updated?.code || positionCode.toUpperCase(),
                    name: updated?.name || positionName,
                    level: updated?.level ?? positionLevel,
                    isActive: updated?.is_active ?? positionIsActive,
                  }
                : p
            ).sort((a, b) => b.level - a.level)
          );
          setAlert({ text: `Jabatan "${positionName}" berhasil diperbarui.`, type: 'success' });
          setIsPositionModalOpen(false);
          router.refresh();
        } else {
          setAlert({ text: res.error || 'Gagal memperbarui jabatan.', type: 'error' });
        }
      } else {
        const res = await createPositionAction({
          code: positionCode,
          name: positionName,
          level: positionLevel,
        });

        if (res.success) {
          const inserted = res.data as any;
          const newPos: PositionItem = {
            id: inserted?.id || 'pos-' + Date.now(),
            code: inserted?.code || positionCode.toUpperCase(),
            name: inserted?.name || positionName,
            level: inserted?.level ?? positionLevel,
            isActive: inserted?.is_active ?? true,
          };
          setPositions((prev) =>
            [...prev.filter((p) => p.id !== newPos.id), newPos].sort((a, b) => b.level - a.level)
          );
          setAlert({ text: `Jabatan "${positionName}" berhasil ditambahkan.`, type: 'success' });
          setIsPositionModalOpen(false);
          router.refresh();
        } else {
          setAlert({ text: res.error || 'Gagal menambahkan jabatan.', type: 'error' });
        }
      }
    } catch (err: any) {
      setAlert({ text: err.message || 'Terjadi kesalahan sistem.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Delete Execution
  // -------------------------------------------------------------
  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    setAlert(null);

    try {
      if (deleteTarget.type === 'unit') {
        const res = await deleteUnitAction(deleteTarget.id);
        if (res.success) {
          setUnits((prev) => prev.filter((u) => u.id !== deleteTarget.id));
          setAlert({
            text: (res.data as string) || `Unit kerja "${deleteTarget.name}" berhasil dihapus.`,
            type: 'success',
          });
          router.refresh();
        } else {
          setAlert({ text: res.error || 'Gagal menghapus unit kerja.', type: 'error' });
        }
      } else {
        const res = await deletePositionAction(deleteTarget.id);
        if (res.success) {
          setPositions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
          setAlert({
            text: (res.data as string) || `Jabatan "${deleteTarget.name}" berhasil dihapus.`,
            type: 'success',
          });
          router.refresh();
        } else {
          setAlert({ text: res.error || 'Gagal menghapus jabatan.', type: 'error' });
        }
      }
      setDeleteTarget(null);
    } catch (err: any) {
      setAlert({ text: err.message || 'Gagal memproses penghapusan.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-full">
      {/* Header dengan Tombol Responsif Mobile */}
      <PageHeader
        title="Master Organisasi"
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenAddPosition}
              className="flex-1 sm:flex-initial text-xs h-9 justify-center"
            >
              + Tambah Jabatan
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddUnit}
              className="flex-1 sm:flex-initial bg-brand-red hover:bg-[#8F0808] text-xs h-9 justify-center shadow-xs"
            >
              + Tambah Unit Kerja
            </Button>
          </div>
        }
      />

      {/* Alert Banner */}
      {alert && <ActionNotice eventKey={alert} kind={alert.type}>{alert.text}</ActionNotice>}

      {/* ========================================================================= */}
      {/* BAGAN STRUKTUR POHON ORGANISASI (DINAMIS DARI DATA JABATAN AKTIF)        */}
      {/* ========================================================================= */}
      <Card className="p-4 sm:p-6 bg-white overflow-hidden shadow-xs border border-[#EEEEEA]">
        <CardHeader className="p-0 pb-4 text-center">
          <CardTitle className="text-sm sm:text-base font-bold text-neutral-900">
            Bagan Struktur Hierarki Jabatan
          </CardTitle>
        </CardHeader>

        {/* Pohon Hierarki Bersih (1 Cabang SM, Rapi di Mobile & Desktop) */}
        <div className="w-full py-2">
          <div className="w-full max-w-[340px] sm:max-w-[380px] mx-auto flex flex-col items-center">
            {/* LEVEL 4: DIREKTUR UTAMA (CEO) */}
            <div className="flex flex-col items-center relative z-10 w-full">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full ring-3 ring-pink-500/20 overflow-hidden shadow-xs bg-neutral-100 flex items-center justify-center">
                <img
                  src="/images/avatar-user.png"
                  alt="Avatar DIR"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl px-4 py-1.5 sm:py-2 shadow-sm text-center -mt-2 z-20 w-[170px] sm:w-[190px]">
                <div className="font-bold text-xs tracking-tight truncate">
                  {dirPosition?.name || 'Direktur Utama'}
                </div>
                <div className="text-[10px] text-pink-100 font-medium mt-0.5">
                  Level 4 ({dirPosition?.code || 'DIR'})
                </div>
              </div>
            </div>

            {/* Garis Vertikal Bersih dari DIR ke SM */}
            <div className="w-0.5 h-7 sm:h-8 bg-neutral-300"></div>

            {/* LEVEL 3: SENIOR MANAGER (HANYA 1 CABANG SM) */}
            <div className="flex flex-col items-center relative z-10 w-full">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-3 ring-orange-500/20 overflow-hidden shadow-xs bg-neutral-100 flex items-center justify-center">
                <img
                  src="/images/avatar-user.png"
                  alt="Avatar SM"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl px-4 py-1.5 sm:py-2 shadow-sm text-center -mt-2 z-20 w-[160px] sm:w-[180px]">
                <div className="font-bold text-xs tracking-tight truncate">
                  {smPosition?.name || 'Senior Manager'}
                </div>
                <div className="text-[10px] text-orange-100 font-medium mt-0.5">
                  Level 3 ({smPosition?.code || 'SM'})
                </div>
              </div>
            </div>

            {/* Garis Vertikal Bersih dari SM ke Cabang GM */}
            <div className="w-0.5 h-6 sm:h-7 bg-neutral-300"></div>

            {/* CABANG GM & STAFF (2 SUB-UNIT OPERASIONAL & AKUNTANSI) */}
            <div className="w-full relative pt-4">
              {/* Garis Horizontal Cabang Simetris */}
              <div className="absolute top-0 left-[24%] right-[24%] h-0.5 bg-neutral-300"></div>

              {/* Garis Vertikal Turun ke Tiap GM */}
              <div className="absolute top-0 left-[24%] w-0.5 h-4 bg-neutral-300"></div>
              <div className="absolute top-0 right-[24%] w-0.5 h-4 bg-neutral-300"></div>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full">
                {/* KOLOM KIRI: GM UNIT 1 -> STAFF 1 */}
                <div className="flex flex-col items-center">
                  {/* GM Kiri */}
                  <div className="w-10 h-10 rounded-full ring-3 ring-emerald-500/20 overflow-hidden shadow-xs bg-neutral-100 flex items-center justify-center">
                    <img
                      src="/images/avatar-user.png"
                      alt="Avatar GM"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg px-2 sm:px-3 py-1 shadow-xs text-center -mt-1.5 z-10 w-full max-w-[135px] sm:max-w-[155px]">
                    <div className="font-bold text-[11px] leading-tight truncate">
                      {gmPosition?.name || 'GM / Ka. Unit'}
                    </div>
                    <div className="text-[9px] text-emerald-100 mt-0.5">
                      Level 2 ({gmPosition?.code || 'GM'})
                    </div>
                  </div>

                  {/* Garis Vertikal Turun ke Staff Kiri */}
                  <div className="w-0.5 h-6 bg-neutral-300"></div>

                  {/* Staff Kiri */}
                  <div className="w-9 h-9 rounded-full ring-3 ring-sky-500/20 overflow-hidden shadow-xs bg-neutral-100 flex items-center justify-center">
                    <img
                      src="/images/avatar-user.png"
                      alt="Avatar Staff"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg px-2 sm:px-3 py-1 shadow-xs text-center -mt-1.5 z-10 w-full max-w-[125px] sm:max-w-[145px]">
                    <div className="font-bold text-[10px] leading-tight truncate">
                      {stfPosition?.name || 'Staff / PIC'}
                    </div>
                    <div className="text-[9px] text-sky-100 mt-0.5">
                      Level 1 ({stfPosition?.code || 'STF'})
                    </div>
                  </div>
                </div>

                {/* KOLOM KANAN: GM UNIT 2 -> STAFF 2 */}
                <div className="flex flex-col items-center">
                  {/* GM Kanan */}
                  <div className="w-10 h-10 rounded-full ring-3 ring-emerald-500/20 overflow-hidden shadow-xs bg-neutral-100 flex items-center justify-center">
                    <img
                      src="/images/avatar-user.png"
                      alt="Avatar GM"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg px-2 sm:px-3 py-1 shadow-xs text-center -mt-1.5 z-10 w-full max-w-[135px] sm:max-w-[155px]">
                    <div className="font-bold text-[11px] leading-tight truncate">
                      {gmPosition?.name || 'GM / Ka. Unit'}
                    </div>
                    <div className="text-[9px] text-emerald-100 mt-0.5">
                      Level 2 ({gmPosition?.code || 'GM'})
                    </div>
                  </div>

                  {/* Garis Vertikal Turun ke Staff Kanan */}
                  <div className="w-0.5 h-6 bg-neutral-300"></div>

                  {/* Staff Kanan */}
                  <div className="w-9 h-9 rounded-full ring-3 ring-sky-500/20 overflow-hidden shadow-xs bg-neutral-100 flex items-center justify-center">
                    <img
                      src="/images/avatar-user.png"
                      alt="Avatar Staff"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg px-2 sm:px-3 py-1 shadow-xs text-center -mt-1.5 z-10 w-full max-w-[125px] sm:max-w-[145px]">
                    <div className="font-bold text-[10px] leading-tight truncate">
                      {stfPosition?.name || 'Staff / PIC'}
                    </div>
                    <div className="text-[9px] text-sky-100 mt-0.5">
                      Level 1 ({stfPosition?.code || 'STF'})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* TABEL UNIT KERJA & TABEL JABATAN DENGAN AKSI CRUD LENGKAP */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start w-full">
        {/* TABEL UNIT KERJA */}
        <Card className="overflow-hidden border border-[#EEEEEA]">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 py-3.5 px-4 sm:px-5 border-b border-[#EEEEEA]">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-neutral-900">
                Unit Kerja ({units.length})
              </CardTitle>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Digunakan pada pola penomoran surat internal & tagihan
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddUnit}
              className="bg-brand-red hover:bg-[#8F0808] text-xs font-semibold shrink-0 h-8 px-3"
            >
              + Tambah Unit
            </Button>
          </CardHeader>

          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 sm:w-20">Kode</TableHead>
                  <TableHead>Nama Unit</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono font-bold text-neutral-900 text-xs sm:text-sm">
                      {u.code}
                    </TableCell>
                    <TableCell className="font-medium text-neutral-800 text-xs sm:text-sm">
                      {u.name}
                    </TableCell>
                    <TableCell>
                      <Chip variant={u.isActive ? 'green' : 'gray'}>
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEditUnit(u)}
                          className="h-7 px-2 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({ type: 'unit', id: u.id, name: `${u.code} - ${u.name}` })
                          }
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* TABEL JABATAN & LEVEL */}
        <Card className="overflow-hidden border border-[#EEEEEA]">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 py-3.5 px-4 sm:px-5 border-b border-[#EEEEEA]">
            <div>
              <CardTitle className="text-sm sm:text-base font-bold text-neutral-900">
                Daftar Jabatan ({positions.length})
              </CardTitle>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Level 3 (SM) & 4 (DIR) berwenang tanda tangan dokumen sah
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenAddPosition}
              className="text-xs font-semibold shrink-0 h-8 px-3"
            >
              + Tambah Jabatan
            </Button>
          </CardHeader>

          <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 sm:w-20">Kode</TableHead>
                  <TableHead>Nama Jabatan</TableHead>
                  <TableHead className="w-16 sm:w-20">Level</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-bold text-neutral-900 text-xs sm:text-sm">
                      {p.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-neutral-800 text-xs sm:text-sm leading-tight">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">
                        {p.level >= 3 ? '✓ Penandatangan Sah' : 'Pelaksana / Disposisi'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-[11px] sm:text-xs px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 border border-neutral-200">
                        L{p.level}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip variant={p.isActive ? 'green' : 'gray'}>
                        {p.isActive ? 'Aktif' : 'Nonaktif'}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEditPosition(p)}
                          className="h-7 px-2 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({ type: 'position', id: p.id, name: `${p.code} - ${p.name}` })
                          }
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Catatan Aturan */}
      <div className="p-3.5 sm:p-4 bg-white/70 border border-[#E4E4E0] rounded-xl text-[11px] sm:text-xs text-neutral-500 leading-relaxed">
        <b>Aturan Master Organisasi:</b> Struktur organisasi SIADocs bersifat dinamis dan tersimpan di database. Kode unit dan jabatan digunakan pada penomoran surat resmi serta batas kewenangan tanda tangan.
      </div>

      {/* ========================================================================= */}
      {/* MODAL FORM: TAMBAH / EDIT UNIT KERJA */}
      {/* ========================================================================= */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#EEEEEA]">
              <h3 className="font-bold text-sm sm:text-base text-neutral-900 m-0">
                {editingUnit ? 'Edit Unit Kerja' : 'Tambah Unit Kerja Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4">
              <Field label="Kode Unit Kerja *" hint="Singkatan unik unit kerja (contoh: SDM, ENG, LOG, FIN)">
                <Input
                  required
                  placeholder="Misal: SDM"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </Field>

              <Field label="Nama Unit Kerja *" hint="Nama lengkap unit atau divisi perusahaan">
                <Input
                  required
                  placeholder="Misal: Sumber Daya Manusia"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                />
              </Field>

              {editingUnit && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="unitActive"
                    checked={unitIsActive}
                    onChange={(e) => setUnitIsActive(e.target.checked)}
                    className="w-4 h-4 text-brand-red rounded border-neutral-300 focus:ring-brand-red"
                  />
                  <label htmlFor="unitActive" className="text-xs font-semibold text-neutral-700">
                    Status Unit Kerja Aktif
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEEEEA]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsUnitModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  className="bg-brand-red hover:bg-[#8F0808]"
                >
                  {editingUnit ? 'Simpan Perubahan' : 'Tambah Unit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FORM: TAMBAH / EDIT JABATAN */}
      {/* ========================================================================= */}
      {isPositionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#EEEEEA]">
              <h3 className="font-bold text-sm sm:text-base text-neutral-900 m-0">
                {editingPosition ? 'Edit Jabatan' : 'Tambah Jabatan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsPositionModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="space-y-4">
              <Field label="Kode Jabatan *" hint="Singkatan unik jabatan (contoh: MGR, SPV, DIR, STF)">
                <Input
                  required
                  placeholder="Misal: MGR"
                  value={positionCode}
                  onChange={(e) => setPositionCode(e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </Field>

              <Field label="Nama Jabatan *" hint="Nama resmi jabatan struktural / kedinasan">
                <Input
                  required
                  placeholder="Misal: Manager Operasional"
                  value={positionName}
                  onChange={(e) => setPositionName(e.target.value)}
                />
              </Field>

              <Field label="Tingkat / Level Hirarki *" hint="Tingkat hierarki kewenangan kedinasan">
                <Select
                  value={positionLevel}
                  onChange={(e) => setPositionLevel(Number(e.target.value))}
                >
                  <option value={1}>Level 1 - Staff / PIC Pelaksana</option>
                  <option value={2}>Level 2 - GM / Kepala Unit / Departemen</option>
                  <option value={3}>Level 3 - Senior Manager (Penandatangan Sah)</option>
                  <option value={4}>Level 4 - Direktur Utama (Pucuk Pimpinan)</option>
                </Select>
              </Field>

              {editingPosition && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="posActive"
                    checked={positionIsActive}
                    onChange={(e) => setPositionIsActive(e.target.checked)}
                    className="w-4 h-4 text-brand-red rounded border-neutral-300 focus:ring-brand-red"
                  />
                  <label htmlFor="posActive" className="text-xs font-semibold text-neutral-700">
                    Status Jabatan Aktif
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEEEEA]">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsPositionModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  className="bg-brand-red hover:bg-[#8F0808]"
                >
                  {editingPosition ? 'Simpan Perubahan' : 'Tambah Jabatan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI HAPUS (NATURAL, JELAS & SESUAI PERMINTAAN USER)         */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 border border-[#EEEEEA]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-neutral-900 m-0">
                  {deleteTarget.type === 'unit' ? 'Konfirmasi Hapus Unit Kerja' : 'Konfirmasi Hapus Jabatan'}
                </h3>
                <p className="text-xs text-neutral-600 mt-2 leading-relaxed m-0">
                  Apakah Anda yakin akan menghapus{' '}
                  <span className="font-semibold text-neutral-900">{deleteTarget.type === 'unit' ? 'unit kerja' : 'jabatan'}</span>{' '}
                  <b className="text-neutral-900">"{deleteTarget.name}"</b>?
                </p>
                <p className="text-[11px] text-neutral-500 mt-1 leading-normal m-0">
                  Data yang dihapus akan dinonaktifkan dari sistem penomoran dan master organisasi.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEEEEA]">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                className="text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleExecuteDelete}
                className="bg-red-600 hover:bg-red-700 text-xs font-semibold"
              >
                Ya, Hapus {deleteTarget.type === 'unit' ? 'Unit' : 'Jabatan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
