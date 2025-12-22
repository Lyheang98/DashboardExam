# Dashboard App

A Next.js dashboard application with authentication and user management.

## Features

- 🔐 Authentication with external API
- 👥 User management (staff/admin only)
- 🎨 Modern UI with dark mode support
- 📱 Responsive design

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```env
EXTERNAL_API_BASE_URL=https://moeys-exam-qbfys.ondigitalocean.app
EXTERNAL_API_AUTH_URL=https://moeys-exam-qbfys.ondigitalocean.app/api/token/
EXTERNAL_API_USERS_URL=https://moeys-exam-qbfys.ondigitalocean.app/api/users/
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
lib/
  api/              # API client and services
    config.ts       # API endpoints configuration
    client.ts       # HTTP client with retry logic
    services/       # API service modules
      auth.service.ts
      users.service.ts
    index.ts        # Main export file
    types.ts        # TypeScript types
  auth.ts           # Authentication helpers (localStorage)
  logger.ts         # Logging utility

app/
  api/              # Next.js API routes (server-side)
    auth/           # Authentication endpoints
      route.ts      # POST /api/auth (login)
    users/          # User endpoints
      search/       # GET /api/users/search
        route.ts
  dashboard/        # Dashboard pages
  (auth)/           # Auth pages (login, register)
```

---

## API Architecture & Flow

### Overview

The application uses a **3-layer architecture** for API calls:

```
Frontend Component → Next.js API Route → Service Layer → External API
```

### Layer 1: Frontend Components

Frontend components make requests to **Next.js API routes** (not directly to external API).

**Example: Login Flow**
```typescript
// app/(auth)/login/page.tsx
const res = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});

const data = await res.json();
if (data.success) {
  setToken(data.token);      // Save to localStorage
  setUser(data.user);        // Save to localStorage
  router.push('/dashboard');
}
```

**Example: Fetch Users Flow**
```typescript
// app/dashboard/users/page.tsx
const token = getToken();  // Get from localStorage
const res = await fetch('/api/users/search?q=john&role=staff', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const data = await res.json();
```

### Layer 2: Next.js API Routes

API routes act as **proxies** between frontend and services. They:
- Validate requests
- Extract authentication tokens
- Call service layer
- Return formatted responses

**Login Route** (`app/api/auth/route.ts`):
```typescript
export async function POST(request: NextRequest) {
  // 1. Extract credentials from request
  const { username, password } = await request.json();
  
  // 2. Validate input
  if (!username || !password) {
    return NextResponse.json({ success: false, error: 'Required fields missing' }, { status: 400 });
  }
  
  // 3. Call auth service
  const result = await authService.login({ username, password });
  
  // 4. Return response
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }
  
  return NextResponse.json({
    success: true,
    token: result.token,
    user: result.user,
  });
}
```

**Users Search Route** (`app/api/users/search/route.ts`):
```typescript
export async function GET(request: NextRequest) {
  // 1. Extract token from Authorization header
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  
  // 2. Extract query parameters
  const searchParams = request.nextUrl.searchParams;
  const params = {
    q: searchParams.get('q') || undefined,
    role: searchParams.get('role') || undefined,
    status: searchParams.get('status') || undefined,
  };
  
  // 3. Call users service
  const result = await usersService.search(token, params);
  
  // 4. Return response
  return NextResponse.json({
    success: true,
    count: result.count || 0,
    data: result.data || [],
  });
}
```

### Layer 3: Service Layer

Services handle **business logic** and communicate with **external APIs**.

**Structure:**
- `lib/api/config.ts` - All endpoint URLs
- `lib/api/client.ts` - HTTP client with retry/timeout
- `lib/api/services/*.service.ts` - Domain-specific services

**Auth Service** (`lib/api/services/auth.service.ts`):
```typescript
export const authService = {
  async login(credentials: LoginCredentials) {
    // 1. Call external API using apiClient
    const response = await apiClient.post(
      EXTERNAL_ENDPOINTS.AUTH.TOKEN,  // From config.ts
      credentials
    );
    
    // 2. Extract token from response (handle different formats)
    const token = response.data?.token || response.data?.access_token;
    
    // 3. Extract and format user data
    const userData = response.data?.user || response.data;
    const user = {
      id: userData?.id,
      username: credentials.username,
      name: userData?.name || userData?.full_name,
      email: userData?.email,
      role: userData?.role || 'user',
      is_staff: userData?.is_staff || false,
    };
    
    // 4. Return standardized format
    return { success: true, token, user };
  },
};
```

**Users Service** (`lib/api/services/users.service.ts`):
```typescript
export const usersService = {
  async getAll(token: string, params?: UserSearchParams) {
    // 1. Build query string
    const queryParams = new URLSearchParams();
    if (params?.q) queryParams.append('search', params.q);
    if (params?.role) queryParams.append('role', params.role);
    
    // 2. Call external API with token
    const url = `${EXTERNAL_ENDPOINTS.USERS.LIST}?${queryParams}`;
    const response = await apiClient.get(url, { token });
    
    // 3. Transform response to standard format
    const users = response.data?.data || response.data || [];
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name || user.full_name,
      email: user.email,
      role: user.role || 'User',
      status: user.status || (user.is_active ? 'active' : 'inactive'),
    }));
    
    // 4. Filter staff/admin only
    const filteredUsers = formattedUsers.filter(user => 
      user.role.toLowerCase() === 'staff' || user.role.toLowerCase() === 'admin'
    );
    
    return { success: true, data: filteredUsers, count: filteredUsers.length };
  },
};
```

### API Client (`lib/api/client.ts`)

The `apiClient` provides:
- **Automatic retry** (3 attempts by default)
- **Timeout handling** (30 seconds default)
- **Error parsing** (extracts error messages from various formats)
- **Token injection** (adds Authorization header automatically)

```typescript
// Usage in services
const response = await apiClient.post(endpoint, body, { token });
// or
const response = await apiClient.get(endpoint, { token });
```

**Features:**
- Retries failed requests up to 3 times
- Handles network errors gracefully
- Parses JSON/text responses automatically
- Extracts error messages from different API formats

### Configuration (`lib/api/config.ts`)

All endpoints are centralized:

```typescript
export const EXTERNAL_ENDPOINTS = {
  AUTH: {
    TOKEN: 'https://moeys-exam-qbfys.ondigitalocean.app/api/token/',
    REFRESH: '.../api/token/refresh/',
    VERIFY: '.../api/token/verify/',
  },
  USERS: {
    BASE: 'https://moeys-exam-qbfys.ondigitalocean.app/api/users/',
    DETAIL: (id) => `.../api/users/${id}/`,
  },
};
```

---

## Complete Flow Examples

### 1. Login Flow

```
User enters credentials
    ↓
Frontend: app/(auth)/login/page.tsx
    ↓ POST /api/auth
Next.js Route: app/api/auth/route.ts
    ↓ authService.login()
Service: lib/api/services/auth.service.ts
    ↓ apiClient.post(EXTERNAL_ENDPOINTS.AUTH.TOKEN)
API Client: lib/api/client.ts
    ↓ fetch() with retry logic
External API: https://moeys-exam-qbfys.ondigitalocean.app/api/token/
    ↓ Returns: { token, user }
    ↓
Response flows back through layers
    ↓
Frontend saves token & user to localStorage
    ↓
Redirects to /dashboard
```

### 2. Fetch Users Flow

```
User navigates to /dashboard/users
    ↓
Frontend: app/dashboard/users/page.tsx
    ↓ GET /api/users/search?q=john&role=staff
    ↓ Headers: Authorization: Bearer <token>
Next.js Route: app/api/users/search/route.ts
    ↓ Extracts token from header
    ↓ usersService.search(token, params)
Service: lib/api/services/users.service.ts
    ↓ apiClient.get(EXTERNAL_ENDPOINTS.USERS.LIST, { token })
API Client: lib/api/client.ts
    ↓ Adds Authorization header
    ↓ fetch() with retry logic
External API: https://moeys-exam-qbfys.ondigitalocean.app/api/users/
    ↓ Returns: [{ id, name, email, role, ... }]
    ↓
Service filters for staff/admin only
    ↓
Response flows back through layers
    ↓
Frontend displays users in table
```

---

## Usage Examples

### Using Services Directly (Server-Side Only)

```typescript
// In Next.js API routes or server components
import { authService, usersService } from '@/lib/api';

// Login
const result = await authService.login({ username, password });
if (result.success) {
  console.log('Token:', result.token);
  console.log('User:', result.user);
}

// Get users
const users = await usersService.getAll(token, { role: 'staff' });
if (users.success) {
  console.log('Users:', users.data);
}
```

### Using API Routes (Client-Side)

```typescript
// In React components
const token = getToken(); // From localStorage

// Fetch users
const res = await fetch('/api/users/search?role=staff', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const data = await res.json();
```

---

## Authentication

### Token Storage

- Tokens are stored in `localStorage` (client-side only)
- Never stored in cookies or server-side
- Token is sent in `Authorization: Bearer <token>` header

### Helper Functions (`lib/auth.ts`)

```typescript
import { setToken, getToken, setUser, getUser, isAuthenticated, isAdmin } from '@/lib/auth';

// Save token after login
setToken(token);

// Get token for API calls
const token = getToken();

// Check if user is logged in
if (isAuthenticated()) {
  // User is logged in
}

// Check if user is admin
if (isAdmin()) {
  // User has admin privileges
}
```

---

## Error Handling

All API calls return a standardized format:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
}
```

**Example:**
```typescript
const result = await authService.login({ username, password });

if (!result.success) {
  console.error('Error:', result.error);
  // Handle error
} else {
  console.log('Success:', result.data);
  // Handle success
}
```

---

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components

---

## Key Benefits of This Architecture

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Reusability**: Services can be used in multiple API routes
3. **Error Handling**: Centralized error handling in API client
4. **Type Safety**: Full TypeScript support throughout
5. **Maintainability**: Easy to update endpoints in one place (config.ts)
6. **Security**: Tokens never exposed to client-side code directly
7. **Reliability**: Automatic retry logic for failed requests
