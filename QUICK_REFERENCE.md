# Quick Reference: Leaderboard API Fix

## The Problem ❌
```
404 Not Found: GET /api/v1/result/result-subjects/?province_id=2&district_name=...&geip_school_id=39
```

**Why:** API expects hierarchical paths, not query parameters

---

## The Solution ✅

### Before
```tsx
// Hardcoded URL with query params
const url = `https://moeys-exam.../api/v1/result/result-subjects/?province_id=2&...`;
const response = await fetch(url, { /* ... */ });
```

### After
```tsx
// Service-based approach
const response = await resultSubjectsService.getList(token, {
  provinceName: "Banteay Mean Chey",  // Key: Use NAME, not ID
  districtName: "Kampong Chhnang",
  geipSchoolId: "39",
  gradeName: "7",
  limit: 10000,
  forceMonthlyEndpoint: false,
});
```

---

## Key Changes

| What | Old | New |
|------|-----|-----|
| **API Call** | `fetch()` | `resultSubjectsService.getList()` |
| **Province Param** | `provinceId` (ID) | `provinceName` (Name) |
| **Endpoint Type** | Query parameters | Hierarchical paths |
| **Error Handling** | Scattered | Centralized in service |
| **Response Format** | Manual parsing | Service normalized |

---

## Critical Parameter

```tsx
// WRONG ❌
provinceName: filters.provinceId  // Passing ID as province name

// CORRECT ✅
const province = provinces.find(p => p.province_id === filters.provinceId);
provinceName: province.province_name  // Passing actual name
```

---

## Endpoint Structure

```
Query Param Approach (❌ DOESN'T WORK):
GET /api/v1/result/result-subjects/?province_id=2&district_name=...

Hierarchical Path Approach (✅ WORKS):
GET /api/v1/result/result-Subjects/
  Banteay Mean Chey/
  districts/Kampong Chhnang/
  schools/39/
  grades/7/
```

---

## Files Changed

1. **[app/dashboard/leaderboard/all/page.tsx](app/dashboard/leaderboard/all/page.tsx)**
   - Replaced `fetch()` calls with `resultSubjectsService.getList()`
   - Fixed province parameter (ID → Name)
   - Improved error handling

2. **No changes needed to:**
   - [lib/api/config.ts](lib/api/config.ts) - Already has correct endpoints
   - [lib/api/services/resultSubjects.service.ts](lib/api/services/resultSubjects.service.ts) - Already handles everything

---

## Testing

```tsx
// 1. Select filters and click "Apply Filters"
// 2. Check console - should see:
//    [LEADERBOARD] Service response: success
//    [RESULT_SUBJECTS] Using deep endpoint: BY_GRADE

// 3. Data should load without 404 error
// 4. Leaderboard displays correctly
```

---

## Copy-Paste Solution

For similar pages, use this pattern:

```tsx
const response = await resultSubjectsService.getList(
  token,
  {
    provinceName: filters.provinceName,  // ← Province NAME
    districtName: filters.districtName,
    geipSchoolId: filters.geipSchoolId,
    gradeName: filters.gradeName,
    room: filters.room,  // Optional
    limit: 10000,
    forceMonthlyEndpoint: false,
  },
  abortController.signal
);

if (!response.success) {
  setError(response.error);
  return;
}

const data = response.data || [];
// Process data...
```

---

## Documentation Files

- 📖 **[LEADERBOARD_BEST_PRACTICES.md](LEADERBOARD_BEST_PRACTICES.md)** - Detailed explanation and best practices
- 📋 **[LEADERBOARD_IMPLEMENTATION.md](LEADERBOARD_IMPLEMENTATION.md)** - Implementation details
- 🔗 **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - This file

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Still getting 404 | Check if `provinceName` is province name, not ID |
| Empty results | Data may not exist for this combination |
| Service not found | Import: `import { resultSubjectsService } from "@/lib/api/services/resultSubjects.service"` |
| Type errors | Ensure all parameters match `ResultSubjectsParams` type |

---

## Result

✅ 404 error fixed
✅ Leaderboard loads data correctly
✅ Code follows best practices
✅ Service can be reused across multiple pages
✅ Better error handling and logging
