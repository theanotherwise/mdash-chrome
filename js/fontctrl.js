
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
    
} )( window.mdash || ( window.mdash = {} ) );