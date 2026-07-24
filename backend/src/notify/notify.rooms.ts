/**
 * Room names used by the notify namespace. Building these inline invites typos
 * (`user :${id}`) that silently drop every delivery instead of failing loudly.
 */

/** Holds every socket of one user, i.e. all of their open tabs. */
export const userRoom = (userId: number) => `user:${userId}`;

/**
 * Holds everyone watching `userId`'s presence. Status updates are published
 * under the same name as an event, so the two always stay in sync.
 */
export const onlineStatusRoom = (userId: number) => `online-status:${userId}`;
