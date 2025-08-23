
( function( mdash, $ )
{

    var Dashboard = mdash.Dashboard = function() {},
        proto     = Dashboard.prototype;

    Dashboard.VERSION = '0.9.2';

    proto.init = function()
    {
        this.$fontSizes  = $( '#fontctrl > a' );
        this.$helpCtrl   = $( '#helpctrl' );
        this.$themeCtrl  = $( '#themectrl > a' );
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

        $( document ).on( 'keyup', '#dialog', function( e )
        {
            var $dialog = $( '#dialog' );

            if( e.keyCode === 13 /* enter */ )
            {
                $dialog.find( 'button.ok' ).click();
            }
            else if( e.keyCode === 27 /* esc */ )
            {
                $dialog.find( 'button.cancel' ).click();
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

} )( window.mdash || ( window.mdash = {} ), window.jQuery || window.Zepto );
