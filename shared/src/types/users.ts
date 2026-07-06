import type { LanguageCode } from "./auth";

export type UserRole = "admin" | "user";

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  language?: LanguageCode;
  image?: string;
}

export interface OnboardingRequest {
  /** TMDB ids of the movies the user picked during onboarding. */
  movieIds: number[];
}

export interface UserMeResponse {
  id: number;
  username: string;
  email: string;
  language: LanguageCode;
  image: string | null;
  role: UserRole;
  onboardingCompleted: boolean;
  genreIds: number[];
  actorIds: number[];
  directorIds: number[];
}

export interface GetUserRequest {
  id: number;
}

export interface GetUserResponse {
  id: number;
  image: string | null;
  username: string;
}
