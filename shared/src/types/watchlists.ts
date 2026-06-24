export type WatchlistRole = "editor" | "viewer";

export interface WatchlistMovieRequest {
  tmdbId: number;
}

export interface WatchlistCreateRequest {
  name: string;
  image?: string;
}

export interface WatchlistUpdateRequest {
  name?: string;
  image?: string;
}

export interface WatchlistResponse {
  id: number;
  name: string;
  image: string | null;
  role: WatchlistRole;
  createdAt: Date;
}

export interface WatchlistUserRequest {
  userId: number;
  role: WatchlistRole;
}

export interface WatchlistRoleRequest {
  role: WatchlistRole;
}
