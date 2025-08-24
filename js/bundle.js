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
                _this.tree = null;
                
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
    'use strict';
    
    mdash.links = {};
    
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
            $section = ich.section( section );
        
        section.children.forEach( function( bookmark )
        {
            var $link = _this.renderBookmark( bookmark );
            $section.append( $link );
            mdash.links[ $link.attr( 'href' ) ] = $link;
        } );
        
        var $addBtn = $( '<a href="#add" class="add" aria-label="Add bookmark" title="Add" draggable="false">+</a>' );
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
        
        link.href = bookmark.url;
        var faviconCandidates = [
            'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent( link.href ) + '&sz=64',
            'https://www.google.com/s2/favicons?domain=' + encodeURIComponent( new URL( link.href ).hostname )
        ];

        var data = {
            id      : bookmark.id,
            title   : bookmark.title,
            url     : link.href,
            favicon : bookmark.favicon ? bookmark.favicon : faviconCandidates[ 0 ]
        };
        
        var $el  = ich.bookmark( data );
        var $img = $el.find( 'img' );
        
        // image src already set via template; no extra preloading needed here
        
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
        
        this.$sizes.bind( 'click', this.sizeSelected.bind( this ) );
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


( function( mdash, $ )
{
    'use strict';
    
    var EditCtrl = mdash.EditCtrl = function( $btn, $bookmarks )
    {
        this.$docEl       = $( document.documentElement );
        this.$btn       = $btn;
        this.$bookmarks = $bookmarks;
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
        $tiles.attr( 'draggable', true )
            .on( 'dragstart.mdash', function( e )
            {
                self._dragging = true;
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
            } )
            .on( 'dragend.mdash', function()
            {
                self._dragging = false;
                $( this ).removeClass( 'dragging' );
                if( self.$placeholder ) self.$placeholder.detach();
                self.$bookmarks.find( 'section' ).removeClass( 'drop-target' );
            } );

        // While dragging over a tile, show the placeholder before/after the tile
        $tiles.on( 'dragover.mdash', function( e )
        {
            e.preventDefault();
            var rect = this.getBoundingClientRect();
            var before = (e.originalEvent.clientX < rect.left + rect.width / 2);
            var $t = $( this );
            if( before ) { $t.before( self.$placeholder ); }
            else { $t.after( self.$placeholder ); }
            $t.closest( 'section' ).addClass( 'drop-target' );
        } );

        var $sections = this.$bookmarks.find( 'section' );
        $sections
            .on( 'dragover.mdash', function( e )
            {
                e.preventDefault();
                var $section = $( this );
                $section.addClass( 'drop-target' );
                // For empty sections, place placeholder before the add button
                var $tilesInside = $section.children( 'a' ).not( '.add' ).not( '.drop-placeholder' );
                if( $tilesInside.length === 0 )
                {
                    var $add = $section.find( 'a.add' );
                    if( $add.length ) $add.before( self.$placeholder ); else $section.append( self.$placeholder );
                }
            } )
            .on( 'dragleave.mdash', function()
            {
                $( this ).removeClass( 'drop-target' );
            } )
            .on( 'drop.mdash', function( e )
            {
                e.preventDefault();
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
                // Guard: if dropping right next to itself in the same section, do nothing
                var $tileBeforeMove = $( document.getElementById( id ) );
                if( $tileBeforeMove.length )
                {
                    var $srcSection = $tileBeforeMove.closest( 'section' );
                    if( $srcSection.length && $srcSection.attr( 'id' ) === $section.attr( 'id' ) )
                    {
                        // Compute source index within its section (excluding add button)
                        var srcIndex = 0;
                        var srcChildren = $srcSection.children( 'a' );
                        for( var si = 0; si < srcChildren.length; si++ )
                        {
                            var srcEl = srcChildren[ si ];
                            if( srcEl === $tileBeforeMove[0] ) break;
                            if( srcEl.classList.contains( 'add' ) ) continue;
                            srcIndex++;
                        }
                        // If target index equals current index (before) or current index + 1 (after), ignore
                        if( index === srcIndex || index === srcIndex + 1 )
                        {
                            if( self.$placeholder ) self.$placeholder.detach();
                            return;
                        }
                    }
                }
                self.api.move( id, { parentId: targetSectionId, index: index }, function()
                {
                    var $tile = $( document.getElementById( id ) );
                    if( !$tile.length ) return; // Invalid id; do nothing
                    if( self.$placeholder && self.$placeholder.parent().length )
                    {
                        self.$placeholder.replaceWith( $tile );
                    }
                    else
                    {
                        var $add  = $section.find( 'a.add' );
                        if( $add.length ) $add.before( $tile ); else $section.append( $tile );
                    }
                    ui.notify( 'Moved', 'Bookmark moved.' );
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
                var $searchInput = $( '#search-input' );
                if( $searchInput.length )
                {
                    $searchInput.val( '' ).trigger( 'input' );
                }

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
            else if( self.editMode && (e.key === 'Delete' || e.keyCode === 46 || e.keyCode === 8) )
            {
                // If user is typing inside an input/select/textarea, ignore
                if( $( e.target ).is('input, textarea, select') ) return;

                // If dialog is open, delete the currently edited bookmark
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
                    return;
                }

                // Otherwise delete hovered/focused tile
                var $target = self.$activeBookmark || $( e.target ).closest( '#bookmarks a:not(.add)' );
                if( !$target.length ) return;
                e.preventDefault();
                e.stopPropagation();
                var id = $target.attr( 'id' );
                self.remove( id, function()
                {
                    var $section = $target.closest( 'section' );
                    setTimeout( function()
                    {
                        if( !document.documentElement.classList.contains( 'edit' ) )
                        {
                            var remaining = $section.find( 'a' ).not( '.add' ).length;
                            if( remaining === 0 )
                            {
                                $section.hide();
                                var $col = $section.parent();
                                var visibleSections = $col.find( 'section' ).filter( function(){ return $(this).is(':visible'); } ).length;
                                if( visibleSections === 0 ) $col.hide();
                            }
                        }
                    }, 0 );
                } );
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
        var $form, $title, $url, $section, $rmBtn, dialog,
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
        sectionsSelectHtml += '</select>';
        $section = $( sectionsSelectHtml ).val( sectionId );

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
                var $content = $( '<div>Bookmark \'' + undoInfo.title + '\' removed. <a href="#" class="undo">Undo (<span class="count">' + seconds + '</span>)</a></div>' );
                var note = ui.notify( 'Removed', $content ).hide( 6000 );
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
            url      : $el.attr( 'href' ),
            parentId : $el.closest( 'section' ).attr( 'id' ),
            index    : (function(){
                var $tiles = $el.closest('section').children('a').not('.add');
                for( var i=0; i<$tiles.length; i++ ) if( $tiles[i] === $el[0] ) return i;
                return null;
            })()
        };

        function refreshFaviconForUrl( anchorEl, url )
        {
            var $img = anchorEl.find( 'img' );
            try
            {
                var u    = new URL( url );
                var host = u.hostname;
                var cb   = Date.now() + '-' + Math.random().toString(36).slice(2);
                var src  = 'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent( url ) + '&sz=64&cb=' + cb;
                $img.attr( 'src', src );
            }
            catch(e){}
        }

        function showUndoNotification()
        {
            var seconds = 30, undone = false;
            var $content = $( '<div>Bookmark \'' + ($title.text()) + '\' updated. <a href="#" class="undo">Undo (<span class="count">' + seconds + '</span>)</a></div>' );
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
                    // Restore title/url
                    self.api.update( id, { title: prev.title, url: prev.url }, function()
                    {
                        var $cur = $( document.getElementById( id ) );
                        var $t = $cur.find('span');
                        $t.text( prev.title );
                        $cur.attr('href', prev.url );
                        $cur.attr('title', prev.title );
                        $cur.attr('aria-label', prev.title );
                        $cur.attr( 'data-title', prev.title );
                        $cur.data( 'title', prev.title );
                        refreshFaviconForUrl( $cur, prev.url );
                    } );
                } );
            });
        }

        this.api.update( id, props, function()
        {
            props.title && $title.text( props.title );
            if( props.url )
            {
                $el.attr( 'href', props.url );

                // Refresh favicon immediately using the same fallback strategy as rendering
                refreshFaviconForUrl( $el, props.url );
            }

            if( props.title )
            {
                $el.attr( 'title', props.title );
                $el.attr( 'aria-label', props.title );
                $el.attr( 'data-title', props.title );
                $el.data( 'title', props.title );
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

        try { new URL( value ); return value; } catch( e ) {}

        if( value.indexOf( '//' ) === 0 ) return 'https:' + value;

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

                    // Re-apply active search filter so nowo dodany link respektuje aktualne filtrowanie
                    var $input = $( '#search-input' );
                    if( $input.length )
                    {
                        var q = $input.val();
                        try {
                            var search = new mdash.Search( $input );
                            search.query = q;
                            search.filter();
                        } catch( e ) {}
                    }
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
    'use strict';
    
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

        $( '#bookmarks a' ).not( '.add,.drop-placeholder' ).each( function( _, el )
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

        $( '#bookmarks section' ).each( function( _, section )
        {
            var $section = $( section );
            var anyMatch = false;
            $section.find( 'a' ).not( '.add,.drop-placeholder' ).each( function( _, a )
            {
                var $a    = $( a );
                var title = $a.find( 'span' ).text() || $a.attr( 'data-title' ) || $a.data( 'title' );
                if( !regex || !title || regex.test( title ) )
                {
                    anyMatch = true;
                    return false;
                }
            } );

            if( document.documentElement.classList.contains( 'edit' ) )
            {
                $section.show();
                // In edit mode, still hide individual non-matching links so nowo dodane lub niematchujące nie widać przy aktywnym filtrze
            }
            else
            {
                $section.toggle( anyMatch );
            }
        } );

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


( function( mdash, $ )
{
    'use strict';
    
    var Dashboard = mdash.Dashboard = function() {},
        proto     = Dashboard.prototype;

    Dashboard.VERSION = '0.9.2';

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

        this.manager.init( this.loadBookmarks.bind( this ) );

        this.setupUIKit();

        this.keyboardManager.init();

        // Refresh icons action
        var _this = this;
        this.$refresh.on( 'click', function( e )
        {
            e.preventDefault();
            if( e.altKey )
            {
                ui.notify( 'Refreshing', 'Refreshing favicons…' );
                _this.refreshFavicons();
            }
            else
            {
                // Full page reload to mirror browser refresh and guarantee requests
                window.location.reload();
            }
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
        $( '#bookmarks a:not(.add) img' ).each( function( _, img )
        {
            var $img = $( img );
            var $a   = $img.closest( 'a' );
            var href = $a.attr( 'href' );
            try
            {
                var cb = Date.now() + '-' + Math.random().toString(36).slice(2);
                var src = 'https://www.google.com/s2/favicons?domain_url=' + encodeURIComponent( href ) + '&sz=64&cb=' + cb;
                $img.attr( 'src', src );
            }
            catch( e ) {}
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


