"""Generate canonical/hreflang links, sitemap, robots and camp Event JSON-LD."""
from datetime import datetime,date
from zoneinfo import ZoneInfo
from html import escape
from pathlib import Path
import json,re
import xml.etree.ElementTree as ET
from media import load,image_info
ERROR_PAGES={'404.html','404-uk.html'}

def origin(root):
    domain=(root/'CNAME').read_text().strip()
    assert re.fullmatch(r'[a-zA-Z0-9.-]+',domain) and '.' in domain,'CNAME must contain the production hostname'
    return 'https://'+domain

def canonical(base,name):
    return base+'/' if name=='index.html' else base+'/'+name

def event(c,lang,base,manifest):
    text=c['copy'][lang];detail=c['detail']
    name=c['page'] if lang=='en' else c['page'].replace('.html','-uk.html')
    url=canonical(base,name)
    image=(image_info(manifest,c['image']) or {'src':c['image']})['src']
    result={'@context':'https://schema.org','@type':'Event','@id':canonical(base,c['page'])+'#event','url':url,'mainEntityOfPage':url,'name':('GD1 Hockey Camp - ' if lang=='en' else 'Хокейний кемп GD1 - ')+text['title'],'description':text['heroLead'],'startDate':c['startsOn'],'endDate':c['endsOn'],'eventAttendanceMode':'https://schema.org/OfflineEventAttendanceMode','eventStatus':'https://schema.org/EventCancelled' if c['status']=='cancelled' else 'https://schema.org/EventScheduled','image':[base+'/'+image],'location':{'@type':'Place','name':text['venue'],'hasMap':detail['venueUrl'],'address':{'@type':'PostalAddress',**detail['address']}},'organizer':{'@type':'Organization','name':'GD1 School','url':base+'/'}}
    if c['status']=='open':
        result['offers']=[{'@type':'Offer','name':p['label'][lang],'price':p['amount'],'priceCurrency':'EUR','url':c['registrationUrl'],'availability':'https://schema.org/InStock'} for p in detail['prices'] if p['id'] in ('campFee','campFeeWithLunch')]
    return result

def generate(root,data,as_of=None):
    base=origin(root);manifest=load(root)
    # All-day events remain current through the venue's final local day.
    by_page={c['page']:c for c in data['camps'] if c['page']}
    pages=sorted(root.glob('*.html'))
    for path in pages:
        lang='uk' if path.stem.endswith('-uk') else 'en'
        english=path.name.replace('-uk.html','.html')
        uk=english.replace('.html','-uk.html')
        assert (root/english).is_file() and (root/uk).is_file(),'Missing language pair for '+path.name
        s=path.read_text()
        s=re.sub(r'\s*<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>','',s)
        s=re.sub(r'\s*<script\b[^>]*id="gd1-event-data"[^>]*>.*?</script>','',s,flags=re.S)
        if path.name in ERROR_PAGES:
            if not re.search(r'<meta\s+name="robots"',s):
                s=s.replace('</head>','  <meta name="robots" content="noindex, follow">\n</head>')
            path.write_text(s)
            continue
        links=f'  <link rel="canonical" href="{canonical(base,path.name)}">\n'
        for code,name in [('en',english),('uk',uk),('x-default',english)]:
            links+=f'  <link rel="alternate" hreflang="{code}" href="{canonical(base,name)}">\n'
        camp=by_page.get(english)
        if camp and date.fromisoformat(camp['endsOn'])>=(as_of or datetime.now(ZoneInfo(camp['timeZone'])).date()):
            payload=json.dumps(event(camp,lang,base,manifest),ensure_ascii=False,indent=2).replace('<','\\u003c')
            links+='  <script type="application/ld+json" id="gd1-event-data">\n'+payload+'\n  </script>\n'
        path.write_text(s.replace('</head>',links+'</head>'))
    ns='http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('',ns)
    sitemap=ET.Element('{'+ns+'}urlset')
    for path in pages:
        if path.name in ERROR_PAGES or re.search(r'<meta name="robots" content="noindex',path.read_text()):continue
        node=ET.SubElement(sitemap,'{'+ns+'}url')
        ET.SubElement(node,'{'+ns+'}loc').text=canonical(base,path.name)
    ET.indent(sitemap,space='  ')
    ET.ElementTree(sitemap).write(root/'sitemap.xml',encoding='utf-8',xml_declaration=True)
    (root/'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {base}/sitemap.xml\n')
