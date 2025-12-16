# Login Troubleshooting Guide

## How to Test Login

### 1. **Try these demo credentials:**

```
Email: kminchelle@gmail.com
Password: password
```

Or any of these DummyJSON users:
- emilys@gmail.com
- michaelw@gmail.com
- sophiab@gmail.com
- jamesj@gmail.com
- sarahm@gmail.com

Password: `password` (for all demo users)

### 2. **Test from Browser**

1. Go to: `http://localhost:3001/login`
2. Enter email: `kminchelle@gmail.com`
3. Enter password: `password`
4. Click "Sign In"
5. Should redirect to `/dashboard`

### 3. **Test from Terminal (curl)**

```bash
curl -s -X POST http://localhost:3001/api/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"kminchelle@gmail.com","password":"password"}' | jq
```

Expected response:
```json
{
  "success": true,
  "token": "demo-token-1700000000000",
  "user": {
    "id": 1,
    "name": "Emily Johnson",
    "email": "kminchelle@gmail.com"
  }
}
```

### 4. **Debugging Steps**

If you get an error:

1. **Check browser console** (F12 → Console tab)
   - Look for network errors or JavaScript errors
   
2. **Check server logs** in your terminal running `npm run dev`
   - Look for "LOGIN ERROR:" message
   
3. **Verify password** - must be exactly: `password` (no special chars)

4. **Verify email** - must be a valid DummyJSON user email

5. **Check localStorage** (F12 → Application → Local Storage)
   - After successful login, should see `token` and `user` keys

### 5. **Common Issues**

| Issue | Solution |
|-------|----------|
| "Invalid credentials" | Check email spelling, password must be `password` |
| Blank error | Check browser console for network errors |
| Page doesn't redirect | Check if localStorage is enabled in browser |
| 404 on `/api/auth` | Ensure dev server is running on port 3001 |
| CORS error | Not applicable (same origin) - check dev server running |

### 6. **Start Fresh**

If stuck, try:
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Clear localStorage: Open DevTools console and run:
   ```js
   localStorage.clear()
   ```
3. Restart dev server:
   ```bash
   npm run dev
   ```
4. Try login again

---

**Need help?** Check the server terminal for error messages or provide the exact error you see on screen.
