import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getAccessToken,
  setTokens,
  clearTokens,
  getStoredUser,
  setStoredUser,
} from "@/lib/storage";
import { mobileLogin } from "@/api/chat";
import type { AuthUser } from "@/types/chat";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const storedUser = await getStoredUser();
        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {
        // Corrupted storage — clear
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const platform =
      (await import("react-native")).Platform.OS === "ios" ? "ios" : "android";

    const response = await mobileLogin(email, password, { platform });

    await setTokens(response.tokens.accessToken, response.tokens.refreshToken);
    await setStoredUser(JSON.stringify(response.user));
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
