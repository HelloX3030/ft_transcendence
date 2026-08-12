export type ReactionType = "like" | "dislike";

export interface MovieReactionRequest {
  reaction: ReactionType;
}

export interface MovieReactionResponse {
  tmdbId: number;
  reaction: ReactionType;
}
