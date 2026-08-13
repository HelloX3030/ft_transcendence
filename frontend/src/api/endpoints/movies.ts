import { backendClient } from '../client';
import type {
  FeedMovie,
  MovieReactionRequest,
  MovieReactionResponse,
  ReactionType,
} from '@cinemates/shared';

export const moviesApi = {
  /**
   * @param exclude TMDB ids already on screen. The endpoint has no cursor, so
   * this is what makes a second call return the next films rather than the same
   * ones.
   */
  getFeed: (limit?: number, exclude?: number[]) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (exclude?.length) params.set('exclude', exclude.join(','));
    const query = params.toString();
    return backendClient<FeedMovie[]>(`/movies/feed${query ? `?${query}` : ''}`);
  },

  setReaction: (tmdbId: number, reaction: ReactionType) =>
    backendClient<MovieReactionResponse>(`/movies/${tmdbId}/rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reaction } satisfies MovieReactionRequest),
    }),
};
