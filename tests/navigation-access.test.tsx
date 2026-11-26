import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {navigationAccess} from '../src/domain/navigation-access';
vi.mock('next/navigation',()=>({usePathname:()=>'/'}));
vi.mock('next/link',()=>({default:({children,prefetch,...props}:any)=><a {...props}>{children}</a>}));
vi.mock('@/server/actions/auth',()=>({logoutAction:vi.fn()}));
import {Sidebar} from '../src/components/ui/sidebar';
const base={hasAssignment:true,isSuperAdmin:false,isOfficialSigner:false,isFinance:false,reviewerAssigned:false,approverAssigned:false};
function menu(positionCode:string,extra:Partial<typeof base>={}){
 const access=navigationAccess({...base,positionCode,...extra});
 return renderToStaticMarkup(<Sidebar user={{name:'Akun uji',position:positionCode,positionCode,unit:'ACH',access}}/>);
}
it.each(['STF','GM'])('%s memiliki surat/disposisi, tanpa menu kewenangan yang tidak ditugaskan',role=>{
 const html=menu(role);for(const href of ['/surat','/surat/buat','/kotak-masuk','/kotak-keluar','/disposisi'])expect(html).toContain(`href="${href}"`);
 for(const href of ['/pengesahan','/admin/organisasi','/tagihan/buat'])expect(html).not.toContain(`href="${href}"`);
 expect(html).not.toContain('href="/pemeriksaan"');expect(html.includes('href="/persetujuan"')).toBe(role==='GM');
});
it.each(['SM','DIR'])('%s melihat persetujuan dan TTD hanya dengan mandat penandatangan',role=>{
 expect(menu(role)).toContain('href="/persetujuan"');expect(menu(role)).not.toContain('href="/pengesahan"');
 expect(menu(role,{isOfficialSigner:true})).toContain('Tanda Tangan');
});
it('Finance melihat pengantar tagihan, tanpa menjadi penyetuju/penandatangan otomatis',()=>{
 const html=menu('STF',{isFinance:true});expect(html).toContain('href="/tagihan/buat"');expect(html).not.toContain('href="/persetujuan"');expect(html).not.toContain('href="/pengesahan"');
});
it('pemeriksa mengikuti jabatan sedangkan approver tambahan tetap mengikuti mandat',()=>{
 const html=menu('STF',{reviewerAssigned:true,approverAssigned:true});expect(html).not.toContain('href="/pemeriksaan"');expect(html).toContain('href="/persetujuan"');expect(html).not.toContain('href="/pengesahan"');
});
it('Super Admin tanpa penugasan hanya mendapat menu administrasi, bukan kewenangan bisnis',()=>{
 const html=menu('',{hasAssignment:false,isSuperAdmin:true,reviewerAssigned:true,isOfficialSigner:true,isFinance:true});
 for(const href of ['/admin/organisasi','/admin/seri','/admin/log'])expect(html).toContain(`href="${href}"`);
 for(const href of ['/surat/buat','/persetujuan','/pengesahan','/pemeriksaan','/disposisi','/tagihan/buat'])expect(html).not.toContain(`href="${href}"`);
});
