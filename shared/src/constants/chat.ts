/**
 * Max length of a chat message body, enforced identically by the frontend
 * composer and the backend DTO. The column is VarChar(2000). The frontend needs
 * the value: a body only the server rejects is refused by a pipe that runs before
 * the gateway handler, so the send would go unacknowledged.
 */
export const MESSAGE_MAX_LENGTH = 2000;
