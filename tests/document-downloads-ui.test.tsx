import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {DocumentDownloads} from '../src/components/letters/document-downloads';
const numbered={file_format:'DOCX',version_kind:'NUMBERED',file_hash:'unsigned'};
function render(kind:string, fullVersionAccess=true, hash='signed', signatureCount=1){
 return renderToStaticMarkup(<DocumentDownloads id="letter" current={{...numbered,version_kind:kind,file_hash:hash}} unsigned={numbered} signatureCount={signatureCount} fullVersionAccess={fullVersionAccess}/>);
}
it.each(['DRAFT','NUMBERED'])('dokumen %s hanya satu unduhan karena area TTD belum diisi',kind=>{
 const html=render(kind);expect(html.match(/<a /g)).toHaveLength(1);expect(html).toContain('area TTD kosong');expect(html).not.toContain('blank=1');
});
it('salinan berbeda tersedia setelah TTD, hanya untuk hak versi lengkap',()=>{
 expect(render('SIGNED').match(/<a /g)).toHaveLength(2);
 expect(render('SIGNED')).toContain('blank=1');expect(render('SIGNED',false).match(/<a /g)).toHaveLength(1);
 expect(render('SIGNED',true,'unsigned').match(/<a /g)).toHaveLength(1);
});
it('surat tanpa TTD tidak diberi label area TTD kosong',()=>{
 expect(render('NUMBERED',true,'unsigned',0)).not.toContain('area TTD');
});
