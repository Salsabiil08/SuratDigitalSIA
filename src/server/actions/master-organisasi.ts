'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Tambah Unit Kerja baru ke database
 */
export async function createUnitAction(formData: {
  code: string;
  name: string;
}): Promise<ActionResult> {
  try {
    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();

    if (!code || !name) {
      return { success: false, error: 'Kode unit dan nama unit kerja wajib diisi.' };
    }

    const supabase = createAdminClient();

    // Periksa apakah kode unit sudah ada
    const { data: existing } = await supabase
      .from('organizational_units')
      .select('id, is_active')
      .ilike('code', code)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        // Aktifkan kembali unit yang sebelumnya nonaktif
        const { data: reactivated, error: reactivateErr } = await supabase
          .from('organizational_units')
          .update({ name, is_active: true })
          .eq('id', existing.id)
          .select('id, code, name, is_active')
          .single();

        if (reactivateErr) {
          return { success: false, error: reactivateErr.message };
        }
        revalidatePath('/admin/organisasi');
        return { success: true, data: reactivated };
      }
      return { success: false, error: `Unit kerja dengan kode "${code}" sudah terdaftar.` };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('organizational_units')
      .insert({
        code,
        name,
        is_active: true,
      })
      .select('id, code, name, is_active')
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath('/admin/organisasi');
    return { success: true, data: inserted };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menambahkan unit kerja.' };
  }
}

/**
 * Update Unit Kerja (Nama, Kode, atau Status Aktif)
 */
export async function updateUnitAction(formData: {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const { id, isActive } = formData;
    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();

    if (!id || !code || !name) {
      return { success: false, error: 'ID, kode unit, dan nama unit wajib diisi.' };
    }

    const supabase = createAdminClient();

    const { data: updated, error: updateError } = await supabase
      .from('organizational_units')
      .update({
        code,
        name,
        is_active: isActive,
      })
      .eq('id', id)
      .select('id, code, name, is_active')
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/admin/organisasi');
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal memperbarui unit kerja.' };
  }
}

/**
 * Hapus Unit Kerja (Hard delete atau Soft-delete)
 */
export async function deleteUnitAction(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID unit kerja tidak valid.' };
    }

    const supabase = createAdminClient();

    // 1. Coba hapus langsung
    const { error: deleteError } = await supabase
      .from('organizational_units')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // 2. Jika ada foreign key constraints (surat / assignment), nonaktifkan agar tidak muncul
      const { error: updateError } = await supabase
        .from('organizational_units')
        .update({ is_active: false })
        .eq('id', id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath('/admin/organisasi');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus unit kerja.' };
  }
}

/**
 * Tambah Jabatan baru
 */
export async function createPositionAction(formData: {
  code: string;
  name: string;
  level: number;
}): Promise<ActionResult> {
  try {
    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();
    const level = Number(formData.level) || 1;

    if (!code || !name) {
      return { success: false, error: 'Kode jabatan dan nama jabatan wajib diisi.' };
    }

    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from('positions')
      .select('id, is_active')
      .ilike('code', code)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        // Aktifkan kembali jabatan yang sebelumnya dinonaktifkan
        const { data: reactivated, error: reactivateErr } = await supabase
          .from('positions')
          .update({ name, level, is_active: true })
          .eq('id', existing.id)
          .select('id, code, name, level, is_active')
          .single();

        if (reactivateErr) {
          return { success: false, error: reactivateErr.message };
        }
        revalidatePath('/admin/organisasi');
        return { success: true, data: reactivated };
      }
      return { success: false, error: `Jabatan dengan kode "${code}" sudah terdaftar.` };
    }

    const { data: inserted, error: insertError } = await supabase
      .from('positions')
      .insert({
        code,
        name,
        level,
        is_active: true,
      })
      .select('id, code, name, level, is_active')
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    revalidatePath('/admin/organisasi');
    return { success: true, data: inserted };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menambahkan jabatan.' };
  }
}

/**
 * Update Jabatan
 */
export async function updatePositionAction(formData: {
  id: string;
  code: string;
  name: string;
  level: number;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const { id, isActive } = formData;
    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();
    const level = Number(formData.level) || 1;

    if (!id || !code || !name) {
      return { success: false, error: 'ID, kode jabatan, dan nama jabatan wajib diisi.' };
    }

    const supabase = createAdminClient();

    const { data: updated, error: updateError } = await supabase
      .from('positions')
      .update({
        code,
        name,
        level,
        is_active: isActive,
      })
      .eq('id', id)
      .select('id, code, name, level, is_active')
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath('/admin/organisasi');
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal memperbarui jabatan.' };
  }
}

/**
 * Hapus Jabatan
 */
export async function deletePositionAction(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID jabatan tidak valid.' };
    }

    const supabase = createAdminClient();

    // 1. Lepaskan relasi penugasan/seri jika memungkinkan
    try {
      await supabase.from('user_assignments').delete().eq('position_id', id);
      await supabase.from('number_series').update({ position_id: null }).eq('position_id', id);
    } catch {
      // Abaikan jika tidak ada baris
    }

    // 2. Coba delete langsung
    const { error: deleteError } = await supabase
      .from('positions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // 3. Jika terikat foreign key historis yang tidak bisa dihapus, nonaktifkan (is_active = false)
      const { error: updateError } = await supabase
        .from('positions')
        .update({ is_active: false })
        .eq('id', id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    revalidatePath('/admin/organisasi');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghapus jabatan.' };
  }
}
