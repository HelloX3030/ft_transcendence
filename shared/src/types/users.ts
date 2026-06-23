import type { LanguageCode } from "./auth";

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
}
