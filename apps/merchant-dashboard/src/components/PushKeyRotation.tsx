import { useEffect } from "react";
import { syncPushKey } from "@/lib/webPush";

/**
 * Keeps this browser's push subscription on the server's current VAPID key
 * (handoff 392): once per load of the signed-in shell, a device that was
 * turned on with a key the owner has since rotated is subscribed again with
 * the new one. Draws nothing and never prompts.
 */
export function PushKeyRotation() {
  useEffect(() => {
    void syncPushKey();
  }, []);
  return null;
}
