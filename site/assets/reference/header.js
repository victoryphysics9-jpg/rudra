
(function(){

    var script = document.currentScript;

    if(!script) return;

    var root = script.parentElement;

    if(!root) return;

    var header = root.querySelector('.main-header');

    if(!header) return;


    var sticky = header.querySelector('.header-sticky');

    var toggle = header.querySelector('.mobile-menu-toggle');

    var menu = header.querySelector('.responsive-menu');


    /* ================= MENU CLOSE ================= */

    function closeMenu(){

        if(!menu || !toggle) return;

        menu.classList.remove('is-open');

        toggle.classList.remove('open');

        toggle.setAttribute(
            'aria-expanded',
            'false'
        );

        menu.setAttribute(
            'aria-hidden',
            'true'
        );


        /* close all dropdowns */

        menu
            .querySelectorAll('.mobile-dropdown.open')
            .forEach(function(item){

                item.classList.remove('open');

                var link =
                    item.querySelector('.mobile-dropdown-toggle');

                if(link){

                    link.setAttribute(
                        'aria-expanded',
                        'false'
                    );

                }

            });

    }


    /* ================= MOBILE MENU ================= */

    if(toggle && menu){

        toggle.addEventListener(
            'click',
            function(e){

                e.preventDefault();

                var isOpen =
                    menu.classList.contains('is-open');


                if(isOpen){

                    closeMenu();

                }else{

                    menu.classList.add('is-open');

                    toggle.classList.add('open');

                    toggle.setAttribute(
                        'aria-expanded',
                        'true'
                    );

                    menu.setAttribute(
                        'aria-hidden',
                        'false'
                    );

                }

            }
        );


        /* ================= DROPDOWNS ================= */

        menu
            .querySelectorAll('.mobile-dropdown-toggle')
            .forEach(function(link){

                link.addEventListener(
                    'click',
                    function(e){

                        e.preventDefault();

                        e.stopPropagation();

                        var parent =
                            link.closest('.mobile-dropdown');

                        if(!parent) return;


                        var wasOpen =
                            parent.classList.contains('open');


                        /* close other dropdowns */

                        menu
                            .querySelectorAll(
                                '.mobile-dropdown.open'
                            )
                            .forEach(function(other){

                                if(other !== parent){

                                    other.classList.remove(
                                        'open'
                                    );

                                    var otherLink =
                                        other.querySelector(
                                            '.mobile-dropdown-toggle'
                                        );

                                    if(otherLink){

                                        otherLink.setAttribute(
                                            'aria-expanded',
                                            'false'
                                        );

                                    }

                                }

                            });


                        if(wasOpen){

                            parent.classList.remove(
                                'open'
                            );

                            link.setAttribute(
                                'aria-expanded',
                                'false'
                            );

                        }else{

                            parent.classList.add(
                                'open'
                            );

                            link.setAttribute(
                                'aria-expanded',
                                'true'
                            );

                        }

                    }
                );

            });


        /* ================= NORMAL MOBILE LINKS ================= */

        menu
            .querySelectorAll(
                '.mobile-nav-list > li:not(.mobile-dropdown) > a'
            )
            .forEach(function(link){

                link.addEventListener(
                    'click',
                    function(){

                        closeMenu();

                    }
                );

            });


        /* ================= SUBMENU LINKS ================= */

        menu
            .querySelectorAll(
                '.mobile-dropdown > ul a'
            )
            .forEach(function(link){

                link.addEventListener(
                    'click',
                    function(){

                        closeMenu();

                    }
                );

            });


        /* ================= RESIZE ================= */

        window.addEventListener(
            'resize',
            function(){

                if(window.innerWidth > 991){

                    closeMenu();

                }

            }
        );

    }


    /* ================= STICKY HEADER ================= */

    var lastScroll =
        window.scrollY || 0;


    window.addEventListener(
        'scroll',
        function(){

            if(!sticky) return;

            var currentScroll =
                window.scrollY || 0;


            /* activate sticky */

            if(currentScroll > 600){

                sticky.classList.add('active');

            }else{

                sticky.classList.remove('active');

            }


            /* hide while scrolling down */

            if(
                currentScroll > lastScroll &&
                currentScroll > 180
            ){

                sticky.classList.add('hide');

            }else{

                sticky.classList.remove('hide');

            }


            lastScroll = currentScroll;

        },
        {
            passive:true
        }
    );


})();
