import {it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({rpc:m.rpc})}));
import {readDashboardActivities} from '../src/server/dashboard-activities';
beforeEach(()=>vi.resetAllMocks());
it('uses a session-only summary without actor override or private reasons',async()=>{m.rpc.mockResolvedValue({data:[{id:'x',action:'DRAFT_SAVED',subject:'Contoh',official_number:null,occurred_at:'2026-11-24T00:00:00Z',reason:'RAHASIA'}],error:null});const rows=await readDashboardActivities();expect(m.rpc).toHaveBeenCalledWith('get_dashboard_letter_activity');expect(rows[0]?.description).toBe('Draft disimpan — Contoh');expect(rows[0]?.time).toContain('07.00');expect(JSON.stringify(rows)).not.toContain('RAHASIA');});
it('query failure is not an empty success',async()=>{m.rpc.mockResolvedValue({data:null,error:{message:'error'}});await expect(readDashboardActivities()).rejects.toThrow('belum dapat dimuat');});
