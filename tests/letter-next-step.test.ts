import {it,expect} from 'vitest';
import {letterNextStep} from '../src/domain/letter-next-step';
import {higherReviewer} from '../src/domain/reviewer-hierarchy';
const actor={creator:true,review:false,approval:false,signing:false,sent:false,recipient:false,received:false};
const letter={status:'DRAFT',required_signature_count:1,signature_mode:'IN_APP'};
it('staff can only select higher positions; GM cannot select staff or peer GM; DIR cannot self-review',()=>{
 expect([1,2,3,4].filter(x=>higherReviewer(1,x))).toEqual([2,3,4]);expect([1,2,3,4].filter(x=>higherReviewer(2,x))).toEqual([3,4]);expect(higherReviewer(4,4)).toBe(false);expect(higherReviewer(0,4)).toBe(false);
});
it('guides the current actor without treating number, signature, finality and delivery as one state',()=>{
 expect(letterNextStep(letter,actor).target).toBe('preview');
 expect(letterNextStep({...letter,status:'IN_REVIEW'},actor).title).toBe('Menunggu persetujuan');
 expect(letterNextStep({...letter,status:'READY_TO_ISSUE'},actor).target).toBe('number');
 expect(letterNextStep({...letter,status:'NUMBERED',signature_status:'WAITING'},actor).target).toBeUndefined();
 expect(letterNextStep({...letter,status:'NUMBERED'}, {...actor,creator:false,signing:true}).target).toBe('signing');
 expect(letterNextStep({...letter,status:'NUMBERED',signature_status:'UPLOADED'},actor).target).toBe('finalize');
 expect(letterNextStep({...letter,status:'NUMBERED',finalized_at:'now'},actor).target).toBe('delivery');
 expect(letterNextStep(letter,{...actor,creator:false,sent:true,recipient:true}).title).toBe('Konfirmasi penerimaan');
});
