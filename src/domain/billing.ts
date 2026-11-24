export interface BillingItem {
  description: string;
  amount: number;
  documentNumber?: string;
  payeeName?: string;
  bankName?: string;
  accountNumber?: string;
}
export function validateBillingItems(items: BillingItem[]) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100)
    throw new Error('Isi 1 sampai 100 rincian pembayaran.');
  for (const [index, item] of items.entries()) {
    if (!item || ![item.documentNumber, item.description, item.payeeName, item.bankName, item.accountNumber].every(v => typeof v === 'string' && v.trim() && v.length <= 2000)
      || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 999999999999.99 || (item.documentNumber?.length || 0) > 120)
      throw new Error(`Lengkapi nomor dokumen, keterangan, penerima, bank, rekening, dan nominal pada rincian ${index + 1}.`);
  }
}

/** Complete new three-field rows using the single payment destination; preserve existing row-specific data. */
export function billingItemsWithSharedPayment(billing:{items:BillingItem[];accountHolder:string;accountNumber:string;bankName?:string},registeredBankName=''):BillingItem[]{
 if(!Array.isArray(billing.items))throw new Error('Lengkapi rincian pembayaran.');
 return billing.items.map(item=>({...item,payeeName:item.payeeName||billing.accountHolder,bankName:item.bankName||registeredBankName||billing.bankName||'',accountNumber:item.accountNumber||billing.accountNumber}));
}
