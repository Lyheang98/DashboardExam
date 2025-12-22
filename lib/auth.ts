"use client";

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // Clear cookie as well
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
}

export function setUser(user: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem("user", JSON.stringify(user));
}

export function getUser() {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function isAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const user = getUser();
  if (!user) return false;
  
  const role = user.role || user.user_role || '';
  const isStaff = user.is_staff || user.is_admin || user.is_superuser || false;
  
  return (
    role.toLowerCase() === 'admin' ||
    role.toLowerCase() === 'administrator' ||
    isStaff === true
  );
}

export function getUserRole(): string {
  const user = getUser();
  return user?.role || user?.user_role || 'user';
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