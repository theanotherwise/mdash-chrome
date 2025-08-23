
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
    
} )( window.mdash || ( window.mdash = {} ) );
