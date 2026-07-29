export const DEFAULT_MAX_LENGTH = 255;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MAX_LENGTH = 512;

export const FRIENDS_TITLE = 'Friends';

export const WATCHLISTS_TITLE = 'Watchlists';

export const NEW_FRIEND_REQUEST = (user: string) =>
  `You have received a new friend request from ${user}.`;

export const FRIEND_REMOVED = (user: string) => `${user} has removed you as a friend.`;
export const FRIEND_REQUEST_CANCELLED = (user: string) =>
  `${user} has cancelled their friend request.`;
export const FRIEND_REQUEST_DECLINED = (user: string) =>
  `${user} has declined your friend request.`;

export const FRIEND_REQUEST_ACCEPTED = (user: string) =>
  `${user} has accepted your friend request.`;

export const WATCHLIST_USER_ADDED = (watchlist: string) =>
  `You have been added to the watchlist "${watchlist}".`;

export const WATCHLIST_USER_REMOVED = (watchlist: string) =>
  `You have been removed from the watchlist "${watchlist}".`;

export const MOVIE_ADDED_TO_WATCHLIST = (user: string, movie: string, watchlist: string) =>
  `${user} added "${movie}" to the watchlist "${watchlist}".`;

export const MOVIE_REMOVED_FROM_WATCHLIST = (user: string, movie: string, watchlist: string) =>
  `${user} removed "${movie}" from the watchlist "${watchlist}".`;

export const WATCHLIST_DELETED = (user: string, watchlist: string) =>
  `${user} deleted the watchlist "${watchlist}".`;

export const SYSTEM_SENDER_ID = -1;
