export type UserRole = "admin" | "user";

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  /** No `image`: avatars are set only via POST /users/me/avatar. */
}

export interface OnboardingRequest {
  /** TMDB ids of the movies the user picked during onboarding. */
  movieIds: number[];
}

export interface UserMeResponse {
  id: number;
  username: string;
  email: string;
  /** Id of the stored avatar; the client builds `/files/:id` from it. */
  avatarFileId: number | null;
  role: UserRole;
  onboardingCompleted: boolean;
  genreIds: number[];
  actorIds: number[];
  directorIds: number[];
  totpActive: boolean;
}

export interface GetUserRequest {
  id: number;
}

export interface GetUserResponse {
  id: number;
  avatarFileId: number | null;
  username: string;
}

/**
 * The profile page's read. Everything in GetUserResponse, plus the taste the
 * onboarding derived — deliberately not email, role or totpActive.
 */
export interface UserProfileResponse extends GetUserResponse {
  genreIds: number[];
  actorIds: number[];
  directorIds: number[];
}

export interface UserSearchResponse {
  page: number;
  limit: number;
  total: number;
  results: GetUserResponse[];
}
