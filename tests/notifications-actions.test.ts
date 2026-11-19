import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ user: vi.fn(), client: vi.fn(), read: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/server/auth', () => ({ requireUser: mocks.user }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }));
vi.mock('@/server/notifications', () => ({ readNotifications: mocks.read }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import * as actions from '../src/server/actions/notifications';
let query: any;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: 'owner', isActive: true });
  query = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'n' }, error: null }) };
  mocks.client.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
});
describe('Notifikasi: batas Server Action', () => {
  it('tidak mengekspor pembuat event publik dengan service role', () => {
    expect(Object.keys(actions).sort()).toEqual(['getNotificationsAction', 'markAllNotificationsAsReadAction', 'markNotificationAsReadAction']);
  });
  it('menolak tanpa akun aktif sebelum akses database', async () => {
    mocks.user.mockRejectedValue(new Error('inactive'));
    expect((await actions.markNotificationAsReadAction('n')).success).toBe(false);
    expect((await actions.markAllNotificationsAsReadAction()).success).toBe(false);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it('memfilter penerima dari sesi, bukan payload browser', async () => {
    expect((await actions.markNotificationAsReadAction('n')).success).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('recipient_id', 'owner');
    expect(query.eq).toHaveBeenCalledWith('id', 'n');
    expect(query.update.mock.calls[0][0]).toMatchObject({ is_read: true });
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: 'secret database detail' } }])('ID asing/hilang dan write gagal tidak berhasil', async result => {
    query.maybeSingle.mockResolvedValue(result);
    const response = await actions.markNotificationAsReadAction('foreign');
    expect(response.success).toBe(false);
    expect(JSON.stringify(response)).not.toContain('secret');
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('semua dibaca hanya mengubah milik sesi yang belum dibaca', async () => {
    query.eq.mockImplementation((key: string) => key === 'is_read' ? Promise.resolve({ error: null }) : query);
    expect((await actions.markAllNotificationsAsReadAction()).success).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('recipient_id', 'owner');
    expect(query.eq).toHaveBeenCalledWith('is_read', false);
  });
  it('semua dibaca mengembalikan kegagalan database', async () => {
    query.eq.mockImplementation((key: string) => key === 'is_read' ? Promise.resolve({ error: { message: 'private' } }) : query);
    expect((await actions.markAllNotificationsAsReadAction()).success).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it('gagal baca tidak dilaporkan sebagai daftar kosong yang berhasil', async () => {
    mocks.read.mockRejectedValue(new Error('private'));
    expect(await actions.getNotificationsAction()).toMatchObject({ success: false, data: [], unreadCount: 0 });
  });
});
