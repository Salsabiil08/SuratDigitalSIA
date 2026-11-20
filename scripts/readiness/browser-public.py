"""Smoke browser lokal tanpa backend: bukan bukti UAT Auth/Storage lintas akun."""
import asyncio,json,os,urllib.request,urllib.error
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 base=os.environ.get('SIADOCS_BROWSER_BASE_URL','http://127.0.0.1:3108')
 if not base.startswith('http://127.0.0.1:'):raise RuntimeError('Hanya server localhost terisolasi untuk smoke ini')
 out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 results=[]
 for attempt in range(120):
  try:
   urllib.request.urlopen(base+'/login',timeout=1).close();break
  except (urllib.error.URLError,OSError):await asyncio.sleep(.25)
 else:raise RuntimeError('Server localhost belum siap')
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name,width,height in [('desktop',1366,641),('mobile',390,650)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   blocked=[]
   async def protect(route):
    if 'ixrpdgkrxlsxbwttujvz.supabase.co' in route.request.url:
     blocked.append(route.request.url);await route.abort()
    else:await route.continue_()
   await page.route('**/*',protect)
   await page.goto(base+'/kotak-masuk');await page.wait_for_url('**/login')
   assert await page.get_by_role('heading',name='Masuk ke akun Anda').is_visible()
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Overflow horizontal'
   await page.get_by_role('button',name='Masuk',exact=True).click()
   assert await page.locator('input:invalid').count()>0
   await page.locator('input[name=email]').fill('uat-public@example.invalid')
   await page.locator('input[name=password]').fill('Uat-local-only-123')
   await page.get_by_role('button',name='Masuk',exact=True).click()
   await page.get_by_text('Layanan login belum dapat dihubungi. Coba kembali.',exact=True).wait_for(timeout=30000)
   await page.get_by_role('link',name='Daftar Akun',exact=True).click()
   await page.wait_for_url('**/register')
   assert await page.get_by_role('heading',name='Daftar Akun Baru',exact=True).is_visible()
   assert await page.locator('input[name=confirmPassword]').is_visible()
   assert await page.get_by_role('button',name='Ajukan Pendaftaran',exact=True).is_visible()
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Register overflow'
   scroller=page.locator('[data-auth-scroll]')
   await scroller.hover()
   await page.mouse.wheel(0,1800)
   await page.wait_for_timeout(300)
   assert await scroller.evaluate('(el)=>el.scrollTop>0'), 'Registration cannot scroll'
   submit=page.get_by_role('button',name='Ajukan Pendaftaran',exact=True)
   box=await submit.bounding_box()
   assert box and box['y']>=0 and box['y']+box['height']<=height, 'Submit clipped after scroll'
   await page.get_by_role('link',name='Masuk di sini',exact=True).is_visible()
   await submit.click()
   assert await page.locator('input:invalid').count()>0
   await page.screenshot(path=str(out/(name+'.png')),full_page=True)
   assert not blocked,'Browser mencoba mengakses production'
   assert not errors,errors
   results.append({'viewport':name,'redirect_login':'PASS','validation_empty':'PASS','login_network_failure':'PASS','horizontal_overflow':False,'js_errors':errors,'production_requests':len(blocked)})
   await page.close()
  await browser.close()
 (out/'result.json').write_text(json.dumps({'scope':'public routes only; Auth/Storage UAT BLOCKED', 'results':results},indent=2))
 print(json.dumps(results))
asyncio.run(main())
