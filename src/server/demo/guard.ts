import { isDemoMode } from '../env.ts';

// The one place that refuses writes in demo mode. Content write services call it right after the session guard.

export class DemoModeError extends Error {
  constructor() {
    super('This action is disabled in demo mode');
    this.name = 'DemoModeError';
  }
}

// Decided on every call, not when the module is imported.
export function assertWritable(): void {
  if (isDemoMode()) throw new DemoModeError();
}

// Route handlers use demoModeResponse(error); Server Actions catch DemoModeError themselves.
export function demoModeResponse(error: unknown): Response | undefined {
  if (!(error instanceof DemoModeError)) return undefined;
  return Response.json({ error: error.message }, { status: 403 });
}
