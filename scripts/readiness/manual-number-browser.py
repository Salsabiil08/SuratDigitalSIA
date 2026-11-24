import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True);results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for name,viewport in [('desktop',{'width':1366,'height':900}),('mobile',{'width':390,'height':844})]:
   context=await browser.new_context(viewport=viewport);page=await context.new_page()
   for n in range(40):
    try: await page.goto('http://127.0.0.1:3126');break
    except Exception: await asyncio.sleep(.5)
   await page.get_by_label('Perihal',exact=True).fill('Surat impor manual')
   button=page.get_by_role('button',name='Ambil Nomor Surat',exact=True);await button.click()
   await page.get_by_role('alert').wait_for();await button.click()
   await page.get_by_text('00025-IN/FIN/SIA/11.2026',exact=True).wait_for()
   requests=await page.evaluate('window.requests');assert len(requests)==2 and requests[0]['key']==requests[1]['key'];assert requests[0]['type']=='IN'
   assert await page.get_by_role('link',name='Unggah Surat',exact=True).get_attribute('href')=='/surat/ambil-nomor?nomor=reserved-fixture'
   assert await page.locator('input[type=file]').count()==0
   await page.get_by_role('button',name='Perbarui status',exact=True).click()
   await page.locator('[data-action-popup]').filter(has_text='Permohonan pembatalan menunggu persetujuan Anda.').wait_for()
   await page.get_by_role('button',name='Perbarui status',exact=True).click()
   await page.locator('[data-action-popup]').filter(has_text='Surat telah dibatalkan.').wait_for()
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await page.screenshot(path=str(out/('manual-number-'+name+'.png')),full_page=True);results.append({'viewport':name,'reserve_retry_same_key':'PASS','number_upload_link':'PASS','no_overflow':'PASS','cancellation_refresh_feedback':'PASS','scope':'synthetic UI fixture; no real account writes'})
   await context.close()
  await browser.close()
 print(json.dumps(results));(out/'manual-number-result.json').write_text(json.dumps(results,indent=2))
asyncio.run(main())
