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
            this.select( 'dark' );
        }
        else if( saved === 'light' )
        {
            this.select( 'light' );
        }
        else
        {
            // default to light
            localStorage.setItem( KEY, 'light' );
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
        }
        else
        {
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


