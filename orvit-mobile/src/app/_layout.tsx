import "react-native-reanimated";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Slot, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import ErrorBoundary from "@/components/ErrorBoundary";
import { registerDevice } from "@/api/chat";
import { getAccessToken } from "@/lib/storage";

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
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function useNotificationSetup() {
  const responseListener = useRef<Notifications.Subscription>(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web" || !Device.isDevice) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") return;

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: "000ae057-7558-4995-bd34-d8450e559eab",
      });
      const accessToken = await getAccessToken();
      if (accessToken && token.data) {
        registerDevice(
          token.data,
          Platform.OS as "ios" | "android"
        ).catch(() => {});
      }
    })();

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

export default function RootLayout() {
  useNotificationSetup();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <ThemedStatusBar />
                <Slot />
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
