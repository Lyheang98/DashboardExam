# Leaderboard API Integration - Best Practices Guide

## Problem Analysis

The original code had several critical issues:

### ❌ Anti-Pattern: Hardcoded API URLs
```tsx
// BAD - Hardcoded URL with query parameters
const url = `https://moeys-exam-qbfys.ondigitalocean.app/api/v1/result/result-subjects/?province_id=2&district_name=...`;
```

**Problems:**
- API expects **hierarchical path parameters**, not query parameters
- Hardcoded URLs are brittle and hard to maintain
- No centralized configuration
- Difficult to test or switch endpoints

### ❌ Anti-Pattern: Raw Fetch Instead of Service Layer
```tsx
// BAD - Direct fetch calls in component
const response = await fetch(url, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  signal: abortController.signal,
});
```

**Problems:**
- API logic mixed with UI logic
- No reusability across components
- Error handling scattered throughout
- Difficult to add rate limiting, retries, or caching
- Response normalization done in component
- Testing becomes complex

---

## ✅ Best Practice Solution

### 1. **Centralized API Configuration**

Located in [lib/api/config.ts](lib/api/config.ts):

```typescript
export const EXTERNAL_ENDPOINTS = {
  RESULT_SUBJECTS: {
    BASE: `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/`,
    BY_PROVINCE: (provinceName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/`,
    BY_GRADE: (provinceName: string, districtName: string, geipSchoolId: string, gradeName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/grades/${encodeURIComponent(gradeName)}/`,
    // ... more endpoints
  }
}
```

**Benefits:**
- ✅ Single source of truth for all API endpoints
- ✅ Easy to update or switch environments
- ✅ Proper URL encoding via `encodeURIComponent()`
- ✅ Hierarchical endpoint structure matches API design

---

### 2. **Service Layer for API Operations**

Located in [lib/api/services/resultSubjects.service.ts](lib/api/services/resultSubjects.service.ts):

```typescript
export const resultSubjectsService = {
  async getList(
    token: string,
    params: ResultSubjectsParams = {},
    signal?: AbortSignal
  ): Promise<ResultSubjectsResponse> {
    // Build endpoint dynamically based on parameters
    const endpoint = buildEndpoint(params);
    const queryParams = buildQueryParams(params);
    const url = `${endpoint}?${queryParams.toString()}`;
    
    // Call external API with proper error handling
    const response = await apiClient.get<any>(url, { token, signal });
    
    // Normalize response to consistent format
    const normalizedData = normalizeResultSubjectsResponse(response.data);
    
    return {
      success: response.success,
      data: normalizedData,
      error: response.error,
    };
  }
}
```

**Benefits:**
- ✅ **Separation of Concerns**: API logic isolated from UI
- ✅ **Reusability**: Used across multiple components
- ✅ **Consistency**: Same error handling and response normalization everywhere
- ✅ **Testability**: Easy to mock and test
- ✅ **Maintainability**: Changes to API logic don't affect components
- ✅ **Built-in Features**: 
  - Rate limiting (via apiClient)
  - Retries (via apiClient)
  - Request cancellation support
  - Response normalization

---

### 3. **Clean Component Usage**

In [app/dashboard/leaderboard/all/page.tsx](app/dashboard/leaderboard/all/page.tsx):

```tsx
const fetchLeaderboard = useCallback(
  async (filters: LeaderboardParams, pageNum: number) => {
    try {
      const token = getToken();
      
      // Use service with clean, readable parameters
      const response = await resultSubjectsService.getList(
        token,
        {
          provinceName: filters.provinceName,  // Key: Use province NAME, not ID
          districtName: filters.districtName,
          geipSchoolId: filters.geipSchoolId,
          gradeName: filters.gradeName,
          room: filters.room,
          limit: 10000,
          forceMonthlyEndpoint: false,
        },
        abortController.signal
      );

      if (!response.success) {
        setError(response.error);
        return;
      }

      // Process response
      setRawApiData(response.data || []);
    } catch (error) {
      setError(error.message);
    }
  },
  [provinces]
);
```

**Benefits:**
- ✅ **Clean and Readable**: No fetch/fetch logic, just service call
- ✅ **Type Safe**: Full TypeScript support
- ✅ **Error Handling**: Centralized in service
- ✅ **Focused**: Component only handles UI state

---

## Key Differences: Query Parameters vs Hierarchical Paths

### ❌ Query Parameter Approach (What Doesn't Work)
```
GET /api/v1/result/result-subjects/?province_id=2&district_name=Bati&geip_school_id=39&grade_name=7
```
- ❌ Returns 404 - API doesn't recognize this endpoint
- ❌ Not RESTful
- ❌ Hard to scale with more hierarchies

### ✅ Hierarchical Path Approach (What Works)
```
GET /api/v1/result/result-Subjects/[Province Name]/districts/[District Name]/schools/[School ID]/grades/[Grade]/
```
- ✅ Follows REST principles
- ✅ Scalable and composable
- ✅ API can enforce relationships

---

## Critical Parameter Mapping

| Variable | Expected by Service | Source |
|----------|----------------------|---------|
| `provinceName` | **Province NAME** (e.g., "Banteay Mean Chey") | `provinces.find(...).province_name` |
| `provinceId` | Numeric ID (e.g., "2") | Direct from filter state |
| `districtName` | District name | Direct from filter state |
| `geipSchoolId` | School ID (sanitized) | From schools dropdown |
| `gradeName` | Grade number (e.g., "7") | From grade selector |

**Common Mistake:**
```tsx
// WRONG - Passing province ID to province name parameter
provinceName: filters.provinceId  // ❌ Causes 404

// CORRECT - Map ID to name
const province = provinces.find(p => p.province_id === filters.provinceId);
provinceName: province.province_name  // ✅ Works
```

---

## Data Validation & Sanitization

### School ID Sanitization
```tsx
// In school data loading
const sanitizeSchoolId = (id: string): string => {
  return String(id)
    .trim()
    .replace(/-+$/, '')  // Remove trailing hyphens
    .replace(/^\d+-/, (match) => match.slice(0, -1))
    .trim();
};
```

### Filtering Invalid Data
```tsx
const uniqueSchools = schoolsData
  .map(s => ({
    // ... mapping
    geip_school_ID: sanitizeSchoolId(rawSchoolId),
  }))
  .filter((s: any) => s.school_name && s.school_name.trim() && s.geip_school_ID)
  // ✅ Excludes schools with empty or invalid IDs
  .sort((a, b) => a.school_name.localeCompare(b.school_name));
```

---

## Error Handling Best Practices

### Service-Level Error Handling
```typescript
// In resultSubjectsService.getList()
if (!response.success) {
  const is404EmptyState = errorMessage.includes('404');
  
  if (is404EmptyState && forceMonthlyEndpoint) {
    // Treat as empty state, not error
    return {
      success: true,
      data: [],
      count: 0,
    };
  }
  
  return {
    success: false,
    error: response.error,
  };
}
```

### Component-Level Error Handling
```tsx
// In component
if (!response.success) {
  logger.error('[LEADERBOARD] Service error', 'LEADERBOARD', response.error);
  setError(response.error);
  return;
}
```

---

## Testing Advantages

With the service-based approach:

```typescript
// Easy to mock
jest.mock('@/lib/api/services/resultSubjects.service', () => ({
  resultSubjectsService: {
    getList: jest.fn().mockResolvedValue({
      success: true,
      data: mockLeaderboardData,
    })
  }
}));

// Component test is simple
it('should display leaderboard data', async () => {
  render(<LeaderboardAllPage />);
  expect(mockService.getList).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ provinceName: 'Banteay Mean Chey' }),
    expect.any(AbortSignal)
  );
});
```

---

## Summary: Why This Approach Works

| Aspect | Benefit |
|--------|---------|
| **Centralized Config** | Single source of truth for endpoints |
| **Service Layer** | Separation of concerns, reusability |
| **Type Safety** | TypeScript catches errors at compile time |
| **Error Handling** | Consistent error handling across app |
| **Testability** | Easy to mock and test |
| **Maintainability** | Changes isolated to service layer |
| **Performance** | Built-in rate limiting and retries |
| **Scalability** | Easy to add caching, monitoring, etc. |

---

## Implementation Checklist

- ✅ Use `resultSubjectsService.getList()` instead of raw fetch
- ✅ Pass `provinceName`, not `provinceId`
- ✅ Sanitize school IDs from API responses
- ✅ Validate all required parameters before calling service
- ✅ Handle both success and error responses
- ✅ Use proper TypeScript types
- ✅ Log important operations for debugging
- ✅ Support request cancellation (AbortSignal)
