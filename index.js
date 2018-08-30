const fs = require('fs');
const https = require('https');
const express = require('express');
const Bundler = require('parcel-bundler');
const proxyMiddleware = require('http-proxy-middleware');
const open = require('open');
const selfSigned = require('selfsigned');

const DEFAULT_PEM_PATHS = {
  key: './server.key',
  cert: './server.cert'
};

function generatePemsIfNotExists({ key: keyPath, cert: certPath } = DEFAULT_PEM_PATHS) {
  let key;
  let cert;

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    key = fs.readFileSync(keyPath);
    cert = fs.readFileSync(certPath);
  } else {
    const pems = selfSigned.generate(null, { days: 365 });
    key = pems.private;
    cert = pems.cert;

    fs.writeFileSync(keyPath, key);
    fs.writeFileSync(certPath, cert);
  }

  return { key, cert };
}

class Server {
  constructor ({ entryPoint, parcelOptions = {}, proxies = {} }) {
    const { https: httpsOptions } = parcelOptions;

    try {
      if (httpsOptions) {
        if (httpsOptions === true) {
          this.httpsOptions = generatePemsIfNotExists(DEFAULT_PEM_PATHS);
          parcelOptions.https = DEFAULT_PEM_PATHS;
        } else {
          const { cert, key } = httpsOptions;
          if (cert && key) {
            this.httpsOptions = generatePemsIfNotExists(httpsOptions);
          }
        }
      }
    } catch (err) {
      console.warn(`Error fetching ssl certs: ${err.message}`);
      console.warn('Starting dev server with https = false');

      this.httpsOptions = null;
      parcelOptions.https = false;
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
