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
  SCHOOL: {
    BASE: 'https://moeys-exam-qbfys.ondigitalocean.app/api/schools/',
    DETAIL: (id) => `.../api/schools/${id}/`,
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
