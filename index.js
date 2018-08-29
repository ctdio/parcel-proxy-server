const fs = require('fs');
const https = require('https');
const express = require('express');
const Bundler = require('parcel-bundler');
const proxyMiddleware = require('http-proxy-middleware');
const open = require('open');
const selfSigned = require('selfsigned');

function generatePems() {
  let key;
  let cert;

  if (fs.existsSync('./server.key') && fs.existsSync('./server.cert')) {
    key = fs.readFileSync('./server.key');
    cert = fs.readFileSync('./server.cert');
  } else {
    const pems = selfSigned.generate(null, { days: 365 });
    key = pems.private;
    cert = pems.cert;

    fs.writeFileSync('./server.key', key);
    fs.writeFileSync('./server.cert', cert);
  }

  return { key, cert };
}

class Server {
  constructor (entryPoint, parcelOptions = {}, proxies = {}) {
    const { https: httpsOptions } = parcelOptions;

    if (httpsOptions) {
      if (httpsOptions === true) {
        this.httpsOptions = generatePems();
        parcelOptions.https = {
          key: './server.key',
          cert: './server.cert'
        }
      } else {
        const { cert, key } = httpsOptions;
        if (cert && key) {
          this.httpsOptions = httpsOptions;
        }
      }
    }

    if (parcelOptions.open === true || parcelOptions.open === undefined) {
      this.openBrowser = true
    }

    const outDir = parcelOptions.outDir || './dist';

    const bundler = this.bundler = new Bundler(entryPoint, parcelOptions);

    const app = this.app = express();

    app.use(
      ...Object.entries(proxies)
        .map(([ route, config ]) => proxyMiddleware(route, config)),
      bundler.middleware(),
      express.static(outDir)
    );
  }

  listen (port, callback) {
    const { app, openBrowser, httpsOptions } = this;
    let server;
    let protocol;

    if (httpsOptions) {
      server = https.createServer(httpsOptions, app)
      protocol = 'https';
    } else {
      server = app
      protocol = 'http';
    }

    const wrappedCallback = () => {
      if (open) {
        open(`${protocol}://localhost:${port}`);
      }
      callback();
    };

    server.listen(port, wrappedCallback);
  }
}

module.exports = Server;
