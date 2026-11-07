#!/usr/bin/env python3
"""Offline release checks; no network requests or third-party packages required."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import re,sys
from camps import read,period
from media import load,image_info
ROOT=Path(__file__).resolve().parents[1]
manifest=load(ROOT)
errors=[]
def require(ok,message):
    if not ok:errors.append(message)
class Page(HTMLParser):
    def __init__(self,path):
        super().__init__();self.path=path;self.ids=set();self.refs=[];self.registrations=[];self.lang='';self.alternates={};self.h1=0;self.campid=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:
            require(a['id'] not in self.ids,f'{self.path.name}: duplicate ID {a["id"]}')
            self.ids.add(a['id'])
        if tag=='html':self.lang=a.get('lang')
        if tag=='body':self.campid=a.get('data-camp-id')
        if tag=='h1':self.h1+=1
        if tag=='img':require(bool(a.get('alt')),f'{self.path.name}: image missing description')
        for key in ('href','src','data-src','poster'):
            if a.get(key) and tag!='base':self.refs.append(a[key])
        if a.get('srcset'):
            self.refs.extend(item.strip().split()[0] for item in a['srcset'].split(','))
        if tag=='video':
            require(a.get('preload')=='none',f'{self.path.name}: video must not download before play')
            require(bool(a.get('poster')),f'{self.path.name}: missing video cover')
        if tag=='link' and a.get('rel')=='alternate':self.alternates[a.get('hreflang')]=a.get('href')
        if tag=='a' and a.get('target')=='_blank':require('noopener' in a.get('rel',''),f'{self.path.name}: external tab missing noopener')
        if tag=='a' and ('camp-detail-cta' in a.get('class','')):self.registrations.append(a)

data=read(ROOT);camps=data['camps'];campids={c['id'] for c in camps}
pages={}
for path in ROOT.glob('*.html'):
    p=Page(path);p.feed(path.read_text());pages[path.name]=p
    lang='uk' if path.stem.endswith('-uk') else 'en'
    require(p.lang==lang,f'{path.name}: wrong page language')
    require(p.h1<=1,f'{path.name}: duplicate main headings')
    peer=path.name.replace('-uk.html','.html') if lang=='uk' else path.stem+'-uk.html'
    require((ROOT/peer).exists(),f'{path.name}: missing language counterpart')
    expected_alternates=set() if path.name in ('404.html','404-uk.html') else {'en','uk','x-default'}
    require(set(p.alternates)==expected_alternates,f'{path.name}: incorrect language alternates')
    for asset in ('script.js','analytics.js','styles.css'):
        require(any(urlsplit(ref).path==asset for ref in p.refs),f'{path.name}: missing shared {asset}')
    if p.campid:
        require(p.campid in campids,f'{path.name}: camp page has no source record')
        expected=next((c['page'] for c in camps if c['id']==p.campid),'')
        if lang=='uk':expected=expected.replace('.html','-uk.html')
        require(path.name==expected,f'{path.name}: orphan or mismatched camp page')
for name,p in pages.items():
    for ref in p.refs:
        u=urlsplit(ref)
        if u.scheme or u.netloc:continue
        path=unquote(u.path) or name
        target=ROOT/path
        require(target.is_file(),f'{name}: missing local file {path}')
        if u.fragment and path in pages:
            # Camp cards and their IDs are rendered by script.js.
            allowed=pages[path].ids | ({'videos','photos'} if path in ('gallery.html','gallery-uk.html') else set()) |  (campids if path in ('camps.html','camps-uk.html') else set())
            require(unquote(u.fragment) in allowed,f'{name}: broken anchor {ref}')
for path in ROOT.glob('*.css'):
    for ref in re.findall(r'url\([\x27\"]?([^\)\x27\"]+)',path.read_text()):
        if not urlsplit(ref).scheme:require((ROOT/urlsplit(ref).path).is_file(),f'{path.name}: missing CSS asset {ref}')
for c in camps:
    require((ROOT/c['image']).is_file(),c['id']+': missing image')
    if not c['page']:continue
    for lang in ('en','uk'):
        name=c['page'] if lang=='en' else c['page'].replace('.html','-uk.html')
        p=pages.get(name);require(p is not None,c['id']+': missing '+lang+' page')
        if not p:continue
        text=(ROOT/name).read_text()
        require(period(c,lang) in text,name+': wrong dates')
        require((image_info(manifest,c['image']) or {'src':c['image']})['src'] in text,name+': wrong image')
        if c['status']=='open':
            require(len(p.registrations)==2,name+': expected two registration links')
            require(all(a.get('href')==c['registrationUrl'] and a.get('target')=='_blank' for a in p.registrations),name+': wrong registration link or tab')
        for price in c['detail']['prices']:require(str(price['amount']) in text,name+': missing price')
if errors:
    print('\n'.join(errors),file=sys.stderr);raise SystemExit(f'{len(errors)} site checks failed.')
print(f'Passed: {len(pages)} pages, bilingual navigation, local links/assets, camp data and registration links.')
