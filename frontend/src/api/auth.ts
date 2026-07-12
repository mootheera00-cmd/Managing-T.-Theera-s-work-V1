import axios from 'axios';

const authApi = axios.create({ baseURL: '/api/auth' });

export interface User {
  id: number;
  username: string;
  password?: string;
  display_name: string;
  role: 'user' | 'admin';
  is_active: number;
  created_at: string;
}

let _token: string | null = localStorage.getItem('auth_token');

export function getToken(): string | null { return _token; }

export function setToken(t: string | null) {
  _token = t;
  if (t) localStorage.setItem('auth_token', t);
  else localStorage.removeItem('auth_token');
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const { data } = await authApi.post('/login', { username, password });
  setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try { await authApi.post('/logout', {}, { headers: authHeaders() }); } catch {}
  setToken(null);
}

export async function getMe(): Promise<User | null> {
  try {
    const { data } = await authApi.get('/me', { headers: authHeaders() });
    return data.user;
  } catch { return null; }
}

// Admin
export async function getUsers(): Promise<User[]> {
  const { data } = await authApi.get('/users', { headers: authHeaders() });
  return data;
}

export async function createUser(payload: { username: string; password: string; display_name?: string; role?: string }): Promise<void> {
  await authApi.post('/users', payload, { headers: authHeaders() });
}

export async function updateUser(id: number, payload: { password?: string; display_name?: string; role?: string; is_active?: number }): Promise<void> {
  await authApi.put(`/users/${id}`, payload, { headers: authHeaders() });
}

export async function deleteUser(id: number): Promise<void> {
  await authApi.delete(`/users/${id}`, { headers: authHeaders() });
}
