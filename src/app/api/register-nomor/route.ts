import JSZip from 'jszip';
import { numberRegister } from '@/server/number-register';

const sheetNs='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const officeNs='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const relsNs='http://schemas.openxmlformats.org/package/2006/relationships';
const xml = (value:string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export async function GET(request:Request) {
  try {
    const register = await numberRegister(new URL(request.url).searchParams);
    const cells:Array<Array<string|number|null>> = [register.columns];
    for(let offset=0;;offset+=500) {
      const rows=await register.read(offset,500);
      cells.push(...rows.map(register.cells));
      if(rows.length<500) break;
      if(offset>=19500) {
        if((await register.read(20000,1)).length) return Response.json({error:'Persempit filter untuk mengekspor maksimal 20.000 nomor.'},{status:413});
        break;
      }
    }
    const rows=cells.map(row=>'<row>'+row.map(value=>typeof value==='number'
      ? '<c><v>'+value+'</v></c>'
      : '<c t="inlineStr"><is><t xml:space="preserve">'+xml(value??'')+'</t></is></c>').join('')+'</row>').join('');
    const zip=new JSZip();
    zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    zip.file('_rels/.rels',`<Relationships xmlns="${relsNs}"><Relationship Id="rId1" Type="${officeNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file('xl/workbook.xml',`<workbook xmlns="${sheetNs}" xmlns:r="${officeNs}"><sheets><sheet name="Register Nomor" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels',`<Relationships xmlns="${relsNs}"><Relationship Id="rId1" Type="${officeNs}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
    zip.file('xl/worksheets/sheet1.xml',`<worksheet xmlns="${sheetNs}"><sheetData>${rows}</sheetData></worksheet>`);
    return new Response(await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'}),{headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':'attachment; filename="register-nomor-surat.xlsx"',
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
    }});
  } catch {
    return Response.json({error:'Ekspor register belum dapat dibuat.'},{status:400});
  }
}
