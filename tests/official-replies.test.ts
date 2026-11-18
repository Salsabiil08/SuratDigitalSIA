import {expect,it} from 'vitest';
import {replyDraft} from '../src/domain/official-replies';
import {letterText} from '../src/domain/rich-text';
const seed={dispatchId:'dispatch',senderId:'sender',officialNumber:'001-IN/SIA/2026',subject:'Permintaan <script>alert(1)</script>',categoryCode:'PERMOHONAN'};
const key='b0000000-0000-0000-0000-000000000001';
it('balasan memakai identitas baru, referensi aman dan kategori awal tanpa menyalin nomor/keputusan',()=>{
 const input=replyDraft(seed,key);expect(input.id).toBeUndefined();expect(input.recipientUserId).toBe(seed.senderId);expect(input.categoryCode).toBe('PERMOHONAN');expect(input.replyToDispatchId).toBe(seed.dispatchId);expect(input.replyKey).toBe(key);
 expect(input.signerIds).toEqual([]);expect(input.reviewerId).toBeUndefined();expect(input).not.toHaveProperty('official_number');expect(input).not.toHaveProperty('finalized_at');expect(input.content).not.toContain('<script>');expect(letterText(input.content!)).toContain(seed.officialNumber);
});
it('kunci retry wajib UUID, bukan input SQL atau aktor',()=>{expect(()=>replyDraft(seed,"' OR 1=1")).toThrow(/Kunci/);});
