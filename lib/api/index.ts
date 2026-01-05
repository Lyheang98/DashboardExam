/**
 * API Module - Single import point for all API functionality
 */

export { API_CONFIG, EXTERNAL_ENDPOINTS, INTERNAL_ENDPOINTS } from './config';
export { apiClient, apiRequest } from './client';
export { authService } from './services/auth.service';
export { usersService } from './services/users.service';
// schoolsService removed - use schoolService instead
export { studentsService } from './services/students.service';
export { studentIndexService } from './services/studentIndex.service';
export { studentDetailService } from './services/studentDetail.service';
export { provinceService } from './services/province.service';
export { districtService } from './services/district.service';
export { schoolService } from './services/school.service';
export { resultSubjectsService } from './services/resultSubjects.service';
export { leaderboardService } from './services/leaderboard.service';
export { studentTrackerService } from './services/studentTracker.service';
// studentService removed - use studentIndexService instead

export type { ApiResponse, RequestOptions, PaginationParams, PaginatedResponse } from './types';
export type { LoginCredentials, LoginResponse, RegisterData } from './services/auth.service';
export type { User, UserSearchParams, UsersListResponse } from './services/users.service';
export type { School, SchoolSearchParams, SchoolServiceResponse, SchoolData, SchoolServiceParams } from './services/school.service';
// SchoolsListResponse is now SchoolServiceResponse from school.service
import type { SchoolServiceResponse } from './services/school.service';
export type SchoolsListResponse = SchoolServiceResponse;
// Export Student types from students.service
export type { Student, StudentsListResponse, StudentsListParams } from './services/students.service';
export type { DistrictSummary, SchoolSummary, StudentIndexListResponse } from './services/studentIndex.service';
export type { StudentDetail, StudentDetailResponse, StudentDetailParams } from './services/studentDetail.service';
export type { ProvinceData, ProvinceServiceResponse, ProvinceServiceParams } from './services/province.service';
export type { DistrictData, DistrictServiceResponse, DistrictServiceParams } from './services/district.service';
export type { ResultSubject, ResultSubjectsResponse, ResultSubjectsParams } from './services/resultSubjects.service';
export type { LeaderboardEntry, LeaderboardResponse, LeaderboardParams } from './services/leaderboard.service';
export type { StudentTrackerEntry, StudentTrackerStats, MonthlyComparisonData, StudentTrackerResponse, StudentTrackerParams } from './services/studentTracker.service';
// StudentServiceResponse removed - use StudentIndexListResponse from studentIndexService instead

