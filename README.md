# Rudra reference homepage integration

This is Rudra Elite with the supplied reference homepage, header, footer and original animated logo geometry integrated. Existing internal product pages, RFQ, admin source and backend files are preserved. No Astro/React.

## Start locally
Open this project folder (the one containing `site`) in VS Code, then run:

    py -m http.server 8000 --directory site

Open http://localhost:8000/ manually. If already inside site, use `py -m http.server 8000`.

## Apply to your existing Elite project
Copy the contents of this project's `site/index.html`, `site/assets/reference/`, `site/images/`, `site/components/` to the corresponding places in the existing Elite project. Keep the existing `site/assets/` files. For future rebuilds copy `src/reference-homepage.html` and updated `src/build.py` too. The page has the header/footer/loader statically assembled: editing a standalone component snippet alone does not change the page. Edit matching markup in `site/index.html` and sync it to `src/reference-homepage.html`. Header/footer CSS is in `site/assets/reference/theme.css`; their scripts are in the same reference folder.

## Replace photos
Use the same filenames and WebP format (or update HTML/CSS paths).
- site/images/hero.webp — hero, services and intro background
- site/images/engineer.webp — hero right portrait
- site/images/about.webp — company photo
- site/images/about-2.webp — secondary about photo
- site/images/engineer-w1.webp — why choose us photo
- site/images/cta-background.webp — old fire sprinkler background replacement
- site/images/page-background.webp — old extinguisher background replacement (legacy CSS rule)
- site/images/certified-experts.webp, custom-solutions.webp, consultation.webp, design.webp, process-installation.webp, support.webp, ticker.webp, earthing-service.webp — replaceable icons, temporary grounding motif.
The missing reference photos have been temporarily sourced from the supplied catalogue; verify originals before launch.

## Loader and animations
Original SVG logo parts preserved inline, no external loader request. First visit per session only, about 1.9 seconds maximum including exit, skips reduced motion. Edit inline loader CSS and script in site/index.html for timing. Scroll reveals use IntersectionObserver/CSS rather than the original JS plugin stack. Font families Rubik/Rajdhani and Font Awesome icons are loaded from external CSS; offline screenshots use fallback typography and do not prove exact visual parity. Small non-fire SVG icons remain local. Bootstrap's tiny CSS control SVGs remain.

## Differences and verification
Corrected unrelated democracy paragraph and unsupported 30+ years to catalogue's since 2017. Replaced duplicate ESE card with Lightning Strike Counter, corrected product links to existing pages. Unavailable video buttons link to solutions instead; social links remain disabled until URLs supplied. Only existing privacy page linked; unprovided terms/disclaimer links removed. Existing interior pages keep their Elite layouts, not the reference homepage styling. Backend credentials/deployment/real PageSpeed tests are not completed here.

Local Chromium checks: tests/reference-report.json (inline rendering, no remote fonts/icons). No live hosting change.

---

# Rudra Earthing Systems — Elite static website

A framework-free, multi-page B2B catalogue with independent product landing pages, motion, RFQ basket, optional Supabase-backed enquiry capture and staff lead pipeline. Generated output is committed in `site/` so the website requires no build runtime on the host.

## Preview in VS Code (Windows)
Extract ZIP, open `rudra-elite` in VS Code. Open Terminal:

```powershell
py -m http.server 8000 --directory site
```

Open http://localhost:8000/. If `py` is unavailable, use `python`. Do not double-click index.html: clean root-relative URLs need an HTTP server.

## Source / build
- `src/products.json`: catalogue data; edit here, then run `py src/build.py` to regenerate HTML and sitemap.
- `src/build.py`: shared page templates. Python standard library only.
- `site/assets/style.css`: responsive theme / motion, `main.js`: navigation, catalogue and RFQ, `admin.js`: lead pipeline.
- `site/`: ready-to-host static output. All images are local WebP files, not base64 or data SVG; small SVG favicon only.
- `backend/`: SQL schema and edge function; configure before accepting online enquiries.
- `tests/`: render checks, screenshots, static audit; live HTTP navigation blocked in creation environment. See QA guide.

## GitHub and Vercel
1. Create a **private** GitHub repo in your account (do not upload keys). From this project folder:
   `git init`, `git add .`, `git commit -m "Rudra Elite website"`, `git branch -M main`, `git remote add origin https://github.com/YOUR-ACCOUNT/rudra-earthing.git`, `git push -u origin main`.
2. On Vercel choose New Project, import repo. Framework preset Other; build and install commands empty; output directory `site`. The included vercel.json specifies these settings. Use a commercial-capable Vercel plan (Hobby is non-commercial).
3. In Project Settings > Domains, add `rudraearthingsystem.com` and `www.rudraearthingsystem.com`, choose apex as canonical, set redirect from www. Copy the DNS values shown in your own Vercel project to the registrar; do not guess A/CNAME records. Preserve email-related DNS records. Verify HTTPS and each landing page before advertising.
4. For Cloudflare Pages or other static hosting upload `site/` or set output to `site` with no build command. On cPanel upload **contents** of `site/` into public_html. Configure redirects/headers separately.

## Backend
See `docs/BACKEND.md`. Until configured, quote form explicitly uses email handoff; admin login is disabled. Do not treat the included source as a deployed backend. Full product CMS, quotation PDFs, email notifications and offline conversion import are not implemented in this release.

## Before client handover
See `docs/QA.md`. Verify catalogue claims, certificates and logos; supplied pure copper photo is a duplicate. The downloadable 12-page web catalogue is a raster-compressed copy of original supplied PDF and includes claims not independently validated; approve before publishing. No actual Google Ads / Analytics account connected. No guaranteed Lighthouse score or commercial value.
