import { backendClient } from '../client';
import type { MovieReactionRequest, MovieReactionResponse, ReactionType } from '@cinemates/shared';

export const moviesApi = {
  setReaction: (tmdbId: number, reaction: ReactionType) =>
    backendClient<MovieReactionResponse>(`/movies/${tmdbId}/rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reaction } satisfies MovieReactionRequest),
    }),
};
