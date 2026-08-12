import { backendClient } from '../client';
import type {
  FeedMovie,
  MovieReactionRequest,
  MovieReactionResponse,
  ReactionType,
} from '@cinemates/shared';

export const moviesApi = {
  getFeed: (limit?: number) =>
    backendClient<FeedMovie[]>(`/movies/feed${limit ? `?limit=${limit}` : ''}`),

  setReaction: (tmdbId: number, reaction: ReactionType) =>
    backendClient<MovieReactionResponse>(`/movies/${tmdbId}/rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reaction } satisfies MovieReactionRequest),
    }),
};
