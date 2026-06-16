import { apiResponse } from 'src/types/helper';

export function successResponse<T>(
  data: T | null,
  message = 'executed successfully',
): apiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}
