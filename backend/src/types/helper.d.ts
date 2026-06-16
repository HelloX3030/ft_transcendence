export interface apiResponse<T> {
  success: true;
  message?: string;
  error?: string;
  statusCode?: number;
  data?: T | null;
}
