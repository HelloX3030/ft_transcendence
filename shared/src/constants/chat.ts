/**
 * Max length of a chat message body, enforced identically by the composer in the
 * frontend and the DTO in the backend. The column is VarChar(2000), so this is
 * the storage limit as much as the product rule.
 *
 * It lives here because the frontend has to know it: a body that only the server
 * rejects is rejected by a pipe that runs before the gateway handler, and that
 * path used to leave the send with no acknowledgement at all.
 */
export const MESSAGE_MAX_LENGTH = 2000;
