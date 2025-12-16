# Local Auth Storage - Test Guide

Your authentication system now uses local file-based storage. User accounts are stored in `data/users.json` and persist across server restarts.

## Default Test Users

The following test accounts are pre-loaded in `data/users.json`:

| Email | Password | Role | Status |
|-------|----------|------|--------|
| john@example.com | password123 | admin | active |
| jane@example.com | password123 | user | active |
| bob@example.com | password123 | user | inactive |

## Testing Login

1. Go to http://localhost:3000/login
2. Enter one of the test emails above with password: `password123`
3. You should be redirected to the dashboard

## Testing Registration

1. Go to http://localhost:3000/register
2. Fill in the form with:
   - Full Name: Your name
   - Email: A new email (not already registered)
   - Password: Your password (min 3 characters)
   - Confirm Password: Same as above
3. Click "Register"
4. You'll be redirected to login
5. Use your new email and password to sign in

## How It Works

- **File Storage**: User accounts stored in `data/users.json` (auto-created on first run)
- **Storage Utility**: `lib/storage.ts` provides functions:
  - `getUsers()` - read all users
  - `getUserByEmail(email)` - find user by email
  - `createUser(user)` - add new user
  - `updateUser(id, updates)` - modify user
  - `deleteUser(id)` - remove user

- **Auth Endpoints**:
  - `POST /api/auth` - Login (validates email + password)
  - `POST /api/auth/register` - Register (creates new user)

## Security Notes (Demo Only)

⚠️ **For demonstration only:**
- Passwords are stored in **plaintext** (never do this in production)
- No rate limiting on login attempts
- Token format is simple: `demo-token-${timestamp}`

**Production recommendations:**
- Use bcrypt/Argon2 for password hashing
- Implement rate limiting
- Use proper JWT tokens with expiration
- Consider a real database (SQLite, PostgreSQL, etc.)
- Add refresh token mechanism
- Enable HTTPS

## File Structure

```
dashboard-app/
├── data/
│   └── users.json          # Local user storage (auto-created)
├── lib/
│   ├── storage.ts          # NEW: File-based storage utility
│   └── auth.ts             # Client-side auth helpers
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── route.ts    # UPDATED: Now uses local storage
│   │       └── register/
│   │           └── route.ts # NEW: Registration endpoint
│   └── (auth)/
│       ├── login/
│       │   └── page.tsx
│       └── register/
│           └── page.tsx    # UPDATED: Fully functional
```

## Next Steps

To upgrade to production:
1. Add password hashing (bcrypt)
2. Switch to SQLite, PostgreSQL, or MongoDB
3. Implement proper JWT with expiration
4. Add refresh token rotation
5. Add email verification
6. Add password reset functionality
