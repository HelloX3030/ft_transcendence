export type WatchlistRole = "editor" | "viewer";

export interface WatchlistMovieRequest {
  tmdbId: number;
}
export interface WatchlistMovieResponse {
  tmdbId: number;
  name: string;
}

export interface WatchlistCreateRequest {
  name: string;
  image?: string;
}

export interface WatchlistUpdateRequest {
  name?: string;
  image?: string;
}

export interface WatchlistRequest {
  watchlistId: number;
}

export interface WatchlistResponse {
  id: number;
  name: string;
  image: string | null;
  posterPaths: string[];
  role: WatchlistRole;
  editorIds: number[];
  createdAt: Date | string;
}

export interface WatchlistUserCreateRequest {
  userId: number;
  role: WatchlistRole;
}

export interface WatchlistMovieResponse {
  id: number;
  tmdbId: number;
  name: string;
  posterPath: string | null;
}

export interface WatchlistUserRequest {
  watchlistId: number;
}

export interface WatchlistUserResponse {
  userId: number;
  role: WatchlistRole;
}

export interface WatchlistRoleRequest {
  role: WatchlistRole;
}
