import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { downloadLetterhead } from '@/server/letterhead';

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user?.isActive||!user.isSuperAdmin)return new NextResponse('Akses ditolak.',{status:403});
  const {id}=await params;
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return new NextResponse('Kop tidak ditemukan.',{status:404});
  const {data,error}=await createAdminClient().from('letter_templates')
    .select('template_path,template_hash,original_file_name,version').eq('id',id).not('template_path','is',null).maybeSingle();
  if(error)return new NextResponse('Kop belum dapat dimuat.',{status:500});
  if(!data?.template_path||!data.template_hash)return new NextResponse('Kop tidak ditemukan.',{status:404});
  try {
    const bytes=await downloadLetterhead(data.template_path,data.template_hash);
    const fileName=encodeURIComponent(data.original_file_name||`Kop-Surat-v${data.version}.docx`).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
    const preview=new URL(request.url).searchParams.has('preview');
    return new NextResponse(new Uint8Array(bytes),{headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition':`${preview?'inline':'attachment'}; filename*=UTF-8''${fileName}`,
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
    }});
  } catch {
    return new NextResponse('Berkas kop tidak tersedia.',{status:404});
  }
}
