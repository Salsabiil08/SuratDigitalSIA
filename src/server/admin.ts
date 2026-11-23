import { displayLabel } from '@/domain/display-labels';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from './auth';

export interface UnitData {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface PositionData {
  id: string;
  code: string;
  name: string;
  level: number;
  isActive: boolean;
}

export interface LetterTypeData {
  id: string;
  code: string;
  name: string;
  category: string;
  seriesBasis: string;
  requiredAttachment: boolean;
  defaultSignatureCount: number;
  isActive: boolean;
}

export interface NumberSeriesData {
  id: string;
  letterTypeId: string;
  letterTypeName?: string;
  pattern: string;
  status: string;
  unitCode?: string;
  positionCode?: string;
}

export interface AuditLogData {
  id: string;
  occurredAt: string;
  actorName: string;
  action: string;
  officialNumber?: string;
  letterSubject?: string;
  reason?: string;
  statusBefore?: string;
  statusAfter?: string;
}

/**
 * Mengambil data Master Organisasi (Unit & Jabatan).
 */
export async function getMasterOrganisasi() {
  await requireSuperAdmin();
  try {
    const supabase = createAdminClient();

    const { data: units, error: ue } = await supabase
      .from('organizational_units')
      .select('*')
      .eq('is_active', true)
      .order('code');

    const { data: positions, error: pe } = await supabase
      .from('positions')
      .select('*')
      .eq('is_active', true)
      .order('level', { ascending: false });

    if(ue||pe)throw new Error("query");
    return {
      units: (units || []).map((u) => ({
        id: u.id,
        code: u.code,
        name: u.name,
        isActive: u.is_active,
      })),
      positions: (positions || []).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        level: p.level,
        isActive: p.is_active,
      })),
    };
  } catch (err) {
    throw new Error("Data organisasi belum dapat dimuat. Silakan coba kembali.");
  }
}

/**
 * Mengambil data Master Jenis Surat & Seri Penomoran.
 */
export async function getMasterSeri() {
  await requireSuperAdmin();
  try {
    const supabase = createAdminClient();

    const { data: types, error: te } = await supabase
      .from('letter_types')
      .select('*')
      .order('code');

    const { data: series, error: se } = await supabase
      .from('number_series')
      .select(`
        id,
        letter_type_id,
        pattern,
        status,
        unit:organizational_units(code),
        position:positions(code),
        letter_type:letter_types(name)
      `)
      .order('pattern');

    if(te||se)throw new Error("query");
    return {
      types: (types || []).map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        category: t.category,
        seriesBasis: t.series_basis,
        requiredAttachment: t.required_attachment,
        defaultSignatureCount: t.default_signature_count,
        isActive: t.is_active,
      })),
      series: (series || []).map((s) => ({
        id: s.id,
        letterTypeId: s.letter_type_id,
        letterTypeName: (s.letter_type as unknown as { name: string })?.name || '',
        pattern: s.pattern,
        status: s.status,
        unitCode: (s.unit as unknown as { code: string })?.code,
        positionCode: (s.position as unknown as { code: string })?.code,
      })),
    };
  } catch (err) {
    throw new Error("Seri penomoran belum dapat dimuat. Silakan coba kembali.");
  }
}

/**
 * Mengambil Log History khusus Super Admin.
 */
export async function getAuditLogs(limit = 50): Promise<AuditLogData[]> {
  await requireSuperAdmin();
  try {
    const supabase = createAdminClient();

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select(`
        id,
        occurred_at,
        action,
        official_number,
        reason,
        status_before,
        status_after,
        actor:profiles!actor_id (full_name),
        letter:letters (subject)
      `)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error || !logs) {
      throw new Error("Riwayat aktivitas belum dapat dimuat.");
    }

    return logs.map((l) => ({
      id: l.id,
      occurredAt: l.occurred_at,
      actorName: (l.actor as unknown as { full_name: string })?.full_name || 'Sistem',
      action: displayLabel(l.action),
      officialNumber: l.official_number || undefined,
      letterSubject: (l.letter as unknown as { subject: string })?.subject || undefined,
      reason: l.reason || undefined,
      statusBefore: l.status_before ? displayLabel(l.status_before) : undefined,
      statusAfter: l.status_after ? displayLabel(l.status_after) : undefined,
    }));
  } catch (err) {
    throw new Error("Riwayat aktivitas belum dapat dimuat.");
  }
}
