import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

const usersFile = path.join(process.cwd(), 'data', 'users.json');

export interface StoredUser {
  id: number;
  name: string;
  email: string;
  password: string; // stored plaintext for demo (use bcrypt in production)
  role: string;
  status: string;
}

async function ensureFile() {
  try {
    await fs.access(usersFile);
  } catch {
    // Create data directory and file if missing
    const dir = path.dirname(usersFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(usersFile, JSON.stringify([], null, 2));
  }
}

export async function getUsers(): Promise<StoredUser[]> {
  try {
    await ensureFile();
    const data = await fs.readFile(usersFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await getUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function createUser(user: Omit<StoredUser, 'id'>): Promise<StoredUser> {
  const users = await getUsers();
  const newUser: StoredUser = {
    ...user,
    id: users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
  };
  users.push(newUser);
  await saveUsers(users);
  return newUser;
}

export async function updateUser(id: number, updates: Partial<StoredUser>): Promise<StoredUser | null> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates };
  await saveUsers(users);
  return users[index];
}

export async function deleteUser(id: number): Promise<boolean> {
  const users = await getUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  await saveUsers(users);
  return true;
}

async function saveUsers(users: StoredUser[]) {
  await ensureFile();
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}

// Search AND filter combined - main search function
export async function searchAndFilterUsers(
  query?: string,
  filters?: { role?: string; status?: string }
): Promise<StoredUser[]> {
  let users = await getUsers();
  
  // Apply search
  if (query?.trim()) {
    const lowerQuery = query.toLowerCase();
    users = users.filter(
      (user) =>
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
    );
  }
  
  // Apply filters
  if (filters?.role) {
    users = users.filter((user) => user.role === filters.role);
  }
  if (filters?.status) {
    users = users.filter((user) => user.status === filters.status);
  }
  
  return users;
}
