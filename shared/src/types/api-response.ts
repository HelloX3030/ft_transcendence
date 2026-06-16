export interface apiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  statusCode?: number;
  data?: T | null;
}
