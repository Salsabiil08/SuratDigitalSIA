import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import {DocumentDownloads} from '../src/components/letters/document-downloads';
import {exportSources} from '../src/domain/document-export';
const numbered={file_format:'DOCX',version_kind:'NUMBERED',file_hash:'unsigned'};
const signed={file_format:'PDF',version_kind:'SIGNED',file_hash:'signed'};
it('one download action with separate signature and format choices',()=>{
 const html=renderToStaticMarkup(<DocumentDownloads id="letter" current={signed} unsigned={numbered} signatureCount={1} fullVersionAccess/>);
 expect(html.match(/<button /g)).toHaveLength(1);expect(html.match(/<select /g)).toHaveLength(2);expect(html).toContain('Bertanda tangan');expect(html).toContain('Belum bertanda tangan');expect(html).toContain('PDF');expect(html).toContain('DOCX');expect(html).not.toContain('<a ');
});
it('keeps each original format distinct after a wet PDF signature on a DOCX source',()=>{
 expect(exportSources(signed,numbered,true)).toEqual({signed:{format:'PDF',blank:false},unsigned:{format:'DOCX',blank:true}});
});
it('never offers unsigned history through recipient-only rights or missing/identical hashes',()=>{
 expect(exportSources(signed,numbered,false).unsigned).toBeNull();expect(exportSources(signed,undefined,true).unsigned).toBeNull();expect(exportSources(signed,{...numbered,file_hash:'signed'},true).unsigned).toBeNull();
});
it('unsigned draft has no signed option and documents without TTD show only format selector',()=>{
 expect(exportSources(numbered,undefined,true).signed).toBeNull();
 const html=renderToStaticMarkup(<DocumentDownloads id="l" current={numbered} signatureCount={0} fullVersionAccess/>);expect(html.match(/<select /g)).toHaveLength(1);expect(html).not.toContain('Versi surat');
});
