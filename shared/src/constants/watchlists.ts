/**
 * Max length of a watchlist name, enforced identically by the zod schema in the
 * frontend and the DTO in the backend. The column is VarChar(255) and stays that
 * way — this is the product rule, not the storage limit.
 */
export const WATCHLIST_NAME_MAX_LENGTH = 50;
