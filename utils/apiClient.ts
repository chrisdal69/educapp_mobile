import { DeviceEventEmitter } from "react-native";
import { storageDelete, storageGet } from "./storage";

export const TOKEN_KEY = "auth_token";
export const PENDING_TOKEN_KEY = "pending_token";
export const UNAUTHORIZED_EVENT = "auth:unauthorized";

export const API_URL = __DEV__
  ? "http://localhost:3000"
  : "https://educappdf-back.vercel.app";

export async function triggerUnauthorized() {
  await storageDelete(TOKEN_KEY);
  DeviceEventEmitter.emit(UNAUTHORIZED_EVENT);
}

type ApiFetchOptions = RequestInit & { skipUnauthorized?: boolean };

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { skipUnauthorized, ...fetchOptions } = options;
  const token = await storageGet(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  if (response.status === 401 && !skipUnauthorized) {
    await triggerUnauthorized();
  }
  return response;
}
