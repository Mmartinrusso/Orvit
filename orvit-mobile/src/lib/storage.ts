import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

// Web fallback using localStorage
async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return typeof window !== "undefined" ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const KEYS = {
  ACCESS_TOKEN: "orvit_access_token",
  REFRESH_TOKEN: "orvit_refresh_token",
  USER: "orvit_user",
} as const;

export async function getAccessToken(): Promise<string | null> {
  return getItem(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(KEYS.REFRESH_TOKEN);
}

export async function setTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await setItem(KEYS.ACCESS_TOKEN, accessToken);
  await setItem(KEYS.REFRESH_TOKEN, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await deleteItem(KEYS.ACCESS_TOKEN);
  await deleteItem(KEYS.REFRESH_TOKEN);
  await deleteItem(KEYS.USER);
}

export async function getStoredUser(): Promise<string | null> {
  return getItem(KEYS.USER);
}

export async function setStoredUser(userJson: string): Promise<void> {
  await setItem(KEYS.USER, userJson);
}

// Generic key-value helpers (for theme, preferences, etc.)
export async function getValue(key: string): Promise<string | null> {
  return getItem(key);
}

export async function storeValue(key: string, value: string): Promise<void> {
  await setItem(key, value);
}
