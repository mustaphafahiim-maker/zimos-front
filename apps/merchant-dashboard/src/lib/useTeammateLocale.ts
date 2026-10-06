import { useEffect, useRef } from "react";
import { profileLocaleOf, profileUpdate } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/i18n/LocaleContext";

/**
 * Tells the server which language this teammate uses the dashboard in, so the
 * notifications that leave the dashboard — push, email, WhatsApp — are
 * written in it (backend merchantNotificationService, users.locale). Sent
 * once when it differs from what the server has, and again on each switch.
 * A failure is silent: the notifications just stay in Arabic.
 */
export function useTeammateLocale() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const lang = locale === "en" ? "en" : "ar";
    if (profileLocaleOf(user) === lang || sent.current === lang) return;
    sent.current = lang;
    profileUpdate(apiClient, { locale: lang }).catch(() => {
      sent.current = null;
    });
  }, [user, locale]);
}
