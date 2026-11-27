import asyncio,json,os,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 base='http://127.0.0.1:3127';out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 for _ in range(100):
  try: urllib.request.urlopen(base,timeout=1).close();break
  except OSError: await asyncio.sleep(.2)
 results=[];failures=[]
 def check(condition,detail):
  if not condition: failures.append(detail)
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path=os.environ.get("CHROMIUM_PATH"))
  for width in [320,390,768,1366]:
   context=await browser.new_context(viewport={'width':width,'height':844});page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   for role in ['STF','GM','SM','DIR','ADMIN']:
    pages=['notifications','letters','inbox','outbox','create','billing','import','profile','disposition','approval','sign'] if role=='STF' else ['notifications','import','approval','sign'] if role!='ADMIN' else ['notifications','organization','admin']
    for name in pages:
     errors.clear();await page.goto(f'{base}/?role={role}&page={name}');await page.locator(f'[data-fixture-page="{name}"]').wait_for();await page.locator('main.dashboard-content').wait_for();await page.wait_for_timeout(150)
     check(not errors,(role,name,width,errors))
     if name in ['create','billing','import']:
      check(await page.locator('#letter-review-needed,#letter-reviewer').count()==0,(role,name,width,'separate review controls removed'))
      if name in ['create','import'] and await page.locator('#recipient-user').count():
       await page.locator('#recipient-user').select_option('dir' if role=='STF' else 'peer')
       needed=page.get_by_text('Perlu persetujuan?',exact=True)
       if role=='DIR':check(await needed.count()==0,(role,name,width,'Director has no superior approval'))
       elif role in ['STF','GM','SM']:
        await needed.click();approver=page.locator('#content-approver');await approver.wait_for()
        ids=await approver.locator('option').evaluate_all('(nodes)=>nodes.map(n=>n.value).filter(Boolean)')
        check(ids=={'STF':['gm','sm','dir'],'GM':['sm','dir'],'SM':['dir']}[role],(role,name,width,'approval hierarchy',ids))
     for selector in ['header button','[data-fixture-page] input:not([type=checkbox]):not([type=hidden])','[data-fixture-page] select','[data-fixture-page] button']:
      for item in await page.locator(selector).all():
       if await item.is_visible():
        # Wide desktop/admin tables scroll within their own viewport; the page itself must remain fixed.
        if await item.evaluate('(el)=>!!el.closest("table")'): continue
        box=await item.bounding_box();check(box['x']>=-1 and box['x']+box['width']<=width+1,(role,name,width,selector,box))
     if width==390 and role=='STF' and name in ['notifications','import','sign']:await page.screenshot(path=str(out/('responsive-'+name+'.png')))
     results.append({'width':width,'role':role,'page':name,'overflow':'PASS'})
   await context.close()
  for width in [320,390,1366]:
   page=await browser.new_page(viewport={'width':width,'height':844})
   for form in ['create','import']:
    await page.goto(base+f'/?role=STF&page={form}&r05=1')
    recipient=page.get_by_label('Kepada (To)',exact=False)
    await recipient.select_option('sm')
    check(await page.locator('#automatic-approver').inner_text()=='Pejabat GM',('R05',width,form,'GM approves when To is SM'))
    await recipient.select_option('dir')
    await page.locator('#official-sender').select_option('sm')
    check(await page.locator('#automatic-approver').inner_text()=='Pejabat SM',('R05',width,form,'SM can approve when To is Director'))
    await recipient.select_option('gm')
    check('Belum ada GM terkait' in await page.locator('#official-sender').inner_text(),('R05',width,form,'selected GM cannot be From and To'))
    check(await page.locator('#automatic-approver').inner_text()=='Mengikuti pengirim resmi',('R05',width,form,'previous approval cleared'))
    await recipient.select_option('')
    check(await page.get_by_role('button',name='Simpan Draft',exact=True).is_disabled(),('R05',width,form,'save blocked without To'))
    await recipient.select_option('other-gm')
    check(await page.locator('#automatic-approver').inner_text()=='Pejabat GM',('R05',width,form,'From automatically approves'))
    await recipient.select_option('peer')
    check(await page.locator('#automatic-approver').inner_text()=='Tidak diperlukan',('R05',width,form,'creator sends peer mail'))
    await page.locator('#letter-type').select_option('KRE')
    await page.locator('#official-sender').select_option('dir')
    await page.locator('#origin-city').fill('Banda Aceh')
    check(await page.locator('#automatic-approver').inner_text()=='Pejabat Direktur',('R05',width,form,'external approval follows sender'))
    check(await page.locator('#letter-category').count()==1 and await page.locator('#letter-reviewer').count()==0,('R05',width,form,'category without separate review'))
    check(await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('R05',width,form,'viewport'))
    await page.goto(base+f'/?role=STF&page={form}&r05=1&no-gm=1')
    await page.locator('#recipient-user').select_option('sm')
    check('Belum ada GM terkait' in await page.locator('#official-sender').inner_text(),('R05',width,form,'SM selectable without GM; From explains missing assignment'))
    for button in ['Simpan Draft','Simpan dan Pratinjau']:
     check(await page.get_by_role('button',name=button,exact=True).is_disabled(),('R05',width,form,button,'no save without lawful From'))
   await page.goto(base+'/?role=STF&page=create&r05=1&multi=1')
   await page.locator('#recipient-user').select_option('other-gm')
   await page.locator('#official-sender').select_option('second-gm')
   check(await page.locator('#automatic-approver').inner_text()=='Pejabat GM Kedua',('R05',width,'selected eligible sender approves'))
   await page.close()
   results.append({'width':width,'scope':'R05 creation and import From/To'})
  context=await browser.new_context(viewport={'width':1366,'height':844});page=await context.new_page();await page.clock.install(time=__import__('datetime').datetime(2026,11,24,18,59,0,tzinfo=__import__('datetime').timezone.utc));await page.goto(base+'/?page=admin');await page.get_by_text('01.59 WIB',exact=True).first.wait_for();await page.clock.run_for(60100);await page.get_by_text('02.00 WIB',exact=True).first.wait_for();results.append({'clock_minute_rollover':'PASS'})
  await browser.close()
 (out/'responsive-result.json').write_text(json.dumps({'results':results,'failures':failures},indent=2));print(json.dumps({'cases':len(results),'failures':failures,'scope':'real UI components, synthetic data; no production account writes'}));assert not failures,failures
asyncio.run(main())
