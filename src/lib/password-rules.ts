// The length rules for the admin password, shared by the auth options, the account action, the reset forms and the
// seed, so they can not drift apart. 128 is the upper limit of the authentication library.
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
