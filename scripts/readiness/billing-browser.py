"""Local fixtures only: billing form and actual generated DOCX rendering, no production writes."""
import asyncio,json,os,urllib.request,urllib.error
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 base='http://127.0.0.1:3122'
 for _ in range(100):
  try:urllib.request.urlopen(base,timeout=1).close();break
  except (OSError,urllib.error.URLError):await asyncio.sleep(.2)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name,width,height in [('desktop',1366,768),('mobile',390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   saved=[]
   async def draft(route):
    raw=route.request.post_data_buffer.decode();start=raw.index('{');end=raw.rindex('}')+1;saved.append(json.loads(raw[start:end]));await route.fulfill(status=200,json={'id':'local-fixture'})
   await page.route('**/api/letters/draft',draft)
   await page.goto(base)
   await page.get_by_label('Kategori Surat',exact=False).select_option('PEMBERITAHUAN')
   assert await page.locator('#recipient-address').count()==0
   assert await page.locator('#item-0').count()==1 and await page.locator('#item-1').count()==0
   await page.locator('#bank').select_option('mandiri')
   for field,value in [('documentNumber','1900000110'),('payeeName','Penerima Pengujian'),('bankName','BSI'),('accountNumber','000045')]:await page.locator('#'+field+'-0').fill(value)
   await page.locator('#item-0').fill('Biaya operasional pengurusan IUP OP')
   await page.locator('#amount-0').fill('10000000')
   selects=page.locator('select');all_ids=await selects.evaluate_all('(els)=>els.map(x=>x.id)')
   # Slot order remains SM then director; position in the document is independent.
   for ident in all_ids:
    if ident.startswith('signer-'):await page.locator('#'+ident).select_option('sm' if ident.endswith('0') else 'dir')
   await page.get_by_role('button',name='Simpan Draft',exact=True).click()
   await page.wait_for_timeout(300)
   assert len(saved)==1,await page.locator('body').inner_text()
   assert saved[0]['signerIds']==['sm','dir'] and saved[0]['mandatoryApproverIds']==['sm','dir']
   assert await page.locator('#signer-0').count()==0 and await page.locator('#signer-1').count()==0
   assert len(saved[0]['billing']['items'])==1 and saved[0]['billing']['items'][0]['documentNumber']=='1900000110'
   await page.get_by_role('button',name='Tambah Rincian',exact=True).click()
   assert await page.locator('#item-1').count()==1
   await page.get_by_role('button',name='Hapus Baris Terakhir',exact=True).click()
   assert await page.locator('#item-1').count()==0
   await page.screenshot(path=str(out/('billing-form-'+name+'.png')),full_page=True)
   await page.route('**/billing-example',lambda route:route.fulfill(path='test-results/billing/payment-request.docx'))
   await page.goto(base+'/?preview=1')
   frame=page.frame_locator('iframe')
   await frame.get_by_text('SURAT PENGANTAR TAGIHAN',exact=True).wait_for(timeout=20000)
   assert await frame.get_by_text('No Dokumen',exact=True).is_visible()
   assert await frame.get_by_text('1900000110',exact=True).is_visible()
   grid=frame.locator('table').filter(has=frame.get_by_text('No Dokumen',exact=True))
   assert await grid.count()==1
   assert await grid.locator('td,th').evaluate_all("els=>els.every(e=>{const s=getComputedStyle(e);return s.borderTopStyle==='solid'&&parseFloat(s.borderTopWidth)>0&&s.borderTopColor==='rgb(51, 51, 51)';})")

   assert await frame.get_by_text('{{SIGNATURE_1}}',exact=True).count()==0
   await frame.locator('img[alt="Kop resmi PT Semen Indonesia Aceh"]').wait_for()
   await page.screenshot(path=str(out/('billing-preview-'+name+'.png')))
   await page.route('**/billing-legacy-example',lambda route:route.fulfill(path='test-results/legacy-billing/signed.docx',headers={'X-SIADocs-Layout-Copy':'1'}))
   await page.goto(base+'/?preview=1&legacy=1')
   frame=page.frame_locator('iframe')
   await frame.get_by_text('No Dokumen',exact=True).wait_for(timeout=20000)
   grid=frame.locator('table').filter(has=frame.get_by_text('No Dokumen',exact=True))
   assert await grid.locator('td,th').evaluate_all("els=>els.length===21&&els.every(e=>{const s=getComputedStyle(e);return s.borderLeftStyle==='solid'&&parseFloat(s.borderLeftWidth)>0&&s.backgroundColor==='rgb(255, 255, 255)';})")
   assert await page.get_by_text('Unduh dokumen asli',exact=True).count()==0
   assert await frame.get_by_text('Disetujui oleh,',exact=True).is_visible()
   assert await frame.get_by_text('Diajukan oleh,',exact=True).is_visible()
   await page.screenshot(path=str(out/('billing-legacy-preview-'+name+'.png')))

   await page.close()
  await browser.close()
 print('PASS billing form, single row, add/remove rows, generated DOCX table/header, hidden signing markers: desktop/mobile')
asyncio.run(main())
