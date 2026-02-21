chrome.runtime.onMessage.addListener( function( msg, sender, sendResponse )
{
    if( msg && msg.type === 'cacheFavicon' && msg.url )
    {
        fetch( msg.url )
            .then( function( r ){ return r.arrayBuffer(); } )
            .then( function( buf )
            {
                var bytes = new Uint8Array( buf );
                var bin = '';
                for( var i = 0; i < bytes.length; i++ ) bin += String.fromCharCode( bytes[i] );
                var b64 = 'data:image/png;base64,' + btoa( bin );
                if( msg.key )
                {
                    var store = {};
                    store[ msg.key ] = b64;
                    chrome.storage.local.set( store );
                }
                sendResponse({ data: b64 });
            } )
            .catch( function(){ sendResponse({ data: null }); } );
        return true;
    }
} );
