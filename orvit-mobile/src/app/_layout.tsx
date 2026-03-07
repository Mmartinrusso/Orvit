import "react-native-reanimated";
import { useEffect, useRef, useCallback } from "react";
import { Platform, Alert } from "react-native";
import { Slot, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import * as Device from "expo-device";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_700Bold,
} from "@expo-google-fonts/ibm-plex-mono";
import ErrorBoundary from "@/components/ErrorBoundary";
import BiometricLock from "@/components/BiometricLock";
import { registerDevice } from "@/api/chat";
import { getAccessToken } from "@/lib/storage";

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// Android notification channels (required for Android 8+ / Samsung)
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("chat-messages", {
    name: "Mensajes de chat",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    lightColor: "#3b82f6",
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
  Notifications.setNotificationChannelAsync("task-notifications", {
    name: "Tareas y recordatorios",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    lightColor: "#6366f1",
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      retry: 1,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 15_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
    },
  },
});

// Auto-update: check for OTA updates on app start and apply silently
function useAutoUpdate() {
  useEffect(() => {
    if (__DEV__) return; // Skip in development
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log("[update] New update available, downloading...");
          await Updates.fetchUpdateAsync();
          console.log("[update] Update downloaded, reloading...");
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log("[update] Check failed:", e);
      }
    })();
  }, []);
}

function useNotificationSetup() {
  const { user } = useAuth();
  const responseListener = useRef<Notifications.Subscription>(null);
  const registeredRef = useRef(false);

  // Register push token — runs on mount AND when user logs in
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (Platform.OS === "web" || !Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted" || !isMounted) return;

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: "000ae057-7558-4995-bd34-d8450e559eab",
      });
      const accessToken = await getAccessToken();
      if (isMounted && accessToken && token.data) {
        console.log("[push] Registering device token:", token.data.slice(0, 30) + "...");
        registerDevice(
          token.data,
          Platform.OS as "ios" | "android"
        )
          .then(() => console.log("[push] Device registered successfully"))
          .catch((err) => console.error("[push] Device registration failed:", err));
        registeredRef.current = true;
      } else {
        console.log("[push] Skipping registration:", {
          hasToken: !!token.data,
          hasAccessToken: !!accessToken,
          userId: user?.id,
        });
      }
    })();

    return () => { isMounted = false; };
  }, [user?.id]); // Re-run when user changes (login/logout)

  // Notification tap handler
  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "task_assigned" && data?.taskId) {
          router.push(`/task/${data.taskId}`);
        } else if (data?.conversationId) {
          router.push(`/chat/${data.conversationId}`);
        }
      });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

/** Must be inside AuthProvider so useAuth() works */
function AppBootstrap() {
  useAutoUpdate();
  useNotificationSetup();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_700Bold,
  });

  const onLayoutReady = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutReady}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <AppBootstrap />
                <ThemedStatusBar />
                <Slot />
                <BiometricLock />
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
