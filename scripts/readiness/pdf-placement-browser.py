"""Real browser PDF and visual placement regression, synthetic localhost files only."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name,width,height in [('desktop',1366,768),('mobile',390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height},has_touch=name=='mobile');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   async def pdf(route):await route.fulfill(path='test-results/pdf-placement/fixture.pdf',content_type='application/pdf')
   await page.route('**/fixture.pdf*',pdf)
   for attempt in range(30):
    try:await page.goto('http://127.0.0.1:3123');break
    except Exception:
     if attempt==29:raise
     await asyncio.sleep(1)
   async def place(label,page_number,x,y,drag=True):
    target=page.get_by_role('button',name=f'Tempatkan {label} pada halaman {page_number}',exact=True)
    pane=page.locator('[data-placement-scroll]');await pane.evaluate('(el)=>el.scrollIntoView({block:"start"})')
    await target.evaluate('(el,y)=>{const pane=el.closest("[data-placement-scroll]");const top=el.getBoundingClientRect().top-pane.getBoundingClientRect().top+pane.scrollTop;pane.scrollTop=top+el.clientHeight*y-pane.clientHeight/2;}',y)
    canvas=target.locator('..').locator('canvas');await page.wait_for_function('(el)=>el.width>0',arg=await canvas.element_handle(),timeout=30000)
    await page.wait_for_timeout(400)
    box=await target.bounding_box();sx=box['x']+box['width']*x;sy=box['y']+box['height']*y
    if drag:
     await page.mouse.move(sx,sy);await page.mouse.down();await page.mouse.move(sx+box['width']*.25,sy+box['height']*.04,steps=8);await page.mouse.up()
    elif name=='mobile':await page.touchscreen.tap(sx,sy)
    else:await page.mouse.click(sx,sy)
   await page.get_by_role('checkbox',name='Tambahkan tempat stempel (opsional)').check()
   await place('Nomor Surat',1,.12,.16)
   await place('TTD SM',1,.55,.7,False)
   await place('TTD Dirut',2,.18,.68,False)
   await place('Stempel',2,.42,.68,False)
   positions=json.loads(await page.locator('#positions').inner_text());assert set(positions)=={'number','signature-0','signature-1','stamp'},positions
   assert positions['signature-1']['page']==2
   for area in positions.values():assert area['x']>=0 and area['y']>=0 and area['x']+area['width']<=595.1 and area['y']+area['height']<=842.1,area
   assert await page.locator('input[type=number]').count()==0
   await page.screenshot(path=str(out/f'pdf-placement-{name}.png'),full_page=True)
   await page.get_by_role('heading',name='Pratinjau PDF',exact=True).scroll_into_view_if_needed()
   viewer=page.get_by_label('Pratinjau PDF halaman 1',exact=True).last
   await page.wait_for_function('(el)=>el.width>0',arg=await viewer.element_handle(),timeout=30000)
   await page.wait_for_timeout(500)
   pixels=await viewer.evaluate('(c)=>{const p=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<p.length;i+=4)if(p[i+3]>0&&p[i]<100&&p[i+1]<100&&p[i+2]<100)dark++;return dark;}');assert pixels>100,pixels
   assert await page.locator('iframe').count()==0
   await page.screenshot(path=str(out/f'pdf-preview-{name}.png'))
   await page.get_by_role('button',name='Atur Ulang Posisi',exact=True).click();assert json.loads(await page.locator('#positions').inner_text())=={}
   assert not errors,errors
   await page.close()
  page=await browser.new_page();calls=0
  async def retry(route):
   nonlocal calls
   if 'placement=1' in route.request.url:
    calls+=1
    if calls==1:await route.fulfill(status=503,body='synthetic failure');return
   await route.fulfill(path='test-results/pdf-placement/fixture.pdf',content_type='application/pdf')
  await page.route('**/fixture.pdf*',retry);await page.goto('http://127.0.0.1:3123');await page.get_by_text('PDF belum dapat dimuat. Coba kembali.',exact=True).wait_for();await page.get_by_role('button',name='Muat Ulang PDF',exact=True).click();await page.get_by_role('button',name='Tempatkan Nomor Surat pada halaman 1',exact=True).wait_for(timeout=30000);assert calls==2
  await page.close();await browser.close()
 print('PDF preview and placement passed on desktop/mobile, multi-page, touch, reset and fetch retry.')
asyncio.run(main())
