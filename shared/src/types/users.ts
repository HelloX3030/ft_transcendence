import type { LanguageCode } from "./auth";

export type UserRole = "admin" | "user";

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  language?: LanguageCode;
  image?: string;
}

export interface UserMeResponse {
  id: number;
  username: string;
  email: string;
  language: LanguageCode;
  image: string | null;
  role: UserRole;
  genreIds: number[];
  actorIds: number[];
  directorIds: number[];
}
