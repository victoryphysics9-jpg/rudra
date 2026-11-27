/* Load common Rudra HTML fragments. Use on pages with empty mount elements. */
(async function () {
    const normalize = path => path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
    function markCurrent(root) {
        root.querySelectorAll('a[href]').forEach(link => {
            const url = new URL(link.getAttribute('href'), location.href);
            if (url.origin === location.origin && !url.search &&
                normalize(url.pathname) === normalize(location.pathname) &&
                !link.matches('[data-rn-trigger], [data-rn-category-trigger], .mobile-dropdown-toggle, .navbar-brand, .rudra-footer__logo')) {
                link.setAttribute('aria-current', 'page');
            }
        });
    }
    async function load(id, name) {
        const mount = document.getElementById(id);
        if (!mount) return null;
        const response = await fetch('/components/' + name + '.html');
        if (!response.ok) throw new Error(name + ': HTTP ' + response.status);
        mount.innerHTML = await response.text();
        return mount;
    }
    function script(src, parent) {
        return new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = src;
            el.onload = resolve;
            el.onerror = () => reject(new Error('Cannot load ' + src));
            parent.appendChild(el);
        });
    }
    function initNestedNavigation() {
        (function(){
            const header = document.querySelector('#rudra-header-mount .main-header');
            if (!header) return;
            const desktop = Array.from(header.querySelectorAll('[data-rn-dropdown]'));
            const mobile = header.querySelector('#rudra-mobile-products');
            const mobileMenu = header.querySelector('.responsive-menu');
            const mobileToggle = header.querySelector('.mobile-menu-toggle');
            const hover = window.matchMedia('(hover:hover) and (pointer:fine)');
            const cats = Array.from(header.querySelectorAll('[data-rn-category]'));
            // Treat enhanced disclosure links as buttons, supporting both Enter and Space.
            header.querySelectorAll('[data-rn-trigger],[data-rn-category-trigger],.mobile-dropdown-toggle').forEach(trigger=>{
                trigger.setAttribute('role','button');
                trigger.addEventListener('keydown',e=>{
                    if(e.key===' '){e.preventDefault();trigger.click();}
                });
            });
            let pinned = null;
            function setCategory(item, open){
                item.classList.toggle('rn-open',open);
                item.querySelector('[data-rn-category-trigger]').setAttribute('aria-expanded',String(open));
                if(open){
                    const panel=item.querySelector('.rn-product-flyout');
                    const rect=item.getBoundingClientRect();
                    panel.style.setProperty('--rn-flyout-height',Math.max(90,window.innerHeight-rect.top-12)+'px');
                }
            }
            function closeRoot(root){
                root.classList.remove('rn-open');
                root.querySelector('[data-rn-trigger]').setAttribute('aria-expanded','false');
                root.querySelectorAll('[data-rn-category]').forEach(item=>setCategory(item,false));
                if(pinned===root) pinned=null;
            }
            function openRoot(root){
                desktop.forEach(other=>{if(other!==root)closeRoot(other);});
                root.classList.add('rn-open');
                root.querySelector('[data-rn-trigger]').setAttribute('aria-expanded','true');
                if(root.id==='rudra-desktop-products'){
                    const rect=root.querySelector('#rn-desktop-categories').getBoundingClientRect();
                    root.classList.toggle('rn-flip',rect.right+300>window.innerWidth-12);
                }
            }
            desktop.forEach(root=>{
                const trigger=root.querySelector('[data-rn-trigger]');
                root.addEventListener('mouseenter',()=>{if(hover.matches)openRoot(root);});
                root.addEventListener('mouseleave',()=>{if(hover.matches&&pinned!==root&&!root.contains(document.activeElement))closeRoot(root);});
                trigger.addEventListener('click',e=>{
                    e.preventDefault();
                    if(pinned===root){closeRoot(root);return;}
                    openRoot(root); pinned=root;
                });
                root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget)&&!root.matches(':hover'))closeRoot(root);});
            });
            cats.forEach(item=>{
                const trigger=item.querySelector('[data-rn-category-trigger]');
                function show(){cats.forEach(other=>setCategory(other,other===item));}
                item.addEventListener('mouseenter',()=>{if(hover.matches)show();});
                trigger.addEventListener('click',e=>{e.preventDefault();if(e.detail===0&&item.classList.contains('rn-open'))setCategory(item,false);else show();});
            });
            document.addEventListener('click',e=>desktop.forEach(root=>{if(!root.contains(e.target))closeRoot(root);}));
            header.addEventListener('keydown',e=>{
                if(e.key!=='Escape')return;
                const root=desktop.find(item=>item.classList.contains('rn-open'));
                const category=cats.find(item=>item.classList.contains('rn-open')&&item.contains(document.activeElement));
                if(category){setCategory(category,false);category.querySelector('[data-rn-category-trigger]').focus();e.preventDefault();return;}
                if(root){closeRoot(root);root.querySelector('[data-rn-trigger]').focus();e.preventDefault();return;}
                if(mobileMenu.classList.contains('is-open')){mobileToggle.click();mobileToggle.focus();e.preventDefault();}
            });
            if(mobile){
                const buttons=Array.from(mobile.querySelectorAll('.rn-category-button'));
                function reset(){buttons.forEach(b=>{b.setAttribute('aria-expanded','false');b.closest('li').classList.remove('rn-expanded');});}
                buttons.forEach(button=>button.addEventListener('click',()=>{
                    const wasOpen=button.getAttribute('aria-expanded')==='true';reset();
                    if(!wasOpen){button.setAttribute('aria-expanded','true');button.closest('li').classList.add('rn-expanded');}
                }));
                // Existing header.js still manages main mobile dropdowns and sticky behavior.
                new MutationObserver(()=>{if(!mobile.classList.contains('open'))reset();}).observe(mobile,{attributes:true,attributeFilter:['class']});
            }
            function updateMobileHeight(){
                const isOpen=mobileMenu.classList.contains('is-open');
                mobileMenu.inert=!isOpen;
                mobileToggle.setAttribute('aria-label',isOpen?'Close navigation':'Open navigation');
                if(isOpen){
                    mobileMenu.style.setProperty('--rn-mobile-height',Math.max(100,window.innerHeight-Math.max(0,mobileMenu.getBoundingClientRect().top)-8)+'px');
                }
            }
            new MutationObserver(updateMobileHeight).observe(mobileMenu,{attributes:true,attributeFilter:['class']});
            updateMobileHeight();
            window.addEventListener('resize',()=>{desktop.forEach(closeRoot);updateMobileHeight();});
        })();
    }
    const skip = document.querySelector('.rudra-skip-link');
    const main = document.getElementById('main-content');
    if (skip && main) {
        skip.addEventListener('focus', () => document.documentElement.classList.add('rudra-keyboard-start'));
        skip.addEventListener('click', () => main.focus({preventScroll:true}));
    }
    await Promise.allSettled([
        
        load('rudra-header-mount', 'header').then(async mount => {
            if (!mount) return;
            markCurrent(mount);
            initNestedNavigation();
            await script('/assets/reference/header.js', mount);
        }).catch(console.error),
        load('rudra-footer-mount', 'footer').then(async mount => {
            if (!mount) return;
            markCurrent(mount);
            await script('/assets/reference/footer.js', mount);
        }).catch(console.error)
    ]);

    window.RudraLoader?.componentsReady();

})();
