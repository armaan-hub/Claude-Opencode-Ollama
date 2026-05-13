// tests/oauth_state.test.js
const assert = require('assert');
try {
  const { saveOauthState, readOauthState, deleteOauthState } = require('../lib/oauth_state');
  const state = 'test-' + Date.now();

  if (!saveOauthState(state)) throw new Error('saveOauthState returned false');
  const read = readOauthState();
  assert(read && read.state === state, `readOauthState() returned ${JSON.stringify(read)}`);

  deleteOauthState();
  const read2 = readOauthState();
  assert(read2 === null || read2.state === undefined, `expected null after delete, got ${JSON.stringify(read2)}`);

  console.log('PASS');
  process.exit(0);
} catch (e) {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
}
