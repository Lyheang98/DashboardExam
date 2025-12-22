/**
 * Authentication Service
 */

import { apiClient, EXTERNAL_ENDPOINTS } from '../client';
import { logger } from '../../logger';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string | number;
    username: string;
    name: string;
    email: string;
    role: string;
    is_staff: boolean;
  };
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  name?: string;
}

export const authService = {
  async login(credentials: LoginCredentials) {
    const apiUrl = EXTERNAL_ENDPOINTS.AUTH.TOKEN;
    console.log('[AUTH] Calling external API:', apiUrl);
    logger.info(`Calling external API: ${apiUrl}`, 'AUTH');
    
    try {
      // Django REST Framework token endpoint expects form-data
      const formData = new URLSearchParams();
      formData.append('username', credentials.username);
      formData.append('password', credentials.password);
      
      console.log('[AUTH] Sending login request to:', apiUrl);
      logger.info(`Sending login request to: ${apiUrl}`, 'AUTH');
      
      // Use apiRequest with custom headers for form-data and shorter timeout
      const startTime = Date.now();
      const response = await apiClient.post(apiUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000, // 15 second timeout
      });
      const duration = Date.now() - startTime;
      
      console.log(`[AUTH] Response received after ${duration}ms: success=${response.success}`, response);
      logger.info(`Response received after ${duration}ms: success=${response.success}`, 'AUTH');

      if (!response.success) {
        const errorMsg = response.error || 'Login failed';
        console.log('[AUTH] Login failed, error:', errorMsg);
        console.log('[AUTH] Full response:', JSON.stringify(response));
        logger.warn(`Login failed: ${errorMsg}`, 'AUTH');
        
        // Provide user-friendly error messages
        const lowerError = errorMsg.toLowerCase();
        if (lowerError.includes('invalid') || lowerError.includes('incorrect') || lowerError.includes('credentials') || lowerError.includes('no active account')) {
          return { success: false, error: 'Invalid username or password. Please check your credentials.' };
        }
        if (lowerError.includes('timeout')) {
          return { success: false, error: 'Request timed out. Please try again.' };
        }
        if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection')) {
          return { success: false, error: 'Unable to connect to authentication server. Please check your internet connection.' };
        }
        
        return { success: false, error: errorMsg };
      }

      if (!response.data) {
        logger.warn('Login API returned no data', 'AUTH');
        return { success: false, error: 'Invalid response from server. Please try again.' };
      }

      const data = response.data as any;
      console.log('[AUTH] Response data:', JSON.stringify(data).substring(0, 500));
      console.log('[AUTH] Response data keys:', Object.keys(data));
      
      // Extract token - support multiple response formats
      const token = data.token || data.access_token || data.access || data.data?.token || data.accessToken || data.auth_token;
      
      if (!token) {
        console.error('[AUTH] No token found in response');
        console.error('[AUTH] Full response data:', JSON.stringify(data));
        logger.warn(`No token in response. Response keys: ${JSON.stringify(Object.keys(data))}`, 'AUTH');
        return { success: false, error: 'Invalid response format. No authentication token found.' };
      }
      
      console.log('[AUTH] Token extracted successfully');

      // Extract user data - handle various response formats
      const userData = data.user || data.data?.user || data;
      const user = {
        id: userData?.id || userData?.pk || userData?.user_id || credentials.username,
        username: userData?.username || credentials.username,
        name: userData?.name || userData?.full_name || userData?.username || credentials.username.split('@')[0] || credentials.username,
        email: userData?.email || userData?.email_address || credentials.username,
        role: userData?.role || userData?.user_role || userData?.groups?.[0] || 'user',
        is_staff: userData?.is_staff || userData?.is_admin || userData?.is_superuser || false,
      };

      logger.info(`Login successful for user: ${user.username}`, 'AUTH');
      return { success: true, token, user };
    } catch (error: any) {
      const errorMsg = error?.message || 'Login failed. Please check your connection.';
      logger.error(`Login service exception: ${errorMsg}`, 'AUTH', error);
      logger.error(`Error stack: ${error?.stack}`, 'AUTH');
      return { success: false, error: errorMsg };
    }
  },

  async register(data: RegisterData) {
    try {
      return await apiClient.post(EXTERNAL_ENDPOINTS.AUTH.TOKEN, data);
    } catch (error: any) {
      logger.error('Register error', 'AUTH', error);
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  async verifyToken(token: string) {
    try {
      return await apiClient.post(EXTERNAL_ENDPOINTS.AUTH.VERIFY, { token }, { token });
    } catch (error: any) {
      logger.error('Token verification error', 'AUTH', error);
      return { success: false, error: error.message || 'Token verification failed' };
    }
  },

  async refreshToken(refreshToken: string) {
    try {
      return await apiClient.post(EXTERNAL_ENDPOINTS.AUTH.REFRESH, { refresh: refreshToken });
    } catch (error: any) {
      logger.error('Token refresh error', 'AUTH', error);
      return { success: false, error: error.message || 'Token refresh failed' };
    }
  },
};

