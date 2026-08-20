/**
 * Bounds of a username, enforced identically by the zod schemas in the frontend
 * and the DTOs in the backend. The maximum is the column (`VarChar(32)`); the
 * minimum is the product rule.
 *
 * They live here because the two layers used to disagree — the API accepted
 * three characters that the profile form refused, so an account could hold a
 * name its owner was unable to save back.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
