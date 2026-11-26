"""Actual React controls with local server-action fixtures. No production requests or mutations."""
import asyncio,json,os,urllib.request,urllib.error
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 base='http://127.0.0.1:3123';out=Path('test-results/readiness-browser');out.mkdir(parents=True,exist_ok=True)
 for _ in range(100):
  try:urllib.request.urlopen(base,timeout=1).close();break
  except (OSError,urllib.error.URLError):await asyncio.sleep(.2)
 results=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),args=['--no-sandbox'])
  for name,width,height in [('desktop',1366,768),('mobile',390,844)]:
   state={'id':'task','recipientId':'staff','editable':True,'revision':1,'subject':'Tugas pengujian UI','instruction':'Siapkan catatan hasil','priority':'NORMAL','status':'NEW','requiresLetter':False,'responseEditable':False,'responseFinal':False,'integrated':True,'sourceAccessible':False,'files':[],'submissions':[],'giverName':'Ahmad Penguji','recipientName':'Rina Penguji','createdAt':'2026-11-23T01:00:00Z'};actions=[]
   context=await browser.new_context(viewport={'width':width,'height':height})
   async def data(route):
    giver='actor=giver' in route.request.url
    await route.fulfill(json={'success':True,'data':{'inbox':[] if giver else [state],'outbox':[state] if giver else [],'availableLetters':[],'availableProfiles':[],'canCreateDisposition':False,'canReceiveDisposition':not giver}})
   async def act(route):
    payload=route.request.post_data_json;action=payload['action'];actions.append(action);await asyncio.sleep(.15)
    if action=='START':state['status']='IN_PROGRESS';state['editable']=False
    elif action=='SUBMIT':state['status']='IN_REVIEW';state['followUpNote']=payload['note'];state['submissions'].append({'id':'s'+str(len(state['submissions'])),'note':payload['note'],'created_at':'2026-11-23T02:00:00Z','result_letter_id':None})
    elif action=='RETURN':state['status']='REVISION_REQUESTED';state['reviewNote']=payload['note'];state['submissions'][-1]['decision']={'decision':'RETURN','note':payload['note'],'created_at':'2026-11-23T03:00:00Z'}
    elif action=='ACCEPT':state['status']='DONE';state['submissions'][-1]['decision']={'decision':'ACCEPT','note':payload['note'],'created_at':'2026-11-23T04:00:00Z'}
    state['revision']+=1;await route.fulfill(json={'success':True})
   await context.route('**/ux-data*',data);await context.route('**/ux-action*',act)
   edits=[]
   async def edit(route):
    payload=route.request.post_data_json;edits.append(payload)
    assert payload['dispositionId']=='task' and payload['revision']==state['revision']
    for key in ['subject','instruction','priority','requiresLetter']:state[key]=payload[key]
    state['revision']+=1
    await route.fulfill(json={'success':True})
   await context.route('**/ux-edit*',edit)
   preview_attempts=[]
   async def preview(route):
    preview_attempts.append(1)
    if len(preview_attempts)==1:await route.fulfill(status=503,json={'error':'Pratinjau uji belum tersedia.'})
    else:await route.fulfill(path='test-results/editor-harness/guided-signed.docx')
   await context.route('**/ux-preview',preview)
   page=await context.new_page();await page.goto(base+'/?actor=recipient')
   await page.get_by_role('button',name='Uji Validasi',exact=True).click()
   assert await page.locator('#ux-name').evaluate('(el)=>el.validationMessage')=='Isi bagian ini terlebih dahulu.'
   await page.locator('#ux-name').fill('Nama');await page.get_by_role('button',name='Uji Validasi',exact=True).click()
   assert await page.locator('#ux-choice').evaluate('(el)=>el.validationMessage')=='Pilih salah satu pilihan terlebih dahulu.'
   await page.locator('#ux-choice').select_option('one')
   await page.locator('iframe').locator('..').scroll_into_view_if_needed()
   retry=page.get_by_role('button',name='Muat Ulang Pratinjau',exact=True)
   await retry.wait_for(timeout=20000);await retry.click()
   await page.frame_locator('iframe').locator('.docx-wrapper').wait_for(timeout=20000)
   assert len(preview_attempts)>=2
   await page.goto(base+'/?actor=giver')
   await page.get_by_role('button',name='Edit Disposisi',exact=True).click()
   edit_dialog=page.get_by_role('dialog',name='Edit disposisi',exact=True)
   await edit_dialog.locator('input').first.fill('Perihal dikoreksi')
   await edit_dialog.locator('textarea').fill('Arahan pekerjaan diperbaiki')
   await edit_dialog.get_by_role('button',name='Simpan Perubahan',exact=True).click()
   await page.get_by_text('Perubahan disposisi tersimpan.',exact=True).wait_for()
   assert len(edits)==1 and state['subject']=='Perihal dikoreksi' and state['instruction']=='Arahan pekerjaan diperbaiki'
   await page.goto(base+'/?actor=recipient')
   await page.get_by_role('button',name='Mulai Kerjakan',exact=True).click()
   await page.get_by_text('Tahap: Diproses',exact=True).wait_for()
   await page.get_by_role('button',name='Kirim Hasil untuk Diperiksa',exact=True).click()
   dialog=page.get_by_role('dialog');send=dialog.get_by_role('button',name='Kirim kepada Pemberi',exact=True)
   assert await send.is_disabled();await dialog.get_by_role('textbox').fill('Hasil pertama')
   assert await send.is_enabled()
   await send.evaluate('(el)=>{el.click();el.click();}')
   await page.get_by_text('Tahap: Menunggu Pemeriksaan',exact=True).wait_for()
   assert actions.count('SUBMIT')==1
   await page.goto(base+'/?actor=giver');await page.get_by_role('button',name='Periksa Hasil',exact=True).click()
   dialog=page.get_by_role('dialog');fix=dialog.get_by_role('button',name='Minta Perbaikan',exact=True)
   assert await fix.is_disabled();assert await dialog.get_by_text('Isi catatan perbaikan untuk mengaktifkan tombol Minta Perbaikan.',exact=True).is_visible()
   await dialog.get_by_role('textbox').fill('Lengkapi analisis');await fix.click();await page.get_by_text('Tahap: Perlu Perbaikan',exact=True).wait_for()
   await page.goto(base+'/?actor=recipient');assert await page.get_by_text('Menunggu: Rina Penguji — Penerima Tugas',exact=True).is_visible()
   await page.get_by_text('Riwayat hasil dan pemeriksaan',exact=True).click()
   assert await page.get_by_text('Hasil diajukan:',exact=False).is_visible()
   await page.get_by_role('button',name='Kirim Hasil untuk Diperiksa',exact=True).click();dialog=page.get_by_role('dialog');await dialog.get_by_role('textbox').fill('Hasil diperbaiki');await dialog.get_by_role('button',name='Kirim kepada Pemberi',exact=True).click();await page.get_by_text('Tahap: Menunggu Pemeriksaan',exact=True).wait_for()
   await page.goto(base+'/?actor=giver');await page.get_by_role('button',name='Periksa Hasil',exact=True).click();await page.get_by_role('dialog').get_by_role('button',name='Terima Hasil dan Selesaikan',exact=True).click();await page.get_by_text('Tahap: Selesai',exact=True).wait_for()
   await page.get_by_text('Riwayat hasil dan pemeriksaan',exact=True).click()
   assert await page.get_by_text('Hasil pertama',exact=False).count()>0 and await page.get_by_text('Lengkapi analisis',exact=False).count()>0
   assert await page.get_by_text('Hasil diperbaiki',exact=False).count()>0
   await page.locator('iframe').locator('..').scroll_into_view_if_needed()
   # Explicitly exercise retry without resubmitting any workflow action.
   if await page.get_by_role('button',name='Muat Ulang Pratinjau',exact=True).count():
    await page.get_by_role('button',name='Muat Ulang Pratinjau',exact=True).click()
   await page.frame_locator('iframe').locator('.docx-wrapper').wait_for(timeout=20000)
   assert actions==['START','SUBMIT','RETURN','SUBMIT','ACCEPT']
   if name=='desktop':
    await page.get_by_role('button',name='Uji Popup Gagal',exact=True).click();popup=page.locator('[data-action-popup]').filter(has_text='Tindakan uji belum berhasil.')
    await popup.hover();await page.wait_for_timeout(8300);assert await popup.count()==1
    await page.mouse.move(1,1);await page.wait_for_timeout(8300);assert await popup.count()==0
    assert await page.get_by_role('note').get_by_text('Tindakan uji belum berhasil. Silakan coba kembali.',exact=True).count()==1
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   await page.screenshot(path=str(out/('ux-'+name+'.png')),full_page=True)
   results.append({'viewport':name,'validation_indonesian':'PASS','disposition_return_resubmit_accept':'PASS','duplicate_click':'PASS','history_retained':'PASS','scope':'local UI fixtures; server permissions covered separately by PostgreSQL suite'})
   await context.close()
  await browser.close()
 (out/'ux-result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
asyncio.run(main())
