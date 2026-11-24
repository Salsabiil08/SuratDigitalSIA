import asyncio,json,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 base='http://127.0.0.1:3127';out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 for _ in range(100):
  try: urllib.request.urlopen(base,timeout=1).close();break
  except OSError: await asyncio.sleep(.2)
 results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width in [320,390,768,1366]:
   context=await browser.new_context(viewport={'width':width,'height':844});page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   for role in ['STF','GM','SM','DIR','ADMIN']:
    pages=['notifications','letters','inbox','outbox','create','billing','import','profile','disposition','approval','sign'] if role=='STF' else ['notifications','import','approval','sign'] if role!='ADMIN' else ['notifications','organization','admin']
    for name in pages:
     errors.clear();await page.goto(f'{base}/?role={role}&page={name}');await page.locator(f'[data-fixture-page="{name}"]').wait_for();await page.locator('main.dashboard-content').wait_for();await page.wait_for_timeout(150)
     assert not errors,(role,name,width,errors)
     sizes=await page.evaluate('''()=>{const m=document.querySelector('main.dashboard-content');return {page:document.documentElement.scrollWidth,viewport:innerWidth,main:m.scrollWidth,client:m.clientWidth};}''')
     header=await page.locator('header').first.evaluate('(h)=>({scroll:h.scrollWidth,client:h.clientWidth})');assert header['scroll']<=header['client']+1,(role,name,width,header)
     assert sizes['page']<=width+1 and sizes['main']<=sizes['client']+1,(role,name,width,sizes)
     for selector in ['header button','[data-fixture-page] input:not([type=checkbox]):not([type=hidden])','[data-fixture-page] select','[data-fixture-page] button']:
      for item in await page.locator(selector).all():
       if await item.is_visible():
        box=await item.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,(role,name,width,selector,box)
     if width==390 and role=='STF' and name in ['notifications','import','sign']:await page.screenshot(path=str(out/('responsive-'+name+'.png')))
     results.append({'width':width,'role':role,'page':name,'overflow':'PASS'})
   await context.close()
  context=await browser.new_context(viewport={'width':1366,'height':844});page=await context.new_page();await page.clock.install(time=__import__('datetime').datetime(2026,11,24,18,59,0,tzinfo=__import__('datetime').timezone.utc));await page.goto(base+'/?page=admin');await page.get_by_text('01.59 WIB',exact=True).first.wait_for();await page.clock.run_for(60100);await page.get_by_text('02.00 WIB',exact=True).first.wait_for();results.append({'clock_minute_rollover':'PASS'})
  await browser.close()
 (out/'responsive-result.json').write_text(json.dumps(results,indent=2));print(json.dumps({'cases':len(results),'responsive_and_clock':'PASS','scope':'real UI components, synthetic data; no production account writes'}))
asyncio.run(main())
