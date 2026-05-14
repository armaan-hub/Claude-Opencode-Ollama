const http = require('http');

const PROXY_URL = 'http://localhost:4001';

function getProxyStatus() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${PROXY_URL}/v1/models`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from proxy: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Proxy unreachable at ${PROXY_URL}: ${error.message}`));
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Proxy request timeout'));
    });
  });
}

module.exports = { getProxyStatus, PROXY_URL };
