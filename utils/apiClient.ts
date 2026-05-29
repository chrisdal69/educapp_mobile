import { DeviceEventEmitter, Platform } from "react-native";
import Constants from "expo-constants";
import { storageDelete, storageGet } from "./storage";

export const TOKEN_KEY = "auth_token";
export const PENDING_TOKEN_KEY = "pending_token";
export const UNAUTHORIZED_EVENT = "auth:unauthorized";

const getDevHost = () => {
  if (Platform.OS === "android" && !Constants.isDevice) return "10.0.2.2";
  if (Platform.OS === "ios" && !Constants.isDevice) return "localhost";
  const fromEnv = process.env.EXPO_PUBLIC_DEV_HOST;
  if (fromEnv) return fromEnv;
  return Constants.expoConfig?.hostUri?.split(":").shift() ?? "192.168.1.39";
};

export const API_URL = __DEV__
  ? `http://${getDevHost()}:3000`
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
