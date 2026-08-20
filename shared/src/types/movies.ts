export type ReactionType = "like" | "dislike";

export interface MovieReactionRequest {
  reaction: ReactionType;
}

export interface MovieReactionResponse {
  tmdbId: number;
  reaction: ReactionType;
}

/**
 * One playable card in the personalised trailer feed.
 *
 * camelCase, unlike the TmdbMovie types beside it: those are TMDB passthroughs
 * and keep TMDB's field names, while this is a shape we define ourselves.
 */
export interface FeedMovie {
  tmdbId: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  genreIds: number[];
  /** Never null, movies without a trailer are filtered out server-side. */
  trailerKey: string;
  voteAverage: number;
}
