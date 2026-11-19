"""Regresi editor dengan browser nyata dan backend draft tiruan, hanya localhost."""
import asyncio,json,os
from pathlib import Path
from email import policy
from email.parser import BytesParser
from playwright.async_api import async_playwright

async def main():
 out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  results=[]
  for name,width,height in [('desktop',1366,768),('mobile',390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height});errors=[];saved=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   async def draft(route):
    request=route.request
    message=BytesParser(policy=policy.default).parsebytes(('Content-Type: '+request.headers['content-type']+'\r\n\r\n').encode()+request.post_data_buffer)
    data=next(part for part in message.iter_parts() if part.get_param('name',header='content-disposition')=='data')
    saved.append(json.loads(data.get_payload(decode=True)));await route.fulfill(status=200,json={'id':'synthetic-local-only'})
   await page.route('**/api/letters/draft',draft)
   await page.goto('http://127.0.0.1:3121')
   await page.get_by_label('Kategori Surat',exact=False).select_option('PEMBERITAHUAN')
   await page.get_by_label('Penerima Internal',exact=False).select_option('receiver')
   await page.get_by_label('Perihal',exact=False).fill('Uji editor lokal')
   editor=page.get_by_role('textbox',name='Isi surat',exact=True)
   await editor.click();await page.keyboard.type('Paragraf pertama.',delay=12);await page.keyboard.press('Enter');await page.keyboard.type('Paragraf kedua.',delay=12)
   await page.keyboard.press('Control+Home');await page.keyboard.type('Awal ');await page.keyboard.press('Control+End')
   await page.get_by_title('Tebal (Ctrl+B)',exact=True).click();await page.keyboard.type(' TEBAL');await page.get_by_title('Tebal (Ctrl+B)',exact=True).click()
   await page.get_by_title('Rata Kanan',exact=True).click();await page.keyboard.type(' akhir');await page.keyboard.press('Backspace');await page.keyboard.type('r')
   text=await editor.inner_text();assert text.startswith('Awal Paragraf pertama.') and 'Paragraf kedua.' in text and 'TEBAL akhir' in text,text
   await page.get_by_role('button',name='Simpan Draft',exact=True).click()
   await page.wait_for_function('document.querySelector("button[type=submit]").disabled === false')
   assert len(saved)==1,await page.locator('body').inner_text()
   content=saved[0]['content'];assert 'TEBAL' in content and ('<b>' in content or '<strong>' in content or 'font-weight' in content),content
   assert 'right' in content and saved[0]['contentFormat']=='HTML',content
   refresh_calls=[];gate=asyncio.Event()
   async def refresh(route):
    refresh_calls.append(1)
    if len(refresh_calls)==1: await gate.wait()
    if len(refresh_calls)==2: await route.fulfill(status=503,json={'error':'synthetic failure'})
    else: await route.fulfill(status=200,json={'count':len(refresh_calls)})
   await page.route('**/refresh-test',refresh)
   button=page.get_by_role('button',name='Perbarui status',exact=True)
   await button.click();assert await page.get_by_role('button',name='Memperbarui…',exact=True).is_disabled()
   gate.set();await page.get_by_role('status').get_by_text('Status surat sudah diperbarui.',exact=True).wait_for()
   assert await page.get_by_label('Hasil pembaruan').inner_text()=='1'
   await button.click();await page.get_by_role('alert').get_by_text('Jaringan terputus. Coba lagi.',exact=True).wait_for();assert await button.is_enabled()
   await button.click();await page.get_by_role('status').get_by_text('Status surat sudah diperbarui.',exact=True).wait_for()
   assert await page.get_by_label('Hasil pembaruan').inner_text()=='3' and len(refresh_calls)==3
   assert not errors,errors
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Overflow horizontal'
   await page.screenshot(path=str(out/f'editor-{name}.png'),full_page=True)
   results.append({'viewport':name,'typing_cursor_format_draft':'PASS','refresh_success_failure_retry':'PASS','backend':'mock-local-only','js_errors':errors})
   await page.close()
  await browser.close();(out/'editor-result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))

asyncio.run(main())
