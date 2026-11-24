"""Comment UI fixtures: no production access; real Auth/RLS/transaction tests run in PostgreSQL."""
import asyncio,json,os,urllib.request,urllib.error
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 base='http://127.0.0.1:3124';out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 for _ in range(100):
  try:urllib.request.urlopen(base,timeout=1).close();break
  except (OSError,urllib.error.URLError):await asyncio.sleep(.2)
 results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name,width,height in [('desktop',1366,768),('mobile',390,844)]:
   context=await browser.new_context(viewport={'width':width,'height':height});items=[];requests=[];official=[]
   async def data(route):await route.fulfill(json={'canRead':True,'canComment':True,'items':items,'total':len(items),'recipientCommented':bool(items)})
   async def post(route):
    body=route.request.post_data_json;requests.append(body);await asyncio.sleep(.2)
    if not items:items.append({'id':'comment','authorId':'recipient','authorName':'Penerima Pengujian','body':body['body'],'createdAt':'2026-11-24T01:00:00Z'})
    if len(requests)==1:await route.fulfill(json={'success':False,'error':'Hasil pengiriman belum dapat dipastikan. Periksa tanggapan sebelum mencoba kembali.'})
    else:await route.fulfill(json={'success':True,'id':'comment'})
   async def letter(route):official.append(1);await route.fulfill(json={})
   await context.route('**/comment-data',data);await context.route('**/comment-action',post);await context.route('**/official-reply',letter)
   page=await context.new_page();await page.goto(base)
   await page.get_by_text('Surat terkait dan balasan resmi',exact=True).click()
   assert await page.get_by_role('button',name='Balas dengan Surat Resmi',exact=True).is_visible()
   await page.get_by_role('button',name='Balas dengan Komentar',exact=True).click()
   send=page.get_by_role('button',name='Kirim Komentar',exact=True);assert await send.is_disabled()
   await page.get_by_label('Komentar Anda',exact=True).fill('Terima kasih. <b>Catatan saya</b>')
   await send.evaluate('(el)=>{el.click();el.click();}')
   await page.get_by_role('alert').get_by_text('Hasil pengiriman belum dapat dipastikan. Periksa tanggapan sebelum mencoba kembali.',exact=True).wait_for()
   assert len(requests)==1
   assert await page.get_by_label('Komentar Anda',exact=True).input_value()=='Terima kasih. <b>Catatan saya</b>'
   await page.get_by_role('button',name='Muat Ulang Tanggapan',exact=True).click()
   await page.get_by_text('Penerima Pengujian',exact=True).wait_for()
   await send.click();await page.get_by_role('status').get_by_text('Komentar berhasil dikirim.',exact=True).wait_for()
   assert len(requests)==2 and requests[0]['key']==requests[1]['key'] and len(items)==1 and len(official)==0
   assert await page.get_by_label('Status tanggapan').inner_text()=='Sudah ditanggapi melalui komentar'
   assert await page.get_by_text('Terima kasih. <b>Catatan saya</b>',exact=True).count()==1
   assert await page.locator('li b').count()==0
   assert await page.get_by_label('Komentar Anda').input_value()==''
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await page.screenshot(path=str(out/('comments-'+name+'.png')),full_page=True)
   results.append({'viewport':name,'optional_comment_reply':'PASS','unknown_result_retry_same_key':'PASS','no_letter_created':'PASS','plain_text_escaping':'PASS','scope':'local UI fixture'})
   await context.close()
  await browser.close()
 (out/'comments-result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
asyncio.run(main())
