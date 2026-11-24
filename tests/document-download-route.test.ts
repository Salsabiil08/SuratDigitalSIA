import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({download:vi.fn(),selected:vi.fn(),kind:'SIGNED',source:'CREATE',billing:vi.fn(),internal:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/server/auth',()=>({requireUser:async()=>({id:'actor'})}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:()=>({rpc:async()=>({data:{fullVersionAccess:true,documentVersionId:'signed'},error:null})})}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:()=>({select:()=>({eq:()=>({eq:()=>({order:()=>({limit:()=>({maybeSingle:m.selected})})})})})})})}));
vi.mock('@/server/letter-workflow',()=>({readLetter:async()=>({id:'letter',source:m.source,required_signature_count:2,finalized_at:'2026-11-24',official_number:'123'}),downloadVersion:m.download}));
vi.mock('@/lib/letter-document',()=>({DOCUMENT_MIME:{DOCX:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},fillOfficialNumber:async(b:Uint8Array)=>b}));
vi.mock('@/lib/legacy-billing-output',()=>({correctLegacyBillingOutput:m.billing}));
vi.mock('@/lib/legacy-internal-output',()=>({correctLegacyInternalOutput:m.internal}));
import {GET} from '../src/app/api/letters/[id]/document/route';
beforeEach(()=>{vi.clearAllMocks();m.source='CREATE';m.billing.mockImplementation(async(b:Uint8Array)=>({bytes:b,corrected:false}));m.internal.mockImplementation(async(b:Uint8Array)=>b);m.selected.mockResolvedValue({data:{id:'numbered'},error:null});m.download.mockImplementation(async(l:any)=>({bytes:Buffer.from(l.current_version_id),format:'DOCX',version:{version_kind:l.current_version_id==='numbered'?'NUMBERED':'SIGNED'}}));});
it('unsigned download uses numbered bytes, never signed snapshot',async()=>{
 const response=await GET(new Request('https://example.test/api/letters/letter/document?blank=1&variant=unsigned'),{params:Promise.resolve({id:'letter'})});
 expect(response.status).toBe(200);expect(await response.text()).toBe('numbered');expect(response.headers.get('X-SIADocs-Document-Variant')).toBe('unsigned');
});
it('rejects signed bytes returned as the numbered source',async()=>{
 m.download.mockResolvedValue({bytes:Buffer.from('signed'),format:'DOCX',version:{version_kind:'SIGNED',source:'CREATE',billing:vi.fn(),internal:vi.fn()}});
 const response=await GET(new Request('https://example.test/api/letters/letter/document?variant=unsigned'),{params:Promise.resolve({id:'letter'})});expect(response.status).toBe(403);
});
it('signed download retains signed snapshot',async()=>{
 const response=await GET(new Request('https://example.test/api/letters/letter/document?variant=signed'),{params:Promise.resolve({id:'letter'})});expect(response.status).toBe(200);expect(await response.text()).toBe('signed');expect(response.headers.get('X-SIADocs-Document-Variant')).toBe('signed');
});

it('uploaded letters never receive legacy layout rewrites',async()=>{
 m.source='UPLOAD';const response=await GET(new Request('https://example.test/api/letters/letter/document?variant=signed'),{params:Promise.resolve({id:'letter'})});expect(await response.text()).toBe('signed');expect(m.billing).not.toHaveBeenCalled();expect(m.internal).not.toHaveBeenCalled();
});
