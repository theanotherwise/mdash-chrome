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
            var title = $el.data( 'title' ) || $el.attr( 'data-title' ) || $el.find( 'span' ).text();

            if( !regex || !title || regex.test( title ) )
            {
                $el.show();
            }
            else
            {
                $el.hide();
            }
        } );
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


