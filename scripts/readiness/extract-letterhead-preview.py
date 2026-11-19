"""Reproduce the preview fallback from VML paths in the existing official template (stdlib only)."""
from xml.etree import ElementTree as E
import zipfile,re
from pathlib import Path
r=E.fromstring(zipfile.ZipFile('public/templates/template-kop-sia.docx').read('word/header1.xml'));ns={'v':'urn:schemas-microsoft-com:vml'}
def style(x):return dict(v.split(':',1) for v in x.get('style','').split(';') if ':' in v)
def num(v):return float(re.sub('[a-z]+$','',str(v or 0)))
def path(s):
 out=[]
 for c,v in re.findall('([a-z]+)([^a-z]*)',s):
  if c in ['x','xe']:out.append('Z');continue
  if c=='e':continue
  vals=v.split(',') if ',' in v else ([v] if v else [])
  vals=[str(num(x.strip())) if x.strip() else '0' for x in vals]
  if len(vals)%2:vals+=['0']
  out.append({'m':'M','l':'L','r':'l'}[c]+' '.join(vals if vals else ['0','0']))
 return ' '.join(out)
out=[]
for group in r.findall('.//v:group',ns):
 st=style(group);x=num(st.get('margin-left'));y=num(st.get('margin-top'))
 if st.get('mso-position-horizontal-relative')=='margin':x+=63.8
 elif st.get('mso-position-horizontal-relative')=='right-margin-area':x+=538.9
 ox,oy=map(float,group.get('coordorigin','0,0').split(','));gw,gh=map(float,group.get('coordsize').split(','));w=num(st['width']);h=num(st['height'])
 out.append(f'<g transform="translate({x} {y}) scale({w/gw} {h/gh}) translate({-ox} {-oy})">')
 for sh in group.findall('./v:shape',ns):
  a=style(sh);sx=num(a.get('left'));sy=num(a.get('top'));sw=num(a.get('width'));shh=num(a.get('height'));cw,ch=map(float,sh.get('coordsize','1,1').split(','));cw=cw or 1;ch=ch or 1
  fill='none' if sh.get('filled')=='f' else sh.get('fillcolor','black');stroke='none' if sh.get('stroked')=='f' else sh.get('strokecolor','black')
  out.append(f'<path transform="translate({sx} {sy}) scale({sw/cw if sw else 1} {shh/ch if shh else 1})" d="{path(sh.get("path",""))}" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
 out.append('</g>')
svg='<svg xmlns="http://www.w3.org/2000/svg" width="1190" height="160" viewBox="0 0 595 80">'+''.join(out)+'</svg>'
import hashlib,json
header=zipfile.ZipFile('public/templates/template-kop-sia.docx').read('word/header1.xml')
Path('src/lib/letterhead-preview.ts').write_text('// Exact vector fallback extracted from the existing official DOCX header; no change to stored documents.\nexport const CANONICAL_HEADER_SHA256='+json.dumps(hashlib.sha256(header).hexdigest())+';\nexport const LETTERHEAD_SVG='+json.dumps(svg)+';\n')
