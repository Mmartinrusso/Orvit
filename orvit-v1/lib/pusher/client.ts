"use client";

import PusherClient from "pusher-js";

let pusherInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  if (!key) return null;

  if (!pusherInstance) {
    pusherInstance = new PusherClient(key, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      channelAuthorization: {
        endpoint: "/api/chat/pusher/auth",
        transport: "ajax",
      },
    });
  }
  return pusherInstance;
}
