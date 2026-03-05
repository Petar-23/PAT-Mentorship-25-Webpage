#!/usr/bin/env python3
"""
OPTICON Deep Scraper — fetches full article content from premium geopolitical sources.
Uses httpx (no Scrapling needed for these sites).

Usage: python3 scrape-deep.py
Output: JSON array to stdout
"""
import json, re, sys
from datetime import datetime, timezone, timedelta
import httpx

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}
CUTOFF = datetime.now(timezone.utc) - timedelta(hours=48)

def strip_tags(html):
    """Remove HTML tags and decode common entities."""
    text = re.sub(r'<[^>]+>', ' ', html)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>') \
               .replace('&quot;', '"').replace('&#39;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', text).strip()

def scrape_isw(client):
    """Scrape ISW Ukraine conflict updates page — extract latest report excerpt."""
    results = []
    try:
        r = client.get('https://www.understandingwar.org/backgrounder/ukraine-conflict-updates', timeout=15)
        if r.status_code != 200:
            return results

        html = r.text
        # Find article blocks: each report has a div.views-row with title + body
        articles = re.findall(r'<div class="views-row[^"]*">(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
        
        for block in articles[:5]:
            title_m = re.search(r'<h[23][^>]*>.*?<a[^>]*>([^<]+)</a>', block, re.DOTALL)
            date_m = re.search(r'(\w+ \d+,\s*\d{4})', block)
            # Get first paragraph of body text
            body_m = re.search(r'<div class="field-item[^"]*">(.*?)</div>', block, re.DOTALL)
            
            title = title_m.group(1).strip() if title_m else ''
            date_str = date_m.group(1) if date_m else ''
            body = strip_tags(body_m.group(1))[:500] if body_m else ''
            
            if not title:
                continue
            
            try:
                pub_dt = datetime.strptime(date_str, '%B %d, %Y').replace(tzinfo=timezone.utc) if date_str else datetime.now(timezone.utc)
            except:
                pub_dt = datetime.now(timezone.utc)
            
            if pub_dt < CUTOFF:
                continue
            
            results.append({
                'source': 'ISW',
                'title': title,
                'excerpt': body,
                'publishedAt': pub_dt.isoformat(),
                'url': 'https://www.understandingwar.org/backgrounder/ukraine-conflict-updates',
                'depth': 'full',
            })
        
        # Fallback: if no structured articles found, grab the main content summary
        if not results:
            # Try grabbing the main body text sections (ISW reports are long)
            content_blocks = re.findall(r'<p>(.*?)</p>', html, re.DOTALL)
            content_text = ' '.join(strip_tags(b) for b in content_blocks[:10] if len(b) > 100)
            if content_text:
                results.append({
                    'source': 'ISW',
                    'title': 'ISW Ukraine Conflict Update',
                    'excerpt': content_text[:800],
                    'publishedAt': datetime.now(timezone.utc).isoformat(),
                    'url': 'https://www.understandingwar.org/backgrounder/ukraine-conflict-updates',
                    'depth': 'partial',
                })
    except Exception as e:
        sys.stderr.write(f'[scrape] ISW error: {e}\n')
    return results


def scrape_bellingcat(client):
    """Scrape Bellingcat latest investigations."""
    results = []
    try:
        r = client.get('https://www.bellingcat.com/news/', timeout=15)
        if r.status_code != 200:
            return results
        
        html = r.text
        # Bellingcat article structure: article tags with title + excerpt
        articles = re.findall(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        
        for block in articles[:8]:
            title_m = re.search(r'<h\d[^>]*class="[^"]*entry-title[^"]*"[^>]*>.*?<a[^>]*>([^<]+)</a>', block, re.DOTALL)
            if not title_m:
                title_m = re.search(r'<a[^>]*class="[^"]*post-thumbnail[^"]*"[^>]*title="([^"]+)"', block)
            if not title_m:
                title_m = re.search(r'<h[23][^>]*>(.*?)</h[23]>', block, re.DOTALL)
            
            date_m = re.search(r'<time[^>]*datetime="([^"]+)"', block)
            excerpt_m = re.search(r'<p[^>]*class="[^"]*excerpt[^"]*"[^>]*>(.*?)</p>', block, re.DOTALL)
            if not excerpt_m:
                excerpt_m = re.search(r'<p>(.*?)</p>', block, re.DOTALL)
            
            title = strip_tags(title_m.group(1)).strip() if title_m else ''
            date_str = date_m.group(1) if date_m else ''
            excerpt = strip_tags(excerpt_m.group(1))[:400] if excerpt_m else ''
            
            if not title or len(title) < 10:
                continue
            
            try:
                pub_dt = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.now(timezone.utc)
            except:
                pub_dt = datetime.now(timezone.utc)
            
            if pub_dt < CUTOFF:
                continue
            
            results.append({
                'source': 'Bellingcat',
                'title': title,
                'excerpt': excerpt,
                'publishedAt': pub_dt.isoformat(),
                'url': 'https://www.bellingcat.com/news/',
                'depth': 'excerpt',
            })
    except Exception as e:
        sys.stderr.write(f'[scrape] Bellingcat error: {e}\n')
    return results


def scrape_kyiv_independent(client):
    """Scrape Kyiv Independent for Ukraine war coverage."""
    results = []
    try:
        r = client.get('https://kyivindependent.com/tag/war/', timeout=15)
        if r.status_code != 200:
            r = client.get('https://kyivindependent.com/', timeout=15)
        if r.status_code != 200:
            return results
        
        html = r.text
        # Find article cards
        articles = re.findall(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        if not articles:
            # Try generic h2/h3 with links
            articles = re.findall(r'<div[^>]*class="[^"]*post[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
        
        for block in articles[:8]:
            title_m = re.search(r'<h[123][^>]*>(.*?)</h[123]>', block, re.DOTALL)
            date_m = re.search(r'<time[^>]*datetime="([^"]+)"', block)
            excerpt_m = re.search(r'<p[^>]*>(.*?)</p>', block, re.DOTALL)
            
            title = strip_tags(title_m.group(1)).strip() if title_m else ''
            date_str = date_m.group(1) if date_m else ''
            excerpt = strip_tags(excerpt_m.group(1))[:400] if excerpt_m else ''
            
            if not title or len(title) < 10:
                continue
            
            try:
                pub_dt = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.now(timezone.utc)
            except:
                pub_dt = datetime.now(timezone.utc)
            
            if pub_dt < CUTOFF:
                continue
            
            results.append({
                'source': 'KyivIndependent',
                'title': title,
                'excerpt': excerpt,
                'publishedAt': pub_dt.isoformat(),
                'url': 'https://kyivindependent.com/tag/war/',
                'depth': 'excerpt',
            })
    except Exception as e:
        sys.stderr.write(f'[scrape] KyivIndependent error: {e}\n')
    return results


def scrape_acled_crisis(client):
    """Scrape ACLED crisis monitor for global conflict data."""
    results = []
    try:
        r = client.get('https://acleddata.com/2024/01/22/acled-resource-page-the-israel-palestine-war/', 
                       timeout=10)
        # ACLED main page for latest data
        r = client.get('https://acleddata.com/tag/conflict-alert/', timeout=10)
        if r.status_code != 200:
            return results
        
        html = r.text
        articles = re.findall(r'<article[^>]*>(.*?)</article>', html, re.DOTALL)
        for block in articles[:5]:
            title_m = re.search(r'<h[123][^>]*>(.*?)</h[123]>', block, re.DOTALL)
            date_m = re.search(r'<time[^>]*datetime="([^"]+)"', block)
            title = strip_tags(title_m.group(1)).strip() if title_m else ''
            if not title or len(title) < 10:
                continue
            date_str = date_m.group(1) if date_m else ''
            try:
                pub_dt = datetime.fromisoformat(date_str.replace('Z', '+00:00')) if date_str else datetime.now(timezone.utc)
            except:
                pub_dt = datetime.now(timezone.utc)
            if pub_dt < CUTOFF:
                continue
            results.append({
                'source': 'ACLED',
                'title': title,
                'excerpt': '',
                'publishedAt': pub_dt.isoformat(),
                'url': 'https://acleddata.com/tag/conflict-alert/',
                'depth': 'title',
            })
    except Exception as e:
        sys.stderr.write(f'[scrape] ACLED error: {e}\n')
    return results


def main():
    all_results = []
    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        # Run all scrapers
        for scraper in [scrape_isw, scrape_bellingcat, scrape_kyiv_independent, scrape_acled_crisis]:
            try:
                items = scraper(client)
                all_results.extend(items)
                sys.stderr.write(f'[scrape] {scraper.__name__}: {len(items)} items\n')
            except Exception as e:
                sys.stderr.write(f'[scrape] {scraper.__name__} fatal: {e}\n')
    
    # Output JSON array to stdout
    print(json.dumps(all_results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
