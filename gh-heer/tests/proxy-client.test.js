const EventEmitter = require('events');
const http = require('http');

describe('proxy-client', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('getProxyStatus requests /v1/models and parses JSON', async () => {
    const calls = { url: null, timeout: null, destroyed: false };

    jest.spyOn(http, 'get').mockImplementation((url, callback) => {
      calls.url = url;

      const res = new EventEmitter();
      const req = new EventEmitter();
      req.setTimeout = (ms) => {
        calls.timeout = ms;
      };
      req.destroy = () => {
        calls.destroyed = true;
      };

      process.nextTick(() => {
        callback(res);
        res.emit('data', '{"data":[{"id":"gpt-4"}]}');
        res.emit('end');
      });

      return req;
    });

    const { getProxyStatus, PROXY_URL } = require('../lib/proxy-client');
    const result = await getProxyStatus();

    expect(calls.url).toBe(`${PROXY_URL}/v1/models`);
    expect(calls.timeout).toBe(5000);
    expect(result).toEqual({ data: [{ id: 'gpt-4' }] });
    expect(calls.destroyed).toBe(false);
  });

  test('getProxyStatus wraps network errors with proxy URL context', async () => {
    jest.spyOn(http, 'get').mockImplementation(() => {
      const req = new EventEmitter();
      req.setTimeout = () => {};
      process.nextTick(() => req.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:4001')));
      return req;
    });

    const { getProxyStatus, PROXY_URL } = require('../lib/proxy-client');
    await expect(getProxyStatus()).rejects.toThrow(
      `Proxy unreachable at ${PROXY_URL}: connect ECONNREFUSED 127.0.0.1:4001`
    );
  });

  test('getProxyStatus rejects invalid JSON responses', async () => {
    jest.spyOn(http, 'get').mockImplementation((url, callback) => {
      const res = new EventEmitter();
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.destroy = () => {};

      process.nextTick(() => {
        callback(res);
        res.emit('data', 'not-json');
        res.emit('end');
      });

      return req;
    });

    const { getProxyStatus } = require('../lib/proxy-client');
    await expect(getProxyStatus()).rejects.toThrow('Invalid JSON from proxy:');
  });

  test('getProxyStatus times out after 5000ms and destroys request', async () => {
    const calls = { destroyed: false };

    jest.spyOn(http, 'get').mockImplementation((url, callback) => {
      const res = new EventEmitter();
      const req = new EventEmitter();
      req.setTimeout = (ms, handler) => {
        expect(ms).toBe(5000);
        process.nextTick(handler);
      };
      req.destroy = () => {
        calls.destroyed = true;
      };

      process.nextTick(() => callback(res));
      return req;
    });

    const { getProxyStatus } = require('../lib/proxy-client');
    await expect(getProxyStatus()).rejects.toThrow('Proxy request timeout');
    expect(calls.destroyed).toBe(true);
  });
});
