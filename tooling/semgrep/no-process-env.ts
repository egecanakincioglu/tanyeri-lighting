// ruleid: no-process-env
const a = process.env.DATABASE_URL;
// ruleid: no-process-env
const b = process.env['SECRET'];
// ok: no-process-env
const c = import.meta.url;
