# parcel-proxy-server

A small wrapper around the parcel development server
that adds support for proxies, just like `webpack`.

## Installation

```bash
yarn add parcel parcel-proxy-server
```

or

```bash
npm install parcel parcel-proxy-server
```

## Usage

This project exposes an api for starting up a proxy server.

### API

Example:

```js
const ParcelProxyServer = require('parcel-proxy-server');

// configure the proxy server
const server = new ParcelProxyServer({
  entryPoint: './path/to/my/entry/point',
  parcelOptions: {
    // provide parcel options here
    // these are directly passed into the
    // parcel bundler
    //
    // More info on supported options are documented at
    // https://parceljs.org/api
    https: true
  },
  proxies: {
    // add proxies here
    '/api': {
      target: 'https://example.com/api'
    }
  }
});

// the underlying parcel bundler is exposed on the server
// and can be used if needed
server.bundler.on('buildEnd', () => {
  console.log('Build completed!');
});

// start up the server
server.listen(8080, () => {
  console.log('Parcel proxy server has started');
});
```

## How it works

This wrapper doesn't do too much under the hood.
A `parcel` bundler is created using the configuration that is passed in.
An `express` server is started and `http-proxy-middleware` is used
to apply proxies. The bundler middleware then applied to the express
server to serve files.

To preserve some of the behaviour that the vanilla
`parcel serve` command supports, the project.

For example, if the `https` option is set to `true`,
the server will generate certs and provide that
to the server that gets created so that things like `HMR` can still function.
