/*!
 * mdash bundle
 * Contains, in order:
 * - manager.js
 * - column.js
 * - fontctrl.js
 * - helpctrl.js
 * - editctrl.js
 * - themectrl.js
 * - keyboard_manager.js
 * - addbtn.js
 * - search.js
 * - dashboard.js
 * - app.js
 */

/* --- manager.js --- */

( function( mdash )
{
    
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
            children.forEach( function( b, i )
            {
                if( b.title === _this.PLACEHOLDER_NAME )
                {
                    delete children[ i ];
                    
                    return;
                }
                
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
                    delete children[ i ];
                    
                    return;
                }
                
                b.title = b.title.substring( 1 );
            } );
            
            _this.folder.children = children;
            
            callback( children );
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
        
        this.api.create(
            {
                parentId : this.tree.children[ 1 ].id,
                title    : this.FOLDER_NAME
            },
            function( folder )
            {
                delete this.tree;
                
                _this.folder = folder;
                _this.createPlaceholder( callback );
            }
        );
        
        this.createRootFolder = function() { callback(); };
    };
    
    proto.createPlaceholder = function( callback )
    {
        this.api.create(
            {
                parentId : this.folder.id,
                title    : this.PLACEHOLDER_NAME,
                url      : 'about:blank'
            },
            callback
        );
        
        this.createPlaceholder = function() { callback() };
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- column.js --- */

( function( mdash )
{
    
    mdash.links = {};
    
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
    };
    
    proto.renderSection = function( section )
    {
        var _this    = this,
            $section = ich.section( section );
        
        section.children.forEach( function( bookmark )
        {
            var $link = _this.renderBookmark( bookmark );
            $section.append( $link );
            mdash.links[ $link.attr( 'href' ) ] = $link;
        } );
        
        var $addBtn = ich.bookmark( {
            id        : ( this.sections.length + 1 ) + '-section-add',
            className : 'add',
            title     : '+',
            url       : '#add',
            favicon   : 'http://www.google.com/s2/favicons?domain=default'
        } );
        
        $section.append( $addBtn );
        $section.data.addBtn = new mdash.AddBtn( $addBtn );
        $section.data.addBtn.init();
        
        return $section;
    };
    
    proto.renderBookmark = function( bookmark )
    {
        var link = document.createElement( 'a' );
        
        link.href = bookmark.url;
        
        var data = {
            id      : bookmark.id,
            title   : bookmark.title,
            url     : link.href,
            favicon : bookmark.favicon ? bookmark.favicon : 'http://www.google.com/s2/favicons?domain=' + link.origin
        };
        
        return ich.bookmark( data );
    };

} )( window.mdash || ( window.mdash = {} ) );


/* --- fontctrl.js --- */

( function( mdash )
{
    
    var FontCtrl = mdash.FontCtrl = function( $sizes )
    {
        this.$sizes = $sizes;
        this.$dropdown = this.$sizes.closest('.dropdown');
        this.$toggle = this.$dropdown.find('.dropdown-toggle');
    };
    
    FontCtrl.prototype.init = function()
    {
        var size;
        
        if( (size = localStorage.fontSize) )
        {
            document.body.className = size;
            
            this.select( size );
        }
        else
        {
            // initialize from current class on body or default to 'large'
            size = document.body.className || 'large';
            document.body.className = size;
            localStorage.fontSize = size;
            this.select( size );
        }
        
        this.$sizes.bind( 'click', this.sizeSelected.bind( this ) );
        this.$toggle.on('click', this.toggleOpen.bind(this));
        $(document).on('click', this.closeOnOutsideClick.bind(this));
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
        
        document.body.className = localStorage.fontSize = $this.attr( 'data-size' );
        this.$toggle.text($this.attr('data-size') + ' ▾');
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
    
    var HelpCtrl = mdash.HelpCtrl = function( $handle, $help, $interface )
    {
        this.$handle    = $handle;
        this.$help      = $help;
        this.$interface = $interface;
        this.$search    = $( '#search' );
    };
    
    HelpCtrl.prototype.init = function()
    {
        this.$handle.bind( 'click', this.toggle.bind( this ) );
    };
    
    HelpCtrl.prototype.toggle = function()
    {
        this.$help.toggle();
        this.$interface.toggle();
        this.$search.toggle();
    };
    
    HelpCtrl.prototype.show = function()
    {
        this.$help.show();
        this.$interface.hide();
        this.$search.hide();
    };
    
    HelpCtrl.prototype.hide = function()
    {
        this.$help.hide();
        this.$interface.show();
        this.$search.show();
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- editctrl.js --- */

// FIXME: Refactor!
// FIXME: Handle pressing alt while in edit mode.

( function( mdash, $ )
{
    
    var EditCtrl = mdash.EditCtrl = function( $btn, $bookmarks )
    {
        this.$docEl       = $( document.documentElement );
        this.$btn       = $btn;
        this.$bookmarks = $bookmarks;
        this.api        = chrome.bookmarks;
        this.editMode   = false;
    };
    
    EditCtrl.prototype.init = function()
    {
        var self = this;
        
        this.listenForAlt();
        this.setupButton();
        
        this.$docEl.on( 'click', '#bookmarks a:not(.add)', function( e )
        {
            if( self.editMode )
            {
                e.preventDefault();
                e.stopPropagation();
                
                var $el = $( e.target );
                
                if( !$el.is( 'a' ) )
                {
                    $el = $el.parent();
                }
                
                self.edit( $el );
            }
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
            }
            else
            {
                self.editMode = true;
                self.$docEl.addClass( 'edit' );
                self.$btn.text( 'done' );
            }
        } );
    };
    
    EditCtrl.prototype.listenForAlt = function()
    {
        var $doc = $( document ),
            self = this;
        
        $doc.bind( 'keydown', function( e )
        {
            if( e.keyCode === 18 /* alt */ )
            {
                self.$docEl.addClass( 'edit' );
                self.editMode = self.altPressed = true;
            }
        } );
        
        $doc.bind( 'keyup', function( e )
        {
            if( e.keyCode === 18 /* alt */ )
            {
                self.$docEl.removeClass( 'edit' );
                self.editMode = self.altPressed = false;
            }
        } );
    };
    
    EditCtrl.prototype.edit = function( $b )
    {
        var $form, $title, $url, $section, $remove, dialog,
            self  = this,
            id    = $b.attr( 'id' ),
            title = $b.find( 'span' ).text(),
            sections = mdash.dashboard.manager.folder.children,
            sectionId = +$b.closest( 'section' ).attr( 'id' );
        
        $form  = $( '<div class="ui-edit-form">' );
        $title = $( '<input autofocus id="title" type="text"/>' ).val( title ).focus();
        $url   = $( '<input id="url" type="text"/>' ).val( $b.attr( 'href' ) );

        var sectionsSelectHtml = '<select id="section">';
        sections.forEach( function( section )
        {
            sectionsSelectHtml += '<option value="' + section.id + '">' + section.title + '</option>';
        } );
        sectionsSelectHtml += '</section>';
        $section = $( sectionsSelectHtml ).val( sectionId );

        $rmBtn = $( '<a class="remove" href="#">Remove</a>' ).click( function( e )
        {
            e.preventDefault();
            
            self.remove( id, function()
            {
                dialog.hide();
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
                return;
            }

            self.update(
                id,
                {
                    title   : $title.val(),
                    url     : $url.val()
                },
                $section.val() != sectionId ? $section.val() : null,
                function() { dialog.hide(); }
            );
        } );
    };
    
    EditCtrl.prototype.remove = function( id, callback )
    {
        var $el = $( document.getElementById( id ) );
        
        this.api.remove( id, function()
        {
            $el.addClass( 'removed' );
            
            setTimeout( callback, 0 );
            setTimeout( function() { $el.remove(); }, 500 );
            
            ui.notify(
                'Bookmark \'' + $el.find( 'span' ).text() + '\' has been removed.'
            );
        } );
    };
    
    EditCtrl.prototype.update = function( id, props, moveTo, callback )
    {
        var $el    = $( document.getElementById( id ) ),
            $title = $el.find( 'span' ),
            self   = this;

        this.api.update( id, props, function()
        {
            props.title && $title.text( props.title );
            props.url   && $el.attr( 'href', props.url );

            // Keep attributes in sync for live-search while editing
            if( props.title )
            {
                $el.attr( 'title', props.title );
                $el.attr( 'aria-label', props.title );
                $el.attr( 'data-title', props.title );
                // Also update jQuery's data cache used by legacy code
                $el.data( 'title', props.title );
            }
            
            // FIXME: So ugly I almost puked writing that stuff. Refactor!
            if( moveTo )
            {
                self.api.move( id, { parentId: moveTo }, function()
                {
                    $( '#' + id ).remove().appendTo( $( '#' + moveTo ) );
                    setTimeout( callback, 0 );
                    ui.notify(
                        'Bookmark \'' + $title.text() + '\' has been updated.'
                    );
                } );
            }
            else
            {
                setTimeout( callback, 0 );
                ui.notify(
                    'Bookmark \'' + $title.text() + '\' has been updated.'
                );
            }
        } );
    };
    
} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );


/* --- themectrl.js --- */

( function( mdash )
{
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

        var ENABLED = 'mdash:keyboard:isEnabled';

        var KeyboardManager = mdash.KeyboardManager = function() {},
                proto       = KeyboardManager.prototype;

        // TODO: Use ES5 getter/setter.
        proto.enable = function()
        {
            localStorage[ENABLED] = "enabled";
        };

        proto.disable = function()
        {
            localStorage[ENABLED] = "enabled";
        };

        proto.toggle = function()
        {
            localStorage[ENABLED] = (localStorage[ENABLED] === 'enabled') ? 'disabled' : 'enabled';
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

            if (localStorage[ENABLED]) {
              this.bindKeyboard();
            }
        }

        proto.bindKeyboard = function()
        {
            return;

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
                    // Backspaces
                    if (_this.modifierPressed) {
                        _this.searchTerm = '';
                    } else {
                        _this.searchTerm = _this.searchTerm.slice(0, -1);
                    }

                    // Prevents the address bar from getting focus
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
        var filterable = $('#bookmarks a').not('.add');

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


/* --- addbtn.js --- */

( function( mdash )
{
    
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

        // If it already parses as a URL, keep as is
        try { new URL( value ); return value; } catch( e ) {}

        // Allow protocol-relative URLs
        if( value.indexOf( '//' ) === 0 ) return 'https:' + value;

        // If it looks like a plain hostname (including hosts entries), prefix http
        // Accept characters commonly used in hostnames/paths
        return 'http://' + value;
    };
    
    var AddBtn = mdash.AddBtn = function( $btn )
    {
        this.$btn     = $btn;
        this.$section = $btn.closest( 'section' );
        this.api      = chrome.bookmarks;
    };
    
    AddBtn.prototype.init = function()
    {
        this.$btn.bind( 'click', this.showModal.bind( this ) );
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
                    
                    ui.notify( 'Added \'' + bookmark.title + '\'.' );
                    
                    self.$btn.before(
                        mdash.Column.prototype.renderBookmark( bookmark )
                    );
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
            index: this.$section.children().length - 2
        },
        function( result )
        {
            callback && setTimeout( function() { callback( !!result, result ); }, 0 );
        } );
    };
    
} )( window.mdash || ( window.mdash = {} ) );


/* --- search.js --- */

( function( mdash, $ )
{

    var Search = mdash.Search = function( $input )
    {
        this.$input = $input;
        this.query  = '';
    };

    Search.prototype.init = function()
    {
        var _this = this;
        this.$input.on( 'input', function()
        {
            _this.query = _this.$input.val();
            _this.filter();
        } );
    };

    Search.prototype.filter = function()
    {
        var regex = null;
        try { regex = new RegExp( this.query, 'i' ); } catch( e ) {}

        $( '#bookmarks a' ).not( '.add' ).each( function( _, el )
        {
            var $el   = $( el );
            var title = $el.find( 'span' ).text() || $el.attr( 'data-title' ) || $el.data( 'title' );

            if( !regex || !title || regex.test( title ) )
            {
                $el.show();
            }
            else
            {
                $el.hide();
            }
        } );

        // Hide sections that have no matches (recompute matches, don't rely on visibility)
        $( '#bookmarks section' ).each( function( _, section )
        {
            var $section = $( section );
            var anyMatch = false;
            $section.find( 'a' ).not( '.add' ).each( function( _, a )
            {
                var $a    = $( a );
                var title = $a.find( 'span' ).text() || $a.attr( 'data-title' ) || $a.data( 'title' );
                if( !regex || !title || regex.test( title ) )
                {
                    anyMatch = true;
                    return false; // break
                }
            } );

            $section.toggle( anyMatch );
        } );

        // Keep columns visible; sections handle emptiness
        $( '#bookmarks > .left, #bookmarks > .right' ).show();
    };

    $( function()
    {
        var $input = $( '#search-input' );
        if( $input.length )
        {
            var search = new mdash.Search( $input );
            search.init();
        }
    } );

} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );


/* --- dashboard.js --- */

( function( mdash, $ )
{

    var Dashboard = mdash.Dashboard = function() {},
        proto     = Dashboard.prototype;

    Dashboard.VERSION = '0.9.2';

    proto.init = function()
    {
        this.$fontSizes  = $( '#fontctrl .dropdown-menu a' );
        this.$helpCtrl   = $( '#helpctrl' );
        this.$themeCtrl  = $( '#themectrl .dropdown-menu a' );
        this.$editBtn    = $( '#edit' );
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

        this.manager.init( this.loadBookmarks.bind( this ) );

        this.setupUIKit();

        this.keyboardManager.init();
    };

    proto.setupUIKit = function()
    {
        ui.Dialog.effect = 'fade';

        // Handle Enter/Escape even when focus is in inputs/selects
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

} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );


/* --- app.js --- */

( function( mdash )
{
    
    if( navigator.platform.indexOf( 'Win' ) !== -1 )
    {
        document.documentElement.classList.add( 'win' );
    }
    
    mdash.dashboard = new mdash.Dashboard();
    
    $( document ).ready( mdash.dashboard.init.bind( mdash.dashboard ) );
    
} )( window.mdash || ( window.mdash = {} ) );


