#!/usr/bin/env python3
"""Install/update Rudra's customer feedback sections from approved genuine reviews.
Python 3.9+, standard library only. No prices, network requests or deployment.
"""
import argparse
import csv
import html
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

BASE = 'https://rudraearthingsystem.com/products/'
PRODUCTS = {
    'ese-lightning-arrester': 'ESE Lightning Arrester',
    'conventional-lightning-arrester': 'Conventional Lightning Arrester',
    'gi-earthing-electrode': 'GI Earthing Electrode',
    'gi-earthing-electrode-with-copper-terminal': 'GI Earthing Electrode with Copper Terminal',
    'copper-bonded-earthing-electrode': 'Copper Bonded Earthing Electrode',
    'copper-bonded-earthing-rod': 'Copper Bonded Earthing Rod',
    '4g-copper-bonded-earthing-rod': '4G Copper Bonded Earthing Rod',
    'lightning-strike-counter': 'Lightning Strike Counter',
    'pure-copper-earthing-electrode': 'Pure Copper Earthing Electrode',
    'solar-earthing-kit': 'Solar Earthing Kit',
    'earth-backfill-compound': 'Earth Backfill Compound',
    'earth-pit-cover': 'Earth Pit Cover',
    'exothermic-welding-kit': 'Exothermic Welding Kit',
    'xtra-advance-ese-lightning-arrester': 'XTRA Advance ESE Lightning Arrester',
    'earthing-lightning-accessories': 'Earthing & Lightning Accessories',
}
CATEGORY = 'earthing-lightning-accessories'
FIELDS = ['slug', 'product', 'customer_name', 'author_type', 'city', 'state',
          'rating_1_to_5', 'review_text', 'component_name', 'genuine_confirmed', 'publish_permission']
MARK = 'RUDRA-SEO-REVIEWS'
STYLE = 'RUDRA-REVIEWS-STYLE'
JSONLD = re.compile(r'(<script\b[^>]*\btype\s*=\s*[\"\']application/ld\+json[\"\'][^>]*>)(.*?)(</script\s*>)', re.I | re.S)
ANCHOR = re.compile(r'<section\b[^>]*\baria-labelledby\s*=\s*[\"\']rp-related-title[\"\'][^>]*>', re.I)
CSS = '''<style>
#rudra-product .rrv-section {background:#f1f5f9;color:#071a2b;}
#rudra-product .rrv-header {display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px;}
#rudra-product .rrv-header h2 {margin-bottom:8px;}
#rudra-product .rrv-summary {color:#475569;margin:0;}
#rudra-product .rrv-controls {display:flex;gap:8px;}
#rudra-product .rrv-controls[hidden] {display:none!important;}
#rudra-product .rrv-arrow {width:46px;height:46px;border:1px solid #cbd5e1;background:#fff;color:#071a2b;border-radius:50%;font-size:20px;cursor:pointer;}
#rudra-product .rrv-arrow:hover:not(:disabled) {background:#071a2b;color:#fff;}
#rudra-product .rrv-arrow:disabled {opacity:.4;cursor:default;}
#rudra-product .rrv-track {display:grid;grid-auto-flow:column;grid-auto-columns:calc((100% - 32px)/3);gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-inline:contain;padding:4px 2px 14px;scrollbar-width:thin;scrollbar-color:#94a3b8 transparent;}
#rudra-product .rrv-card {min-width:0;scroll-snap-align:start;border:1px solid #dbe3ec;border-top:3px solid #ed701e;border-radius:12px;background:#fff;padding:22px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 14px #071a2b08;}
#rudra-product .rrv-person {display:flex;gap:12px;align-items:center;}
#rudra-product .rrv-avatar {flex:0 0 44px;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:#071a2b;color:white;font-weight:700;}
#rudra-product .rrv-card h3 {font-family:inherit;font-size:16px;line-height:1.4;margin:0;overflow-wrap:anywhere;}
#rudra-product .rrv-city {font-size:12px;color:#475569;margin:0;overflow-wrap:anywhere;}
#rudra-product .rrv-stars {color:#a43d0d;font-size:17px;letter-spacing:1px;font-weight:600;margin:0;}
#rudra-product .rrv-stars span {font-size:12px;color:#334155;letter-spacing:0;}
#rudra-product .rrv-body {color:#334155;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:14px;margin:0;}
#rudra-product .rrv-component {font-size:12px;color:#475569;overflow-wrap:anywhere;}
#rudra-product .rrv-empty {border:1px solid #dbe3ec;background:#fff;padding:24px;border-radius:12px;}
#rudra-product .rrv-feedback {margin-top:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
#rudra-product .rrv-feedback a {color:#a43d0d;text-decoration:underline;text-underline-offset:3px;font-weight:600;}
#rudra-product .rrv-section :focus-visible {outline:3px solid #a43d0d;outline-offset:3px;}
@media(max-width:991px){#rudra-product .rrv-track {grid-auto-columns:calc((100% - 16px)/2);}}
@media(max-width:575px){#rudra-product .rrv-track {grid-auto-columns:100%;}#rudra-product .rrv-card {padding:18px;}}
@media(prefers-reduced-motion:reduce){#rudra-product .rrv-track {scroll-behavior:auto!important;}}
</style>'''
JS = '''<script>
(function(){
    const root = document.getElementById('rudra-review-section');
    if (!root) return;
    const track = root.querySelector('.rrv-track');
    const controls = root.querySelector('.rrv-controls');
    if (!track || !controls) return;
    const prev = controls.querySelector('[data-rrv-prev]');
    const next = controls.querySelector('[data-rrv-next]');
    function refresh(){
        const max = Math.max(0, track.scrollWidth - track.clientWidth);
        controls.hidden = max <= 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max - 2;
    }
    function move(direction){
        const cards = track.children;
        const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
        track.scrollBy({left:direction * step,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
    prev.addEventListener('click',function(){move(-1);});
    next.addEventListener('click',function(){move(1);});
    track.addEventListener('scroll',refresh,{passive:true});
    window.addEventListener('resize',refresh);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refresh).observe(track);
    refresh();
})();
</script>'''


def esc(x):
    return html.escape(str(x), quote=True)


def marked(mark, content):
    return f'<!-- {mark} START -->\n{content}\n<!-- {mark} END -->\n'


def remove_mark(source, mark):
    start, end = f'<!-- {mark} START -->', f'<!-- {mark} END -->'
    if source.count(start) != source.count(end) or source.count(start) > 1:
        raise ValueError(f'Unexpected duplicate or incomplete managed block: {mark}')
    return re.sub(re.escape(start) + r'.*?' + re.escape(end) + r'[ \t]*\r?\n?', '', source, flags=re.S)


def load_reviews(path):
    data = {slug: [] for slug in PRODUCTS}
    with path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if not set(FIELDS).issubset(reader.fieldnames or []):
            raise ValueError('Use the new review CSV template; required columns are missing.')
        for line, raw in enumerate(reader, 2):
            row = {k: (raw.get(k) or '').strip() for k in FIELDS}
            slug = row['slug']
            if not any(row.values()): continue
            if slug not in PRODUCTS: raise ValueError(f'Row {line}: unknown product slug.')
            for key in ('genuine_confirmed','publish_permission'):
                if row[key].upper() not in ('YES','NO',''):
                    raise ValueError(f'Row {line}: {key} must be YES or NO.')
            if row['publish_permission'].upper() != 'YES': continue
            if row['genuine_confirmed'].upper() != 'YES':
                raise ValueError(f'Row {line}: confirm genuine customer feedback before publishing.')
            if not row['customer_name'] or not row['review_text']:
                raise ValueError(f'Row {line}: actual customer name and review required.')
            if row['author_type'] not in ('Person','Organization'):
                raise ValueError(f'Row {line}: author_type must be Person or Organization.')
            if row['rating_1_to_5'] not in ('1','2','3','4','5'):
                raise ValueError(f'Row {line}: actual rating must be an integer 1–5.')
            if slug == CATEGORY and not row['component_name']:
                raise ValueError(f'Row {line}: identify the specific accessory reviewed.')
            item = (row['customer_name'], row['author_type'], row['city'], row['state'],
                    int(row['rating_1_to_5']), row['review_text'], row['component_name'])
            if item in data[slug]: raise ValueError(f'Row {line}: duplicate review.')
            # One published review per author/location per product (or accessory component).
            key = (item[0].casefold(), item[2].casefold(), item[3].casefold(), item[6].casefold())
            if any((r[0].casefold(),r[2].casefold(),r[3].casefold(),r[6].casefold()) == key for r in data[slug]):
                raise ValueError(f'Row {line}: duplicate reviewer for this product/component; consolidate their feedback.')
            data[slug].append(item)
    return data


def build_section(slug, reviews):
    title = esc(PRODUCTS[slug]); count = len(reviews)
    out = ['<section class="rp-section rrv-section" id="rudra-review-section" aria-labelledby="rudra-product-review-title">',
           '<div class="rp-container">', '<div class="rrv-header"><div class="rp-heading">',
           '<p class="rp-kicker">Customer Feedback</p>',f'<h2 id="rudra-product-review-title">{title} Reviews</h2>']
    if count and slug != CATEGORY:
        avg = round(sum(r[4] for r in reviews)/count,2)
        out.append(f'<p class="rrv-summary">{avg:g}/5 from {count} published product review{"s" if count != 1 else ""}</p>')
    out.append('</div>')
    if count:
        out.append('<div class="rrv-controls" hidden><button type="button" class="rrv-arrow" data-rrv-prev aria-label="Previous reviews" aria-controls="rudra-review-track">&#8592;</button><button type="button" class="rrv-arrow" data-rrv-next aria-label="Next reviews" aria-controls="rudra-review-track">&#8594;</button></div>')
    out.append('</div>')
    if count:
        out.append('<div class="rrv-track" id="rudra-review-track" tabindex="0" role="region" aria-label="Customer review cards; scroll to see more">')
        for name, kind, city, state, rating, body, component in reviews:
            initials = ''.join(p[0].upper() for p in name.split()[:2])
            loc = ', '.join(x for x in (city,state) if x)
            out.extend(['<article class="rrv-card">','<div class="rrv-person">',
                        f'<span class="rrv-avatar" aria-hidden="true">{esc(initials)}</span><div>',
                        f'<h3>{esc(name)}</h3>',f'<p class="rrv-city">{esc(loc)}</p>' if loc else '', '</div></div>'])
            if slug == CATEGORY: out.append(f'<p class="rrv-component">Product: {esc(component)}</p>')
            out.append('<p class="rrv-stars"><span aria-hidden="true" style="font-size:17px;color:inherit">' + '&#9733;'*rating + '&#9734;'*(5-rating) + f'</span> <span>{rating}/5</span></p>')
            out.append(f'<p class="rrv-body">{esc(body)}</p></article>')
        out.append('</div>')
    else:
        out.append('<div class="rrv-empty"><p>No customer reviews have been published for this product yet.</p></div>')
    out.append('<div class="rrv-feedback"><span>Have you used this product?</span><a href="/contact/">Share your experience with our team</a></div></div></section>')
    if count: out.append(JS)
    return marked(MARK,'\n'.join(out))


def rewrite(source, slug, reviews):
    owned = f'<!-- {MARK} START -->' in source
    source = remove_mark(remove_mark(source,MARK),STYLE)
    matches = list(JSONLD.finditer(source))
    if not matches: raise ValueError(f'{slug}: JSON-LD missing.')
    found = []
    for m in matches:
        doc = json.loads(m.group(2)); nodes = doc if isinstance(doc,list) else doc.get('@graph',[doc])
        for n in nodes:
            if isinstance(n,dict) and ('Product' in n.get('@type',[]) if isinstance(n.get('@type'),list) else n.get('@type') == 'Product') and n.get('url','').rstrip('/') == (BASE+slug).rstrip('/'):
                found.append((m,doc,n))
    if slug != CATEGORY and len(found) != 1:
        raise ValueError(f'{slug}: expected exactly one matching Product schema; got {len(found)}.')
    if len(found)>1: raise ValueError(f'{slug}: ambiguous Product schema.')
    if found:
        m,doc,node = found[0]
        if 'offers' in node:
            raise ValueError(f'{slug}: existing Offer detected; check price privacy before running this review-only updater.')
        if ('review' in node or 'aggregateRating' in node) and not owned:
            raise ValueError(f'{slug}: manually maintained review schema exists; no overwrite performed.')
        change = False
        for k in ('review','aggregateRating'):
            if k in node: node.pop(k); change = True
        if reviews and slug != CATEGORY:
            node['review'] = [{'@type':'Review','author':{'@type':kind,'name':name},'reviewBody':body,
                               'reviewRating':{'@type':'Rating','ratingValue':rating,'bestRating':5,'worstRating':1}}
                              for name,kind,city,state,rating,body,component in reviews]
            node['aggregateRating'] = {'@type':'AggregateRating','ratingValue':round(sum(r[4] for r in reviews)/len(reviews),2),'reviewCount':len(reviews),'bestRating':5,'worstRating':1}
            change = True
        if change:
            payload = json.dumps(doc,ensure_ascii=False,indent=4).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
            source = source[:m.start(2)]+'\n'+payload+'\n    '+source[m.end(2):]
    anchors = list(ANCHOR.finditer(source))
    if len(anchors)!=1: raise ValueError(f'{slug}: cannot uniquely locate Related Products section.')
    pos = anchors[0].start()
    # Insert before the related-products section, keeping all existing markup.
    source = source[:pos]+build_section(slug,reviews)+source[pos:]
    heads = list(re.finditer(r'</head\s*>',source,re.I))
    if len(heads)!=1: raise ValueError(f'{slug}: unexpected head markup.')
    pos=heads[0].start(); source=source[:pos]+marked(STYLE,CSS)+source[pos:]
    for m in JSONLD.finditer(source): json.loads(m.group(2))
    return source


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path.cwd())
    p.add_argument('--data',type=Path,default=Path.home()/'rudra-customer-reviews.csv')
    p.add_argument('--apply',action='store_true',help='Apply changes; default is preview')
    args=p.parse_args(); root=args.root.resolve(); site=next((s for s in (root/'site',root) if (s/'products').is_dir()),None)
    if not site: p.error('Run from project root containing site/products, or from site itself.')
    data_path=args.data.expanduser().resolve()
    # Input may contain personal data; keep it outside the repository and deployment.
    repo=next((s for s in (root,*root.parents) if (s/'.git').exists()),root)
    if repo==data_path or repo in data_path.parents: p.error('Keep the CSV outside the repository (recommended: Windows user home).')
    try:
        data=load_reviews(data_path); planned=[]
        for slug in PRODUCTS:
            path=site/'products'/slug/'index.html'; raw=path.read_bytes(); original=raw.decode('utf-8-sig'); updated=rewrite(original,slug,data[slug]);
            if updated!=original:
                payload=(b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'')+updated.encode('utf-8'); planned.append((path,payload))
            status=f'{len(data[slug])} approved review(s)' if data[slug] else 'honest empty feedback section; no review schema'
            if slug==CATEGORY and data[slug]: status+='; component feedback only, no category rating schema'
            print(f'{slug}: {status}')
        print(f'\n{len(planned)} page(s) to update. No prices will be published.')
        if not args.apply or not planned:
            print('Preview only. Run with --apply to save.' if not args.apply else 'Already up to date.'); return 0
        backup=Path(tempfile.mkdtemp(prefix='rudra-reviews-backup-'))
        for path,_ in planned:
            dest=backup/path.relative_to(site); dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(path,dest)
        written=[]
        try:
            for path,payload in planned:
                with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as f:
                    tmp=Path(f.name); f.write(payload)
                try: tmp.replace(path); written.append(path)
                finally: tmp.unlink(missing_ok=True)
        except Exception:
            for path in written: shutil.copy2(backup/path.relative_to(site),path)
            raise
        print(f'Updated {len(written)} pages. Backup: {backup}\nReview git diff before deployment.')
        return 0
    except (OSError,ValueError) as e:
        print(f'ERROR: {e}',file=sys.stderr);return 1

if __name__=='__main__': sys.exit(main())
