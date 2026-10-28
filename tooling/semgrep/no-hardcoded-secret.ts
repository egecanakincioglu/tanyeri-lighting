declare const cfg: any;

// ruleid: no-hardcoded-secret
const apiKey = 'abc123';
// ruleid: no-hardcoded-secret
let dbPassword = 'hunter2';
// ruleid: no-hardcoded-secret
cfg.authToken = 'xyz';
// ruleid: no-hardcoded-secret
const opts = { clientSecret: 'shh' };
// ok: no-hardcoded-secret
const emptyToken = '';
// ok: no-hardcoded-secret
const title = 'hello';
// ok: no-hardcoded-secret
const keyFromEnv = cfg.key;
