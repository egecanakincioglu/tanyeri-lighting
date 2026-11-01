import { isDemoMode } from '../env.ts';

// The one place that refuses writes in demo mode (ADR 0003 rule 8). Every content write service calls it right after
// the session guard, so a signed-in demo admin can read everything and change nothing.

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

// Route handlers: `catch (error) { return demoModeResponse(error) ?? Response.json(...) }`. Server Actions catch
// DemoModeError themselves and map it to a result for the form, like UnauthorizedError.
export function demoModeResponse(error: unknown): Response | undefined {
  if (!(error instanceof DemoModeError)) return undefined;
  return Response.json({ error: error.message }, { status: 403 });
}
