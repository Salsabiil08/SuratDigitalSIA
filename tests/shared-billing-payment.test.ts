import {expect,it} from 'vitest';
import {billingItemsWithSharedPayment,validateBillingItems} from '../src/domain/billing';
it('accepts three-field rows with shared payment details and keeps the original amounts',()=>{
 const items=billingItemsWithSharedPayment({items:[{documentNumber:'INV-1',description:'Jasa',amount:1500000},{documentNumber:'INV-2',description:'Barang',amount:2000000}],accountHolder:'Penerima',accountNumber:'123'},'Bank Pilihan');
 expect(()=>validateBillingItems(items)).not.toThrow();expect(items.map(i=>i.amount)).toEqual([1500000,2000000]);expect(items.every(i=>i.payeeName==='Penerima'&&i.accountNumber==='123'&&i.bankName==='Bank Pilihan')).toBe(true);
});
it('preserves old row-specific payment details rather than silently overwriting them',()=>{
 const row={documentNumber:'INV',description:'Jasa',amount:1,payeeName:'Lama',bankName:'Bank Lama',accountNumber:'999'};
 expect(billingItemsWithSharedPayment({items:[row],accountHolder:'Baru',accountNumber:'123'},'Bank Baru')[0]).toEqual(row);expect(row.payeeName).toBe('Lama');
});
it('missing shared payment details still fail validation',()=>{const items=billingItemsWithSharedPayment({items:[{documentNumber:'INV',description:'Jasa',amount:1}],accountHolder:'',accountNumber:''});expect(()=>validateBillingItems(items)).toThrow(/Lengkapi/);});
