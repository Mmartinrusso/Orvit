import Pusher from "pusher-js/react-native";
import { getAccessToken } from "@/lib/storage";

const PUSHER_KEY = process.env.EXPO_PUBLIC_PUSHER_KEY || "";
const PUSHER_CLUSTER = process.env.EXPO_PUBLIC_PUSHER_CLUSTER || "us2";
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

let pusherClient: Pusher | null = null;

export function getPusherClient(): Pusher {
  if (!pusherClient) {
    pusherClient = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      activityTimeout: 15_000,
      pongTimeout: 10_000,
      disableStats: true,
      authorizer: (channel) => ({
        authorize: async (socketId, callback) => {
          try {
            const token = await getAccessToken();
            const formData = new FormData();
            formData.append("socket_id", socketId);
            formData.append("channel_name", channel.name);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(`${API_URL}/api/chat/pusher/auth`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
              callback(new Error("Pusher auth failed"), null);
              return;
            }

            const data = await res.json();
            callback(null, data);
          } catch (err) {
            callback(err as Error, null);
          }
        },
      }),
    });
  }
  return pusherClient;
}

export function disconnectPusher() {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
}
