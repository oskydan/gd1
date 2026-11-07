"""Apply prepared responsive media to generated output; standard library only."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import json,re

def load(root):
    path=root/'data/media.json'
    return json.loads(path.read_text()) if path.exists() else {'images':{},'videos':{}}

def image_info(manifest,src):
    return manifest['images'].get(src) or next((v for v in manifest['images'].values() if v['src']==src),None)

def cards(camps,manifest):
    for c in camps:
        info=image_info(manifest,c['image'])
        if info:c.update(image=info['src'],imageSrcset=info['srcset'],imageWidth=info['width'],imageHeight=info['height'])

class ResponsiveHTML(HTMLParser):
    def __init__(self,manifest):super().__init__(convert_charrefs=False);self.manifest=manifest;self.parts=[]
    def handle_starttag(self,tag,attrs):
        raw=self.get_starttag_text();a=dict(attrs);updates={}
        if tag=='img':
            info=image_info(self.manifest,a.get('src'))
            if info:
                sizes='(max-width: 800px) calc(100vw - 40px), 600px'
                if a.get('loading')=='lazy':sizes='(max-width: 620px) calc(100vw - 40px), (max-width: 800px) 50vw, 600px'
                updates.update(src=info['src'],srcset=info['srcset'],sizes=sizes,width=str(info['width']),height=str(info['height']),decoding='async')
        if tag=='source' and a.get('type')=='video/mp4':
            src=a.get('data-src',a.get('src',''));info=self.manifest['videos'].get(src)
            if info:updates['data-src' if 'data-src' in a else 'src']=info['src']
        if tag=='video':
            updates['preload']='none'
            poster=image_info(self.manifest,a.get('poster'))
            if poster:updates['poster']=poster['src']
        for key,value in updates.items():
            attr=key+'="'+escape(value,quote=True)+'"'
            if key in a:raw=re.sub(r'\b'+key+r'=("[^"]*"|\x27[^\x27]*\x27)',lambda _:attr,raw,count=1)
            else:raw=raw[:-1]+' '+attr+'>'
        self.parts.append(raw)
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
    def handle_endtag(self,tag):self.parts.append('</'+tag+'>')
    def handle_data(self,data):self.parts.append(data)
    def handle_decl(self,data):self.parts.append('<!'+data+'>')
    def handle_entityref(self,name):self.parts.append('&'+name+';')
    def handle_charref(self,name):self.parts.append('&#'+name+';')
    def handle_comment(self,data):self.parts.append('<!--'+data+'-->')

def html(text,manifest):
    def cover(match):
        block=match[0]
        if 'poster=' in block:return block
        source=re.search(r'data-src="([^"]+)"',block)
        if not source:return block
        info=manifest['videos'].get(source[1]) or next((v for v in manifest['videos'].values() if v['src']==source[1]),None)
        return block.replace('<video ','<video poster="'+info['poster']+'" ',1) if info else block
    text=re.sub(r'<video\b.*?</video>',cover,text,flags=re.S)
    parser=ResponsiveHTML(manifest);parser.feed(text);return ''.join(parser.parts)

def styles(root,manifest):
    p=root/'styles.css';s=p.read_text()
    for source,info in manifest['images'].items():s=s.replace("url('"+source+"')","url('"+info['src']+"')")
    if '/* Responsive homepage background */' not in s:
        info=manifest['images'].get('assets/power-skating.jpg')
        if info:
            mobile=next((part.strip().split()[0] for part in info['srcset'].split(',') if part.strip().endswith('960w')),info['src'])
            s+="\n/* Responsive homepage background */\n@media(max-width:800px){.hero .hero-image{background-image:linear-gradient(90deg,rgba(5,5,5,.25),rgba(5,5,5,.16)),url('"+mobile+"')}}\n"
    p.write_text(s)
