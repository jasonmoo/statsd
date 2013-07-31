/*jshint node:true, laxcomma:true */

exports.init = function(startupTime, config, emitter) {
  "use strict";

  var crypto = require('crypto'),
    zlib = require('zlib'),

    // todo: config this
    BUFFER_SIZE = 10,

    // simple shared secret auth
    SECRET = '0dvGtuZuvUF+W3hWTe7mSLG9/Iir8J',

    // store up to BUFFER_SIZE metric flushes
    circular_buffer = new Array(BUFFER_SIZE),

    // index of the buffer
    idx = 0;

  function digest(epoch) {
    return crypto
      .createHash('sha1')
      .update(epoch)
      .update(SECRET)
      .digest('hex');
  }

  // bind to the flush event
  emitter.on('flush', function(timestamp, metrics) {

    try {
      // store json of the metrics object to ensure snapshot
      circular_buffer[idx++%BUFFER_SIZE] = [timestamp, JSON.stringify(metrics)];
    } catch (e) {
      console.error(e);
    }

  });

  // set up a little http endpoint for payload service
  require('http').createServer(function (req, res) {

    // handle auth
    // expect timestamp | sha1(timestamp + secret)
    var token = req.getHeader('Authorization').split('|');

    if (token.length != 2 || digest(token[0]) !== token[1]) {
      // 401 Unauthorized
      res.writeHead(401);
      res.end();
      return;
    }

    if (idx === 0) {
      // 204 No Content
      res.writeHead(204);
      res.end();
      return;
    }

    // sort the buffer by timestamp and dump the whole thing as json
    var data = JSON.stringify(circular_buffer.sort(function(a, b) { return a[0] > b[0]; }));

    // reset index/buffer
    circular_buffer = new Array(BUFFER_SIZE);
    idx = 0;

    res.setHeader('Content-Type', 'application/json; charset=UTF-8');

    // if the client accepts compressed data, send it gzipped
    if (req.getHeader('Accept-Encoding').indexOf('gzip') !== -1) {

      zlib.gzip(data, function(err, result) {

        if (err) {
          // deliver the payload uncompressed if there's an error
          res.end(data);
          console.error(err);
        } else {
          res.setHeader('Content-Encoding', 'gzip');
          res.end(result);
        }

      });

      return;

    }

    // default send uncompressed
    res.end(data);

  // todo: config port
  }).listen(8008);

  return true;
};
