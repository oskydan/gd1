"""Camp data, validation, rendering and bilingual text used by the site build."""
from datetime import date
from html import escape
from pathlib import Path
import json, re
from urllib.parse import urlsplit

MONTHS = {'en': 'January February March April May June July August September October November December'.split(), 'uk': 'січня лютого березня квітня травня червня липня серпня вересня жовтня листопада грудня'.split()}
def period(c, lang='en'):
    a,b=(date.fromisoformat(c[k]) for k in ('startsOn','endsOn'))
    month=MONTHS[lang]; dash='–' if lang=='en' else '-'
    if a==b:return f'{a.day} {month[a.month-1]} {a.year}'
    if (a.year,a.month)==(b.year,b.month):return f'{a.day}{dash}{b.day} {month[b.month-1]} {b.year}'
    first=f'{a.day} {month[a.month-1]}' + (f' {a.year}' if a.year!=b.year else '')
    return f'{first}{dash}{b.day} {month[b.month-1]} {b.year}'

def read(root):
    data=json.loads((root/'data/camps.json').read_text())
    assert data['schemaVersion']==1, 'Unsupported camp data schema'
    ids=set();pages=set()
    for c in data['camps']:
        assert re.fullmatch('[a-z0-9-]+',c['id']), 'Invalid camp ID'
        assert c['id'] not in ids, 'Duplicate camp ID: '+c['id']
        ids.add(c['id'])
        assert date.fromisoformat(c['startsOn'])<=date.fromisoformat(c['endsOn']),c['id']+': reversed dates'
        assert c['status'] in ('open','soon','cancelled','closed'),c['id']+': invalid status'
        assert c['image'].startswith('assets/') and '..' not in c['image'],c['id']+': invalid image path'
        for lang in ('en','uk'):
            assert all(c['copy'][lang].get(k) for k in ('title','imageAlt','shortDescription','longDescription')),c['id']+': incomplete '+lang
            for key,value in c['copy'][lang].items():
                if isinstance(value,str):
                    for token,field in [('onIce','onIceDaily'),('offIce','offIceDaily')]:
                        count=data['defaults'][field]
                        value=value.replace('{'+token+'}',('two' if lang=='en' else 'два') if count==2 else str(count))
                    c['copy'][lang][key]=value
        if c['status']=='open':assert urlsplit(c['registrationUrl']).scheme=='https' and urlsplit(c['registrationUrl']).netloc,c['id']+': registration URL required'
        if c['page']:
            assert re.fullmatch(r'[a-z0-9-]+\.html',c['page']) and c['page'] not in pages,'Duplicate or invalid camp page'
            pages.add(c['page'])
            assert c.get('detail') and c['detail']['prices'],c['id']+': missing page details'
            assert urlsplit(c['detail']['venueUrl']).scheme=='https',c['id']+': invalid venue URL'
            assert all(isinstance(p['amount'],int) and p['amount']>0 for p in c['detail']['prices']),c['id']+': invalid price'
            amounts={p['id']:str(p['amount']) for p in c['detail']['prices']}
            for t in c['copy'].values():
                for key,value in list(t.items()):
                    if isinstance(value,str):
                        for id,amount in amounts.items():value=value.replace('{'+id+'}',amount)
                        t[key]=value
            for p in c['detail']['prices']:
                assert all(set(p[k])=={'en','uk'} for k in ('label','unit','note')),c['id']+': prices need both languages'
            for lang in ('en','uk'):
                t=c['copy'][lang]
                t['meta']=(f'GD1 camp in {t["title"]}, {period(c,lang)}. ' if lang=='en' else f'Кемп GD1: {t["title"]}, {period(c,lang)}. ')+t['heroLead']
                start=date.fromisoformat(c['startsOn'])
                t['breadcrumb']=f'{t["title"].split(",")[0]}, {MONTHS[lang][start.month-1]} {start.year}'
            for lang in ('en','uk'):
                assert all(c['copy'][lang].get(k) for k in ('meta','breadcrumb','heroLabel','heroHeading','heroLead','formatHeading','formatDescription','venue','costHeading')),c['id']+': missing detail translation'
    assert len(set(data['footerCampIds']))==len(data['footerCampIds']) and set(data['footerCampIds'])<=ids,'Unknown or duplicate footer camp'
    assert all(isinstance(v,int) and v>0 for v in data['defaults'].values()),'Invalid training/prepayment settings'
    return data

def runtime(c,lang):
    result={k:c[k] for k in ('id','startsOn','endsOn','image','registrationUrl')}
    result.update({k:c['copy'][lang][k] for k in ('title','imageAlt','shortDescription','longDescription')})
    result.update(period=period(c,lang),page=c['page'].replace('.html','-uk.html') if lang=='uk' else c['page'],cancelled=c['status']=='cancelled',registrationComingSoon=c['status']=='soon',registrationClosed=c['status']=='closed')
    return result

def translations(data):
    pairs={}
    for c in data['camps']:
        pairs[period(c)]=period(c,'uk')
        pairs[c['copy']['en']['title'].split(',')[0]]=c['copy']['uk']['title'].split(',')[0]
        for key,value in c['copy']['en'].items():
            other=c['copy']['uk'][key]
            if isinstance(value,list):pairs.update(zip(value,other))
            else:pairs[value]=other
        if c['page']:
            pairs[c['copy']['en']['title']+' | GD1 Camp']=c['copy']['uk']['title']+' | Кемп GD1'
            for p in c['detail']['prices']:
                for k in ('label','unit','note'):pairs[p[k]['en']]=p[k]['uk']
    d=data['defaults'];amount=d['prepaymentEuro'];months=d['cancellationMonths']
    pairs[prepayment_text(data)]=f'Реєстрацію підтверджено після передоплати {amount} € за одну сесію. Передоплата не повертається, якщо ви скасуєте участь менш ніж за '+('місяць' if months==1 else f'{months} міс.')+' до початку кемпу.'
    pairs[f'Daily training schedule: {d["onIceDaily"]} on-ice and {d["offIceDaily"]} off-ice trainings']=f'Щоденний розклад: {d["onIceDaily"]} тренування на льоду та {d["offIceDaily"]} поза льодом'
    pairs[training_summary(data)]=f'{d["onIceDaily"]+d["offIceDaily"]} цілеспрямовані тренування щодня.'
    return pairs

def prepayment_text(data):
    d=data['defaults'];months=d['cancellationMonths']
    return f'Registration is confirmed with a €{d["prepaymentEuro"]} prepayment per session. The prepayment is non-refundable if you cancel less than '+('one month' if months==1 else f'{months} months')+' before the camp.'

def training_summary(data):
    total=data['defaults']['onIceDaily']+data['defaults']['offIceDaily']
    return ('Four' if total==4 else str(total))+' focused sessions, every day.'

def main_html(c,data):
    t=c['copy']['en'];detail=c['detail'];d=data['defaults'];e=escape
    def heading(parts):return e(parts[0])+'<br><em>'+e(parts[1])+'</em>'
    registration=(f'<a class="button camp-detail-cta" href="{e(c["registrationUrl"],quote=True)}" target="_blank" rel="noopener noreferrer">Register Now</a>' if c['status']=='open' else '<span class="button camp-detail-cta is-disabled" aria-disabled="true">'+('Cancelled' if c['status']=='cancelled' else 'Registration soon' if c['status']=='soon' else 'Registration Closed')+'</span>')
    arena=f'<a class="camp-detail-map-link" href="{e(detail["venueUrl"],quote=True)}" target="_blank" rel="noopener noreferrer">{e(t["venue"])}'+(' <span aria-hidden="true">↗</span>' if detail['mapArrow'] else '')+'</a>'
    facts=f'<div class="camp-detail-fact"><span>DATES</span><strong>{period(c)}</strong></div><div class="camp-detail-fact"><span>ICE ARENA</span><strong>{arena}</strong></div>'
    if t['accommodation']:facts+=f'<div class="camp-detail-fact"><span>ACCOMMODATION</span><strong>{e(t["accommodation"])}</strong></div>'
    prices=''.join(f'<div class="camp-detail-price"><span>{e(p["label"]["en"])}</span><strong>€{p["amount"]}'+(f' <small>{e(p["unit"]["en"])}</small>' if p['unit']['en'] else '')+f'</strong><p>{e(p["note"]["en"])}</p></div>' for p in detail['prices'])
    return f'''    <div class="camp-breadcrumb-bar"><nav class="wrap camp-breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="index.html">Home</a></li><li><a href="camps.html">Camps</a></li><li aria-current="page">{e(t['breadcrumb'])}</li></ol></nav></div>
    <section class="camp-detail-hero" aria-labelledby="camp-title">
      <div class="camp-detail-hero-copy"><p class="eyebrow dark"><span class="live-dot"></span>{e(t['heroLabel'])}</p><h1 id="camp-title">{heading(t['heroHeading'])}</h1><p class="camp-detail-date">{period(c)}</p><p class="camp-detail-lead">{e(t['heroLead'])}</p>{registration}</div>
      <div class="camp-detail-hero-image"><img src="{e(c['image'])}" alt="{e(t['imageAlt'])}"></div>
    </section>
    <section class="camp-detail-section" aria-labelledby="camp-format-title">
      <div class="wrap camp-detail-grid"><div class="camp-detail-main-copy"><p class="eyebrow dark">THE CAMP</p><h2 id="camp-format-title">{heading(t['formatHeading'])}</h2><p>{e(t['formatDescription'])}</p></div><aside class="camp-detail-facts" aria-label="Camp details">{facts}</aside></div>
      <div class="wrap"><div class="camp-detail-format" aria-label="Daily training schedule: {d['onIceDaily']} on-ice and {d['offIceDaily']} off-ice trainings"><div class="camp-detail-format-heading"><span>DAILY TRAINING</span><strong>{training_summary(data)}</strong></div><div class="camp-detail-format-counts"><div class="camp-detail-format-count"><strong>{d['onIceDaily']:02}</strong><span>ON-ICE<br>TRAININGS</span></div><div class="camp-detail-format-count"><strong>{d['offIceDaily']:02}</strong><span>OFF-ICE<br>TRAININGS</span></div></div></div></div>
    </section>
    <section class="camp-detail-pricing" aria-labelledby="camp-cost-title"><div class="wrap camp-detail-pricing-grid"><div><p class="eyebrow">CAMP COST</p><h2 id="camp-cost-title">{heading(t['costHeading'])}</h2></div>{prices}</div></section>
    <section class="camp-detail-section camp-detail-registration" aria-labelledby="camp-registration-title"><div class="wrap camp-detail-registration-inner"><div><p class="eyebrow dark">HOW TO REGISTER</p><h2 id="camp-registration-title">Save your<br><em>place.</em></h2></div><div class="camp-detail-registration-copy"><p>{prepayment_text(data)}</p><p>After you submit the form, you’ll receive the prepayment details.</p>{registration}</div></div></section>'''
