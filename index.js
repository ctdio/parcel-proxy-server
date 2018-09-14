const fs = require('fs');
const https = require('https');
const express = require('express');
const Bundler = require('parcel-bundler');
const proxyMiddleware = require('http-proxy-middleware');
const opn = require('opn');
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

class ParcelProxyServer {
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
      console.warn('Parcel dev server with https = false');

      this.httpsOptions = null;
      parcelOptions.https = false;
    }

    this.openApp = parcelOptions.open;

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
    const { app, openApp, httpsOptions } = this;
    let server;
    let protocol;

    if (httpsOptions) {
      server = https.createServer(httpsOptions, app)
      protocol = 'https';
    } else {
      server = app
      protocol = 'http';
    }

    const wrappedCallback = async function () {
      if (openApp) {
        const options = typeof openApp === 'string' ? {app: openApp} : undefined;
        try {
          await opn(`${protocol}://localhost:${port}`, options);
        } catch (err) {
          console.warn(`Warning: unable to open app (open=${openApp}) Reason: ${err.message}`);
        }
      }
      callback();
    };

    server.listen(port, wrappedCallback);
  }
}

module.exports = ParcelProxyServer;
