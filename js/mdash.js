( function( mdash )
{
    'use strict';
    
    var Manager = mdash.Manager = function() {},
        proto   = Manager.prototype;
    
    proto.api              = chrome.bookmarks;
    proto.FOLDER_NAME      = '[Dashboard]';
    proto.PLACEHOLDER_NAME = '[MDASH_DO_NOT_DELETE]';
    
    proto.init = function( callback )
    {
        var _this = this;
        
        this.api.getTree( function( tree )
        {
            _this.tree = tree[ 0 ];
        } );
        
        this.checkRootFolder( callback );
    };
    
    proto.hasBookmarks = function( callback )
    {
        this.getSections( function( sections )
        {
            callback( !!sections.length );
        } );
    };
    
    proto.fetchSections = function( callback )
    {
        var _this = this;
        
        if( this.folder.children )
        {
            callback( this.folder.children );
            
            return;
        }
        
        this.api.getChildren( this.folder.id, function( children )
        {
            var filtered = children.filter( function( b )
            {
                if( b.title === _this.PLACEHOLDER_NAME ) return false;
                
                var firstChar = b.title.substring( 0, 1 );
                
                if( firstChar === '+' )
                {
                    b.side = 'left';
                }
                else if( firstChar === '-' )
                {
                    b.side = 'right';
                }
                else
                {
                    return false;
                }
                
                b.title = b.title.substring( 1 );
                return true;
            } );
            
            _this.folder.children = filtered;
            
            callback( filtered );
        } );
    };
    
    proto.getSections = function( side, callback )
    {
        var _this = this;
        side = side || 'left';
        
        this.fetchSections( function( sections )
        {
            var results = [],
                index   = 1;
            
            sections.forEach( function( section )
            {
                if( section.side === side )
                {
                    results.push( section );
                }
            } );
            
            if( !results.length )
            {
                callback( results );
                return;
            }
            
            results.forEach( function( section )
            {
                _this.fetchSectionBookmarks( section, function( i )
                {
                    return function()
                    {
                        if( i === results.length )
                        {
                            callback( results );
                        }
                    }
                }( index++ ) );
            } );
        } );
    };
    
    proto.fetchSectionBookmarks = function( section, callback )
    {
        this.api.getChildren( section.id, function( bookmarks )
        {
            section.children = bookmarks;
            
            callback( section.bookmarks );
        } )
    };
    
    proto.checkRootFolder = function( callback )
    {
        var _this = this;
        
        this.api.search(
            this.PLACEHOLDER_NAME,
            function( results )
            {
                if( !results.length )
                {
                    _this.createRootFolder( callback );
                }
                else
                {
                    _this.api.get( results[ 0 ].parentId, function( folder )
                    {
                        _this.folder = folder[ 0 ];
                        
                        callback();
                    } );
                }
            }
        );
    };
    
    proto.createRootFolder = function( callback )
    {
        var _this = this;
        
        if( _this._creatingRoot ) { callback(); return; }
        _this._creatingRoot = true;
        
        this.api.create(
            {
                parentId : this.tree.children[ 1 ].id,
                title    : this.FOLDER_NAME
            },
            function( folder )
            {
                _this.tree = null;
                
                _this.folder = folder;
                _this.createPlaceholder( callback );
            }
        );
    };
    
    proto.createPlaceholder = function( callback )
    {
        var _this = this;
        
        if( _this._creatingPlaceholder ) { callback(); return; }
        _this._creatingPlaceholder = true;
        
        this.api.create(
            {
                parentId : this.folder.id,
                title    : this.PLACEHOLDER_NAME,
                url      : 'about:blank'
            },
            callback
        );
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- column.js --- */

( function( mdash )
{
    'use strict';
    
    mdash.links = {};

    // Shared utilities
    mdash.util = mdash.util || {};

    mdash.util.isSafeUrl = function( url )
    {
        if( !url ) return false;
        try { var u = new URL( url ); return /^https?:$|^ftp:$|^file:$|^chrome:$|^chrome-extension:$/.test( u.protocol ); }
        catch( _e ){ return false; }
    };

    // Shared favicon helpers
    mdash.util.ICONS_MAP_LOCAL = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime.getURL( 'icons/icons.json' ) : '';
    mdash.util.ICONS_MAP_REMOTE = 'https://raw.githubusercontent.com/theanotherwise/mdash-chrome/refs/heads/master/icons/icons.json';
    mdash.util.ICONS_BASE_URL = 'https://raw.githubusercontent.com/theanotherwise/mdash-chrome/refs/heads/master/icons/';
    mdash.util._iconsMap = null;
    mdash.util._iconsPromise = null;
    mdash.util.preloadIconsMap = function()
    {
        if( this._iconsPromise ) return this._iconsPromise;
        var localUrl = this.ICONS_MAP_LOCAL;
        var remoteUrl = this.ICONS_MAP_REMOTE;
        try
        {
            var tryFetch = localUrl
                ? fetch( localUrl ).then( function( r ){ return r.ok ? r.json() : Promise.reject(); } )
                    .catch( function(){ return fetch( remoteUrl, { cache: 'no-store' } ).then( function( r ){ return r.ok ? r.json() : {}; } ); } )
                : fetch( remoteUrl, { cache: 'no-store' } ).then( function( r ){ return r.ok ? r.json() : {}; } );
            this._iconsPromise = tryFetch
                .then( function( json ){ mdash.util._iconsMap = json || {}; return mdash.util._iconsMap; } )
                .catch( function(){ mdash.util._iconsMap = {}; } );
        }
        catch( _e )
        {
            this._iconsPromise = Promise.resolve( mdash.util._iconsMap || {} );
        }
        return this._iconsPromise;
    };
    mdash.util.findIconPathFromMap = function( title, href )
    {
        if( !title ) return null;
        var map = this._iconsMap;
        if( !map ) return null;
        var host = '';
        try { host = new URL( href || '' ).hostname || ''; } catch( _e ) { host = ''; }
        var t = ('' + title + ' ' + host).toLowerCase();
        var bestKey = null;
        Object.keys( map ).forEach( function( key )
        {
            var k = key.toLowerCase();
            if( t.indexOf( k ) !== -1 )
            {
                if( !bestKey || k.length > bestKey.length ) bestKey = key;
            }
        } );
        return bestKey ? map[ bestKey ] : null;
    };
    mdash.util.stripIconOverride = function( title )
    {
        var t = (title || '');
        return t.replace( /\s*ICON_OVERRIDE\s*$/, '' );
    };
    mdash.util.hasIconOverride = function( title )
    {
        if( !title ) return false;
        return /\s*ICON_OVERRIDE\s*$/.test( title );
    };
    mdash.util.buildIconPathCandidates = function( href, relPath, noNormalize )
    {
        try
        {
            if( /^https?:\/\//i.test( relPath ) ) return [ relPath ];
            var u = new URL( href );
            var host = u.hostname || '';
            var out = [];
            var base = u.protocol + '//' + host + (relPath.startsWith('/')?relPath:'/' + relPath);
            out.push( base );
            if( !noNormalize )
            {
                var labels = host.split('.');
                if( labels.length > 2 && labels[0] !== 'www' )
                {
                    var root = labels.slice(-2).join('.');
                    out.push( u.protocol + '//' + root + (relPath.startsWith('/')?relPath:'/' + relPath) );
                    out.push( u.protocol + '//www.' + root + (relPath.startsWith('/')?relPath:'/' + relPath) );
                }
            }
            // dedupe
            var seen = {}; var uniq = [];
            out.forEach(function(v){ if(!seen[v]){ seen[v]=1; uniq.push(v); } });
            return uniq;
        }
        catch(_e){ return []; }
    };
    mdash.util.getFaviconCandidates = function( href, noNormalize )
    {
        try
        {
            var u = new URL( href );
            var host = u.hostname || '';
            var labels = host.split( '.' );
            // If subdomain present and not 'www', use registrable root (last two labels). Keep protocol.
            if( !noNormalize && labels.length > 2 && labels[0] !== 'www' )
            {
                host = labels.slice( -2 ).join( '.' );
            }
            var canonical = u.protocol + '//' + host;
            // Policy: never hit local favicon.ico; only Google S2 as base fallback
            return [
                'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent( canonical ) + '&sz=64'
            ];
        }
        catch( _e )
        {
            return [ 'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent( href ) + '&sz=64' ];
        }
    };
    var _faviconMemCache = mdash.util._faviconMemCache = {};
    var _faviconExtId = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime.id : '';

    function _faviconCacheKey( href )
    {
        try { var u = new URL( href ); return 'fav:' + u.hostname; }
        catch(_e){ return 'fav:' + href; }
    }

    function _faviconUrl( pageUrl )
    {
        return 'chrome-extension://' + _faviconExtId + '/_favicon/?pageUrl=' + encodeURIComponent( pageUrl ) + '&size=64';
    }

    function _imgToBase64( img )
    {
        try
        {
            var c = document.createElement( 'canvas' );
            c.width = img.naturalWidth || 32;
            c.height = img.naturalHeight || 32;
            c.getContext( '2d' ).drawImage( img, 0, 0, c.width, c.height );
            return c.toDataURL( 'image/png' );
        }
        catch(_e){ return null; }
    }

    function _saveFaviconToLocalStorage( key, data )
    {
        if( !data || data.length < 30 ) return;
        _faviconMemCache[ key ] = data;
        try { localStorage.setItem( key, data ); } catch(_e){}
    }

    function _isValidCachedFavicon( dataUrl )
    {
        try
        {
            if( !dataUrl || dataUrl.length < 80 ) return false;
            var header = dataUrl.slice( 0, 30 );
            if( header.indexOf( 'data:image' ) !== 0 ) return false;
            var commaIdx = dataUrl.indexOf( ',' );
            if( commaIdx < 0 ) return false;
            var raw = atob( dataUrl.slice( commaIdx + 1 ) );
            if( raw.length < 100 ) return false;
            return true;
        }
        catch(_e){ return false; }
    }

    ( function _purgeBadFaviconCache()
    {
        var PURGE_KEY = 'fav:_purged_v2';
        try
        {
            if( localStorage.getItem( PURGE_KEY ) ) return;
            var keys = [];
            for( var i = 0; i < localStorage.length; i++ )
            {
                var k = localStorage.key( i );
                if( k && k.indexOf( 'fav:' ) === 0 ) keys.push( k );
            }
            keys.forEach( function( k )
            {
                localStorage.removeItem( k );
            } );
            localStorage.setItem( PURGE_KEY, '1' );
        }
        catch(_e){}
    } )();

    mdash.util.applyFaviconWithFallback = function( $img, href, noNormalize, title, overrideOnly )
    {
        var candidates = overrideOnly ? [] : mdash.util.getFaviconCandidates( href, !!noNormalize );
        try
        {
            var path = mdash.util.findIconPathFromMap( title, href );
            if( overrideOnly )
            {
                if( path )
                {
                    var full1 = /^https?:\/\//i.test( path ) ? path : (mdash.util.ICONS_BASE_URL + (path.charAt(0)==='/'?path.slice(1):path));
                    candidates = [ full1 ];
                }
                else
                {
                    candidates = mdash.util.getFaviconCandidates( href, !!noNormalize );
                }
            }
        }
        catch( _e ){}

        var cacheKey = _faviconCacheKey( href );

        // 1. In-memory cache (instant)
        if( _faviconMemCache[ cacheKey ] )
        {
            $img.attr( 'src', _faviconMemCache[ cacheKey ] );
            return;
        }

        // 2. localStorage cache (synchronous)
        try
        {
            var cached = localStorage.getItem( cacheKey );
            if( cached )
            {
                _faviconMemCache[ cacheKey ] = cached;
                $img.attr( 'src', cached );
                return;
            }
        }
        catch(_e){}

        // 3. Show Google S2 immediately for display, then cache via _favicon API in background
        $img.off( 'error.mdash load.mdash' );
        $img.data( 'favicon:candidates', candidates );
        $img.data( 'favicon:index', 0 );

        $img.on( 'error.mdash', function()
        {
            var $i = $( this );
            var list = $i.data( 'favicon:candidates' ) || [];
            var idx  = ($i.data( 'favicon:index' ) || 0) + 1;
            if( idx < list.length )
            {
                $i.data( 'favicon:index', idx );
                this.src = list[ idx ];
            }
        } );

        if( candidates.length ) {
            $img.attr( 'src', candidates[0] );
        }

        // 4. Background: load same-origin _favicon and cache only if it looks usable.
        // Do not replace the currently visible icon here to avoid flicker/regressions.
        if( _faviconExtId )
        {
            var bgImg = new Image();
            bgImg.onload = function()
            {
                if( bgImg.naturalWidth < 2 ) return;
                try
                {
                    var c = document.createElement( 'canvas' );
                    c.width = bgImg.naturalWidth || 32;
                    c.height = bgImg.naturalHeight || 32;
                    var ctx = c.getContext( '2d' );
                    ctx.drawImage( bgImg, 0, 0, c.width, c.height );
                    var pd = ctx.getImageData( 0, 0, c.width, c.height ).data;
                    var opaque = 0, dark = 0, area = c.width * c.height;
                    for( var pi = 0; pi < pd.length; pi += 4 )
                    {
                        var a = pd[ pi + 3 ];
                        if( a <= 10 ) continue;
                        opaque++;
                        var lum = (0.2126 * pd[ pi ]) + (0.7152 * pd[ pi + 1 ]) + (0.0722 * pd[ pi + 2 ]);
                        if( lum < 220 ) dark++;
                    }
                    if( opaque < area * 0.1 ) return;
                    if( dark < Math.max( 4, area * 0.01 ) ) return;
                    var b64 = c.toDataURL( 'image/png' );
                }
                catch( _e ){ return; }
                if( b64 )
                {
                    _saveFaviconToLocalStorage( cacheKey, b64 );
                }
            };
            bgImg.src = _faviconUrl( href );
        }
    };
    
    // favicon helpers not needed when using full reload; kept minimal inline logic elsewhere
    
    var Column = mdash.Column = function( $el )
    {
        this.$el      = $el;
        this.sections = null;
    },
    proto = Column.prototype;
    
    proto.render = function()
    {
        var _this = this;
        
        this.$el.empty();
        
        this.sections.forEach( function( section )
        {
            _this.$el.append( _this.renderSection( section ) );
        } );
        
        // If all sections are empty and hidden, also hide the column wrapper to remove gaps
        var anyVisible = _this.$el.find( 'section' ).filter( function(){ return $(this).is(':visible'); } ).length > 0;
        _this.$el.toggle( anyVisible || document.documentElement.classList.contains( 'edit' ) );
    };
    
    proto.renderSection = function( section )
    {
        var _this    = this,
            $section = $( '<section>' ).attr( 'id', section.id )
                .append( $( '<h1>' ).text( section.title ) );
        
        section.children.forEach( function( bookmark )
        {
            var $link = _this.renderBookmark( bookmark );
            $section.append( $link );
            mdash.links[ $link.attr( 'href' ) ] = $link;
        } );
        
        var $removeSectionBtn = $( '<button type="button" class="section-remove" aria-label="Delete section" title="Delete section" draggable="false">&times;</button>' );
        $section.append( $removeSectionBtn );
        
        var $addBtn = $( '<a href="#add" class="add" aria-label="Add bookmark" title="Add" draggable="false"><span>+</span></a>' );
        $section.append( $addBtn );
        // Prevent default link-drag behaviour so the "+" button is never treated as a draggable item
        $addBtn.on( 'dragstart', function( e ){ e.preventDefault(); } );
        new mdash.AddBtn( $addBtn ).init();
        
        // Hide empty sections by default (shown in edit mode)
        var hasBookmarks = Array.isArray( section.children ) && section.children.length > 0;
        if( !hasBookmarks && !document.documentElement.classList.contains( 'edit' ) )
        {
            $section.hide();
        }
        
        return $section;
    };
    
    proto.renderBookmark = function( bookmark )
    {
        var link = document.createElement( 'a' );
        
        var safeUrl = mdash.util.isSafeUrl( bookmark.url ) ? bookmark.url : 'about:blank';
        link.href = safeUrl;
        var faviconCandidates = mdash.util.getFaviconCandidates( link.href );

        var isVpnMarker = (bookmark.title || '').indexOf('[VPN]') !== -1;
        var displayTitle = mdash.util.stripIconOverride( bookmark.title );
        var hasOverride = mdash.util.hasIconOverride( bookmark.title );
        var faviconSrc = bookmark.favicon ? bookmark.favicon : (hasOverride ? '' : faviconCandidates[ 0 ]);

        var $img = $( '<img>' ).attr( { src: faviconSrc, alt: displayTitle } );
        var $el = $( '<a>' ).attr( {
            id: bookmark.id,
            href: link.href,
            title: displayTitle,
            'aria-label': displayTitle,
            'data-title': displayTitle,
            'data-raw-title': bookmark.title
        } ).append( $img, $( '<span>' ).text( displayTitle ) );
        
        // Attach fallback; if [VPN] in title, skip normalization (use exact host)
        mdash.util.applyFaviconWithFallback( $img, link.href, isVpnMarker, displayTitle, hasOverride );
        
        return $el;
    };

} )( window.mdash || ( window.mdash = {} ) );


/* --- fontctrl.js --- */

( function( mdash )
{
    'use strict';
    
    var FontCtrl = mdash.FontCtrl = function( $sizes )
    {
        this.$sizes = $sizes;
        this.$dropdown = this.$sizes.closest('.dropdown');
        this.$toggle = this.$dropdown.find('.dropdown-toggle');
    };
    
    FontCtrl.prototype.init = function()
    {
        var sizeFromStorage = localStorage.fontSize;
        var valid = { small: true, medium: true, large: true };

        var size = valid[sizeFromStorage] ? sizeFromStorage : (function(){
            if( document.body.classList.contains('small') ) return 'small';
            if( document.body.classList.contains('medium') ) return 'medium';
            if( document.body.classList.contains('large') ) return 'large';
            return 'large';
        })();

        this.applySize( size );
        localStorage.fontSize = size;
        this.select( size );
        
        this.$sizes.on( 'click', this.sizeSelected.bind( this ) );
        this.$toggle.on('click', this.toggleOpen.bind(this));
        $(document).on('click', this.closeOnOutsideClick.bind(this));
    };

    FontCtrl.prototype.applySize = function( size )
    {
        document.body.classList.remove('small','medium','large');
        document.body.classList.add( size );
    };
    
    FontCtrl.prototype.select = function( size )
    {
        this.$sizes.removeClass( 'selected' );
        this.$sizes.parent().find( 'a[data-size="' + size + '"]' ).addClass( 'selected' );
        this.$toggle.text(size + ' ▾');
    };
    
    FontCtrl.prototype.sizeSelected = function( e )
    {
        var $this = $( e.target );
        
        $this.siblings().removeClass( 'selected' );
        $this.addClass( 'selected' );
        
        var size = $this.attr( 'data-size' );
        this.applySize( size );
        localStorage.fontSize = size;
        this.$toggle.text( size + ' ▾');
        this.$dropdown.removeClass('open');
    };

    FontCtrl.prototype.toggleOpen = function(e)
    {
        e.preventDefault();
        e.stopPropagation();
        this.$dropdown.toggleClass('open');
    };

    FontCtrl.prototype.closeOnOutsideClick = function(e)
    {
        if(!$(e.target).closest(this.$dropdown).length) {
            this.$dropdown.removeClass('open');
        }
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- helpctrl.js --- */

( function( mdash )
{
    'use strict';
    
    var HelpCtrl = mdash.HelpCtrl = function( $handle, $help, $interface )
    {
        this.$handle    = $handle;
        this.$help      = $help;
        this.$overlay   = $( '#getstarted-overlay' );
        this.$interface = $interface;
    };

    HelpCtrl.prototype.init = function()
    {
        var self = this;
        this.$handle.on( 'click', function( e ) { e.preventDefault(); self.toggle(); } );
        this.$overlay.find( '.getstarted-backdrop' ).on( 'click', function() { self.hide(); } );
    };

    HelpCtrl.prototype.toggle = function()
    {
        this.$overlay.toggleClass( 'visible' );
    };

    HelpCtrl.prototype.show = function()
    {
        this.$overlay.addClass( 'visible' );
    };

    HelpCtrl.prototype.hide = function()
    {
        this.$overlay.removeClass( 'visible' );
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- Shared undo notification helper --- */

( function( mdash )
{
    'use strict';

    mdash._undoNotify = function( noteTitle, msg, undoFn )
    {
        var seconds = 30, undone = false;
        var $content = $( '<div>' ).append(
            document.createTextNode( msg + ' ' ),
            $( '<a href="#" class="undo">' ).append( 'Undo (', $( '<span class="count">' ).text( seconds ), ')' )
        );
        var note = ui.notify( noteTitle, $content ).hide( 31000 );
        var tick = setInterval( function()
        {
            seconds -= 1;
            if( seconds <= 0 ) clearInterval( tick );
            $content.find( '.count' ).text( Math.max( seconds, 0 ) );
        }, 1000 );

        $content.on( 'click', '.undo', function( e )
        {
            e.preventDefault();
            if( undone ) return; undone = true;
            clearInterval( tick );
            note.hide( 1 );
            undoFn();
        } );

        return note;
    };

} )( window.mdash || ( window.mdash = {} ) );


( function( mdash, $ )
{
    'use strict';
    
    var EditCtrl = mdash.EditCtrl = function( $btn, $bookmarks )
    {
        this.$docEl       = $( document.documentElement );
        this.$btn       = $btn;
        this.$bookmarks = $bookmarks;
        this.$addSectionBtn = $( '#add-section-cta' );
        this.api        = chrome.bookmarks;
        this.editMode   = false;
        this.$activeBookmark = null;
        this.currentEditId = null;
        this._dragging = false;
    };
    
    EditCtrl.prototype.init = function()
    {
        var self = this;
        
        this.listenForAlt();
        this.setupButton();
        this.setupAddSectionButton();
        
        this.$docEl.on( 'click', '#bookmarks a:not(.add)', function( e )
        {
            if( self.editMode )
            {
                e.preventDefault();
                e.stopPropagation();
                
                if( self._dragging ) return; // ignore click right after drag
                var $el = $( e.target );
                
                if( !$el.is( 'a' ) )
                {
                    $el = $el.parent();
                }
                
                self.edit( $el );
            }
        } );

        // Rename section: click on section title while in edit mode
        this.$docEl.on( 'click', '#bookmarks section > h1', function( e )
        {
            if( !self.editMode ) return;
            if( self._sectionJustDragged ) return;
            e.preventDefault();
            e.stopPropagation();
            self.renameSection( $( this ) );
        } );
        
        this.$docEl.on( 'click', '#bookmarks section > .section-remove', function( e )
        {
            if( !self.editMode ) return;
            e.preventDefault();
            e.stopPropagation();
            self.confirmRemoveSection( $( this ).closest( 'section' ) );
        } );

        // Track hovered/active bookmark for keyboard delete
        this.$docEl.on( 'mouseenter', '#bookmarks a:not(.add)', function( e )
        {
            self.$activeBookmark = $( e.currentTarget );
        } );
        this.$docEl.on( 'mouseleave', '#bookmarks a:not(.add)', function( e )
        {
            if( self.$activeBookmark && self.$activeBookmark[0] === e.currentTarget )
            {
                self.$activeBookmark = null;
            }
        } );

    };
    
    EditCtrl.prototype.enableDragAndDrop = function()
    {
        var self = this;
        var $tiles = this.$bookmarks.find( 'a' ).not( '.add' );
        // Visual placeholder for insertion point
        this.$placeholder = $('<a class="drop-placeholder" aria-hidden="true"></a>');

        // Helper to reliably reset UI state after any drop/move
        function cleanupDrag()
        {
            self._dragging = false;
            self.$bookmarks.find( 'a.dragging' ).removeClass( 'dragging' );
            if( self.$placeholder ) self.$placeholder.removeClass( 'collapsed' ).detach();
            self.$bookmarks.find( 'section' ).removeClass( 'drop-target' );
        }
        $tiles.attr( 'draggable', true )
            .on( 'dragstart.mdash', function( e )
            {
                self._dragging = true;
                self._handledDrop = false;
                var id = $( this ).attr( 'id' );
                var dt = e.originalEvent.dataTransfer;
                // Use a custom type so only our tiles are accepted by drop targets
                try { dt.setData( 'application/x-mdash-bookmark-id', id ); } catch( _e ) {}
                // Clear generic text to avoid browsers providing fallback text/url values
                try { dt.setData( 'text/plain', '' ); } catch( _e ) {}
                dt.effectAllowed = 'move';
                // Defer hiding the source element so the browser captures a proper drag image
                var el = this;
                setTimeout( function(){ $( el ).addClass( 'dragging' ); }, 0 );

                // Insert a collapsed placeholder at the original position to collapse the gap
                var $cur = $( this );
                self.$placeholder.addClass( 'collapsed' );
                $cur.before( self.$placeholder );
            } )
            .on( 'dragend.mdash', function()
            {
                cleanupDrag();
            } );

        // While dragging over a tile, show the placeholder before/after the tile
        $tiles.on( 'dragover.mdash', function( e )
        {
            if( self._sectionDragging ) return;
            e.preventDefault();
            var rect = this.getBoundingClientRect();
            var before = (e.originalEvent.clientX < rect.left + rect.width / 2);
            var $t = $( this );
            if( before ) { $t.before( self.$placeholder ); }
            else { $t.after( self.$placeholder ); }
            self.$placeholder.removeClass( 'collapsed' );
            $t.closest( 'section' ).addClass( 'drop-target' );
        } );

        var $sections = this.$bookmarks.find( 'section' );
        $sections
            .on( 'dragover.mdash', function( e )
            {
                if( self._sectionDragging ) return;
                e.preventDefault();
                var $section = $( this );
                $section.addClass( 'drop-target' );
                // For empty sections, place placeholder before the add button
                var $tilesInside = $section.children( 'a' ).not( '.add' ).not( '.drop-placeholder' );
                if( $tilesInside.length === 0 )
                {
                    var $add = $section.find( 'a.add' );
                    if( $add.length ) $add.before( self.$placeholder ); else $section.append( self.$placeholder );
                    self.$placeholder.removeClass( 'collapsed' );
                }
                else
                {
                    // Row-aware placement: if pointer is vertically inside any row, choose from that row only
                    var clientX = e.originalEvent.clientX, clientY = e.originalEvent.clientY;
                    var inRow = [];
                    $tilesInside.each( function(){ var r = this.getBoundingClientRect(); if( clientY >= r.top && clientY <= r.bottom ) inRow.push({el:this, rect:r}); });
                    var target = null, rect = null;
                    if( inRow.length )
                    {
                        // Pick nearest by X within the row
                        var bestDx = Infinity;
                        inRow.forEach( function( it ){
                            var midX = it.rect.left + it.rect.width / 2;
                            var dx = Math.abs( clientX - midX );
                            if( dx < bestDx ) { bestDx = dx; target = it.el; rect = it.rect; }
                        } );
                    }
                    else
                    {
                        // Fallback: choose row by minimal |dy| then by |dx|
                        var bestScore = Infinity;
                        $tilesInside.each( function(){
                            var r = this.getBoundingClientRect();
                            var dy = Math.abs( clientY - (r.top + r.height/2) );
                            var dx = Math.abs( clientX - (r.left + r.width/2) );
                            var score = dy * 1000 + dx;
                            if( score < bestScore ) { bestScore = score; target = this; rect = r; }
                        } );
                    }
                    if( target )
                    {
                        var before = clientX < (rect.left + rect.width / 2);
                        if( before ) $( target ).before( self.$placeholder ); else $( target ).after( self.$placeholder );
                        self.$placeholder.removeClass( 'collapsed' );
                    }
                }
            } )
            .on( 'dragleave.mdash', function()
            {
                $( this ).removeClass( 'drop-target' );
            } )
            .on( 'drop.mdash', function( e )
            {
                if( self._sectionDragging ) return;
                e.preventDefault();
                self._handledDrop = true;
                var $section = $( this );
                $( this ).removeClass( 'drop-target' );
                var dt = e.originalEvent.dataTransfer;
                var id = '';
                try { id = dt.getData( 'application/x-mdash-bookmark-id' ); } catch( _e ) { id = ''; }
                if( !id ) return; // Ignore drops not originating from our tiles

                // Compute insertion index from placeholder position
                var index = 0;
                var children = $section.children( 'a' );
                for( var i = 0; i < children.length; i++ )
                {
                    var el = children[ i ];
                    if( el === self.$placeholder[0] ) break;
                    if( el.classList.contains( 'add' ) ) continue;
                    index++;
                }

                var targetSectionId = $section.attr( 'id' );
                var $tileBeforeMove = $( document.getElementById( id ) );
                var undoParentId = '', undoIndex = 0;

                if( $tileBeforeMove.length )
                {
                    var $srcSection = $tileBeforeMove.closest( 'section' );
                    undoParentId = $srcSection.attr( 'id' ) || '';
                    var srcChildren = $srcSection.children( 'a' );
                    for( var si = 0; si < srcChildren.length; si++ )
                    {
                        var srcEl = srcChildren[ si ];
                        if( srcEl === $tileBeforeMove[0] ) break;
                        if( srcEl.classList.contains( 'add' ) ) continue;
                        undoIndex++;
                    }

                    if( $srcSection.length && $srcSection.attr( 'id' ) === $section.attr( 'id' ) )
                    {
                        if( index === undoIndex || index === undoIndex + 1 )
                        {
                            if( self.$placeholder ) self.$placeholder.detach();
                            return;
                        }
                    }
                }

                var $tileImmediate = $( document.getElementById( id ) );
                if( $tileImmediate.length )
                {
                    if( self.$placeholder && self.$placeholder.parent().length )
                    {
                        self.$placeholder.replaceWith( $tileImmediate );
                    }
                    else
                    {
                        var $addImmediate  = $section.find( 'a.add' );
                        if( $addImmediate.length ) $addImmediate.before( $tileImmediate ); else $section.append( $tileImmediate );
                    }
                    $tileImmediate.removeClass( 'dragging' );
                }

                self.api.move( id, { parentId: targetSectionId, index: index }, function()
                {
                    cleanupDrag();
                    mdash._undoNotify( 'Moved', 'Bookmark moved.', function()
                    {
                        self.api.move( id, { parentId: undoParentId, index: undoIndex }, function()
                        {
                            var $tile = $( document.getElementById( id ) );
                            var $origSection = $( '#' + undoParentId );
                            if( !$tile.length || !$origSection.length ) return;
                            var $tiles = $origSection.children( 'a' ).not( '.add' );
                            var $add   = $origSection.find( 'a.add' );
                            if( undoIndex < $tiles.length ) $tiles.eq( undoIndex ).before( $tile );
                            else $add.before( $tile );
                            $origSection.show(); $origSection.parent().show();
                        } );
                    } );
                } );
            } );

        // Global dragover handler on container: choose nearest section under pointer even over whitespace
        this.$bookmarks.on( 'dragover.mdash', function( e )
        {
            if( !self._dragging ) return;
            e.preventDefault();
            var clientX = e.originalEvent.clientX, clientY = e.originalEvent.clientY;
            var el = document.elementFromPoint( clientX, clientY );
            if( !el ) return;
            var $section = $( el ).closest( 'section' );
            if( !$section.length ) return;

            // Decide insertion before/after based on nearest tile center
            var $tilesInside = $section.children( 'a' ).not( '.add' ).not( '.drop-placeholder' );
            if( $tilesInside.length === 0 )
            {
                var $add = $section.find( 'a.add' );
                if( $add.length ) $add.before( self.$placeholder ); else $section.append( self.$placeholder );
            }
            else
            {
                // Prefer tiles whose vertical span contains pointer (row under cursor)
                var candidates = [];
                $tilesInside.each( function(){ var r = this.getBoundingClientRect(); if( clientY >= r.top && clientY <= r.bottom ) candidates.push({el:this, rect:r}); });
                var target = null, rect = null;
                if( candidates.length )
                {
                    var bestDx = Infinity;
                    candidates.forEach( function( it ){
                        var midX = it.rect.left + it.rect.width / 2;
                        var dx = Math.abs( clientX - midX );
                        if( dx < bestDx ) { bestDx = dx; target = it.el; rect = it.rect; }
                    } );
                }
                else
                {
                    // Fallback: nearest by weighted Y then X
                    var bestScore = Infinity;
                    $tilesInside.each( function(){
                        var r = this.getBoundingClientRect();
                        var dy = Math.abs( clientY - (r.top + r.height/2) );
                        var dx = Math.abs( clientX - (r.left + r.width/2) );
                        var score = dy * 1000 + dx;
                        if( score < bestScore ) { bestScore = score; target = this; rect = r; }
                    } );
                }
                if( target )
                {
                    var before = clientX < rect.left + rect.width / 2;
                    if( before ) $( target ).before( self.$placeholder ); else $( target ).after( self.$placeholder );
                }
            }
            self.$placeholder.removeClass( 'collapsed' );
            $section.addClass( 'drop-target' );
        } );

        // Global drop handler to commit when dropping over whitespace
        this.$bookmarks.on( 'drop.mdash', function( e )
        {
            if( !self._dragging || self._handledDrop ) return;
            e.preventDefault();
            var dt = e.originalEvent.dataTransfer;
            var id = '';
            try { id = dt.getData( 'application/x-mdash-bookmark-id' ); } catch( _e ) { id = ''; }
            if( !id ) return;

            var $section = self.$placeholder.closest( 'section' );
            if( !$section.length ) return;

            var $tileSrc = $( document.getElementById( id ) );
            var undoParentId2 = '', undoIndex2 = 0;
            if( $tileSrc.length )
            {
                var $srcSec = $tileSrc.closest( 'section' );
                undoParentId2 = $srcSec.attr( 'id' ) || '';
                var srcCh = $srcSec.children( 'a' );
                for( var si2 = 0; si2 < srcCh.length; si2++ )
                {
                    if( srcCh[ si2 ] === $tileSrc[0] ) break;
                    if( srcCh[ si2 ].classList.contains( 'add' ) ) continue;
                    undoIndex2++;
                }
            }

            var index = 0;
            var children = $section.children( 'a' );
            for( var i = 0; i < children.length; i++ )
            {
                var el = children[ i ];
                if( el === self.$placeholder[0] ) break;
                if( el.classList.contains( 'add' ) ) continue;
                index++;
            }

            var targetSectionId = $section.attr( 'id' );
            var $tileImmediate2 = $( document.getElementById( id ) );
            if( $tileImmediate2.length )
            {
                self.$placeholder.replaceWith( $tileImmediate2 );
                $tileImmediate2.removeClass( 'dragging' );
            }

            self.api.move( id, { parentId: targetSectionId, index: index }, function()
            {
                cleanupDrag();
                mdash._undoNotify( 'Moved', 'Bookmark moved.', function()
                {
                    self.api.move( id, { parentId: undoParentId2, index: undoIndex2 }, function()
                    {
                        var $tile = $( document.getElementById( id ) );
                        var $origSec = $( '#' + undoParentId2 );
                        if( !$tile.length || !$origSec.length ) return;
                        var $ts = $origSec.children( 'a' ).not( '.add' );
                        var $ad = $origSec.find( 'a.add' );
                        if( undoIndex2 < $ts.length ) $ts.eq( undoIndex2 ).before( $tile );
                        else $ad.before( $tile );
                        $origSec.show(); $origSec.parent().show();
                    } );
                } );
            } );
        } );
    };

    EditCtrl.prototype.disableDragAndDrop = function()
    {
        var $tiles = this.$bookmarks.find( 'a' ).not( '.add' );
        $tiles.removeAttr( 'draggable' ).off( '.mdash' ).removeClass( 'dragging' );
        this.$bookmarks.find( 'section' ).off( '.mdash' ).removeClass( 'drop-target' );
        this._dragging = false;
    };
    
    EditCtrl.prototype.enableSectionDragAndDrop = function()
    {
        var self = this;
        var $sections = this.$bookmarks.find( 'section' );
        this.$sectionPlaceholder = $( '<div class="section-drop-placeholder"></div>' );
        
        $sections.each( function()
        {
            var $section = $( this );
            var $h1 = $section.children( 'h1' );
            
            $h1.attr( 'draggable', true ).addClass( 'section-drag-handle' );
            
            $h1.on( 'dragstart.mdash-section', function( e )
            {
                if( $h1.hasClass( 'section-renaming' ) )
                {
                    e.preventDefault();
                    return;
                }
                e.stopPropagation();
                self._sectionDragging = true;
                self._sectionHandledDrop = false;
                var dt = e.originalEvent.dataTransfer;
                try { dt.setData( 'application/x-mdash-section-id', $section.attr( 'id' ) ); } catch( _e ) {}
                try { dt.setData( 'text/plain', '' ); } catch( _e ) {}
                dt.effectAllowed = 'move';
                setTimeout( function(){ $section.addClass( 'section-dragging' ); }, 0 );
            } );
            
            $h1.on( 'dragend.mdash-section', function()
            {
                self._sectionDragging = false;
                self._sectionJustDragged = true;
                setTimeout( function(){ self._sectionJustDragged = false; }, 200 );
                $section.removeClass( 'section-dragging' );
                if( self.$sectionPlaceholder ) self.$sectionPlaceholder.detach();
                self.$bookmarks.find( '.left, .right' ).removeClass( 'column-drop-target' );
            } );
        } );
        
        $sections.on( 'dragover.mdash-section', function( e )
        {
            if( !self._sectionDragging ) return;
            e.preventDefault();
            e.stopPropagation();
            var rect = this.getBoundingClientRect();
            var before = ( e.originalEvent.clientY < rect.top + rect.height / 2 );
            var $target = $( this );
            if( before ) $target.before( self.$sectionPlaceholder );
            else $target.after( self.$sectionPlaceholder );
            self.$bookmarks.find( '.left, .right' ).removeClass( 'column-drop-target' );
            $target.closest( '.left, .right' ).addClass( 'column-drop-target' );
        } );
        
        var $columns = this.$bookmarks.children( '.left, .right' );
        
        $columns.on( 'dragover.mdash-section', function( e )
        {
            if( !self._sectionDragging ) return;
            e.preventDefault();
            var $col = $( this );
            if( $col.children( 'section' ).length === 0 )
            {
                $col.append( self.$sectionPlaceholder );
            }
            $col.addClass( 'column-drop-target' );
        } );
        
        $columns.on( 'dragleave.mdash-section', function()
        {
            $( this ).removeClass( 'column-drop-target' );
        } );
        
        $columns.on( 'drop.mdash-section', function( e )
        {
            if( !self._sectionDragging ) return;
            e.preventDefault();
            e.stopPropagation();
            self._sectionHandledDrop = true;
            
            var dt = e.originalEvent.dataTransfer;
            var sectionId = '';
            try { sectionId = dt.getData( 'application/x-mdash-section-id' ); } catch( _e ) {}
            if( !sectionId ) return;
            
            var $draggedSection = $( document.getElementById( sectionId ) );
            if( !$draggedSection.length ) return;
            
            var $targetCol = $( this );
            var $sourceCol = $draggedSection.parent();
            var isTargetLeft = $targetCol.hasClass( 'left' );
            var isSourceLeft = $sourceCol.hasClass( 'left' );
            var oldPrefix = isSourceLeft ? '+' : '-';
            var newPrefix = isTargetLeft ? '+' : '-';
            var currentTitle = $draggedSection.children( 'h1' ).text();
            var sourceColClass = isSourceLeft ? '.left' : '.right';

            var $prevSibling = $draggedSection.prev( 'section' );
            var hadPrevSibling = $prevSibling.length > 0;
            var prevSiblingId = hadPrevSibling ? $prevSibling.attr( 'id' ) : null;

            if( self.$sectionPlaceholder.parent().length )
            {
                self.$sectionPlaceholder.replaceWith( $draggedSection );
            }
            else
            {
                $targetCol.append( $draggedSection );
            }
            
            $draggedSection.removeClass( 'section-dragging' );
            if( self.$sectionPlaceholder ) self.$sectionPlaceholder.detach();
            $targetCol.removeClass( 'column-drop-target' );
            $sourceCol.removeClass( 'column-drop-target' );
            
            self.api.update( sectionId, { title: newPrefix + currentTitle }, function()
            {
                if( mdash.dashboard && mdash.dashboard.manager )
                {
                    mdash.dashboard.manager.folder.children = null;
                }
                
                var msg = ( isSourceLeft !== isTargetLeft )
                    ? 'Moved "' + currentTitle + '" to ' + ( isTargetLeft ? 'left' : 'right' ) + ' column.'
                    : 'Reordered "' + currentTitle + '".';

                mdash._undoNotify( 'Section moved', msg, function()
                {
                    self.api.update( sectionId, { title: oldPrefix + currentTitle }, function()
                    {
                        if( mdash.dashboard && mdash.dashboard.manager )
                        {
                            mdash.dashboard.manager.folder.children = null;
                        }
                        var $sec = $( document.getElementById( sectionId ) );
                        var $origCol = self.$bookmarks.children( sourceColClass );
                        if( hadPrevSibling && prevSiblingId )
                        {
                            var $prev = $( '#' + prevSiblingId );
                            if( $prev.length ) { $prev.after( $sec ); }
                            else { $origCol.prepend( $sec ); }
                        }
                        else
                        {
                            $origCol.prepend( $sec );
                        }
                        $origCol.show();
                    } );
                } );
            } );
        } );
        
    };
    
    EditCtrl.prototype.disableSectionDragAndDrop = function()
    {
        var $sections = this.$bookmarks.find( 'section' );
        $sections.find( 'h1' ).removeAttr( 'draggable' ).removeClass( 'section-drag-handle' ).off( '.mdash-section' );
        $sections.off( '.mdash-section' );
        this.$bookmarks.children( '.left, .right' ).off( '.mdash-section' ).removeClass( 'column-drop-target' );
        this._sectionDragging = false;
        if( this.$sectionPlaceholder ) this.$sectionPlaceholder.detach();
    };
    
    EditCtrl.prototype.applyDisplayTitlesBasedOnMode = function()
    {
        var self = this;
        this.$bookmarks.find( 'a' ).not( '.add,.drop-placeholder' ).each( function( _i, a )
        {
            var $a = $( a );
            var raw = $a.attr( 'data-raw-title' ) || $a.find( 'span' ).text() || '';
            var visible = self.editMode ? raw : mdash.util.stripIconOverride( raw );
            $a.find( 'span' ).text( visible );
            $a.attr( 'title', visible );
            $a.attr( 'aria-label', visible );
            $a.attr( 'data-title', visible );
            $a.data( 'title', visible );
            var $img = $a.find( 'img' );
            if( $img && $img.length )
            {
                try { $img.attr( 'alt', visible ); } catch( _e ) {}
            }
        } );
    };
    
    EditCtrl.prototype.setupAddSectionButton = function()
    {
        var self = this;
        if( !this.$addSectionBtn || !this.$addSectionBtn.length ) return;
        
        this.$addSectionBtn.off( '.mdash-add-section' ).on( 'click.mdash-add-section', function( e )
        {
            e.preventDefault();
            e.stopPropagation();
            if( !self.editMode ) return;
            self.showAddSectionModal();
        } );
    };
    
    EditCtrl.prototype.showAddSectionModal = function()
    {
        var self = this;
        var $form = $( '<form class="ui-add-form ui-add-section-form" />' );
        var $name = $( '<input id="section-name" type="text" placeholder="Section name" autocomplete="off" />' );
        var $side = $( '<select id="section-side"><option value="left">Left column (+)</option><option value="right">Right column (-)</option></select>' );
        
        $form.append( $name, $side );
        
        var modal = ui.confirm( 'Create new section', $form );
        modal.overlay().ok( 'Create' );
        
        modal.show( function( ok )
        {
            if( !ok ) return;
            
            var title = ( $name.val() || '' ).trim();
            var side = $side.val() === 'right' ? 'right' : 'left';
            
            if( !title )
            {
                ui.error( 'Error', 'Section name is required.' );
                modal.show();
                return;
            }
            
            self.addSection( title, side, function( added )
            {
                if( !added )
                {
                    ui.error( 'Error', 'Could not create section.' );
                    modal.show();
                }
            } );
        } );
        
        setTimeout( function(){ $name.focus(); }, 20 );
    };
    
    EditCtrl.prototype.addSection = function( title, side, callback )
    {
        var self = this;
        var manager = mdash.dashboard && mdash.dashboard.manager;
        
        if( !manager || !manager.folder || !manager.folder.id )
        {
            callback && callback( false );
            return;
        }
        
        var safeSide = side === 'right' ? 'right' : 'left';
        var prefix = safeSide === 'right' ? '-' : '+';
        
        this.api.create( {
            parentId : manager.folder.id,
            title    : prefix + title
        }, function( created )
        {
            if( !created )
            {
                callback && callback( false );
                return;
            }
            
            if( manager.folder ) manager.folder.children = null;
            
            var $column = self.$bookmarks.children( safeSide === 'right' ? '.right' : '.left' );
            var $section = mdash.Column.prototype.renderSection( {
                id       : created.id,
                title    : title,
                side     : safeSide,
                children : []
            } );
            
            $column.append( $section ).show();
            $section.show();
            
            if( self.editMode )
            {
                // Rebind DnD so the newly created section becomes a valid target/handle.
                self.disableDragAndDrop();
                self.enableDragAndDrop();
                self.disableSectionDragAndDrop();
                self.enableSectionDragAndDrop();
            }
            
            mdash._undoNotify( 'Section created', 'Added "' + title + '" to ' + safeSide + ' column.', function()
            {
                self.api.removeTree( created.id, function()
                {
                    var $rem = $( '#' + created.id );
                    if( $rem.length ) $rem.remove();
                    if( manager.folder ) manager.folder.children = null;
                    if( !$column.find( 'section' ).length && !self.editMode ) $column.hide();
                } );
            } );
            callback && callback( true, created );
        } );
    };
    
    EditCtrl.prototype.confirmRemoveSection = function( $section )
    {
        if( !$section || !$section.length ) return;
        var self = this;
        var sectionId = $section.attr( 'id' );
        if( !sectionId ) return;
        
        var title = ( $section.children( 'h1' ).text() || '' ).trim() || 'Untitled';
        var count = $section.children( 'a' ).not( '.add,.drop-placeholder' ).length;
        var noun = count === 1 ? 'bookmark' : 'bookmarks';
        var message = 'This will permanently delete section "' + title + '" and ' + count + ' ' + noun + '.';
        
        var modal = ui.confirm( 'Delete section?', message );
        modal.overlay().ok( 'Delete' );
        modal.show( function( ok )
        {
            if( !ok ) return;
            self.removeSection( sectionId, title );
        } );
    };
    
    EditCtrl.prototype.removeSection = function( sectionId, sectionTitle, callback )
    {
        var self = this;
        var $section = $( '#' + sectionId );
        var $col = $section.parent();
        var colClass = $col.hasClass( 'left' ) ? '.left' : '.right';

        this.api.getSubTree( sectionId, function( tree )
        {
            var savedTree = ( tree && tree[0] ) ? tree[0] : null;

            self.api.removeTree( sectionId, function()
            {
                if( mdash.dashboard && mdash.dashboard.manager )
                {
                    mdash.dashboard.manager.folder.children = null;
                }

                $section.remove();

                if( !$col.find( 'section' ).length && !self.editMode )
                {
                    $col.hide();
                }

                if( !savedTree )
                {
                    ui.notify( 'Section removed', '"' + ( sectionTitle || 'Section' ) + '" deleted.' );
                    callback && callback( true );
                    return;
                }

                mdash._undoNotify( 'Section removed', '"' + ( sectionTitle || 'Section' ) + '" deleted.', function()
                {
                    var manager = mdash.dashboard && mdash.dashboard.manager;
                    var parentId = ( manager && manager.folder ) ? manager.folder.id : savedTree.parentId;

                    self.api.create( { parentId: parentId, title: savedTree.title }, function( folder )
                    {
                        if( !folder ) return;
                        if( manager && manager.folder ) manager.folder.children = null;

                        function restoreChildren( children, newParentId, done )
                        {
                            if( !children || !children.length ) { done(); return; }
                            var i = 0;
                            ( function next()
                            {
                                if( i >= children.length ) { done(); return; }
                                var child = children[ i++ ];
                                if( child.url )
                                {
                                    self.api.create( { parentId: newParentId, title: child.title, url: child.url }, function() { next(); } );
                                }
                                else
                                {
                                    self.api.create( { parentId: newParentId, title: child.title }, function( sub )
                                    {
                                        if( sub && child.children ) restoreChildren( child.children, sub.id, next );
                                        else next();
                                    } );
                                }
                            } )();
                        }

                        restoreChildren( savedTree.children, folder.id, function()
                        {
                            var displayTitle = savedTree.title.replace( /^[+\-]/, '' );
                            var side = savedTree.title.charAt(0) === '-' ? 'right' : 'left';
                            var $targetCol = self.$bookmarks.children( side === 'right' ? '.right' : '.left' );

                            var $newSection = mdash.Column.prototype.renderSection( {
                                id       : folder.id,
                                title    : displayTitle,
                                side     : side,
                                children : []
                            } );

                            $targetCol.append( $newSection ).show();
                            $newSection.show();

                            mdash.dashboard.manager.getSections( side, function( sections )
                            {
                                var sec = null;
                                for( var s = 0; s < sections.length; s++ )
                                {
                                    if( sections[s].id === folder.id ) { sec = sections[s]; break; }
                                }
                                if( sec && sec.children && sec.children.length )
                                {
                                    $newSection.find( 'a' ).not( '.add' ).remove();
                                    $newSection.find( '.section-remove' ).remove();
                                    var $fresh = mdash.Column.prototype.renderSection( sec );
                                    $newSection.replaceWith( $fresh );
                                    $fresh.show();
                                }
                                if( self.editMode )
                                {
                                    self.disableDragAndDrop();
                                    self.enableDragAndDrop();
                                    self.disableSectionDragAndDrop();
                                    self.enableSectionDragAndDrop();
                                }
                            } );
                        } );
                    } );
                } );
                callback && callback( true );
            } );
        } );
    };
    
    EditCtrl.prototype.setupButton = function()
    {
        var self = this;
        
        this.$btn.click( function()
        {
            if( self.altPressed ) return;
            
            if( self.editMode )
            {
                self.editMode = false;
                self.$docEl.removeClass( 'edit' );
                self.$btn.text( 'edit' );
                // Leaving edit: hide empty sections and columns again
                $( '#bookmarks section' ).each( function( _, section )
                {
                    var $section = $( section );
                    var hasLinks = $section.find( 'a' ).not( '.add' ).length > 0;
                    $section.toggle( hasLinks );
                } );
                var $cols = $( '#bookmarks > .left, #bookmarks > .right' );
                $cols.each( function( _, col )
                {
                    var $col = $( col );
                    var visibleSections = $col.find( 'section' ).filter( function(){ return $(this).is(':visible'); } ).length;
                    $col.toggle( visibleSections > 0 );
                } );

                // Disable DnD
                self.disableDragAndDrop();
                self.disableSectionDragAndDrop();

                // Switch titles back to stripped display in normal mode
                self.applyDisplayTitlesBasedOnMode();
            }
            else
            {
                self.editMode = true;
                self.$docEl.addClass( 'edit' );
                self.$btn.text( 'done' );

                // Entering edit: show all sections and columns so add buttons are visible
                $( '#bookmarks > .left, #bookmarks > .right' ).show();
                $( '#bookmarks section' ).show();

                // Enable DnD
                self.enableDragAndDrop();
                self.enableSectionDragAndDrop();

                // Show raw titles (with ICON_OVERRIDE) while editing
                self.applyDisplayTitlesBasedOnMode();
            }
        } );
    };
    
    EditCtrl.prototype.listenForAlt = function()
    {
        var $doc = $( document ),
            self = this;
        
        $doc.on( 'keydown', function( e )
        {
            if( e.keyCode === 18 /* alt */ )
            {
                self.$docEl.addClass( 'edit' );
                self.editMode = self.altPressed = true;
                // Show raw titles when Alt-edit is active
                self.applyDisplayTitlesBasedOnMode();
            }
            else if( self.editMode && (e.key === 'Escape' || e.keyCode === 27) )
            {
                // Ignore ESC when typing in inputs (e.g. section rename)
                if( $( e.target ).is('input, textarea, select, [contenteditable="true"]') ) return;
                e.preventDefault();
                e.stopPropagation();
                // Exit edit mode (same as clicking the button)
                self.$btn.trigger( 'click' );
                return;
            }
            else if( self.editMode && (e.key === 'Delete' || e.keyCode === 46 || e.keyCode === 8) )
            {
                var isFormField = $( e.target ).is('input, textarea, select');
                if( isFormField ) return;

                // Delete only when the edit dialog is open
                if( $('#dialog').is(':visible') && self.currentEditId )
                {
                    e.preventDefault();
                    e.stopPropagation();
                    var idFromDialog = self.currentEditId;
                    self.remove( idFromDialog, function(){
                        var $dlg = $('#dialog');
                        if( $dlg.length )
                        {
                            $dlg.find('.cancel').trigger('click');
                            $dlg.find('.close').trigger('click');
                        }
                        self.currentEditId = null;
                    } );
                }
            }
        } );
        
        $doc.on( 'keyup', function( e )
        {
            if( e.keyCode === 18 /* alt */ )
            {
                self.$docEl.removeClass( 'edit' );
                self.editMode = self.altPressed = false;
                // Return to stripped titles
                self.applyDisplayTitlesBasedOnMode();
            }
        } );
    };

    EditCtrl.prototype.renameSection = function( $h1 )
    {
        if( $h1.attr( 'contenteditable' ) === 'true' ) return;
        
        var self = this;
        var $section = $h1.closest( 'section' );
        var id = $section.attr( 'id' );
        var original = $h1.text();
        var isLeft = $section.closest( '.left' ).length > 0;
        var prefix = isLeft ? '+' : '-';
        var done = false;
        
        $h1.attr( 'contenteditable', 'true' )
           .attr( 'draggable', 'false' )
           .addClass( 'section-renaming' );
        
        $h1.focus();
        var range = document.createRange();
        range.selectNodeContents( $h1[0] );
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange( range );
        
        function finish( save )
        {
            if( done ) return;
            done = true;
            
            $h1.removeAttr( 'contenteditable' )
               .removeClass( 'section-renaming' );
            
            if( self.editMode )
            {
                $h1.attr( 'draggable', 'true' );
            }
            
            $h1.off( '.mdash-rename' );
            
            if( !save )
            {
                $h1.text( original );
                return;
            }
            
            var title = ( $h1.text() || '' ).trim();
            if( !title )
            {
                $h1.text( original );
                return;
            }
            
            var oldFullTitle = prefix + original;
            self.api.update( id, { title: prefix + title }, function()
            {
                $h1.text( title );
                if( mdash.dashboard && mdash.dashboard.manager )
                {
                    mdash.dashboard.manager.folder.children = null;
                }
                mdash._undoNotify( 'Section renamed', 'Updated to \'' + title + '\'.', function()
                {
                    self.api.update( id, { title: oldFullTitle }, function()
                    {
                        $h1.text( original );
                        if( mdash.dashboard && mdash.dashboard.manager )
                        {
                            mdash.dashboard.manager.folder.children = null;
                        }
                    } );
                } );
            } );
        }
        
        $h1.on( 'keydown.mdash-rename', function( e )
        {
            if( e.key === 'Enter' || e.keyCode === 13 )
            {
                e.preventDefault();
                e.stopPropagation();
                finish( true );
            }
            else if( e.key === 'Escape' || e.keyCode === 27 )
            {
                e.preventDefault();
                e.stopPropagation();
                finish( false );
            }
        } );
        
        $h1.on( 'blur.mdash-rename', function(){ finish( true ); } );
        
        $h1.on( 'paste.mdash-rename', function( e )
        {
            e.preventDefault();
            var text = ( e.originalEvent.clipboardData || window.clipboardData ).getData( 'text/plain' );
            document.execCommand( 'insertText', false, text );
        } );
    };
    
    EditCtrl.prototype.edit = function( $b )
    {
        var $form, $title, $url, $section, $rmBtn, dialog,
            self  = this,
            id    = $b.attr( 'id' ),
            title = $b.find( 'span' ).text(),
            rawTitle = $b.attr( 'data-raw-title' ) || title,
            sections = mdash.dashboard.manager.folder.children,
            sectionId = +$b.closest( 'section' ).attr( 'id' );
        
        $form  = $( '<div class="ui-edit-form">' );
        $title = $( '<input autofocus id="title" type="text"/>' ).val( rawTitle ).focus();
        $url   = $( '<input id="url" type="text"/>' ).val( $b.attr( 'href' ) );

        $section = $( '<select id="section">' );
        sections.forEach( function( section )
        {
            $( '<option>' ).val( section.id ).text( section.title ).appendTo( $section );
        } );
        $section.val( sectionId );

        // Track current edited bookmark id for keyboard Delete
        this.currentEditId = id;

        $rmBtn = $( '<a class="remove" href="#">DELETE (shortcut key: DELETE)</a>' ).click( function( e )
        {
            e.preventDefault();
            
            self.remove( id, function()
            {
                dialog.hide();
                self.currentEditId = null;
            } );
        } );
        
        $form.append( $title, $url, $section, $rmBtn );
        
        dialog = ui.confirm( 'Edit \'' + title + '\'', $form );
        dialog.overlay().ok( 'Save' );
        dialog.show( function( ok )
        {
            if( !ok )
            {
                dialog.hide();
                self.currentEditId = null;
                return;
            }

            self.update(
                id,
                {
                    title   : $title.val(),
                    url     : $url.val()
                },
                $section.val() != sectionId ? $section.val() : null,
                function() { dialog.hide(); self.currentEditId = null; }
            );
        } );
    };
    
    EditCtrl.prototype.remove = function( id, callback )
    {
        var $el = $( document.getElementById( id ) );
        var self = this;

        // Fetch node to capture undo info
        this.api.get( id, function( nodes )
        {
            var node = nodes && nodes[0];
            if( !node )
            {
                // Fallback remove without undo if lookup failed
                self.api.remove( id, function()
                {
                    $el.addClass( 'removed' );
                    setTimeout( callback, 0 );
                    setTimeout( function() { $el.remove(); }, 500 );
                } );
                return;
            }

            var undoInfo = {
                parentId : node.parentId,
                index    : node.index,
                title    : node.title,
                url      : node.url
            };

            self.api.remove( id, function()
            {
                $el.addClass( 'removed' );
                setTimeout( callback, 0 );
                setTimeout( function() { $el.remove(); }, 500 );

                var seconds = 30, undone = false;
                var $content = $( '<div>' ).append(
                    document.createTextNode( 'Bookmark \'' + undoInfo.title + '\' removed. ' ),
                    $( '<a href="#" class="undo">' ).append( 'Undo (', $( '<span class="count">' ).text( seconds ), ')' )
                );
                var note = ui.notify( 'Removed', $content ).hide( 31000 );
                var tick = setInterval( function()
                {
                    seconds -= 1;
                    if( seconds <= 0 )
                    {
                        clearInterval( tick );
                    }
                    $content.find( '.count' ).text( Math.max( seconds, 0 ) );
                }, 1000 );

                $content.on( 'click', '.undo', function( e )
                {
                    e.preventDefault();
                    if( undone ) return; undone = true;
                    clearInterval( tick );
                    note.hide( 1 );

                    self.api.create( {
                        parentId : undoInfo.parentId,
                        index    : undoInfo.index,
                        title    : undoInfo.title,
                        url      : undoInfo.url
                    }, function( created )
                    {
                        if( !created ) return;
                        var $section = $( '#' + undoInfo.parentId );
                        var $new = mdash.Column.prototype.renderBookmark( created );
                        var $tiles = $section.children( 'a' ).not( '.add' );
                        var $add   = $section.find( 'a.add' );
                        if( undoInfo.index != null && undoInfo.index < $tiles.length )
                        {
                            $tiles.eq( undoInfo.index ).before( $new );
                        }
                        else
                        {
                            $add.before( $new );
                        }
                        $section.show();
                        $section.parent().show();

                        // If we are currently in edit mode, make the restored tile draggable and bind DnD handlers
                        if( self.editMode )
                        {
                            $new.attr( 'draggable', true )
                                .on( 'dragstart.mdash', function( e )
                                {
                                    self._dragging = true;
                                    var id = $( this ).attr( 'id' );
                                    var dt = e.originalEvent.dataTransfer;
                                    try { dt.setData( 'application/x-mdash-bookmark-id', id ); } catch( _e ) {}
                                    try { dt.setData( 'text/plain', '' ); } catch( _e ) {}
                                    dt.effectAllowed = 'move';
                                    var el = this;
                                    setTimeout( function(){ $( el ).addClass( 'dragging' ); }, 0 );
                                } )
                                .on( 'dragend.mdash', function()
                                {
                                    self._dragging = false;
                                    $( this ).removeClass( 'dragging' );
                                    if( self.$placeholder ) self.$placeholder.detach();
                                    self.$bookmarks.find( 'section' ).removeClass( 'drop-target' );
                                } );

                            $new.on( 'dragover.mdash', function( e )
                            {
                                e.preventDefault();
                                var rect = this.getBoundingClientRect();
                                var before = (e.originalEvent.clientX < rect.left + rect.width / 2);
                                var $t = $( this );
                                if( before ) { $t.before( self.$placeholder ); }
                                else { $t.after( self.$placeholder ); }
                                $t.closest( 'section' ).addClass( 'drop-target' );
                            } );
                        }
                    } );
                } );
            } );
        } );
    };
    
    EditCtrl.prototype.update = function( id, props, moveTo, callback )
    {
        var $el    = $( document.getElementById( id ) ),
            $title = $el.find( 'span' ),
            self   = this;

        // Capture previous state for undo
        var prev = {
            title    : $title.text(),
            rawTitle : $el.attr( 'data-raw-title' ) || $title.text(),
            url      : $el.attr( 'href' ),
            parentId : $el.closest( 'section' ).attr( 'id' ),
            index    : (function(){
                var $tiles = $el.closest('section').children('a').not('.add');
                for( var i=0; i<$tiles.length; i++ ) if( $tiles[i] === $el[0] ) return i;
                return null;
            })()
        };

        function refreshFaviconForUrl( anchorEl, url, forTitle )
        {
            var $img = anchorEl.find( 'img' );
            try {
                var rawTitle = anchorEl.attr( 'data-raw-title' ) || forTitle || '';
                var overrideOnly = mdash.util.hasIconOverride( rawTitle );
                var effectiveTitle = mdash.util.stripIconOverride( rawTitle );
                var vpn = (rawTitle || '').indexOf('[VPN]') !== -1 || (forTitle || '').indexOf('[VPN]') !== -1;
                mdash.util.applyFaviconWithFallback( $img, url, vpn, effectiveTitle, overrideOnly );
            } catch(e){}
        }

        function showUndoNotification()
        {
            var seconds = 30, undone = false;
            var $content = $( '<div>' ).append(
                document.createTextNode( 'Bookmark \'' + $title.text() + '\' updated. ' ),
                $( '<a href="#" class="undo">' ).append( 'Undo (', $( '<span class="count">' ).text( seconds ), ')' )
            );
            var note = ui.notify( 'Updated', $content ).hide( 31000 );
            var tick = setInterval( function(){ seconds -= 1; if( seconds <= 0 ) clearInterval( tick ); $content.find('.count').text(Math.max(seconds,0)); }, 1000 );

            $content.on( 'click', '.undo', function( e )
            {
                e.preventDefault();
                if( undone ) return; undone = true;
                clearInterval( tick );
                note.hide( 1 );

                // Move back if needed
                var doneMove = function( next ) { next && next(); };
                var currentParent = $el.closest('section').attr('id');
                if( prev.parentId && currentParent !== prev.parentId )
                {
                    doneMove = function( next )
                    {
                        self.api.move( id, { parentId: prev.parentId, index: prev.index }, function()
                        {
                            // Reposition in DOM
                            var $section = $( '#' + prev.parentId );
                            var $tiles = $section.children('a').not('.add');
                            var $add   = $section.find('a.add');
                            var $cur   = $( document.getElementById( id ) );
                            if( prev.index != null && prev.index < $tiles.length ) { $tiles.eq(prev.index).before( $cur ); }
                            else { $add.before( $cur ); }
                            $section.show(); $section.parent().show();
                            next && next();
                        } );
                    };
                }

                doneMove( function()
                {
                    // Restore title/url (raw title)
                    self.api.update( id, { title: prev.rawTitle, url: prev.url }, function()
                    {
                        var $cur = $( document.getElementById( id ) );
                        var $t = $cur.find('span');
                        $cur.attr( 'data-raw-title', prev.rawTitle );
                        var displayPrev = self.editMode ? prev.rawTitle : mdash.util.stripIconOverride( prev.rawTitle );
                        $t.text( displayPrev );
                        $cur.attr('href', prev.url );
                        $cur.attr('title', displayPrev );
                        $cur.attr('aria-label', displayPrev );
                        $cur.attr( 'data-title', displayPrev );
                        $cur.data( 'title', displayPrev );
                        refreshFaviconForUrl( $cur, prev.url, displayPrev );
                    } );
                } );
            });
        }

        this.api.update( id, props, function()
        {
            var newRawTitle = (props.title != null) ? props.title : ( $el.attr('data-raw-title') || $title.text() );
            $el.attr( 'data-raw-title', newRawTitle );
            var displayNow = self.editMode ? newRawTitle : mdash.util.stripIconOverride( newRawTitle );
            if( props.title )
            {
                $title.text( displayNow );
            }
            if( props.url )
            {
                $el.attr( 'href', props.url );

                // Refresh favicon immediately using the same fallback strategy as rendering
                refreshFaviconForUrl( $el, props.url, displayNow );
            }
            else
            {
                // If only title changed, still refresh favicon to respect icons map lookups
                refreshFaviconForUrl( $el, $el.attr('href'), displayNow );
            }

            if( props.title )
            {
                $el.attr( 'title', displayNow );
                $el.attr( 'aria-label', displayNow );
                $el.attr( 'data-title', displayNow );
                $el.data( 'title', displayNow );
            }
            
            function afterUpdate()
            {
                setTimeout( callback, 0 );
                showUndoNotification();
            }
            
            if( moveTo )
            {
                self.api.move( id, { parentId: moveTo }, function()
                {
                    $( '#' + id ).remove().appendTo( $( '#' + moveTo ) );
                    afterUpdate();
                } );
            }
            else
            {
                afterUpdate();
            }
        } );
    };
    
} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );


( function( mdash )
{
    'use strict';
    var KEY = 'mdash:theme';

    var ThemeCtrl = mdash.ThemeCtrl = function( $links )
    {
        this.$links = $links;
        this.$dropdown = this.$links.closest('.dropdown');
        this.$toggle = this.$dropdown.find('.dropdown-toggle');
    };

    ThemeCtrl.prototype.init = function()
    {
        var saved = localStorage.getItem( KEY );
        if( saved === 'dark' )
        {
            document.documentElement.classList.add( 'theme-dark' );
            document.documentElement.classList.remove( 'theme-light' );
            this.select( 'dark' );
        }
        else if( saved === 'light' )
        {
            document.documentElement.classList.add( 'theme-light' );
            document.documentElement.classList.remove( 'theme-dark' );
            this.select( 'light' );
        }
        else
        {
            // default to light
            this.select( 'light' );
        }

        this.$links.on( 'click', this.onClick.bind( this ) );
        this.$toggle.on( 'click', this.toggleOpen.bind( this ) );
        $(document).on('click', this.closeOnOutsideClick.bind(this));
    };

    ThemeCtrl.prototype.select = function( theme )
    {
        this.$links.removeClass( 'selected' );
        this.$links.parent().find( 'a[data-theme="' + theme + '"]' ).addClass( 'selected' );
        this.$toggle.text(theme + ' ▾');
    };

    ThemeCtrl.prototype.onClick = function( e )
    {
        e.preventDefault();
        var theme = e.target.getAttribute( 'data-theme' );
        if( theme === 'dark' )
        {
            document.documentElement.classList.add( 'theme-dark' );
            document.documentElement.classList.remove( 'theme-light' );
        }
        else
        {
            document.documentElement.classList.add( 'theme-light' );
            document.documentElement.classList.remove( 'theme-dark' );
        }
        localStorage.setItem( KEY, theme );
        this.select( theme );
        this.$dropdown.removeClass('open');
    };

    ThemeCtrl.prototype.toggleOpen = function(e)
    {
        e.preventDefault();
        e.stopPropagation();
        this.$dropdown.toggleClass('open');
    };

    ThemeCtrl.prototype.closeOnOutsideClick = function(e)
    {
        if(!$(e.target).closest(this.$dropdown).length) {
            this.$dropdown.removeClass('open');
        }
    };

} )( window.mdash || ( window.mdash = {} ) );


/* --- keyboard_manager.js --- */

( function( mdash )
{
    'use strict';
        var ENABLED = 'mdash:keyboard:isEnabled';

        var KeyboardManager = mdash.KeyboardManager = function() {},
                proto       = KeyboardManager.prototype;

        // TODO: Use ES5 getter/setter.
        proto.enable = function()
        {
            localStorage[ENABLED] = 'enabled';
        };

        proto.disable = function()
        {
            localStorage[ENABLED] = 'disabled';
        };

        proto.toggle = function()
        {
            localStorage[ENABLED] = this.isEnabled() ? 'disabled' : 'enabled';
        };

        proto.isEnabled = function()
        {
            return localStorage[ENABLED] != null && localStorage[ENABLED] === 'enabled';
        };

        proto.init = function()
        {
            this.searchTerm       = "";
            this.modifierPressed  = false;
            this.modifierKeyCodes = [
                91, // ⌘
                16  // Shift
            ];

            if (localStorage[ENABLED] == null) {
                this.disable();
            }

            if (this.isEnabled()) {
              this.bindKeyboard();
            }
        }

        proto.bindKeyboard = function()
        {
            var _this = this;

            $(document).on('keydown', function(e) {

                if (!_this.isEnabled()) {
                    return;
                }

                if (_this.isModifierKey(e.which))
                {
                    _this.modifierPressed = true;
                }
                else if (e.which == 8)
                {
                    if (_this.modifierPressed) {
                        _this.searchTerm = '';
                    } else {
                        _this.searchTerm = _this.searchTerm.slice(0, -1);
                    }

                    e.preventDefault();
                }
                else
                {
                    if (/*!_this.modifierPressed &&*/ e.which >= 65 && e.which <= 90)
                    {
                        _this.searchTerm += String.fromCharCode(e.which);
                    }
                }


                $('#filter p').text(_this.searchTerm);

                _this.filterTiles();
            });

            $(document).on('keyup', function(e) {
                if (_this.isModifierKey(e.which)) {
                    _this.modifierPressed = false;
                }
            });
    }

    proto.isModifierKey = function(keyCode)
    {
        return (this.modifierKeyCodes.indexOf(keyCode) !== -1);
    }

    proto.filterTiles = function()
    {
        var _this = this;
        var filterable = $('#bookmarks a').not('.add,.drop-placeholder');

        $.each(filterable, function(i, item) {
            var $item = $(item);
            var title = $item.data('title');

            if (title.match(new RegExp('' + _this.searchTerm, 'i'))) {
                $item.show();
            } else {
                $item.hide();
            }
        });
    }


} )( window.mdash || ( window.mdash = {} ) );


( function( mdash )
{
    'use strict';
    
    var _getForm = function()
    {
        var $form  = $( '<div class="ui-add-form"></div>' ),
            $title = $( '<input autofocus id="title" type="text" placeholder="Title..." />' ),
            $url   = $( '<input id="url" type="text" placeholder="https://example.com or intranet-host" />' );
        
        $form.append( $title, $url );
        
        return $form;
    };
    
    var normalizeUrl = function( value )
    {
        if( !value ) return value;
        value = value.trim();
        if( !value ) return value;

        if( value.indexOf( '//' ) === 0 ) value = 'https:' + value;

        try { new URL( value ); } catch( _e ) { value = 'http://' + value; }

        return mdash.util.isSafeUrl( value ) ? value : null;
    };
    
    var AddBtn = mdash.AddBtn = function( $btn )
    {
        this.$btn     = $btn;
        this.$section = $btn.closest( 'section' );
        this.api      = chrome.bookmarks;
    };
    
    AddBtn.prototype.init = function()
    {
        this.$btn.on( 'click', this.showModal.bind( this ) );
    };
    
    AddBtn.prototype.showModal = function( e )
    {
        var self = this, $form = _getForm();
        
        e.preventDefault();
        
        var modal = ui.confirm(
            'Add a bookmark in \'' + this.$section.find( 'h1' ).text() + '\'',
            $form
        );
        
        modal.overlay().ok( 'Add' );
        
        modal.show( function( ok )
        {
            if( !ok ) return;
            
            self.add(
                $form.find( '#title' ).val(),
                normalizeUrl( $form.find( '#url' ).val() ),
                function( added, bookmark )
                {
                    if( !added )
                    {
                        ui.error( 'Error', 'Couldn\'t add the bookmark.' );
                        
                        modal.show();
                        return;
                    }
                    
                    var $new = mdash.Column.prototype.renderBookmark( bookmark );
                    self.$btn.before( $new );

                    mdash._undoNotify( 'Added', '\'' + bookmark.title + '\' added.', function()
                    {
                        chrome.bookmarks.remove( bookmark.id, function()
                        {
                            var $tile = $( document.getElementById( bookmark.id ) );
                            if( $tile.length ) { $tile.addClass( 'removed' ); setTimeout( function(){ $tile.remove(); }, 500 ); }
                        } );
                    } );

                    // If user is in edit mode, immediately enable DnD on the new tile
                    try {
                        var edit = mdash.dashboard && mdash.dashboard.editCtrl;
                        if( edit && edit.editMode )
                        {
                            if( !edit.$placeholder || !edit.$placeholder.length )
                            {
                                edit.$placeholder = $('<a class="drop-placeholder" aria-hidden="true"></a>');
                            }
                            $new.attr( 'draggable', true )
                                .on( 'dragstart.mdash', function( e )
                                {
                                    edit._dragging = true;
                                    edit._handledDrop = false;
                                    var id = $( this ).attr( 'id' );
                                    var dt = e.originalEvent.dataTransfer;
                                    try { dt.setData( 'application/x-mdash-bookmark-id', id ); } catch( _e ) {}
                                    try { dt.setData( 'text/plain', '' ); } catch( _e ) {}
                                    dt.effectAllowed = 'move';
                                    var el = this;
                                    setTimeout( function(){ $( el ).addClass( 'dragging' ); }, 0 );
                                    var $cur = $( this );
                                    edit.$placeholder.addClass( 'collapsed' );
                                    $cur.before( edit.$placeholder );
                                } )
                                .on( 'dragend.mdash', function()
                                {
                                    edit._dragging = false;
                                    $( this ).removeClass( 'dragging' );
                                    if( edit.$placeholder ) edit.$placeholder.removeClass( 'collapsed' ).detach();
                                    edit.$bookmarks.find( 'section' ).removeClass( 'drop-target' );
                                } );

                            $new.on( 'dragover.mdash', function( e )
                            {
                                e.preventDefault();
                                var rect = this.getBoundingClientRect();
                                var before = (e.originalEvent.clientX < rect.left + rect.width / 2);
                                var $t = $( this );
                                if( before ) { $t.before( edit.$placeholder ); }
                                else { $t.after( edit.$placeholder ); }
                                edit.$placeholder.removeClass( 'collapsed' );
                                $t.closest( 'section' ).addClass( 'drop-target' );
                            } );
                        }
                    } catch( _e ) {}

                    // Spotlight search does not filter tiles in-place; no re-filter needed
                }
            );
        } );
    };
    
    AddBtn.prototype.add = function( title, url, callback )
    {
        this.api.create( {
            parentId: this.$section.attr( 'id' ),
            title: title,
            url: url,
            index: this.$section.children().length - 3
        },
        function( result )
        {
            callback && setTimeout( function() { callback( !!result, result ); }, 0 );
        } );
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- spotlight.js --- */

( function( mdash, $ )
{
    'use strict';
    
    var MAX_RESULTS = 30;
    var _selectedIdx = -1;
    
    var Spotlight = mdash.Spotlight = function()
    {
        this.$el       = $( '#spotlight' );
        this.$backdrop = this.$el.find( '.spotlight-backdrop' );
        this.$panel    = this.$el.find( '.spotlight-panel' );
        this.$input    = $( '#spotlight-input' );
        this.$results  = $( '#spotlight-results' );
        this.visible   = false;
    };
    
    Spotlight.prototype.init = function()
    {
        var self = this;
        
        $( document ).on( 'keydown', function( e )
        {
            var isKeyF = e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === '\u0192' || e.keyCode === 70;
            var isMac = /Mac|iPhone|iPad|iPod/.test( navigator.platform || navigator.userAgent );
            var trigger = isMac
                ? ( ( e.altKey || e.metaKey ) && isKeyF )
                : ( e.ctrlKey && isKeyF );
            
            if( trigger )
            {
                e.preventDefault();
                e.stopPropagation();
                self.visible ? self.hide() : self.show();
                return;
            }
            
            if( !self.visible ) return;
            
            if( e.key === 'Escape' || e.keyCode === 27 )
            {
                e.preventDefault();
                e.stopPropagation();
                self.hide();
            }
            else if( e.key === 'ArrowDown' || e.keyCode === 40 )
            {
                e.preventDefault();
                self.moveSelection( 1 );
            }
            else if( e.key === 'ArrowUp' || e.keyCode === 38 )
            {
                e.preventDefault();
                self.moveSelection( -1 );
            }
            else if( e.key === 'Enter' || e.keyCode === 13 )
            {
                e.preventDefault();
                self.openSelected();
            }
        } );
        
        this.$input.on( 'input', function()
        {
            self.search( self.$input.val() );
        } );
        
        this.$backdrop.on( 'click', function()
        {
            self.hide();
        } );
        
        this.$results.on( 'click', 'li', function( e )
        {
            e.preventDefault();
            var $li = $( this );
            if( $li.data( 'spotlightSkipClick' ) )
            {
                $li.removeData( 'spotlightSkipClick' );
                return;
            }
            
            var isPrimaryButton = ( e.button === undefined || e.button === 0 ) &&
                                  ( e.which === undefined || e.which === 1 );
            if( !isPrimaryButton ) return;
            
            var href = $( this ).attr( 'data-href' );
            if( !href ) return;
            
            var openInNewTab = e.metaKey || e.ctrlKey;
            self.openHref( href, openInNewTab, openInNewTab );
        } );
        
        this.$results.on( 'mousedown', 'li', function( e )
        {
            if( e.button !== 1 ) return;
            e.preventDefault();
            e.stopPropagation();
            
            var $li = $( this );
            $li.data( 'spotlightSkipClick', true );
            setTimeout( function()
            {
                $li.removeData( 'spotlightSkipClick' );
            }, 250 );
            
            var href = $( this ).attr( 'data-href' );
            if( !href ) return;
            
            self.openHref( href, true, true );
        } );
        
        this.$results.on( 'mouseenter', 'li', function()
        {
            var $li = $( this );
            self.$results.find( 'li.selected' ).removeClass( 'selected' );
            $li.addClass( 'selected' );
            _selectedIdx = $li.index();
        } );
    };
    
    Spotlight.prototype.show = function()
    {
        this.visible = true;
        this.$el.removeClass( 'spotlight-hidden' );
        this.$input.val( '' );
        this.$results.empty();
        _selectedIdx = -1;
        
        var self = this;
        setTimeout( function(){ self.$input.focus(); }, 50 );
    };
    
    Spotlight.prototype.hide = function()
    {
        this.visible = false;
        this.$el.addClass( 'spotlight-hidden' );
        this.$input.blur();
    };
    
    Spotlight.prototype.search = function( query )
    {
        var $list = this.$results;
        $list.empty();
        _selectedIdx = -1;
        
        if( !query || !query.trim() )
        {
            return;
        }
        
        var escaped = query.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
        var regex = null;
        try { regex = new RegExp( escaped, 'i' ); } catch( _e ) { return; }
        
        var matches = [];
        
        $( '#bookmarks a' ).not( '.add,.drop-placeholder' ).each( function( _, el )
        {
            var $el   = $( el );
            var title = $el.find( 'span' ).text() || $el.attr( 'data-title' ) || $el.data( 'title' ) || '';
            var href  = $el.attr( 'href' ) || '';
            var rawTitle = $el.attr( 'data-raw-title' ) || title;
            var displayTitle = mdash.util ? mdash.util.stripIconOverride( rawTitle ) : title;
            
            if( regex.test( displayTitle ) || regex.test( href ) )
            {
                var $section = $el.closest( 'section' );
                var sectionName = $section.find( 'h1' ).text() || '';
                
                matches.push( {
                    title   : displayTitle,
                    href    : href,
                    section : sectionName,
                    $img    : $el.find( 'img' ).first()
                } );
            }
        } );
        
        if( matches.length === 0 )
        {
            $list.append( '<li class="spotlight-empty">No results</li>' );
            return;
        }
        
        var count = Math.min( matches.length, MAX_RESULTS );
        for( var i = 0; i < count; i++ )
        {
            var m = matches[ i ];
            var imgSrc = '';
            try { imgSrc = m.$img.attr( 'src' ) || ''; } catch( _e ) {}
            
            var $titleSpan = $( '<span class="spotlight-title">' );
            var hlRegex = new RegExp( escaped, 'gi' );
            var lastIdx = 0, hlMatch;
            while( ( hlMatch = hlRegex.exec( m.title ) ) !== null )
            {
                if( hlMatch.index > lastIdx )
                    $titleSpan.append( document.createTextNode( m.title.substring( lastIdx, hlMatch.index ) ) );
                $titleSpan.append( $( '<mark>' ).text( hlMatch[0] ) );
                lastIdx = hlRegex.lastIndex;
                if( !hlMatch[0].length ) hlRegex.lastIndex++;
            }
            if( lastIdx < m.title.length )
                $titleSpan.append( document.createTextNode( m.title.substring( lastIdx ) ) );
            
            var $li = $( '<li>' )
                .attr( 'data-href', m.href )
                .append(
                    imgSrc ? $( '<img class="spotlight-icon">' ).attr( 'src', imgSrc ) : '',
                    $( '<div class="spotlight-item-body">' ).append(
                        $titleSpan,
                        $( '<span class="spotlight-url">' ).text( m.href )
                    ),
                    m.section ? $( '<span class="spotlight-section">' ).text( m.section ) : ''
                );
            
            $list.append( $li );
        }
        
        if( matches.length > MAX_RESULTS )
        {
            $list.append( '<li class="spotlight-empty">…and ' + ( matches.length - MAX_RESULTS ) + ' more</li>' );
        }
        
        _selectedIdx = 0;
        $list.find( 'li' ).first().addClass( 'selected' );
    };
    
    Spotlight.prototype.moveSelection = function( dir )
    {
        var $items = this.$results.find( 'li' ).not( '.spotlight-empty' );
        if( !$items.length ) return;
        
        $items.eq( _selectedIdx ).removeClass( 'selected' );
        _selectedIdx += dir;
        if( _selectedIdx < 0 ) _selectedIdx = $items.length - 1;
        if( _selectedIdx >= $items.length ) _selectedIdx = 0;
        
        var $sel = $items.eq( _selectedIdx ).addClass( 'selected' );
        var container = this.$results[0];
        var el = $sel[0];
        if( el.offsetTop < container.scrollTop )
        {
            container.scrollTop = el.offsetTop;
        }
        else if( el.offsetTop + el.offsetHeight > container.scrollTop + container.clientHeight )
        {
            container.scrollTop = el.offsetTop + el.offsetHeight - container.clientHeight;
        }
    };
    
    Spotlight.prototype.openSelected = function()
    {
        var $items = this.$results.find( 'li' ).not( '.spotlight-empty' );
        if( !$items.length || _selectedIdx < 0 ) return;
        var href = $items.eq( _selectedIdx ).attr( 'data-href' );
        this.openHref( href );
    };
    
    Spotlight.prototype.openHref = function( href, inNewTab, keepOpen )
    {
        if( !href || !mdash.util.isSafeUrl( href ) ) return;
        
        if( inNewTab )
        {
            if( window.chrome && chrome.tabs && typeof chrome.tabs.create === 'function' )
            {
                chrome.tabs.create( { url: href, active: false } );
            }
            else
            {
                var newWin = window.open( href, '_blank', 'noopener' );
                if( newWin ) newWin.opener = null;
            }
            
            if( !keepOpen ) this.hide();
            return;
        }
        
        this.hide();
        window.location.href = href;
    };
    
    $( function()
    {
        var spotlight = new mdash.Spotlight();
        spotlight.init();
    } );
    
} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );


( function( mdash, $ )
{
    'use strict';
    
    var Dashboard = mdash.Dashboard = function() {},
        proto     = Dashboard.prototype;

    Dashboard.VERSION = '1.3.4';

    proto.init = function()
    {
        this.$fontSizes  = $( '#fontctrl .dropdown-menu a' );
        this.$helpCtrl   = $( '#helpctrl' );
        this.$themeCtrl  = $( '#themectrl .dropdown-menu a' );
        this.$editBtn    = $( '#edit' );
        this.$refresh    = $( '#refresh-icons' );
        this.$getStarted = $( '#getstarted' );
        this.$bookmarks  = $( '#bookmarks' );
        this.$version    = $( '#version' );

        this.manager         = new mdash.Manager();
        this.fontCtrl        = new mdash.FontCtrl( this.$fontSizes );
        this.helpCtrl        = new mdash.HelpCtrl( this.$helpCtrl, this.$getStarted, this.$bookmarks );
        this.themeCtrl       = new mdash.ThemeCtrl( this.$themeCtrl );
        this.editCtrl        = new mdash.EditCtrl( this.$editBtn, this.$bookmarks );
        this.keyboardManager = new mdash.KeyboardManager();

        this.fontCtrl.init();
        this.helpCtrl.init();
        this.themeCtrl.init();
        this.editCtrl.init();

        // Preload icons map FIRST so favicon lookup prefers icons.json before any fallbacks
        try
        {
            mdash.util.preloadIconsMap().finally( this.manager.init.bind( this.manager, this.loadBookmarks.bind( this ) ) );
        }
        catch( _e )
        {
            this.manager.init( this.loadBookmarks.bind( this ) );
        }

        this.setupUIKit();

        this.keyboardManager.init();

        // Refresh icons action:
        // - click: full page reload (stable/default behavior)
        // - Alt+click: clear favicon cache and re-fetch in place
        var _this = this;
        this.$refresh.on( 'click', function( e )
        {
            e.preventDefault();
            if( e.altKey )
            {
                ui.notify( 'Refreshing', 'Clearing favicon cache and re-fetching…' );
                _this.refreshFavicons();
                return;
            }
            ui.notify( 'Refreshing', 'Reloading page…' );
            window.location.reload();
        } );
    };

    proto.setupUIKit = function()
    {
        ui.Dialog.effect = 'fade';

        $( document ).on( 'keydown', function( e )
        {
            var $dialog = $( '#dialog' );
            if( !$dialog.length || !$dialog.is(':visible') ) return;

            var code = e.which || e.keyCode;
            if( code === 13 )
            {
                e.preventDefault();
                $dialog.find( 'button.ok' ).trigger('click');
            }
            else if( code === 27 )
            {
                e.preventDefault();
                $dialog.find( 'button.cancel' ).trigger('click');
            }
        } );
    };

    proto.loadBookmarks = function()
    {
        var _this = this;

        this.leftColumn  = new mdash.Column( $( '#bookmarks > .left' ) );
        this.rightColumn = new mdash.Column( $( '#bookmarks > .right' ) );

        this.manager.getSections( 'left', function( sections )
        {
            _this.leftColumn.sections = sections;
            _this.leftColumn.render();
        } );

        this.manager.getSections( 'right', function( sections )
        {
            _this.rightColumn.sections = sections;
            _this.rightColumn.render();
        } );
    };

    proto.refreshFavicons = function()
    {
        // Clear favicon cache from localStorage and memory
        var keysToRemove = [];
        for( var i = 0; i < localStorage.length; i++ )
        {
            var k = localStorage.key( i );
            if( k && k.indexOf( 'fav:' ) === 0 ) keysToRemove.push( k );
        }
        keysToRemove.forEach( function( k ){ localStorage.removeItem( k ); } );
        for( var key in mdash.util._faviconMemCache ) delete mdash.util._faviconMemCache[ key ];

        $( '#bookmarks a:not(.add) img' ).each( function( _, img )
        {
            var $img = $( img );
            var $a   = $img.closest( 'a' );
            var href = $a.attr( 'href' );
            if( !href ) return;
            try
            {
                var rawTitle = $a.attr( 'data-raw-title' ) || $a.attr( 'data-title' ) || '';
                var overrideOnly = mdash.util.hasIconOverride( rawTitle );
                var effectiveTitle = mdash.util.stripIconOverride( rawTitle );
                var vpn = rawTitle.indexOf( '[VPN]' ) !== -1;
                mdash.util.applyFaviconWithFallback( $img, href, vpn, effectiveTitle, overrideOnly );
            }
            catch( e ){}
        } );
    };

} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );


( function( mdash )
{
    'use strict';
    
    if( navigator.platform.indexOf( 'Win' ) !== -1 )
    {
        document.documentElement.classList.add( 'win' );
    }
    
    mdash.dashboard = new mdash.Dashboard();
    
    $( document ).ready( mdash.dashboard.init.bind( mdash.dashboard ) );
    
} )( window.mdash || ( window.mdash = {} ) );


