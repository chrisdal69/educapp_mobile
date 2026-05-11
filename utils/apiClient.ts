import { storageDelete, storageGet } from "./storage";

export const TOKEN_KEY = "auth_token";
export const PENDING_TOKEN_KEY = "pending_token";

export const API_URL = __DEV__
  ? "http://localhost:3000"
  : "https://educappdf-back.vercel.app";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await storageGet(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    await storageDelete(TOKEN_KEY);
  }
  return response;
}
