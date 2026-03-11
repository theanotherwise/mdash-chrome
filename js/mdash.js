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
            if( window.chrome && chrome.runtime && chrome.runtime.lastError )
            {
                _this.folder.children = [];
                callback( [] );
                return;
            }
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
                var _colorMatch = b.title.match( /\s+#([0-9A-Fa-f]{6})$/ );
                if( _colorMatch )
                {
                    b.color = '#' + _colorMatch[ 1 ];
                    b.title = b.title.substring( 0, b.title.length - _colorMatch[ 0 ].length );
                }
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
            var results = [];
            
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

            var pending = results.length;
            results.forEach( function( section )
            {
                _this.fetchSectionBookmarks( section, function()
                {
                    pending--;
                    if( pending <= 0 )
                    {
                        callback( results );
                    }
                } );
            } );
        } );
    };
    
    proto.fetchSectionBookmarks = function( section, callback )
    {
        this.api.getChildren( section.id, function( bookmarks )
        {
            if( window.chrome && chrome.runtime && chrome.runtime.lastError )
            {
                section.children = [];
                callback( section.children );
                return;
            }
            section.children = Array.isArray( bookmarks ) ? bookmarks : [];
            
            callback( section.children );
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


/* --- section_state.js --- */

( function( mdash )
{
    'use strict';

    var KEY = 'mdash:sections:collapsed';

    var state = mdash.sectionState = {};
    state._data = null;

    state._load = function()
    {
        if( this._data ) return this._data;
        try { this._data = JSON.parse( localStorage.getItem( KEY ) ) || {}; }
        catch( _e ) { this._data = {}; }
        return this._data;
    };

    state._save = function()
    {
        try { localStorage.setItem( KEY, JSON.stringify( this._data || {} ) ); }
        catch( _e ) {}
    };

    state.isCollapsed = function( sectionId )
    {
        if( !sectionId ) return false;
        var data = this._load();
        return !!data[ '' + sectionId ];
    };

    state.setCollapsed = function( sectionId, collapsed )
    {
        if( !sectionId ) return;
        var data = this._load();
        if( collapsed ) data[ '' + sectionId ] = 1;
        else delete data[ '' + sectionId ];
        this._save();
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
    mdash.util.MAX_TILE_TITLE_CHARS = 32;
    mdash.util.truncateTileTitle = function( title )
    {
        var t = ( title || '' );
        if( t.length <= this.MAX_TILE_TITLE_CHARS ) return t;
        return t.substring( 0, Math.max( this.MAX_TILE_TITLE_CHARS - 3, 0 ) ).replace( /\s+$/, '' ) + '...';
    };
    mdash.util.buildTitleView = function( rawTitle, showRaw )
    {
        var full = showRaw ? ( rawTitle || '' ) : mdash.util.stripIconOverride( rawTitle || '' );
        return {
            full: full,
            tile: mdash.util.truncateTileTitle( full )
        };
    };

    function _isIPv4Host( host )
    {
        return /^\d{1,3}(?:\.\d{1,3}){3}$/.test( host || '' );
    }

    function _isLocalLikeHost( host )
    {
        var h = (host || '').toLowerCase();
        if( !h ) return false;
        if( h === 'localhost' || h.slice( -10 ) === '.localhost' ) return true;
        if( _isIPv4Host( h ) ) return true;
        if( h.indexOf( ':' ) !== -1 || h.charAt( 0 ) === '[' ) return true; // IPv6
        return false;
    }

    function _canNormalizeHost( host, noNormalize )
    {
        if( noNormalize ) return false;
        if( _isLocalLikeHost( host ) ) return false;
        var labels = (host || '').split( '.' );
        return labels.length > 2 && labels[0] !== 'www';
    }

    mdash.util.buildIconPathCandidates = function( href, relPath, noNormalize )
    {
        try
        {
            if( /^https?:\/\//i.test( relPath ) ) return [ relPath ];
            var u = new URL( href );
            var host = u.hostname || '';
            var out = [];
            var hostWithPort = host + (u.port ? (':' + u.port) : '');
            var base = u.protocol + '//' + hostWithPort + (relPath.startsWith('/')?relPath:'/' + relPath);
            out.push( base );
            if( _canNormalizeHost( host, noNormalize ) )
            {
                var labels = host.split('.');
                if( labels.length > 2 && labels[0] !== 'www' )
                {
                    var root = labels.slice(-2).join('.');
                    var rootWithPort = root + (u.port ? (':' + u.port) : '');
                    out.push( u.protocol + '//' + rootWithPort + (relPath.startsWith('/')?relPath:'/' + relPath) );
                    out.push( u.protocol + '//www.' + rootWithPort + (relPath.startsWith('/')?relPath:'/' + relPath) );
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
            // If subdomain present and not 'www', use registrable root (last two labels),
            // but never normalize localhost/IP hosts.
            if( _canNormalizeHost( host, noNormalize ) )
            {
                host = labels.slice( -2 ).join( '.' );
            }
            var hostWithPort = host + (u.port ? (':' + u.port) : '');
            var canonical = u.protocol + '//' + hostWithPort;
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
        try
        {
            var u = new URL( href );
            if( u.origin && u.origin !== 'null' ) return 'fav:' + u.origin;
            return 'fav:' + (u.protocol + '//' + u.host);
        }
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

    function _evictFaviconCacheFraction( fraction )
    {
        var keys = [];
        var part = (typeof fraction === 'number' && fraction > 0 && fraction <= 1) ? fraction : 0.2;
        try
        {
            for( var i = 0; i < localStorage.length; i++ )
            {
                var k = localStorage.key( i );
                if( k && k.indexOf( 'fav:' ) === 0 ) keys.push( k );
            }
        }
        catch( _e ){ return 0; }

        if( !keys.length ) return 0;

        var toRemove = Math.max( 1, Math.floor( keys.length * part ) );
        for( var j = 0; j < toRemove; j++ )
        {
            localStorage.removeItem( keys[ j ] );
            delete _faviconMemCache[ keys[ j ] ];
        }
        return toRemove;
    }

    function _saveFaviconToLocalStorage( key, data )
    {
        if( !data || data.length < 30 ) return;
        _faviconMemCache[ key ] = data;
        try
        {
            localStorage.setItem( key, data );
        }
        catch( e )
        {
            var isQuota = !!(e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014));
            if( !isQuota ) return;

            var removed = _evictFaviconCacheFraction( 0.2 );
            try { if( window.console && console.debug ) console.debug( '[mdash] favicon cache quota reached; evicted %d entries and retrying.', removed ); } catch( _e ){}

            try
            {
                localStorage.setItem( key, data );
            }
            catch( _e2 )
            {
                try { if( window.console && console.debug ) console.debug( '[mdash] favicon cache write failed after eviction.' ); } catch( _e3 ){}
            }
        }
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

        // 4. Background: load same-origin _favicon, cache if usable, and upgrade visible icon.
        if( _faviconExtId )
        {
            var bgImg = new Image();
            var $visibleImg = $img;
            var cleanupBgImg = function()
            {
                bgImg.onload = null;
                bgImg.onerror = null;
            };
            bgImg.onload = function()
            {
                if( bgImg.naturalWidth < 2 )
                {
                    cleanupBgImg();
                    return;
                }
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
                    if( opaque < area * 0.1 )
                    {
                        cleanupBgImg();
                        return;
                    }
                    if( dark < Math.max( 4, area * 0.01 ) )
                    {
                        cleanupBgImg();
                        return;
                    }
                    var b64 = c.toDataURL( 'image/png' );
                }
                catch( _e )
                {
                    cleanupBgImg();
                    return;
                }
                if( b64 )
                {
                    _saveFaviconToLocalStorage( cacheKey, b64 );
                    var currentSrc = $visibleImg.attr( 'src' ) || '';
                    if( currentSrc !== b64 )
                    {
                        $visibleImg.attr( 'src', b64 );
                    }
                }
                cleanupBgImg();
            };
            bgImg.onerror = cleanupBgImg;
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
        
        _this.$el.toggle( _this.$el.find( 'section' ).length > 0 );
    };
    
    proto.renderSection = function( section )
    {
        var _this    = this,
            $section = $( '<section>' ).attr( 'id', section.id ),
            $h1      = $( '<h1>' ),
            $collapse= $( '<button type="button" class="section-collapse" aria-label="Collapse section" aria-expanded="true" title="Collapse section">▾</button>' ),
            $dot     = $( '<span class="section-color-dot"></span>' );

        if( section.color )
        {
            $dot.css( 'background-color', section.color );
            $section.attr( 'data-section-color', section.color );
        }
        else
        {
            $dot.addClass( 'section-color-dot-empty' );
        }
        var isCollapsed = !!( mdash.sectionState && mdash.sectionState.isCollapsed( section.id ) );
        $h1.append( $collapse, $dot, $( '<span class="section-title-text">' ).text( section.title ) );
        $section.append( $h1 );
        $section.attr( 'data-collapsed', isCollapsed ? 'true' : 'false' );
        if( isCollapsed )
        {
            $section.addClass( 'section-collapsed' );
            $collapse.attr( 'aria-expanded', 'false' ).attr( 'aria-label', 'Expand section' ).attr( 'title', 'Expand section' ).text( '▸' );
        }
        
        section.children.forEach( function( bookmark )
        {
            var $link = _this.renderBookmark( bookmark );
            $section.append( $link );
            mdash.links[ $link.attr( 'href' ) ] = $link;
        } );
        
        var $sortBtn = $( '<button type="button" class="section-sort" aria-label="Sort bookmarks" title="Sort bookmarks" draggable="false">Sort</button>' );
        var $removeSectionBtn = $( '<button type="button" class="section-remove" aria-label="Delete section" title="Delete section" draggable="false">Delete</button>' );
        $section.append( $sortBtn, $removeSectionBtn );
        
        var $addBtn = $( '<a href="#add" class="add" aria-label="Add bookmark" title="Add bookmark" draggable="false"><span>Add</span></a>' );
        $section.append( $addBtn );
        // Prevent default link-drag behaviour so the "+" button is never treated as a draggable item
        $addBtn.on( 'dragstart', function( e ){ e.preventDefault(); } );
        new mdash.AddBtn( $addBtn ).init();
        
        return $section;
    };
    
    proto.renderBookmark = function( bookmark )
    {
        var link = document.createElement( 'a' );
        
        var safeUrl = mdash.util.isSafeUrl( bookmark.url ) ? bookmark.url : 'about:blank';
        link.href = safeUrl;
        var faviconCandidates = mdash.util.getFaviconCandidates( link.href );

        var isVpnMarker = (bookmark.title || '').indexOf('[VPN]') !== -1;
        var titleView = mdash.util.buildTitleView( bookmark.title, false );
        var displayTitle = titleView.full;
        var hasOverride = mdash.util.hasIconOverride( bookmark.title );
        var faviconSrc = bookmark.favicon ? bookmark.favicon : (hasOverride ? '' : faviconCandidates[ 0 ]);

        var $img = $( '<img>' ).attr( { src: faviconSrc, alt: displayTitle, draggable: 'false' } );
        var $el = $( '<a>' ).attr( {
            id: bookmark.id,
            href: link.href,
            title: displayTitle,
            'aria-label': displayTitle,
            'data-title': displayTitle,
            'data-raw-title': bookmark.title,
            draggable: 'false'
        } ).append( $img, $( '<span>' ).text( titleView.tile ) );
        
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
        var valid = { xxs: true, xs: true, small: true, medium: true, large: true, xl: true, xxl: true, xxxl: true };

        var size = valid[sizeFromStorage] ? sizeFromStorage : (function(){
            if( document.body.classList.contains('xxs') ) return 'xxs';
            if( document.body.classList.contains('xs') ) return 'xs';
            if( document.body.classList.contains('small') ) return 'small';
            if( document.body.classList.contains('medium') ) return 'medium';
            if( document.body.classList.contains('large') ) return 'large';
            if( document.body.classList.contains('xl') ) return 'xl';
            if( document.body.classList.contains('xxl') ) return 'xxl';
            if( document.body.classList.contains('xxxl') ) return 'xxxl';
            return 'large';
        })();

        this.applySize( size );
        localStorage.fontSize = size;
        this.select( size );
        
        this.$sizes.on( 'click', this.sizeSelected.bind( this ) );
        if( this.$toggle.length )
        {
            this.$toggle.on( 'click', this.toggleOpen.bind( this ) );
            $( document ).on( 'click', this.closeOnOutsideClick.bind( this ) );
        }
    };

    FontCtrl.prototype.applySize = function( size )
    {
        document.body.classList.remove('xxs','xs','small','medium','large','xl','xxl','xxxl');
        document.body.classList.add( size );
    };
    
    FontCtrl.prototype.select = function( size )
    {
        this.$sizes.removeClass( 'selected' );
        this.$sizes.filter( '[data-size="' + size + '"]' ).addClass( 'selected' );
        if( this.$toggle.length ) this.$toggle.text( size + ' ▾' );
    };
    
    FontCtrl.prototype.sizeSelected = function( e )
    {
        e.preventDefault();
        var $this = $( e.currentTarget );
        
        this.$sizes.removeClass( 'selected' );
        $this.addClass( 'selected' );
        
        var size = $this.attr( 'data-size' );
        this.applySize( size );
        localStorage.fontSize = size;
        if( this.$toggle.length ) this.$toggle.text( size + ' ▾' );
        if( this.$dropdown.length ) this.$dropdown.removeClass( 'open' );
    };

    FontCtrl.prototype.toggleOpen = function(e)
    {
        if( !this.$dropdown.length ) return;
        e.preventDefault();
        e.stopPropagation();
        this.$dropdown.toggleClass('open');
    };

    FontCtrl.prototype.closeOnOutsideClick = function(e)
    {
        if( !this.$dropdown.length ) return;
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
    
    var PALETTE_COLORS = [ '#F44336','#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#03A9F4','#00BCD4','#009688','#4CAF50','#8BC34A','#FFC107','#FF9800','#FF5722','#795548','#607D8B' ];

    var EditCtrl = mdash.EditCtrl = function( $btn, $bookmarks )
    {
        this.$docEl       = $( document.documentElement );
        this.$btn       = $btn;
        this.$bookmarks = $bookmarks;
        this.$addSectionBtn = $( '#add-section-cta' );
        this.api        = chrome.bookmarks;
        this.editMode   = false;
        this.altPressed = false;
        this._altEditWasActive = false;
        this.$activeBookmark = null;
        this.currentEditId = null;
        this._dragging = false;
        this._dragHasTargetHover = false;
        this._dragPlacementActivated = false;
        this._dragStartClientX = null;
        this._dragStartClientY = null;
        this._dragGhostEl = null;
        this._dragPointerDownX = null;
        this._dragPointerDownY = null;
        this._dragSourceRect = null;
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

        // Record pointer-down position for robust drag threshold baseline in Chromium.
        this.$docEl.on( 'mousedown', '#bookmarks a:not(.add,.drop-placeholder)', function( e )
        {
            self._dragPointerDownX = e.clientX;
            self._dragPointerDownY = e.clientY;
        } );

        // Rename section: click on section title while in edit mode
        this.$docEl.on( 'click', '#bookmarks section > h1', function( e )
        {
            if( !self.editMode ) return;
            if( self._sectionJustDragged ) return;
            if( $( e.target ).hasClass( 'section-color-dot' ) ) return;
            if( $( e.target ).hasClass( 'section-collapse' ) ) return;
            e.preventDefault();
            e.stopPropagation();
            self.renameSection( $( this ) );
        } );

        this.$docEl.on( 'click', '#bookmarks .section-collapse', function( e )
        {
            e.preventDefault();
            e.stopPropagation();
            self.toggleSectionCollapsed( $( this ).closest( 'section' ) );
        } );
        
        this.$docEl.on( 'click', '#bookmarks section > .section-remove', function( e )
        {
            if( !self.editMode ) return;
            e.preventDefault();
            e.stopPropagation();
            self.confirmRemoveSection( $( this ).closest( 'section' ) );
        } );

        this.$docEl.on( 'click', '#bookmarks section .section-color-dot', function( e )
        {
            if( !self.editMode ) return;
            e.preventDefault();
            e.stopPropagation();
            self.showColorPalette( $( this ) );
        } );

        this.$docEl.on( 'click', '#bookmarks section > .section-sort', function( e )
        {
            if( !self.editMode ) return;
            e.preventDefault();
            e.stopPropagation();
            self.showSortMenu( $( this ) );
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

    EditCtrl.prototype._reportError = function( title, detail )
    {
        if( window.ui && typeof ui.error === 'function' )
        {
            ui.error( 'Error', detail ? ( title + ': ' + detail ) : title );
        }
    };

    EditCtrl.prototype._hasApiError = function( title )
    {
        var err = ( window.chrome && chrome.runtime ) ? chrome.runtime.lastError : null;
        if( !err ) return false;
        this._reportError( title, err.message || '' );
        return true;
    };

    EditCtrl.prototype._cleanupTileDrag = function()
    {
        this._dragging = false;
        this._dragSourceId = null;
        this._dragLastPlacement = null;
        this._dragHasTargetHover = false;
        this._dragPlacementActivated = false;
        this._dragStartClientX = null;
        this._dragStartClientY = null;
        if( this._dragGhostEl && this._dragGhostEl.parentNode )
        {
            this._dragGhostEl.parentNode.removeChild( this._dragGhostEl );
        }
        this._dragGhostEl = null;
        this._dragPointerDownX = null;
        this._dragPointerDownY = null;
        this._dragSourceRect = null;
        this.$bookmarks.find( 'a.dragging' )
            .removeClass( 'dragging' )
            .css( { left: '', top: '', width: '', height: '' } );
        this.$bookmarks.find( 'a.drop-hover-target' ).removeClass( 'drop-hover-target' );
        if( this.$placeholder ) this.$placeholder.removeClass( 'collapsed source-gap' ).detach();
        this.$bookmarks.find( 'section' ).removeClass( 'drop-target' );
    };

    EditCtrl.prototype._canRepositionOnDragOver = function( e )
    {
        if( this._dragPlacementActivated ) return true;
        if( !e || !e.originalEvent ) return false;
        var cx = e.originalEvent.clientX;
        var cy = e.originalEvent.clientY;
        // Ignore synthetic/invalid coordinates that appear in some dragenter paths.
        if( ( cx === 0 && cy === 0 ) || !isFinite( cx ) || !isFinite( cy ) ) return false;
        if( this._dragSourceRect )
        {
            var r = this._dragSourceRect;
            if( cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom )
            {
                return false;
            }
        }
        if( typeof this._dragStartClientX !== 'number' || typeof this._dragStartClientY !== 'number' )
        {
            // Some Chromium drag paths don't provide reliable dragstart coordinates.
            // Seed baseline from first dragover and wait for the next movement event.
            this._dragStartClientX = cx;
            this._dragStartClientY = cy;
            return false;
        }
        // Prevent immediate jump on pickup; wait for an intentional pointer move.
        if( Math.abs( cx - this._dragStartClientX ) < 4 && Math.abs( cy - this._dragStartClientY ) < 4 )
        {
            return false;
        }
        this._dragPlacementActivated = true;
        return true;
    };

    EditCtrl.prototype._positionPlaceholderForTargetTile = function( $targetTile, e )
    {
        if( !$targetTile || !$targetTile.length ) return;
        if( !this.$placeholder || !this.$placeholder.length ) return;

        var $targetSection = $targetTile.closest( 'section' );
        var placeAfter = false;
        var $src = this._dragSourceId ? $( document.getElementById( this._dragSourceId ) ) : $();
        if( $src.length && $targetSection.length )
        {
            var $srcSection = $src.closest( 'section' );
            if( $srcSection.length && $srcSection[ 0 ] === $targetSection[ 0 ] )
            {
                var $items = $targetSection.children( 'a' ).not( '.add,.drop-placeholder' );
                var srcIdx = $items.index( $src );
                var tgtIdx = $items.index( $targetTile );
                if( srcIdx !== -1 && tgtIdx !== -1 )
                {
                    // Same-section move: dragging right means insert after hovered tile.
                    placeAfter = tgtIdx > srcIdx;
                }
                else if( $src[ 0 ] && $targetTile[ 0 ] && $src[ 0 ] !== $targetTile[ 0 ] )
                {
                    var rel = $src[ 0 ].compareDocumentPosition( $targetTile[ 0 ] );
                    if( rel & Node.DOCUMENT_POSITION_FOLLOWING ) placeAfter = true;
                    else if( rel & Node.DOCUMENT_POSITION_PRECEDING ) placeAfter = false;
                }
            }
        }
        var targetId = $targetTile.attr( 'id' ) || '';
        var placementKey = ( placeAfter ? 'after:' : 'before:' ) + targetId;
        if( this._dragLastPlacement === placementKey ) return;

        this.$bookmarks.find( 'a.drop-hover-target' ).removeClass( 'drop-hover-target' );
        $targetTile.addClass( 'drop-hover-target' );
        if( placeAfter ) $targetTile.after( this.$placeholder );
        else $targetTile.before( this.$placeholder );
        // Keep placeholder as logic marker; target tile gets the visible hover state.
        this.$placeholder.addClass( 'collapsed' ).removeClass( 'source-gap' );
        $targetSection.addClass( 'drop-target' );
        this._dragLastPlacement = placementKey;
    };

    EditCtrl.prototype._positionPlaceholderAfterTile = function( $targetTile )
    {
        if( !$targetTile || !$targetTile.length ) return;
        if( !this.$placeholder || !this.$placeholder.length ) return;
        var targetId = $targetTile.attr( 'id' ) || '';
        var placementKey = 'after:' + targetId;
        if( this._dragLastPlacement === placementKey ) return;
        var $targetSection = $targetTile.closest( 'section' );
        $targetTile.after( this.$placeholder );
        this.$placeholder.removeClass( 'collapsed source-gap' );
        $targetSection.addClass( 'drop-target' );
        this._dragLastPlacement = placementKey;
    };

    EditCtrl.prototype._bindTileDnD = function( $tiles )
    {
        var self = this;
        if( !$tiles || !$tiles.length ) return;
        if( !this.$placeholder || !this.$placeholder.length )
        {
            this.$placeholder = $( '<a class="drop-placeholder" aria-hidden="true"></a>' );
        }

        $tiles.each( function()
        {
            var $tile = $( this );
            if( $tile.hasClass( 'add' ) || $tile.hasClass( 'drop-placeholder' ) ) return;

            $tile.attr( 'draggable', true )
                .off( 'dragstart.mdash dragend.mdash dragenter.mdash dragover.mdash' )
                .on( 'dragstart.mdash', function( e )
                {
                    self._dragging = true;
                    self._handledDrop = false;
                    self._dragLastPlacement = null;
                    self._dragHasTargetHover = false;
                    self._dragPlacementActivated = false;
                    var id = $( this ).attr( 'id' );
                    self._dragSourceId = id || null;
                    var _rect = this.getBoundingClientRect();
                    self._dragSourceRect = {
                        left: _rect.left,
                        right: _rect.right,
                        top: _rect.top,
                        bottom: _rect.bottom
                    };
                    self._dragStartClientX = ( typeof self._dragPointerDownX === 'number' )
                        ? self._dragPointerDownX
                        : ( e.originalEvent ? e.originalEvent.clientX : null );
                    self._dragStartClientY = ( typeof self._dragPointerDownY === 'number' )
                        ? self._dragPointerDownY
                        : ( e.originalEvent ? e.originalEvent.clientY : null );
                    var dt = e.originalEvent.dataTransfer;
                    try { dt.setData( 'application/x-mdash-bookmark-id', id ); } catch( _e ) {}
                    try { dt.setData( 'text/plain', '' ); } catch( _e ) {}
                    dt.effectAllowed = 'move';
                    if( self._dragGhostEl && self._dragGhostEl.parentNode )
                    {
                        self._dragGhostEl.parentNode.removeChild( self._dragGhostEl );
                    }
                    self._dragGhostEl = null;
                    try
                    {
                        if( dt.setDragImage )
                        {
                            var pointerX = ( typeof self._dragPointerDownX === 'number' ) ? self._dragPointerDownX : ( _rect.left + this.offsetWidth / 2 );
                            var pointerY = ( typeof self._dragPointerDownY === 'number' ) ? self._dragPointerDownY : ( _rect.top + this.offsetHeight / 2 );
                            var hotX = Math.max( 0, Math.min( this.offsetWidth - 1, Math.round( pointerX - _rect.left ) ) );
                            var hotY = Math.max( 0, Math.min( this.offsetHeight - 1, Math.round( pointerY - _rect.top ) ) );
                            dt.setDragImage( this, hotX, hotY );
                        }
                    }
                    catch( _e ) {}

                    var el = this;
                    requestAnimationFrame( function()
                    {
                        $( el ).addClass( 'dragging' );
                    } );

                } )
                .on( 'dragend.mdash', function()
                {
                    self._cleanupTileDrag();
                } )
                .on( 'dragenter.mdash', function( e )
                {
                    if( self._sectionDragging ) return;
                    e.preventDefault();
                    e.stopPropagation();
                } )
                .on( 'dragover.mdash', function( e )
                {
                    if( self._sectionDragging ) return;
                    e.preventDefault();
                    e.stopPropagation();
                    var $t = $( this );
                    if( self._dragSourceId && this.id === self._dragSourceId ) return;
                    if( !self._canRepositionOnDragOver( e ) ) return;
                    self._dragHasTargetHover = true;
                    self._positionPlaceholderForTargetTile( $t, e );
                } );
        } );
    };
    
    EditCtrl.prototype.enableDragAndDrop = function()
    {
        var self = this;
        var $tiles = this.$bookmarks.find( 'a' ).not( '.add' );
        // Visual placeholder for insertion point
        this.$placeholder = $('<a class="drop-placeholder" aria-hidden="true"></a>');
        this._bindTileDnD( $tiles );

        var $sections = this.$bookmarks.find( 'section' );
        $sections
            .on( 'dragover.mdash', function( e )
            {
                if( self._sectionDragging ) return;
                e.preventDefault();
                e.stopPropagation();
                var $section = $( this );
                var clientX = e.originalEvent.clientX, clientY = e.originalEvent.clientY;
                var elAtPoint = document.elementFromPoint( clientX, clientY );
                var $tileAtPoint = elAtPoint ? $( elAtPoint ).closest( 'a' ).not( '.add,.drop-placeholder,.dragging' ) : $();

                if( $tileAtPoint.length && $tileAtPoint.closest( 'section' )[0] === $section[0] )
                {
                    if( !( self._dragSourceId && $tileAtPoint.attr( 'id' ) === self._dragSourceId ) )
                    {
                        if( !self._canRepositionOnDragOver( e ) ) return;
                        self._dragHasTargetHover = true;
                        self._positionPlaceholderForTargetTile( $tileAtPoint, e );
                    }
                    return;
                }

                var $tilesInside = $section.children( 'a' ).not( '.add,.drop-placeholder,.dragging' );
                if( !$tilesInside.length )
                {
                    if( !self._canRepositionOnDragOver( e ) ) return;
                    self.$bookmarks.find( 'a.drop-hover-target' ).removeClass( 'drop-hover-target' );
                    var $add = $section.find( 'a.add' );
                    if( $add.length ) $add.before( self.$placeholder ); else $section.append( self.$placeholder );
                    self.$placeholder.removeClass( 'collapsed source-gap' );
                    self._dragLastPlacement = null;
                    $section.addClass( 'drop-target' );
                    return;
                }
                $section.addClass( 'drop-target' );
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
                    if( el.id === id || el.classList.contains( 'dragging' ) ) continue;
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
                        if( index === undoIndex )
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
                    $tileImmediate.removeClass( 'dragging' ).css( { left: '', top: '', width: '', height: '' } );
                }

                // Chrome bookmark move index for same-parent forward moves behaves as
                // "current-list index", so adjust by +1 when moving right.
                var apiIndex = index;
                if( undoParentId && undoParentId === targetSectionId && index > undoIndex )
                {
                    apiIndex = index + 1;
                }

                self.api.move( id, { parentId: targetSectionId, index: apiIndex }, function()
                {
                    if( self._hasApiError( 'Could not move bookmark' ) )
                    {
                        self._cleanupTileDrag();
                        var $tileRollback = $( document.getElementById( id ) );
                        var $origSectionRollback = $( '#' + undoParentId );
                        if( $tileRollback.length && $origSectionRollback.length )
                        {
                            var $origTilesRollback = $origSectionRollback.children( 'a' ).not( '.add' );
                            var $origAddRollback = $origSectionRollback.find( 'a.add' );
                            if( undoIndex < $origTilesRollback.length ) $origTilesRollback.eq( undoIndex ).before( $tileRollback );
                            else $origAddRollback.before( $tileRollback );
                        }
                        return;
                    }
                    self._cleanupTileDrag();
                    mdash._undoNotify( 'Moved', 'Bookmark moved.', function()
                    {
                        self.api.move( id, { parentId: undoParentId, index: undoIndex }, function()
                        {
                            if( self._hasApiError( 'Could not undo bookmark move' ) ) return;
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
            e.stopPropagation();
            var clientX = e.originalEvent.clientX, clientY = e.originalEvent.clientY;
            var el = document.elementFromPoint( clientX, clientY );
            if( !el ) return;
            var $tileAtPoint = $( el ).closest( 'a' ).not( '.add,.drop-placeholder,.dragging' );
            if( $tileAtPoint.length )
            {
                if( !( self._dragSourceId && $tileAtPoint.attr( 'id' ) === self._dragSourceId ) )
                {
                    if( !self._canRepositionOnDragOver( e ) ) return;
                    self._dragHasTargetHover = true;
                    self._positionPlaceholderForTargetTile( $tileAtPoint, e );
                }
                return;
            }
            var $section = $( el ).closest( 'section' );
            if( !$section.length ) return;

            var $tilesInside = $section.children( 'a' ).not( '.add,.drop-placeholder,.dragging' );
            if( $tilesInside.length === 0 )
            {
                if( !self._canRepositionOnDragOver( e ) ) return;
                self.$bookmarks.find( 'a.drop-hover-target' ).removeClass( 'drop-hover-target' );
                var $add = $section.find( 'a.add' );
                if( $add.length ) $add.before( self.$placeholder ); else $section.append( self.$placeholder );
                self.$placeholder.removeClass( 'collapsed source-gap' );
                self._dragLastPlacement = null;
                $section.addClass( 'drop-target' );
                return;
            }
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
                if( el.id === id || el.classList.contains( 'dragging' ) ) continue;
                index++;
            }

            var targetSectionId = $section.attr( 'id' );
            if( undoParentId2 && undoParentId2 === targetSectionId && index === undoIndex2 )
            {
                if( self.$placeholder ) self.$placeholder.detach();
                return;
            }
            var $tileImmediate2 = $( document.getElementById( id ) );
            if( $tileImmediate2.length )
            {
                self.$placeholder.replaceWith( $tileImmediate2 );
                $tileImmediate2.removeClass( 'dragging' ).css( { left: '', top: '', width: '', height: '' } );
            }

            var apiIndex2 = index;
            if( undoParentId2 && undoParentId2 === targetSectionId && index > undoIndex2 )
            {
                apiIndex2 = index + 1;
            }

            self.api.move( id, { parentId: targetSectionId, index: apiIndex2 }, function()
            {
                if( self._hasApiError( 'Could not move bookmark' ) )
                {
                    self._cleanupTileDrag();
                    var $rollbackTile = $( document.getElementById( id ) );
                    var $rollbackSection = $( '#' + undoParentId2 );
                    if( $rollbackTile.length && $rollbackSection.length )
                    {
                        var $rollbackTiles = $rollbackSection.children( 'a' ).not( '.add' );
                        var $rollbackAdd = $rollbackSection.find( 'a.add' );
                        if( undoIndex2 < $rollbackTiles.length ) $rollbackTiles.eq( undoIndex2 ).before( $rollbackTile );
                        else $rollbackAdd.before( $rollbackTile );
                    }
                    return;
                }
                self._cleanupTileDrag();
                mdash._undoNotify( 'Moved', 'Bookmark moved.', function()
                {
                    self.api.move( id, { parentId: undoParentId2, index: undoIndex2 }, function()
                    {
                        if( self._hasApiError( 'Could not undo bookmark move' ) ) return;
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
        $tiles.attr( 'draggable', 'false' ).off( '.mdash' )
            .removeClass( 'dragging' )
            .css( { left: '', top: '', width: '', height: '' } );
        this.$bookmarks.find( 'section' ).off( '.mdash' ).removeClass( 'drop-target' );
        this.$bookmarks.off( '.mdash' );
        this._cleanupTileDrag();
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
            var $dragH1 = $draggedSection.children( 'h1' );
            var $dragTitleSpan = $dragH1.find( '.section-title-text' );
            var currentTitle = $dragTitleSpan.length ? $dragTitleSpan.text() : $dragH1.text();
            var sectionColor = $draggedSection.attr( 'data-section-color' ) || '';
            var colorSuffix = sectionColor ? ' ' + sectionColor : '';
            var sourceColClass = isSourceLeft ? '.left' : '.right';

            var $prevSibling = $draggedSection.prev( 'section' );
            var hadPrevSibling = $prevSibling.length > 0;
            var prevSiblingId = hadPrevSibling ? $prevSibling.attr( 'id' ) : null;

            var oldSectionIds = [];
            self.$bookmarks.children( '.left' ).children( 'section' ).each( function(){ oldSectionIds.push( this.id ); } );
            self.$bookmarks.children( '.right' ).children( 'section' ).each( function(){ oldSectionIds.push( this.id ); } );
            var oldIndex = oldSectionIds.indexOf( sectionId ) + 1;

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
            
            var folderId = ( mdash.dashboard && mdash.dashboard.manager ) ? mdash.dashboard.manager.folder.id : null;

            var allSectionIds = [];
            self.$bookmarks.children( '.left' ).children( 'section' ).each( function(){ allSectionIds.push( this.id ); } );
            self.$bookmarks.children( '.right' ).children( 'section' ).each( function(){ allSectionIds.push( this.id ); } );
            var newIndex = allSectionIds.indexOf( sectionId ) + 1;

            var rollbackSectionDom = function()
            {
                var $sec = $( document.getElementById( sectionId ) );
                var $origCol = self.$bookmarks.children( sourceColClass );
                if( !$sec.length || !$origCol.length ) return;
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
            };

            var finishMove = function()
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
                    self.api.update( sectionId, { title: oldPrefix + currentTitle + colorSuffix }, function()
                    {
                        if( self._hasApiError( 'Could not undo section move' ) ) return;
                        if( folderId && oldIndex >= 0 )
                        {
                            self.api.move( sectionId, { parentId: folderId, index: oldIndex }, function()
                            {
                                if( self._hasApiError( 'Could not restore section order' ) ) return;
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
                        }
                        else
                        {
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
                        }
                    } );
                } );
            };

            self.api.update( sectionId, { title: newPrefix + currentTitle + colorSuffix }, function()
            {
                if( self._hasApiError( 'Could not move section' ) )
                {
                    rollbackSectionDom();
                    return;
                }
                if( folderId && newIndex >= 1 )
                {
                    self.api.move( sectionId, { parentId: folderId, index: newIndex }, function()
                    {
                        if( self._hasApiError( 'Could not update section order' ) )
                        {
                            rollbackSectionDom();
                            return;
                        }
                        finishMove();
                    } );
                }
                else
                {
                    finishMove();
                }
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
            var $titleSpan = $a.find( 'span' ).first();
            var raw = $a.attr( 'data-raw-title' ) || ( $titleSpan.text() || '' );
            var titleView = mdash.util.buildTitleView( raw, self.editMode );
            if( $titleSpan.length ) $titleSpan.text( titleView.tile );
            $a.attr( 'title', titleView.full );
            $a.attr( 'aria-label', titleView.full );
            $a.attr( 'data-title', titleView.full );
            $a.data( 'title', titleView.full );
            var $img = $a.find( 'img' );
            if( $img && $img.length )
            {
                try { $img.attr( 'alt', titleView.full ); } catch( _e ) {}
            }
        } );
    };

    EditCtrl.prototype.toggleSectionCollapsed = function( $section, forceCollapsed )
    {
        if( !$section || !$section.length ) return;
        var sectionId = $section.attr( 'id' );
        if( !sectionId ) return;

        var collapsed = ( typeof forceCollapsed === 'boolean' )
            ? forceCollapsed
            : !$section.hasClass( 'section-collapsed' );

        $section.toggleClass( 'section-collapsed', collapsed )
                .attr( 'data-collapsed', collapsed ? 'true' : 'false' );

        var $btn = $section.find( '> h1 .section-collapse' );
        if( $btn.length )
        {
            $btn.attr( 'aria-expanded', collapsed ? 'false' : 'true' )
                .attr( 'aria-label', collapsed ? 'Expand section' : 'Collapse section' )
                .attr( 'title', collapsed ? 'Expand section' : 'Collapse section' )
                .text( collapsed ? '▸' : '▾' );
        }

        if( mdash.sectionState )
        {
            mdash.sectionState.setCollapsed( sectionId, collapsed );
        }
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
        
        var selectedColor = '';
        var $colorLabel = $( '<div class="ui-color-label">Color (optional)</div>' );
        var $colorRow = $( '<div class="ui-color-swatches">' );
        
        PALETTE_COLORS.forEach( function( c )
        {
            var $s = $( '<button type="button" class="color-swatch-sm">' ).css( 'background-color', c ).attr( 'data-color', c );
            $s.on( 'click', function( e )
            {
                e.preventDefault();
                $colorRow.find( '.color-swatch-sm' ).removeClass( 'active' );
                if( selectedColor === c ) { selectedColor = ''; }
                else { $( this ).addClass( 'active' ); selectedColor = c; }
            } );
            $colorRow.append( $s );
        } );
        
        $form.append( $name, $side, $colorLabel, $colorRow );
        
        var modal = ui.confirm( 'Create new section', $form );
        modal.el.addClass( 'dialog-form-wide' );
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
            
            self.addSection( title, side, selectedColor || null, function( added )
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
    
    EditCtrl.prototype.addSection = function( title, side, color, callback )
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
        var colorSuffix = color ? ' ' + color : '';
        
        this.api.create( {
            parentId : manager.folder.id,
            title    : prefix + title + colorSuffix
        }, function( created )
        {
            if( self._hasApiError( 'Could not create section' ) )
            {
                callback && callback( false );
                return;
            }
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
                color    : color || null,
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
                    if( self._hasApiError( 'Could not undo section creation' ) ) return;
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
            if( self._hasApiError( 'Could not read section before delete' ) )
            {
                callback && callback( false );
                return;
            }
            var savedTree = ( tree && tree[0] ) ? tree[0] : null;

            self.api.removeTree( sectionId, function()
            {
                if( self._hasApiError( 'Could not remove section' ) )
                {
                    callback && callback( false );
                    return;
                }
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
                        if( self._hasApiError( 'Could not undo section delete' ) ) return;
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
                                    self.api.create( { parentId: newParentId, title: child.title, url: child.url }, function()
                                    {
                                        if( self._hasApiError( 'Could not restore bookmark in section undo' ) ) { next(); return; }
                                        next();
                                    } );
                                }
                                else
                                {
                                    self.api.create( { parentId: newParentId, title: child.title }, function( sub )
                                    {
                                        if( self._hasApiError( 'Could not restore subfolder in section undo' ) ) { next(); return; }
                                        if( sub && child.children ) restoreChildren( child.children, sub.id, next );
                                        else next();
                                    } );
                                }
                            } )();
                        }

                        restoreChildren( savedTree.children, folder.id, function()
                        {
                            var displayTitle = savedTree.title.replace( /^[+\-]/, '' );
                            var _restoredColor = null;
                            var _cm = displayTitle.match( /\s+#([0-9A-Fa-f]{6})$/ );
                            if( _cm )
                            {
                                _restoredColor = '#' + _cm[ 1 ];
                                displayTitle = displayTitle.substring( 0, displayTitle.length - _cm[ 0 ].length );
                            }
                            var side = savedTree.title.charAt(0) === '-' ? 'right' : 'left';
                            var $targetCol = self.$bookmarks.children( side === 'right' ? '.right' : '.left' );

                            var $newSection = mdash.Column.prototype.renderSection( {
                                id       : folder.id,
                                title    : displayTitle,
                                side     : side,
                                color    : _restoredColor,
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
            
            // Close settings panel if open
            var $docRoot = $( document.documentElement );
            if( $docRoot.hasClass( 'settings-open' ) )
            {
                $docRoot.removeClass( 'settings-open' );
                $( '#settings-toggle' ).attr( 'aria-expanded', 'false' );
                $( '#settings-panel' ).attr( 'aria-hidden', 'true' );
                $( '#settings-backdrop' ).attr( 'aria-hidden', 'true' );
            }
            
            if( self.editMode )
            {
                self.editMode = false;
                self.$docEl.removeClass( 'edit' );
                self.$btn.text( 'off' ).attr( 'aria-pressed', 'false' );

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
                self.$btn.text( 'on' ).attr( 'aria-pressed', 'true' );

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
                // Track previous mode so releasing Alt restores state correctly.
                if( self.altPressed ) return;
                self.altPressed = true;
                self._altEditWasActive = self.editMode;
                if( !self._altEditWasActive )
                {
                    self.$docEl.addClass( 'edit' );
                    self.editMode = true;
                    // Show raw titles when Alt-edit is active
                    self.applyDisplayTitlesBasedOnMode();
                }
            }
            else if( self.editMode && (e.key === 'Escape' || e.keyCode === 27) )
            {
                // When a modal is open, let dialog-level ESC handler close it first.
                if( $( '#dialog' ).is( ':visible' ) ) return;
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
                if( !self.altPressed ) return;
                self.altPressed = false;
                if( !self._altEditWasActive )
                {
                    self.$docEl.removeClass( 'edit' );
                    self.editMode = false;
                    // Return to stripped titles
                    self.applyDisplayTitlesBasedOnMode();
                }
                self._altEditWasActive = false;
            }
        } );
    };

    EditCtrl.prototype.renameSection = function( $h1 )
    {
        var $titleText = $h1.find( '.section-title-text' );
        if( !$titleText.length ) $titleText = $h1;
        if( $titleText.attr( 'contenteditable' ) === 'true' ) return;
        
        var self = this;
        var $section = $h1.closest( 'section' );
        var id = $section.attr( 'id' );
        var original = $titleText.text();
        var isLeft = $section.closest( '.left' ).length > 0;
        var prefix = isLeft ? '+' : '-';
        var sectionColor = $section.attr( 'data-section-color' ) || '';
        var colorSuffix = sectionColor ? ' ' + sectionColor : '';
        var done = false;
        
        $titleText.attr( 'contenteditable', 'true' );
        $h1.attr( 'draggable', 'false' )
           .addClass( 'section-renaming' );
        
        $titleText.focus();
        var range = document.createRange();
        range.selectNodeContents( $titleText[0] );
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange( range );
        
        function finish( save )
        {
            if( done ) return;
            done = true;
            
            $titleText.removeAttr( 'contenteditable' );
            $h1.removeClass( 'section-renaming' );
            
            if( self.editMode )
            {
                $h1.attr( 'draggable', 'true' );
            }
            
            $titleText.off( '.mdash-rename' );
            $h1.off( '.mdash-rename' );
            
            if( !save )
            {
                $titleText.text( original );
                return;
            }
            
            var title = ( $titleText.text() || '' ).trim();
            if( !title )
            {
                $titleText.text( original );
                return;
            }
            
            var oldFullTitle = prefix + original + colorSuffix;
            self.api.update( id, { title: prefix + title + colorSuffix }, function()
            {
                if( self._hasApiError( 'Could not rename section' ) )
                {
                    $titleText.text( original );
                    return;
                }
                $titleText.text( title );
                if( mdash.dashboard && mdash.dashboard.manager )
                {
                    mdash.dashboard.manager.folder.children = null;
                }
                mdash._undoNotify( 'Section renamed', 'Updated to \'' + title + '\'.', function()
                {
                    self.api.update( id, { title: oldFullTitle }, function()
                    {
                        if( self._hasApiError( 'Could not undo section rename' ) ) return;
                        $titleText.text( original );
                        if( mdash.dashboard && mdash.dashboard.manager )
                        {
                            mdash.dashboard.manager.folder.children = null;
                        }
                    } );
                } );
            } );
        }
        
        $titleText.on( 'keydown.mdash-rename', function( e )
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
        
        $titleText.on( 'blur.mdash-rename', function(){ finish( true ); } );
        
        $titleText.on( 'paste.mdash-rename', function( e )
        {
            e.preventDefault();
            var text = ( e.originalEvent.clipboardData || window.clipboardData ).getData( 'text/plain' );
            document.execCommand( 'insertText', false, text );
        } );
    };
    
    EditCtrl.prototype.showColorPalette = function( $dot )
    {
        $( '.section-color-palette' ).remove();
        $( document ).off( 'click.mdash-palette' );
        
        var self = this;
        var $h1 = $dot.closest( 'h1' );
        var $section = $dot.closest( 'section' );
        var sectionId = $section.attr( 'id' );
        var isLeft = $section.closest( '.left' ).length > 0;
        var prefix = isLeft ? '+' : '-';
        var $titleSpan = $h1.find( '.section-title-text' );
        var sectionTitle = $titleSpan.length ? $titleSpan.text() : $h1.text();
        var oldColor = $section.attr( 'data-section-color' ) || '';
        
        var $palette = $( '<div class="section-color-palette">' );
        
        PALETTE_COLORS.forEach( function( color )
        {
            var $swatch = $( '<button type="button" class="color-swatch"></button>' )
                .css( 'background-color', color )
                .attr( 'data-color', color );
            if( color === oldColor ) $swatch.addClass( 'active' );
            $palette.append( $swatch );
        } );
        
        var $none = $( '<button type="button" class="color-swatch color-swatch-none" title="Remove color">\u00d7</button>' );
        if( !oldColor ) $none.addClass( 'active' );
        $palette.append( $none );
        
        $h1.append( $palette );
        
        $palette.on( 'click', '.color-swatch', function( e )
        {
            e.preventDefault();
            e.stopPropagation();
            
            var newColor = $( this ).attr( 'data-color' ) || '';
            var colorSuffix = newColor ? ' ' + newColor : '';
            var newFullTitle = prefix + sectionTitle + colorSuffix;
            var oldFullTitle = prefix + sectionTitle + ( oldColor ? ' ' + oldColor : '' );
            
            self.api.update( sectionId, { title: newFullTitle }, function()
            {
                if( self._hasApiError( 'Could not update section color' ) ) return;
                if( newColor )
                {
                    $dot.css( 'background-color', newColor ).removeClass( 'section-color-dot-empty' );
                    $section.attr( 'data-section-color', newColor );
                }
                else
                {
                    $dot.css( 'background-color', '' ).addClass( 'section-color-dot-empty' );
                    $section.removeAttr( 'data-section-color' );
                }
                
                if( mdash.dashboard && mdash.dashboard.manager )
                {
                    mdash.dashboard.manager.folder.children = null;
                }
                
                $palette.remove();
                $( document ).off( 'click.mdash-palette' );
                
                mdash._undoNotify( 'Color changed', 'Section color updated.', function()
                {
                    self.api.update( sectionId, { title: oldFullTitle }, function()
                    {
                        if( self._hasApiError( 'Could not undo section color change' ) ) return;
                        if( oldColor )
                        {
                            $dot.css( 'background-color', oldColor ).removeClass( 'section-color-dot-empty' );
                            $section.attr( 'data-section-color', oldColor );
                        }
                        else
                        {
                            $dot.css( 'background-color', '' ).addClass( 'section-color-dot-empty' );
                            $section.removeAttr( 'data-section-color' );
                        }
                        if( mdash.dashboard && mdash.dashboard.manager )
                        {
                            mdash.dashboard.manager.folder.children = null;
                        }
                    } );
                } );
            } );
        } );
        
        setTimeout( function()
        {
            $( document ).on( 'click.mdash-palette', function( ev )
            {
                if( !$( ev.target ).closest( '.section-color-palette' ).length )
                {
                    $palette.remove();
                    $( document ).off( 'click.mdash-palette' );
                }
            } );
        }, 10 );
    };
    
    EditCtrl.prototype.showSortMenu = function( $btn )
    {
        $( '.section-sort-menu' ).remove();
        $( document ).off( 'click.mdash-sortmenu' );
        
        var self = this;
        var $section = $btn.closest( 'section' );
        
        var $menu = $( '<div class="section-sort-menu">' );
        var $asc = $( '<button type="button" class="sort-menu-option" data-dir="asc">A \u2192 Z</button>' );
        var $desc = $( '<button type="button" class="sort-menu-option" data-dir="desc">Z \u2192 A</button>' );
        $menu.append( $asc, $desc );
        
        $btn.after( $menu );
        
        $menu.on( 'click', '.sort-menu-option', function( e )
        {
            e.preventDefault();
            e.stopPropagation();
            var dir = $( this ).attr( 'data-dir' );
            $menu.remove();
            $( document ).off( 'click.mdash-sortmenu' );
            self.sortSection( $section, dir === 'asc' );
        } );
        
        setTimeout( function()
        {
            $( document ).on( 'click.mdash-sortmenu', function( ev )
            {
                if( !$( ev.target ).closest( '.section-sort-menu' ).length )
                {
                    $menu.remove();
                    $( document ).off( 'click.mdash-sortmenu' );
                }
            } );
        }, 10 );
    };
    
    EditCtrl.prototype.sortSection = function( $section, ascending )
    {
        var self = this;
        var sectionId = $section.attr( 'id' );
        var $tiles = $section.children( 'a' ).not( '.add,.drop-placeholder' );
        if( $tiles.length < 2 ) return;
        
        var originalIds = [];
        $tiles.each( function(){ originalIds.push( this.id ); } );
        
        var sortedTiles = $tiles.toArray().sort( function( a, b )
        {
            var rawA = $( a ).attr( 'data-raw-title' ) || ( $( a ).find( 'span' ).first().text() || '' );
            var rawB = $( b ).attr( 'data-raw-title' ) || ( $( b ).find( 'span' ).first().text() || '' );
            var titleA = mdash.util.buildTitleView( rawA, self.editMode ).full.toLowerCase();
            var titleB = mdash.util.buildTitleView( rawB, self.editMode ).full.toLowerCase();
            return ascending ? titleA.localeCompare( titleB ) : titleB.localeCompare( titleA );
        } );
        
        var $add = $section.find( 'a.add' );
        sortedTiles.forEach( function( el ){ $add.before( el ); } );
        
        var sortedIds = sortedTiles.map( function( el ){ return el.id; } );
        var moveIdx = 0;
        ( function moveNext()
        {
            if( moveIdx >= sortedIds.length )
            {
                mdash._undoNotify( 'Sorted', 'Bookmarks sorted ' + ( ascending ? 'A\u2192Z' : 'Z\u2192A' ) + '.', function()
                {
                    var restoreIdx = 0;
                    ( function restoreNext()
                    {
                        if( restoreIdx >= originalIds.length )
                        {
                            originalIds.forEach( function( oid )
                            {
                                var $el = $( document.getElementById( oid ) );
                                $add.before( $el );
                            } );
                            return;
                        }
                        self.api.move( originalIds[ restoreIdx ], { parentId: sectionId, index: restoreIdx }, function()
                        {
                            if( self._hasApiError( 'Could not undo section sort' ) ) return;
                            restoreIdx++;
                            restoreNext();
                        } );
                    } )();
                } );
                return;
            }
            self.api.move( sortedIds[ moveIdx ], { parentId: sectionId, index: moveIdx }, function()
            {
                if( self._hasApiError( 'Could not sort section bookmarks' ) ) return;
                moveIdx++;
                moveNext();
            } );
        } )();
    };

    EditCtrl.prototype.edit = function( $b )
    {
        var $form, $title, $url, $section, $dupBtn, $rmBtn, dialog,
            self  = this,
            id    = $b.attr( 'id' ),
            title = $b.find( 'span' ).first().text(),
            rawTitle = $b.attr( 'data-raw-title' ) || title,
            sections = mdash.dashboard.manager.folder.children,
            sectionId = +$b.closest( 'section' ).attr( 'id' );
        
        $form  = $( '<div class="ui-edit-form">' );
        $title = $( '<input autofocus id="title" type="text"/>' ).val( rawTitle ).focus();
        $url   = $( '<input id="url" type="text"/>' ).val( $b.attr( 'href' ) );

        $section = $( '<select id="section" class="ui-hidden-select" aria-hidden="true" tabindex="-1">' );
        sections.forEach( function( section )
        {
            $( '<option>' ).val( section.id ).text( section.title ).appendTo( $section );
        } );
        $section.val( sectionId );

        var $sectionField = $( '<div class="ui-custom-select">' );
        var $sectionTrigger = $( '<button type="button" class="ui-custom-select-trigger" aria-haspopup="listbox" aria-expanded="false"></button>' );
        var $sectionLabel = $( '<span class="ui-custom-select-label"></span>' );
        var $sectionCaret = $( '<span class="ui-custom-select-caret" aria-hidden="true">v</span>' );
        var $sectionMenu = $( '<div class="ui-custom-select-menu" role="listbox"></div>' );

        var closeSectionMenu = function()
        {
            $sectionField.removeClass( 'open' );
            $sectionTrigger.attr( 'aria-expanded', 'false' );
        };

        var openSectionMenu = function()
        {
            $sectionField.addClass( 'open' );
            $sectionTrigger.attr( 'aria-expanded', 'true' );
        };

        var setSectionSelection = function( value, label )
        {
            $section.val( value );
            $sectionLabel.text( label || '' );
            $sectionMenu.find( '.ui-custom-select-option' ).removeClass( 'selected' ).attr( 'aria-selected', 'false' );
            $sectionMenu.find( '.ui-custom-select-option[data-value="' + value + '"]' ).addClass( 'selected' ).attr( 'aria-selected', 'true' );
        };

        $sectionTrigger.append( $sectionLabel, $sectionCaret );
        $sectionField.append( $sectionTrigger, $sectionMenu );

        sections.forEach( function( section )
        {
            var selected = ('' + section.id) === ('' + sectionId);
            var $option = $( '<button type="button" class="ui-custom-select-option" role="option"></button>' )
                .attr( 'data-value', section.id )
                .attr( 'aria-selected', selected ? 'true' : 'false' )
                .text( section.title );
            if( selected ) $option.addClass( 'selected' );
            $sectionMenu.append( $option );
        } );

        if( sections.length )
        {
            var current = sections.filter( function( s ){ return ('' + s.id) === ('' + sectionId); } )[ 0 ] || sections[ 0 ];
            setSectionSelection( current.id, current.title );
        }

        var focusedOptionIdx = -1;

        var highlightOption = function( idx )
        {
            var $opts = $sectionMenu.find( '.ui-custom-select-option' );
            if( idx < 0 ) idx = $opts.length - 1;
            if( idx >= $opts.length ) idx = 0;
            focusedOptionIdx = idx;
            $opts.removeClass( 'focused' );
            var $target = $opts.eq( idx );
            $target.addClass( 'focused' );
            if( $target.length && $target[0].scrollIntoView )
            {
                $target[0].scrollIntoView( { block: 'nearest' } );
            }
        };

        $sectionTrigger.on( 'click', function( e )
        {
            e.preventDefault();
            e.stopPropagation();
            if( $sectionField.hasClass( 'open' ) ) closeSectionMenu();
            else
            {
                openSectionMenu();
                var $sel = $sectionMenu.find( '.ui-custom-select-option.selected' );
                focusedOptionIdx = $sel.length ? $sel.index() : -1;
            }
        } );

        $sectionMenu.on( 'click', '.ui-custom-select-option', function( e )
        {
            e.preventDefault();
            e.stopPropagation();
            var $opt = $( e.currentTarget );
            setSectionSelection( $opt.attr( 'data-value' ), $opt.text() );
            closeSectionMenu();
            $sectionTrigger.focus();
        } );

        $form.on( 'click', function( e )
        {
            if( !$( e.target ).closest( '.ui-custom-select' ).length ) closeSectionMenu();
        } );

        $sectionTrigger.on( 'keydown', function( e )
        {
            var code = e.which || e.keyCode;
            if( code === 40 || code === 38 )
            {
                e.preventDefault();
                e.stopPropagation();
                if( !$sectionField.hasClass( 'open' ) )
                {
                    openSectionMenu();
                    var $sel = $sectionMenu.find( '.ui-custom-select-option.selected' );
                    focusedOptionIdx = $sel.length ? $sel.index() : -1;
                }
                highlightOption( focusedOptionIdx + (code === 40 ? 1 : -1) );
            }
            else if( code === 13 || code === 32 )
            {
                e.preventDefault();
                e.stopPropagation();
                if( $sectionField.hasClass( 'open' ) && focusedOptionIdx >= 0 )
                {
                    var $opt = $sectionMenu.find( '.ui-custom-select-option' ).eq( focusedOptionIdx );
                    if( $opt.length )
                    {
                        setSectionSelection( $opt.attr( 'data-value' ), $opt.text() );
                    }
                    closeSectionMenu();
                }
                else if( !$sectionField.hasClass( 'open' ) )
                {
                    openSectionMenu();
                    var $selE = $sectionMenu.find( '.ui-custom-select-option.selected' );
                    focusedOptionIdx = $selE.length ? $selE.index() : -1;
                }
            }
        } );

        $form.on( 'keydown', function( e )
        {
            var code = e.which || e.keyCode;
            if( (e.key === 'Escape' || code === 27) && $sectionField.hasClass( 'open' ) )
            {
                e.preventDefault();
                e.stopPropagation();
                closeSectionMenu();
                $sectionTrigger.focus();
            }
        } );

        // Track current edited bookmark id for keyboard Delete
        this.currentEditId = id;

        $dupBtn = $( '<a class="duplicate" href="#">DUPLICATE</a>' ).click( function( e )
        {
            e.preventDefault();

            self.duplicate(
                id,
                {
                    title: $title.val(),
                    url: $url.val()
                },
                $section.val(),
                function( duplicated )
                {
                    if( !duplicated )
                    {
                        ui.error( 'Error', 'Couldn\'t duplicate the bookmark.' );
                        return;
                    }

                    dialog.hide();
                    self.currentEditId = null;
                }
            );
        } );

        $rmBtn = $( '<a class="remove" href="#">DELETE (shortcut key: DELETE)</a>' ).click( function( e )
        {
            e.preventDefault();
            
            self.remove( id, function()
            {
                dialog.hide();
                self.currentEditId = null;
            } );
        } );
        
        $form.append( $title, $url, $section, $sectionField, $dupBtn, $rmBtn );
        
        dialog = ui.confirm( 'Edit \'' + title + '\'', $form );
        dialog.el.addClass( 'dialog-form-wide' );
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

    EditCtrl.prototype.duplicate = function( sourceId, props, sectionId, callback )
    {
        var self = this;
        var $source = $( document.getElementById( sourceId ) );
        if( !$source.length )
        {
            callback && callback( false );
            return;
        }

        var sourceSectionId = '' + ( $source.closest( 'section' ).attr( 'id' ) || '' );
        var targetSectionId = '' + ( sectionId || sourceSectionId );
        var $targetSection = $( '#' + targetSectionId );
        if( !$targetSection.length )
        {
            callback && callback( false );
            return;
        }

        var duplicateTitle = ( props && props.title != null )
            ? props.title
            : ( $source.attr( 'data-raw-title' ) || $source.find( 'span' ).first().text() || '' );
        var duplicateUrl = ( props && props.url != null ) ? props.url : $source.attr( 'href' );

        if( duplicateUrl && !mdash.util.isSafeUrl( duplicateUrl ) )
        {
            var candidate = ( '' + duplicateUrl ).trim();
            if( candidate.indexOf( '//' ) === 0 ) candidate = 'https:' + candidate;
            try { new URL( candidate ); } catch( _e ) { candidate = 'http://' + candidate; }
            duplicateUrl = mdash.util.isSafeUrl( candidate ) ? candidate : null;
        }

        if( !duplicateUrl || !mdash.util.isSafeUrl( duplicateUrl ) )
        {
            callback && callback( false );
            return;
        }

        var $targetTiles = $targetSection.children( 'a' ).not( '.add,.drop-placeholder' );
        var insertIndex = $targetTiles.length;
        if( targetSectionId === sourceSectionId )
        {
            for( var i = 0; i < $targetTiles.length; i++ )
            {
                if( $targetTiles[ i ].id === sourceId )
                {
                    insertIndex = i + 1;
                    break;
                }
            }
        }

        this.api.create( {
            parentId: targetSectionId,
            title: duplicateTitle,
            url: duplicateUrl,
            index: insertIndex
        }, function( bookmark )
        {
            if( self._hasApiError( 'Could not duplicate bookmark' ) )
            {
                callback && callback( false );
                return;
            }
            if( !bookmark )
            {
                callback && callback( false );
                return;
            }

            var $new = mdash.Column.prototype.renderBookmark( bookmark );
            var $currentTiles = $targetSection.children( 'a' ).not( '.add,.drop-placeholder' );
            var $add = $targetSection.find( 'a.add' );
            if( insertIndex < $currentTiles.length ) $currentTiles.eq( insertIndex ).before( $new );
            else if( $add.length ) $add.before( $new );
            else $targetSection.append( $new );

            $targetSection.show();
            $targetSection.parent().show();

            if( self.editMode )
            {
                self.disableDragAndDrop();
                self.enableDragAndDrop();
            }

            mdash._undoNotify( 'Duplicated', '\'' + bookmark.title + '\' duplicated.', function()
            {
                self.api.remove( bookmark.id, function()
                {
                    if( self._hasApiError( 'Could not undo duplicate' ) ) return;
                    var $tile = $( document.getElementById( bookmark.id ) );
                    if( $tile.length )
                    {
                        $tile.addClass( 'removed' );
                        setTimeout( function(){ $tile.remove(); }, 500 );
                    }
                } );
            } );

            callback && callback( true, bookmark );
        } );
    };
    
    EditCtrl.prototype.remove = function( id, callback )
    {
        var $el = $( document.getElementById( id ) );
        var self = this;

        // Fetch node to capture undo info
        this.api.get( id, function( nodes )
        {
            if( self._hasApiError( 'Could not load bookmark before delete' ) )
            {
                return;
            }
            var node = nodes && nodes[0];
            if( !node )
            {
                // Fallback remove without undo if lookup failed
                self.api.remove( id, function()
                {
                    if( self._hasApiError( 'Could not remove bookmark' ) )
                    {
                        return;
                    }
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
                if( self._hasApiError( 'Could not remove bookmark' ) )
                {
                    return;
                }
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
                        if( self._hasApiError( 'Could not undo bookmark delete' ) ) return;
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
                            self._bindTileDnD( $new );
                        }
                    } );
                } );
            } );
        } );
    };
    
    EditCtrl.prototype.update = function( id, props, moveTo, callback )
    {
        var $el    = $( document.getElementById( id ) ),
            $title = $el.find( 'span' ).first(),
            self   = this;

        if( !$el.length )
        {
            return;
        }

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
                            if( self._hasApiError( 'Could not undo bookmark move' ) ) return;
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
                        if( self._hasApiError( 'Could not undo bookmark update' ) ) return;
                        var $cur = $( document.getElementById( id ) );
                        var $t = $cur.find( 'span' ).first();
                        $cur.attr( 'data-raw-title', prev.rawTitle );
                        var displayPrevView = mdash.util.buildTitleView( prev.rawTitle, self.editMode );
                        $t.text( displayPrevView.tile );
                        $cur.attr('href', prev.url );
                        $cur.attr('title', displayPrevView.full );
                        $cur.attr('aria-label', displayPrevView.full );
                        $cur.attr( 'data-title', displayPrevView.full );
                        $cur.data( 'title', displayPrevView.full );
                        refreshFaviconForUrl( $cur, prev.url, displayPrevView.full );
                    } );
                } );
            });
        }

        this.api.update( id, props, function()
        {
            if( self._hasApiError( 'Could not update bookmark' ) )
            {
                return;
            }
            var newRawTitle = (props.title != null) ? props.title : ( $el.attr('data-raw-title') || $title.text() );
            $el.attr( 'data-raw-title', newRawTitle );
            var displayNowView = mdash.util.buildTitleView( newRawTitle, self.editMode );
            var displayNow = displayNowView.full;
            if( props.title )
            {
                $title.text( displayNowView.tile );
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
                $el.attr( 'title', displayNowView.full );
                $el.attr( 'aria-label', displayNowView.full );
                $el.attr( 'data-title', displayNowView.full );
                $el.data( 'title', displayNowView.full );
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
                    if( self._hasApiError( 'Could not move bookmark to selected section' ) )
                    {
                        return;
                    }
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
        this._currentTheme = 'auto';
        this._mediaQuery = ( window.matchMedia ? window.matchMedia( '(prefers-color-scheme: dark)' ) : null );
        this._boundMediaHandler = this.handleSystemThemeChange.bind( this );
    };

    ThemeCtrl.prototype.init = function()
    {
        var saved = localStorage.getItem( KEY );
        var theme = ( saved === 'light' || saved === 'dark' || saved === 'auto' ) ? saved : 'auto';
        this.applyTheme( theme );

        this.$links.on( 'click', this.onClick.bind( this ) );
        if( this.$toggle.length )
        {
            this.$toggle.on( 'click', this.toggleOpen.bind( this ) );
            $( document ).on( 'click', this.closeOnOutsideClick.bind( this ) );
        }
    };

    ThemeCtrl.prototype.applyTheme = function( theme )
    {
        this._currentTheme = ( theme === 'light' || theme === 'dark' ) ? theme : 'auto';

        if( this._currentTheme === 'auto' )
        {
            this.bindAutoThemeListener();
            this.applySystemTheme();
        }
        else
        {
            this.unbindAutoThemeListener();
            if( this._currentTheme === 'dark' )
            {
                document.documentElement.classList.add( 'theme-dark' );
                document.documentElement.classList.remove( 'theme-light' );
            }
            else
            {
                document.documentElement.classList.add( 'theme-light' );
                document.documentElement.classList.remove( 'theme-dark' );
            }
        }

        localStorage.setItem( KEY, this._currentTheme );
        this.select( this._currentTheme );
    };

    ThemeCtrl.prototype.applySystemTheme = function()
    {
        var prefersDark = !!( this._mediaQuery && this._mediaQuery.matches );
        if( prefersDark )
        {
            document.documentElement.classList.add( 'theme-dark' );
            document.documentElement.classList.remove( 'theme-light' );
        }
        else
        {
            document.documentElement.classList.add( 'theme-light' );
            document.documentElement.classList.remove( 'theme-dark' );
        }
    };

    ThemeCtrl.prototype.bindAutoThemeListener = function()
    {
        if( !this._mediaQuery ) return;
        this.unbindAutoThemeListener();
        if( this._mediaQuery.addEventListener ) this._mediaQuery.addEventListener( 'change', this._boundMediaHandler );
        else if( this._mediaQuery.addListener ) this._mediaQuery.addListener( this._boundMediaHandler );
    };

    ThemeCtrl.prototype.unbindAutoThemeListener = function()
    {
        if( !this._mediaQuery ) return;
        if( this._mediaQuery.removeEventListener ) this._mediaQuery.removeEventListener( 'change', this._boundMediaHandler );
        else if( this._mediaQuery.removeListener ) this._mediaQuery.removeListener( this._boundMediaHandler );
    };

    ThemeCtrl.prototype.handleSystemThemeChange = function()
    {
        if( this._currentTheme !== 'auto' ) return;
        this.applySystemTheme();
    };

    ThemeCtrl.prototype.select = function( theme )
    {
        this.$links.removeClass( 'selected' );
        this.$links.filter( '[data-theme="' + theme + '"]' ).addClass( 'selected' );
        if( this.$toggle.length ) this.$toggle.text( theme + ' ▾' );
    };

    ThemeCtrl.prototype.onClick = function( e )
    {
        e.preventDefault();
        var theme = $( e.currentTarget ).attr( 'data-theme' );
        this.applyTheme( theme );
        if( this.$dropdown.length ) this.$dropdown.removeClass( 'open' );
    };

    ThemeCtrl.prototype.toggleOpen = function(e)
    {
        if( !this.$dropdown.length ) return;
        e.preventDefault();
        e.stopPropagation();
        this.$dropdown.toggleClass('open');
    };

    ThemeCtrl.prototype.closeOnOutsideClick = function(e)
    {
        if( !this.$dropdown.length ) return;
        if(!$(e.target).closest(this.$dropdown).length) {
            this.$dropdown.removeClass('open');
        }
    };

} )( window.mdash || ( window.mdash = {} ) );


/* click-count badge control removed */


( function( mdash )
{
    'use strict';
    var KEY = 'mdash:motion';

    var MotionCtrl = mdash.MotionCtrl = function( $links )
    {
        this.$links = $links;
        this.$dropdown = this.$links.closest('.dropdown');
        this.$toggle = this.$dropdown.find('.dropdown-toggle');
    };

    MotionCtrl.prototype.init = function()
    {
        var saved = localStorage.getItem( KEY );
        var prefersReduced = !!( window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches );
        var mode = ( saved === 'reduced' || saved === 'full' ) ? saved : ( prefersReduced ? 'reduced' : 'full' );
        this.applyMode( mode );
        this.$links.on( 'click', this.onClick.bind( this ) );
        if( this.$toggle.length )
        {
            this.$toggle.on( 'click', this.toggleOpen.bind( this ) );
            $( document ).on( 'click', this.closeOnOutsideClick.bind( this ) );
        }
    };

    MotionCtrl.prototype.applyMode = function( mode )
    {
        var reduced = mode === 'reduced';
        document.documentElement.classList.toggle( 'reduced-motion', reduced );
        localStorage.setItem( KEY, reduced ? 'reduced' : 'full' );
        this.select( reduced ? 'reduced' : 'full' );
    };

    MotionCtrl.prototype.select = function( mode )
    {
        this.$links.removeClass( 'selected' );
        this.$links.filter( '[data-motion="' + mode + '"]' ).addClass( 'selected' );
        if( this.$toggle.length ) this.$toggle.text( ( mode === 'reduced' ? 'motion reduced' : 'motion full' ) + ' ▾' );
    };

    MotionCtrl.prototype.onClick = function( e )
    {
        e.preventDefault();
        var mode = $( e.currentTarget ).attr( 'data-motion' ) === 'reduced' ? 'reduced' : 'full';
        this.applyMode( mode );
        if( this.$dropdown.length ) this.$dropdown.removeClass( 'open' );
    };

    MotionCtrl.prototype.toggleOpen = function(e)
    {
        if( !this.$dropdown.length ) return;
        e.preventDefault();
        e.stopPropagation();
        this.$dropdown.toggleClass('open');
    };

    MotionCtrl.prototype.closeOnOutsideClick = function(e)
    {
        if( !this.$dropdown.length ) return;
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
        modal.el.addClass( 'dialog-form-wide' );
        
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
                            var err = ( window.chrome && chrome.runtime ) ? chrome.runtime.lastError : null;
                            if( err ) return;
                            var $tile = $( document.getElementById( bookmark.id ) );
                            if( $tile.length ) { $tile.addClass( 'removed' ); setTimeout( function(){ $tile.remove(); }, 500 ); }
                        } );
                    } );

                    // If user is in edit mode, immediately enable DnD on the new tile
                    try {
                        var edit = mdash.dashboard && mdash.dashboard.editCtrl;
                        if( edit && edit.editMode )
                        {
                            edit._bindTileDnD( $new );
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
            index: this.$section.children().length - 4
        },
        function( result )
        {
            var err = ( window.chrome && chrome.runtime ) ? chrome.runtime.lastError : null;
            if( err )
            {
                callback && setTimeout( function() { callback( false, null ); }, 0 );
                return;
            }
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
        this._index    = [];
        this._searchTimer = null;
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
            if( self._searchTimer ) clearTimeout( self._searchTimer );
            self._searchTimer = setTimeout( function()
            {
                self.search( self.$input.val() );
            }, 70 );
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
        this.rebuildIndex();
        
        var self = this;
        requestAnimationFrame( function(){ self.$input.focus(); } );
    };
    
    Spotlight.prototype.hide = function()
    {
        this.visible = false;
        this.$el.addClass( 'spotlight-hidden' );
        this.$input.blur();
        if( this._searchTimer ) { clearTimeout( this._searchTimer ); this._searchTimer = null; }
    };

    Spotlight.prototype.rebuildIndex = function()
    {
        var index = [];
        $( '#bookmarks a' ).not( '.add,.drop-placeholder' ).each( function( _, el )
        {
            var $el   = $( el );
            var href  = $el.attr( 'href' ) || '';
            if( !href ) return;
            var rawTitle = $el.attr( 'data-raw-title' ) || $el.attr( 'data-title' ) || '';
            var displayTitle = mdash.util ? mdash.util.stripIconOverride( rawTitle ) : ( rawTitle || '' );
            if( !displayTitle ) displayTitle = $el.find( 'span' ).first().text() || '';
            var $section = $el.closest( 'section' );
            var sectionName = $section.find( '.section-title-text' ).first().text() || $section.find( 'h1' ).first().text() || '';
            var imgSrc = '';
            try { imgSrc = $el.find( 'img' ).first().attr( 'src' ) || ''; } catch( _e ) {}

            index.push( {
                title   : displayTitle,
                href    : href,
                section : sectionName,
                imgSrc  : imgSrc
            } );
        } );

        this._index = index;
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
        var index = this._index || [];
        for( var i = 0; i < index.length; i++ )
        {
            var item = index[ i ];
            if( regex.test( item.title ) || regex.test( item.href ) )
            {
                matches.push( item );
            }
        }
        
        if( matches.length === 0 )
        {
            $list.append( '<li class="spotlight-empty">No results</li>' );
            return;
        }
        
        var count = Math.min( matches.length, MAX_RESULTS );
        for( var i = 0; i < count; i++ )
        {
            var m = matches[ i ];
            var imgSrc = m.imgSrc || '';
            
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
        if( $sel[0] && $sel[0].scrollIntoView )
        {
            $sel[0].scrollIntoView( { block: 'nearest', behavior: 'smooth' } );
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


/* --- stats.js --- */

( function( mdash )
{
    'use strict';
    // Click-count tracking was removed; keep namespace null for backward-safe checks.
    mdash.stats = null;

} )( window.mdash || ( window.mdash = {} ) );


( function( mdash, $ )
{
    'use strict';
    
    var Dashboard = mdash.Dashboard = function() {},
        proto     = Dashboard.prototype;

    Dashboard.VERSION = '1.8.84';

    proto.init = function()
    {
        this.$settingsToggle = $( '#settings-toggle' );
        this.$settingsPanel = $( '#settings-panel' );
        this.$settingsBackdrop = $( '#settings-backdrop' );
        this.$settingsClose = $( '#settings-close' );
        this.$fontSizes  = $( '#fontctrl [data-size]' );
        this.$helpCtrl   = $( '#helpctrl' );
        this.$themeCtrl  = $( '#themectrl [data-theme]' );
        this.$motionCtrl = $( '#motionctrl [data-motion]' );
        this.$editBtn    = $( '#edit' );
        this.$refresh    = $( '#refresh-icons' );
        this.$getStarted = $( '#getstarted' );
        this.$bookmarks  = $( '#bookmarks' );
        this.$version    = $( '#version' );
        this._refreshingFavicons = false;

        this.manager         = new mdash.Manager();
        this.fontCtrl        = new mdash.FontCtrl( this.$fontSizes );
        this.helpCtrl        = new mdash.HelpCtrl( this.$helpCtrl, this.$getStarted, this.$bookmarks );
        this.themeCtrl       = new mdash.ThemeCtrl( this.$themeCtrl );
        this.motionCtrl      = new mdash.MotionCtrl( this.$motionCtrl );
        this.editCtrl        = new mdash.EditCtrl( this.$editBtn, this.$bookmarks );
        this.keyboardManager = new mdash.KeyboardManager();

        this.fontCtrl.init();
        this.helpCtrl.init();
        this.themeCtrl.init();
        this.motionCtrl.init();
        this.editCtrl.init();

        // Cleanup legacy click-count storage/settings after feature removal.
        try
        {
            localStorage.removeItem( 'mdash:clicks' );
            localStorage.removeItem( 'mdash:badges' );
        }
        catch( _e ) {}

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
        this.setupControlsPanel();

        this.keyboardManager.init();

        // Refresh icons action:
        // - click: always purge favicon cache + reload (full rebuild)
        // - Alt+click: always purge favicon cache + rebuild in place
        var _this = this;
        this.$refresh.on( 'click', function( e )
        {
            e.preventDefault();
            if( e.altKey )
            {
                if( _this._refreshingFavicons ) return;
                ui.notify( 'Refreshing', 'Purging favicon cache and rebuilding in place…' );
                _this.refreshFavicons();
                return;
            }
            ui.notify( 'Refreshing', 'Purging favicon cache and reloading…' );
            _this.purgeFaviconCache();
            window.location.reload();
        } );
    };

    proto.setupControlsPanel = function()
    {
        var _this = this;
        if( !this.$settingsToggle.length || !this.$settingsPanel.length || !this.$settingsBackdrop.length ) return;

        var closePanel = function()
        {
            document.documentElement.classList.remove( 'settings-open' );
            _this.$settingsToggle.attr( 'aria-expanded', 'false' );
            _this.$settingsPanel.attr( 'aria-hidden', 'true' );
            _this.$settingsBackdrop.attr( 'aria-hidden', 'true' );
        };

        var openPanel = function()
        {
            document.documentElement.classList.add( 'settings-open' );
            _this.$settingsToggle.attr( 'aria-expanded', 'true' );
            _this.$settingsPanel.attr( 'aria-hidden', 'false' );
            _this.$settingsBackdrop.attr( 'aria-hidden', 'false' );
        };

        this.$settingsToggle.on( 'click', function( e )
        {
            e.preventDefault();
            if( document.documentElement.classList.contains( 'settings-open' ) ) closePanel();
            else openPanel();
        } );

        if( this.$settingsClose.length )
        {
            this.$settingsClose.on( 'click', function( e )
            {
                e.preventDefault();
                closePanel();
            } );
        }

        this.$settingsBackdrop.on( 'click', function()
        {
            closePanel();
        } );

        this.$settingsPanel.on( 'click', 'a', function( e )
        {
            var $a = $( e.currentTarget );
            if( $a.is( '#refresh-icons' ) || $a.is( '#helpctrl' ) ) closePanel();
        } );

        $( document ).on( 'click', function( e )
        {
            if( !document.documentElement.classList.contains( 'settings-open' ) ) return;
            if( $( e.target ).closest( '#settings-panel, #quick-actions' ).length ) return;
            closePanel();
        } );

        $( document ).on( 'keydown', function( e )
        {
            var code = e.which || e.keyCode;
            if( code === 27 ) closePanel();
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

    proto.purgeFaviconCache = function()
    {
        var keysToRemove = [];
        for( var i = 0; i < localStorage.length; i++ )
        {
            var k = localStorage.key( i );
            if( k && k.indexOf( 'fav:' ) === 0 ) keysToRemove.push( k );
        }
        keysToRemove.forEach( function( k ){ localStorage.removeItem( k ); } );
        for( var key in mdash.util._faviconMemCache ) delete mdash.util._faviconMemCache[ key ];
    };

    proto.refreshFavicons = function()
    {
        if( this._refreshingFavicons ) return;
        this._refreshingFavicons = true;
        this.purgeFaviconCache();

        var _this = this;
        var $imgs = $( '#bookmarks a:not(.add) img' );
        var idx = 0;
        var batchSize = 12;
        var batchDelay = 30;

        var runBatch = function()
        {
            var end = Math.min( idx + batchSize, $imgs.length );
            for( ; idx < end; idx++ )
            {
                var img = $imgs.get( idx );
                var $img = $( img );
                var $a   = $img.closest( 'a' );
                var href = $a.attr( 'href' );
                if( !href ) continue;
                try
                {
                    var rawTitle = $a.attr( 'data-raw-title' ) || $a.attr( 'data-title' ) || '';
                    var overrideOnly = mdash.util.hasIconOverride( rawTitle );
                    var effectiveTitle = mdash.util.stripIconOverride( rawTitle );
                    var vpn = rawTitle.indexOf( '[VPN]' ) !== -1;
                    mdash.util.applyFaviconWithFallback( $img, href, vpn, effectiveTitle, overrideOnly );
                }
                catch( e ){}
            }

            if( idx < $imgs.length )
            {
                setTimeout( runBatch, batchDelay );
                return;
            }
            _this._refreshingFavicons = false;
        };

        runBatch();
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


