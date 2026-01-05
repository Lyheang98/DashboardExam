"use client";

// Token persistence behavior:
// - sessionStorage persists across refresh and navigation within the same session
// - sessionStorage automatically clears when tab/window closes (session ends)
// - This ensures users must login again after closing the browser/tab
// - For best security: always require login when opening the app

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  // Use sessionStorage (not localStorage) so it clears when browser closes
  sessionStorage.setItem("token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token");
}

export function setRefreshToken(refreshToken: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("refresh_token", refreshToken);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("refresh_token");
}

export function clearToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refresh_token");
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("user_permissions"); // Clear permissions cache
  // Clear cookie as well
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
}

export function setUser(user: any) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("user", JSON.stringify(user));
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const u = sessionStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  
  // Use cached permissions to avoid refetching
  const role = getUserRole();
  
  return (
    role.toLowerCase() === 'admin' ||
    role.toLowerCase() === 'administrator'
  );
}

export function getUserRole(): string {
  if (typeof window === "undefined") return 'user';
  
  // Try to get from cached permissions first (fastest)
  try {
    const cachedStr = sessionStorage.getItem('user_permissions');
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      const age = Date.now() - (cached.timestamp || 0);
      // Cache valid for 24 hours
      if (age < 24 * 60 * 60 * 1000 && cached.role) {
        return cached.role;
      }
    }
  } catch (error) {
    // Ignore cache errors, fall through to user object
  }
  
  // Fallback to user object
  const user = getUser();
  const role = user?.role || user?.user_role || 'user';
  
  // Cache the role for next time
  try {
    sessionStorage.setItem('user_permissions', JSON.stringify({
      role,
      timestamp: Date.now(),
    }));
  } catch (error) {
    // Ignore storage errors
  }
  
  return role;
}

export function saveCredentials(username: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("saved_username", username);
}

export function getSavedCredentials(): { username: string } | null {
  if (typeof window === "undefined") return null;
  const username = localStorage.getItem("saved_username");
  if (username) {
    return { username };
  }
  return null;
}

export function clearSavedCredentials() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("saved_username");
}