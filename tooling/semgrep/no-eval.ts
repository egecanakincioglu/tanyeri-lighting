// ruleid: no-eval
eval('1 + 1');
// ruleid: no-eval
const f = new Function('return 1');
// ok: no-eval
const g = () => 1;
