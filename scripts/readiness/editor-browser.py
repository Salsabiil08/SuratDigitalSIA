"""Regresi editor dengan browser nyata dan backend draft tiruan, hanya localhost."""
import asyncio,json,os,zipfile,subprocess
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
   await page.route('**/guided-document',lambda route:route.fulfill(path='test-results/editor-harness/guided-signed.docx'))
   async def export_source(route):
    is_pdf='/export-pdf/' in route.request.url and 'blank=1' not in route.request.url
    file='export-source.pdf' if is_pdf else 'guided-unsigned.docx' if 'blank=1' in route.request.url else 'guided-signed.docx'
    mime='application/pdf' if is_pdf else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    await route.fulfill(path='test-results/editor-harness/'+file,content_type=mime)
   await page.route('**/api/letters/export-*/document?*',export_source)
   await page.goto('http://127.0.0.1:3121')
   await page.get_by_label('Kategori Surat',exact=False).select_option('PEMBERITAHUAN')
   await page.get_by_label('Penerima Internal',exact=False).select_option('receiver')
   assert await page.get_by_text('Surat ini tidak memerlukan persetujuan atau tanda tangan.',exact=True).is_visible()
   assert await page.get_by_role('heading',name='Persetujuan Surat',exact=True).count()==0
   assert await page.get_by_role('heading',name='Tanda Tangan Dokumen',exact=True).count()==0
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
   assert saved[0]['signerIds']==[] and saved[0]['mandatoryApproverIds']==[] and saved[0]['additionalApproverIds']==[]
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
   frame=page.frame_locator('iframe[title="Pratinjau dokumen surat"]')
   await page.locator('iframe[title="Pratinjau dokumen surat"]').scroll_into_view_if_needed()
   logo=frame.get_by_alt_text('Kop resmi PT Semen Indonesia Aceh');await logo.wait_for()
   assert await logo.evaluate('(img)=>img.complete&&img.naturalWidth>0')
   overlapping=await frame.locator('div[style]').evaluate_all("els=>els.filter(e=>e.style.width==='0px'&&e.style.height==='0px'&&e.style.zIndex==='2').some(e=>{const stamp=e.querySelector('img');const signature=e.closest('p')?.querySelectorAll('img');if(!stamp||!signature||signature.length<2)return false;const a=stamp.getBoundingClientRect(),b=signature[1].getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;})")
   assert overlapping,'Stamp is not layered in signature paragraph'
   await page.screenshot(path=str(out/f'guided-preview-{name}.png'),full_page=True)
   panel=page.locator('#export-docx')
   for kind in ['signed','unsigned']:
    await panel.get_by_label('Versi surat untuk diunduh').select_option(kind)
    for fmt in ['DOCX','PDF']:
     await panel.get_by_label('Format unduhan surat').select_option(fmt)
     async with page.expect_download(timeout=60000) as event:
      await panel.get_by_role('button',name='Unduh Surat',exact=True).click()
     download=await event.value;target=out/f'export-{name}-{kind}.{fmt.lower()}';await download.save_as(target)
     data=target.read_bytes()
     assert download.suggested_filename.endswith('.'+fmt.lower())
     if fmt=='DOCX':
      assert data==Path('test-results/editor-harness/guided-'+kind+'.docx').read_bytes()
     else: assert data.startswith(b'%PDF-')
   # A failed authorized fetch must not create a file or fall back to a different version.
   async def fail_export(route):await route.fulfill(status=403,json={'error':'Anda tidak berwenang melihat dokumen ini.'})
   await page.route('**/api/letters/export-docx/document?*',fail_export,times=1)
   await panel.get_by_role('button',name='Unduh Surat',exact=True).click()
   await page.get_by_role('alert').get_by_text('Anda tidak berwenang melihat dokumen ini.',exact=True).wait_for()
   assert await panel.get_by_role('button',name='Unduh Surat',exact=True).is_enabled()
   await panel.get_by_label('Format unduhan surat').select_option('DOCX')
   async with page.expect_download(timeout=60000) as event:await panel.get_by_role('button',name='Unduh Surat',exact=True).click()
   assert (await event.value).suggested_filename.endswith('.docx')
   pdf_panel=page.locator('#export-pdf')
   async with page.expect_download(timeout=60000) as event:await pdf_panel.get_by_role('button',name='Unduh Surat',exact=True).click()
   native=await event.value;native_path=out/f'export-{name}-native.pdf';await native.save_as(native_path)
   assert native_path.read_bytes()==Path('test-results/editor-harness/export-source.pdf').read_bytes()
   await pdf_panel.get_by_label('Format unduhan surat').select_option('DOCX')
   async with page.expect_download(timeout=60000) as event: await pdf_panel.get_by_role('button',name='Unduh Surat',exact=True).click()
   download=await event.value;target=out/f'export-{name}-pdf-to-docx.docx';await download.save_as(target)
   with zipfile.ZipFile(target) as z:
    assert len([n for n in z.namelist() if n.startswith('word/media/') and n.endswith('.jpg')])==2
    assert b'page2' in z.read('word/document.xml')
   verify="import fs from 'node:fs';import {PDFDocument} from 'pdf-lib';for(const f of process.argv.slice(1)){const d=await PDFDocument.load(fs.readFileSync(f));if(d.getPageCount()!==1)throw new Error('Unexpected page count '+f);const p=d.getPage(0);if(p.getWidth()<500||p.getHeight()<700)throw new Error('Invalid page geometry '+f);}"
   subprocess.run(['node','--input-type=module','-e',verify,str(out/f'export-{name}-signed.pdf'),str(out/f'export-{name}-unsigned.pdf')],check=True)
   for _ in range(2):
    await page.get_by_role('button',name='Uji pesan berulang',exact=True).click()
    same=page.locator('[data-action-popup="true"]').filter(has_text='Pesan gagal yang sama');await same.wait_for()
    assert await same.count()==1
    await same.get_by_role('button',name='Tutup pemberitahuan',exact=True).click()
   assert not errors,errors
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Overflow horizontal'
   await page.screenshot(path=str(out/f'editor-{name}.png'),full_page=True)
   results.append({'viewport':name,'typing_cursor_format_draft':'PASS','refresh_success_failure_retry':'PASS','popup_visible_scrolled_dismiss_persistent':'PASS','canonical_letterhead_stamp_layer':'PASS','signed_unsigned_pdf_docx_exports':'PASS','pdf_to_docx_two_pages':'PASS','backend':'mock-local-only','js_errors':errors})
   await page.close()
  await browser.close();(out/'editor-result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))

asyncio.run(main())
