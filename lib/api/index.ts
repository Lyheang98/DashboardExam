/**
 * API Module - Single import point for all API functionality
 */

export { API_CONFIG, EXTERNAL_ENDPOINTS, INTERNAL_ENDPOINTS } from './config';
export { apiClient, apiRequest } from './client';
export { authService } from './services/auth.service';
export { usersService } from './services/users.service';
export { schoolsService } from './services/schools.service';
export { studentsService } from './services/students.service';

export type { ApiResponse, RequestOptions, PaginationParams, PaginatedResponse } from './types';
export type { LoginCredentials, LoginResponse, RegisterData } from './services/auth.service';
export type { User, UserSearchParams, UsersListResponse } from './services/users.service';
export type { School, SchoolsListResponse, SchoolSearchParams } from './services/schools.service';
export type { ProvinceSummary, ProvinceSummaryResponse, ProvinceSummaryParams } from './services/students.service';

