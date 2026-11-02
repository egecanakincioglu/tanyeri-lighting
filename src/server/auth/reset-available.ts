import { isDemoMode, isEmailEnabled } from '../env.ts';

// Resetting by email needs outgoing email, and the demo refuses the endpoints. Without it the pages say so and the
// sign-in page hides its link; recovery is then the command on the server.
export function isPasswordResetAvailable(): boolean {
  return isEmailEnabled() && !isDemoMode();
}
