/*jshint node:true, laxcomma:true */

exports.init = function(startupTime, config, emitter) {

  "use strict";

  var http = require('http'),
    crypto = require('crypto'),
    URL    = require('url'),

    // todo: config
    INTERVAL = 60, // seconds

    // simple shared secret auth
    // todo: config
    SECRET = '0dvGtuZuvUF+W3hWTe7mSLG9/Iir8J',

    // todo: config
    hosts = ['http://127.0.0.1:1337'];

  // simple hashing auth to keep things ours
  function digest(epoch) {
    return crypto
      .createHash('sha1')
      .update(String(epoch))
      .update(SECRET)
      .digest('hex');
  }

  function errorHandler(err) { console.error(err); }

  function responseHandler(resp) {

    var data = "";
    resp.on('error', errorHandler);
    resp.on('data',  function(chunk) { data += chunk; });
    resp.on('end',   function() {

      try {

        JSON.parse(data).forEach(function(row) {
          // send each metric set to the backends
          emitter.emit('flush', row[0], JSON.parse(row[1]));
        });

      } catch (e) {
        console.error(e);
      }

    });

    (function poll(hosts) {

      while (hosts.length) {

        var req = http.request(URL.parse(hosts.shift())),
          epoch = new Date/1000|0;

        req.setHeader("Authorization", epoch+'|'+digest(epoch));
        req.on('error', errorHandler);
        req.on('response', responseHandler);
        req.end();

      }

      // after waiting, do it again
      setTimeout(function() {
        // todo: update from config each time
        poll(hosts);
      }, INTERVAL*1000);

    }(hosts));

    return true;
  }

};