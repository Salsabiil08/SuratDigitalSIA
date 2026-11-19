export type ExportFormat='PDF'|'DOCX';
export type ExportVersion={file_format:string;version_kind:string;file_hash:string|null};
export function exportSources(current:ExportVersion,unsigned:ExportVersion|undefined,fullVersionAccess:boolean){
  const signed=current.version_kind==='SIGNED';
  return {
    signed:signed?{format:current.file_format as ExportFormat,blank:false}:null,
    unsigned:!signed?{format:current.file_format as ExportFormat,blank:false}:
      fullVersionAccess&&unsigned?.file_hash&&current.file_hash&&unsigned.file_hash!==current.file_hash?{format:unsigned.file_format as ExportFormat,blank:true}:null,
  };
}
