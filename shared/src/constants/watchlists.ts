/**
 * Max length of a watchlist name, enforced identically by the zod schema in the
 * frontend and the DTO in the backend. The column is VarChar(255) and stays that
 * way — this is the product rule, not the storage limit.
 */
export const WATCHLIST_NAME_MAX_LENGTH = 50;

/**
 * Number of movie posters stitched into a watchlist's mosaic cover. A shared
 * contract, not a local choice: the backend takes exactly this many posters and
 * the frontend pads the row to exactly this many placeholders, so the two have
 * to move together or the cover renders short or overflows.
 */
export const WATCHLIST_COVER_LIMIT = 4;
