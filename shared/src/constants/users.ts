/**
 * Bounds of a username, enforced identically by the zod schemas in the frontend
 * and the DTOs in the backend. The maximum is the column (`VarChar(32)`); the
 * minimum is the product rule.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
