"""Check built search metadata without making requests to search engines."""
from pathlib import Path
from html import unescape
import search_metadata
from datetime import datetime,date,timedelta
from zoneinfo import ZoneInfo
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re,xml.etree.ElementTree as ET
from camps import read
from seo import origin,canonical,event,ERROR_PAGES
from media import load
ROOT=Path(__file__).resolve().parents[1]
base=origin(ROOT);data=read(ROOT)
by_page={c['page']:c for c in data['camps'] if c['page']}
class Metadata(HTMLParser):
    def __init__(self,text):
        super().__init__();self.canon=[];self.alternates={};self.events=[];self.json='';self.active=False;self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical':self.canon.append(a.get('href'))
        if tag=='link' and a.get('rel')=='alternate':
            assert a['hreflang'] not in self.alternates,'Duplicate language reference'
            self.alternates[a['hreflang']]=a['href']
        if tag=='script' and a.get('type')=='application/ld+json':self.active=True;self.json=''
    def handle_data(self,text):
        if self.active:self.json+=text
    def handle_endtag(self,tag):
        if tag=='script' and self.active:self.events.append(json.loads(self.json));self.active=False

search_copy=search_metadata.catalog(ROOT,data)
seen_titles=set();seen_descriptions=set()
canonical_urls=[];event_count=0
for p in ROOT.glob('*.html'):
    if '<meta name="robots" content="noindex, nofollow">' in p.read_text():continue
    parsed=Metadata(p.read_text());url=canonical(base,p.name)
    if p.name in ERROR_PAGES:
        assert not parsed.canon and not parsed.events and not parsed.alternates,p.name+': error page must not advertise canonical/event metadata'
        assert '<meta name="robots" content="noindex, follow">' in p.read_text(),p.name+': missing noindex'
        continue
    lang='uk' if p.stem.endswith('-uk') else 'en'
    identity=p.name.replace('-uk.html','.html')
    titles=re.findall(r'<title>(.*?)</title>',p.read_text(),re.S)
    descriptions=re.findall(r'<meta name="description" content="([^"]*)">',p.read_text())
    assert len(titles)==len(descriptions)==1,p.name+': expected one title and description'
    title=unescape(titles[0]);description=unescape(descriptions[0])
    assert {'title':title,'description':description}==search_copy[identity][lang],p.name+': stale search copy'
    assert title not in seen_titles and description not in seen_descriptions,p.name+': duplicate search copy'
    seen_titles.add(title);seen_descriptions.add(description)
    canonical_urls.append(url)
    assert parsed.canon==[url],p.name+': expected exactly one self-canonical'
    en=p.name.replace('-uk.html','.html');uk=en.replace('.html','-uk.html')
    assert parsed.alternates=={'en':canonical(base,en),'uk':canonical(base,uk),'x-default':canonical(base,en)},p.name+': invalid language references'
    camp=by_page.get(en)
    expected=bool(camp and date.fromisoformat(camp['endsOn'])>=datetime.now(ZoneInfo(camp['timeZone'])).date())
    assert len(parsed.events)==int(expected),p.name+': incorrect number of event records'
    if not expected:continue
    event_count+=1;value=parsed.events[0]
    assert value['@context']=='https://schema.org' and value['@type']=='Event' and value['url']==url
    assert value['mainEntityOfPage']==url and value['@id']==canonical(base,en)+'#event'
    assert value['name']==('GD1 Hockey Camp - ' if lang=='en' else 'Хокейний кемп GD1 - ')+camp['copy'][lang]['title']
    assert value['description']==camp['copy'][lang]['heroLead']
    assert value['eventAttendanceMode']=='https://schema.org/OfflineEventAttendanceMode'
    assert value['eventStatus']==('https://schema.org/EventCancelled' if camp['status']=='cancelled' else 'https://schema.org/EventScheduled')
    assert date.fromisoformat(value['startDate'])<=date.fromisoformat(value['endDate'])
    assert value['organizer']=={'@type':'Organization','name':'GD1 School','url':base+'/'}
    location=value['location']
    assert location['@type']=='Place' and location['name']==camp['copy'][lang]['venue']
    assert location['hasMap']==camp['detail']['venueUrl']
    assert location['address']=={'@type':'PostalAddress',**camp['detail']['address']}
    assert camp['copy'][lang]['venue'] in unescape(p.read_text()),p.name+': venue must be visible on the page'
    assert value['startDate']==camp['startsOn'] and value['endDate']==camp['endsOn']
    assert 'T' not in value['startDate'],'Unknown start times must not be invented'
    assert value['location']['address']['@type']=='PostalAddress'
    assert value['location']['address']['addressCountry'] in ('CZ','LT','BG')
    assert value['location']['address']['streetAddress']
    for image in value['image']:
        assert image.startswith(base+'/')
        assert (ROOT/urlsplit(image).path.lstrip('/')).is_file()
    offers=value.get('offers',[])
    expected_prices=[x['amount'] for x in camp['detail']['prices'] if x['id'] in ('campFee','campFeeWithLunch')]
    if camp['status']=='open' and datetime.now(ZoneInfo(camp['timeZone'])).date()<date.fromisoformat(camp['startsOn']):
        assert [x['price'] for x in offers]==expected_prices
        assert all(x['@type']=='Offer' and x['priceCurrency']=='EUR' and x['url']==camp['registrationUrl'] and x['availability']=='https://schema.org/InStock' for x in offers)
        assert [x['name'] for x in offers]==[price['label'][lang] for price in camp['detail']['prices'] if price['id'] in ('campFee','campFeeWithLunch')]
        assert 'href="'+camp['registrationUrl']+'"' in unescape(p.read_text()),p.name+': registration URL must be a visible link'
    else:assert not offers,'Disabled registration must not advertise available offers'

ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls=[node.text for node in ET.parse(ROOT/'sitemap.xml').findall('s:url/s:loc',ns)]
assert len(urls)==len(set(urls)) and set(urls)==set(url for url in canonical_urls if not re.search(r'<meta name="robots" content="noindex', (ROOT/('index.html' if url==base+'/' else urlsplit(url).path.lstrip('/'))).read_text())),'Sitemap must contain exactly the canonical pages'
assert f'Sitemap: {base}/sitemap.xml' in (ROOT/'robots.txt').read_text()
# Offers must stop at the venue's registration cutoff, including disabled states.
for camp in by_page.values():
    for lang in ('en','uk'):
        start=date.fromisoformat(camp['startsOn'])
        for status in ('open','soon','closed','cancelled'):
            sample={**camp,'status':status}
            before=event(sample,lang,base,load(ROOT),start-timedelta(days=1))
            assert bool(before.get('offers'))==(status=='open')
            for cutoff in (start,date.fromisoformat(camp['endsOn'])+timedelta(days=1)):
                closed=event(sample,lang,base,load(ROOT),cutoff)
                assert 'offers' not in closed,'Camp must not advertise registration once it starts'
                assert closed['startDate']==camp['startsOn'] and closed['location']['name']==camp['copy'][lang]['venue']
# A cancelled camp must retain dates but stop advertising registration offers.
sample=next(c for c in data['camps'] if c['page']);sample['status']='cancelled'
cancelled=event(sample,'en',base,load(ROOT))
assert cancelled['eventStatus']=='https://schema.org/EventCancelled' and cancelled['startDate']==sample['startsOn'] and 'offers' not in cancelled
print(f'Passed: {len(urls)} sitemap URLs, self-canonicals, reciprocal language references and {event_count} localized camp event records.')
