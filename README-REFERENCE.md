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
