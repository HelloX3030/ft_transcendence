export type LanguageCode = 'de' | 'en' | 'es';
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
    language: LanguageCode;
}
export interface AuthUserResponse {
    id: number;
    username: string;
    email: string;
    language: LanguageCode;
    image: string | null;
}
