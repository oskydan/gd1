"""Check built search metadata without making requests to search engines."""
from pathlib import Path
from datetime import datetime,date
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

canonical_urls=[];event_count=0
for p in ROOT.glob('*.html'):
    parsed=Metadata(p.read_text());url=canonical(base,p.name)
    if p.name in ERROR_PAGES:
        assert not parsed.canon and not parsed.events and not parsed.alternates,p.name+': error page must not advertise canonical/event metadata'
        assert '<meta name="robots" content="noindex, follow">' in p.read_text(),p.name+': missing noindex'
        continue
    canonical_urls.append(url)
    assert parsed.canon==[url],p.name+': expected exactly one self-canonical'
    en=p.name.replace('-uk.html','.html');uk=en.replace('.html','-uk.html')
    assert parsed.alternates=={'en':canonical(base,en),'uk':canonical(base,uk),'x-default':canonical(base,en)},p.name+': invalid language references'
    camp=by_page.get(en)
    expected=bool(camp and date.fromisoformat(camp['endsOn'])>=datetime.now(ZoneInfo(camp['timeZone'])).date())
    assert len(parsed.events)==int(expected),p.name+': incorrect number of event records'
    if not expected:continue
    event_count+=1;value=parsed.events[0]
    assert value['@type']=='Event' and value['url']==url
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
    if camp['status']=='open':
        assert [x['price'] for x in offers]==expected_prices
        assert all(x['priceCurrency']=='EUR' and x['url']==camp['registrationUrl'] for x in offers)
    else:assert not offers,'Disabled registration must not advertise available offers'

ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls=[node.text for node in ET.parse(ROOT/'sitemap.xml').findall('s:url/s:loc',ns)]
assert len(urls)==len(set(urls)) and set(urls)==set(url for url in canonical_urls if not re.search(r'<meta name="robots" content="noindex', (ROOT/('index.html' if url==base+'/' else urlsplit(url).path.lstrip('/'))).read_text())),'Sitemap must contain exactly the canonical pages'
assert f'Sitemap: {base}/sitemap.xml' in (ROOT/'robots.txt').read_text()
# A cancelled camp must retain dates but stop advertising registration offers.
sample=next(c for c in data['camps'] if c['page']);sample['status']='cancelled'
cancelled=event(sample,'en',base,load(ROOT))
assert cancelled['eventStatus']=='https://schema.org/EventCancelled' and cancelled['startDate']==sample['startsOn'] and 'offers' not in cancelled
print(f'Passed: {len(urls)} sitemap URLs, self-canonicals, reciprocal language references and {event_count} localized camp event records.')
