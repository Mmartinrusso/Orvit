import * as SecureStore from "expo-secure-store";

const KEYS = {
  ACCESS_TOKEN: "orvit_access_token",
  REFRESH_TOKEN: "orvit_refresh_token",
  USER: "orvit_user",
} as const;

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}

export async function setTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  await SecureStore.deleteItemAsync(KEYS.USER);
}

export async function getStoredUser(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.USER);
}

export async function setStoredUser(userJson: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USER, userJson);
}

// Generic key-value helpers (for theme, preferences, etc.)
export async function getValue(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function storeValue(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}
