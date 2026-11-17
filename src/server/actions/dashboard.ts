'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/server/auth';

export interface ActionItem {
  id: string;
  kind: 'DISPOSISI' | 'SURAT' | 'PENGESAHAN';
  subject: string;
  typeName: string;
  status: string;
  officialNumber?: string | null;
  recipientText: string;
  link: string;
}

export interface DashboardMetrics {
  draftCount: number;
  numberedCount: number;
  waitingSignatureCount: number;
  activeDispositionsCount: number;
  pendingActions: ActionItem[];
  recentActivities: Array<{
    id: string;
    action: string;
    description: string;
    time: string;
  }>;
}

export async function getDashboardDataAction(): Promise<DashboardMetrics> {
  const supabase = createAdminClient();
  const user = await getCurrentUser();
  const currentUserId = user?.id || 'a0000000-0000-0000-0000-000000000005';

  try {
    // 1. Ambil hitungan status surat
    const { count: draftCount } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'DRAFT');

    const { count: numberedCount } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'NUMBERED');

    const { count: waitingSignatureCount } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('signature_status', 'WAITING');

    const { count: activeDispositionsCount } = await supabase
      .from('dispositions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['NEW', 'IN_PROGRESS']);

    // 2. Ambil hal-hal yang Perlu Tindakan:
    // Bagi Staf & Pegawai: Disposisi Masuk yang belum diselesaikan
    const { data: userDispositions } = await supabase
      .from('dispositions')
      .select(`
        id,
        subject,
        instruction,
        priority,
        status,
        giver:profiles!giver_id (full_name)
      `)
      .eq('recipient_id', currentUserId)
      .in('status', ['NEW', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })
      .limit(5);

    // Draf surat pribadi yang belum terbit
    const { data: userDrafts } = await supabase
      .from('letters')
      .select(`
        id,
        subject,
        status,
        official_number,
        recipient_external_name,
        letter_types (name)
      `)
      .eq('creator_id', currentUserId)
      .eq('status', 'DRAFT')
      .order('created_at', { ascending: false })
      .limit(3);

    // Surat yang menunggu pengesahan tanda tangan
    const { data: waitingSigs } = await supabase
      .from('letters')
      .select(`
        id,
        subject,
        status,
        official_number,
        recipient_external_name,
        letter_types (name)
      `)
      .eq('signature_status', 'WAITING')
      .order('created_at', { ascending: false })
      .limit(3);

    const pendingActions: ActionItem[] = [];

    // Prioritaskan instruksi disposisi dari pimpinan untuk staf
    (userDispositions || []).forEach((d: any) => {
      pendingActions.push({
        id: d.id,
        kind: 'DISPOSISI',
        subject: d.subject,
        typeName: `Disposisi (${d.priority})`,
        status: d.status === 'NEW' ? 'Perlu Dikerjakan' : 'Sedang Diproses',
        officialNumber: d.giver?.full_name ? `Dari: ${d.giver.full_name}` : 'Instruksi Pimpinan',
        recipientText: d.instruction,
        link: '/disposisi',
      });
    });

    // Draf surat
    (userDrafts || []).forEach((l: any) => {
      pendingActions.push({
        id: l.id,
        kind: 'SURAT',
        subject: l.subject,
        typeName: l.letter_types?.name || 'Surat Dinas',
        status: 'Draft (Belum Bernomor)',
        officialNumber: 'Draft',
        recipientText: l.recipient_external_name || 'Internal SIA',
        link: `/surat/${l.id}`,
      });
    });

    // Pengesahan
    (waitingSigs || []).forEach((l: any) => {
      pendingActions.push({
        id: l.id,
        kind: 'PENGESAHAN',
        subject: l.subject,
        typeName: l.letter_types?.name || 'Surat Dinas',
        status: 'Menunggu Pengesahan TTD',
        officialNumber: l.official_number,
        recipientText: l.recipient_external_name || 'Internal SIA',
        link: '/pengesahan',
      });
    });

    // 3. Ambil aktivitas terbaru dari audit_logs
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('id, action, official_number, reason, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(5);

    const recentActivities = (auditLogs || []).map((log: any) => ({
      id: log.id,
      action: log.action,
      description: log.official_number
        ? `Nomor ${log.official_number} diproses (${log.reason || log.action})`
        : log.reason || log.action,
      time: new Date(log.occurred_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB',
    }));

    return {
      draftCount: draftCount || 0,
      numberedCount: numberedCount || 0,
      waitingSignatureCount: waitingSignatureCount || 0,
      activeDispositionsCount: activeDispositionsCount || 0,
      pendingActions,
      recentActivities,
    };
  } catch (err) {
    return {
      draftCount: 0,
      numberedCount: 0,
      waitingSignatureCount: 0,
      activeDispositionsCount: 0,
      pendingActions: [],
      recentActivities: [],
    };
  }
}
