//LeiaCore Version
'use strict';
var REVISION = "0.1";

/**
 * LeiaDisplay
 *
 * @param url
 * @constructor
 */
function LeiaDisplayInfo(url) {
    this.version = REVISION;
    var self = this;

    function handler() {
      if(this.status == 200){
        var data = JSON.parse(this.responseText);
        self.info = data.info;
      } else {
        throw new Error('LeiaCore: Cannot read file ', url);
      }
    }

    if (url == undefined) {
        throw new Error('LeiaCore: must define configuration file when initializing LeiaDisplay().')
    } else {
        var client = new XMLHttpRequest();
        client.onload = handler;
        client.open('GET', url, false);
        client.send();
    }
}
