import type { GetUserResponse } from '@trailertinder/shared';
import { backendClient } from '../client';

export const userApi = {
  getById: (id: number) => backendClient<GetUserResponse>(`/users/${id}`),
};
