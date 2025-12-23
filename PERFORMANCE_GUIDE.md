# Performance & Stability Guide

This guide covers all performance optimizations implemented to prevent crashes and handle large datasets.

## ✅ Implemented Protections

### 1. **Error Boundary** (`components/ErrorBoundary.tsx`)
- Catches React errors and prevents app crashes
- Shows user-friendly error messages
- Allows users to retry without refreshing

### 2. **Safe Fetch Utility** (`lib/api/safeFetch.ts`)
- **Request Timeouts**: Default 10 seconds (prevents hanging requests)
- **Automatic Retries**: 1 retry with exponential backoff
- **Response Size Limits**: Default 10MB (prevents memory issues)
- **Request Cancellation**: Cancels requests when component unmounts

### 3. **Rate Limiting** (`lib/api/rateLimiter.ts`)
- Limits to 10 requests per second
- Prevents API overload
- Automatic queuing of requests

### 4. **Existing Optimizations**
- ✅ Search debouncing (500ms)
- ✅ Pagination (limits data rendered)
- ✅ Loading states (prevents UI blocking)
- ✅ Request cancellation on unmount
- ✅ Error handling with try-catch

## 📋 Best Practices for Adding New APIs

### Use Safe Fetch for All API Calls

```typescript
import { safeFetch, safeFetchJSON } from '@/lib/api/safeFetch';

// Basic usage
const data = await safeFetchJSON('/api/endpoint', {
  timeout: 15000, // 15 seconds
  retries: 2, // Retry 2 times
  maxResponseSize: 5 * 1024 * 1024, // 5MB limit
});
```

### Always Use Request Cancellation

```typescript
useEffect(() => {
  const controller = new AbortController();
  
  const fetchData = async () => {
    try {
      const data = await safeFetchJSON('/api/endpoint', {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setData(data);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
      }
    }
  };
  
  fetchData();
  
  // Cleanup: cancel request if component unmounts
  return () => controller.abort();
}, []);
```

### Implement Pagination for Large Datasets

```typescript
// Always paginate data that could be large
const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState(10); // Start small

// Fetch only current page
const data = await fetch(`/api/data?page=${page}&limit=${perPage}`);
```

### Debounce User Input

```typescript
// Already implemented in Users/Products pages
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchQuery);
  }, 500); // Wait 500ms after user stops typing
  
  return () => clearTimeout(timer);
}, [searchQuery]);
```

### Set Reasonable Limits

```typescript
// Limit data processing
const MAX_ITEMS = 1000;
const processedData = data.slice(0, MAX_ITEMS);

// Limit response size
const maxSize = 10 * 1024 * 1024; // 10MB
if (responseSize > maxSize) {
  throw new Error('Response too large');
}
```

## ⚠️ Common Pitfalls to Avoid

1. **Don't fetch all data at once** - Always use pagination
2. **Don't make API calls on every keystroke** - Use debouncing
3. **Don't forget to cancel requests** - Always use AbortController
4. **Don't ignore errors** - Always handle errors gracefully
5. **Don't process huge arrays in render** - Use useMemo or pagination

## 🔧 Configuration

### Adjust Rate Limiting
Edit `lib/api/rateLimiter.ts`:
```typescript
export const apiRateLimiter = new RateLimiter({
  maxRequests: 10, // Requests per window
  windowMs: 1000,  // Time window in ms
});
```

### Adjust Default Timeouts
Edit `lib/api/safeFetch.ts`:
```typescript
const {
  timeout = 10000, // Increase for slow APIs
  retries = 1,      // Increase for unreliable APIs
  maxResponseSize = 10 * 1024 * 1024, // Adjust as needed
} = options;
```

## 🚀 Testing Performance

1. **Test with large datasets** (10,000+ items)
2. **Test slow network** (throttle to 3G in DevTools)
3. **Test multiple rapid clicks** (rate limiting)
4. **Test with failed APIs** (error handling)
5. **Monitor memory usage** (Chrome DevTools)

## 📊 Monitoring

Watch for:
- Long API response times (>5 seconds)
- Memory leaks (increasing memory over time)
- Too many simultaneous requests
- Large response sizes
- Unhandled errors in console

Your dashboard is now protected against common performance issues! 🛡️

