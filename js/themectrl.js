( function( mdash )
{
    var KEY = 'mdash:theme';

    var ThemeCtrl = mdash.ThemeCtrl = function( $links )
    {
        this.$links = $links;
    };

    ThemeCtrl.prototype.init = function()
    {
        var saved = localStorage.getItem( KEY );
        if( saved === 'dark' )
        {
            document.documentElement.classList.add( 'theme-dark' );
            this.select( 'dark' );
        }
        else
        {
            this.select( 'light' );
        }

        this.$links.on( 'click', this.onClick.bind( this ) );
    };

    ThemeCtrl.prototype.select = function( theme )
    {
        this.$links.removeClass( 'selected' );
        this.$links.parent().find( 'a[data-theme="' + theme + '"]' ).addClass( 'selected' );
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
    };

} )( window.mdash || ( window.mdash = {} ) );


