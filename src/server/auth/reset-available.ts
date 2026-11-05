import { isDemoMode, isEmailEnabled } from '../env.ts';

// Reset needs outgoing email, and the demo refuses the endpoints.
// When off, the pages say so and recovery is a server command.
export function isPasswordResetAvailable(): boolean {
  return isEmailEnabled() && !isDemoMode();
}
