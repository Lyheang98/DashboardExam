/**
 * Users Service
 */

import { apiClient, EXTERNAL_ENDPOINTS } from '../client';
import { logger } from '../../logger';

export interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface UserSearchParams {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface UsersListResponse {
  success: boolean;
  count: number;
  data: User[];
  error?: string;
}

export const usersService = {
  async getAll(token: string, params?: UserSearchParams) {
    try {
      const queryParams = new URLSearchParams();
      if (params?.q) queryParams.append('search', params.q);
      if (params?.role) queryParams.append('role', params.role);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const url = `${EXTERNAL_ENDPOINTS.USERS.LIST}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(url, { token });

      if (!response.success) {
        return { success: false, error: response.error || 'Failed to fetch users', data: [] };
      }

      const data = response.data as any;
      const users = Array.isArray(data) ? data : data.results || data.data || data.users || [];

      const formattedUsers = users
        .map((user: any): User => ({
          id: user.id || user.pk || user.user_id,
          name: user.name || user.full_name || user.username || '',
          email: user.email || user.email_address || '',
          role: user.role || user.user_role || 'User',
          status: user.status || (user.is_active ? 'active' : 'inactive'),
        }))
        .filter((user: User) => {
          const role = user.role?.toLowerCase() || '';
          return role === 'staff' || role === 'admin';
        });

      return { success: true, data: formattedUsers, count: formattedUsers.length };
    } catch (error: any) {
      logger.error('Get users error', 'USERS', error);
      return { success: false, error: error.message || 'Failed to fetch users', data: [] };
    }
  },

  async search(token: string, params: UserSearchParams) {
    return this.getAll(token, params);
  },

  async getById(token: string, id: string | number) {
    try {
      return await apiClient.get<User>(EXTERNAL_ENDPOINTS.USERS.DETAIL(id), { token });
    } catch (error: any) {
      logger.error(`Get user error: ${id}`, 'USERS', error);
      return { success: false, error: error.message || 'Failed to fetch user' };
    }
  },

  async create(token: string, userData: Partial<User>) {
    try {
      return await apiClient.post(EXTERNAL_ENDPOINTS.USERS.BASE, userData, { token });
    } catch (error: any) {
      logger.error('Create user error', 'USERS', error);
      return { success: false, error: error.message || 'Failed to create user' };
    }
  },

  async update(token: string, id: string | number, userData: Partial<User>) {
    try {
      return await apiClient.put(EXTERNAL_ENDPOINTS.USERS.UPDATE(id), userData, { token });
    } catch (error: any) {
      logger.error(`Update user error: ${id}`, 'USERS', error);
      return { success: false, error: error.message || 'Failed to update user' };
    }
  },

  async delete(token: string, id: string | number) {
    try {
      return await apiClient.delete(EXTERNAL_ENDPOINTS.USERS.DELETE(id), { token });
    } catch (error: any) {
      logger.error(`Delete user error: ${id}`, 'USERS', error);
      return { success: false, error: error.message || 'Failed to delete user' };
    }
  },
};

