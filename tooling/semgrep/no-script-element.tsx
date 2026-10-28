export function A() {
  // ruleid: no-script-element
  return <script src="/x.js" />;
}

export function B() {
  // ruleid: no-script-element
  return <script>{'x'}</script>;
}

export function C() {
  // ok: no-script-element
  return <div />;
}
