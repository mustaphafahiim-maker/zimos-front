import { ApiClient } from "@store-builder/api-client";

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  onSessionExpired: () => {
    // Full reload so every in-flight auth state resets cleanly.
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  },
});

/**
 * Root of the backend (the API base with its `/api/vN` suffix removed). Health
 * endpoints live at the root, e.g. `/health` and `/health/ready`.
 */
export function backendRootUrl(): string {
  return API_BASE_URL.replace(/\/+$/, "").replace(/\/api(\/v\d+)?$/, "");
}
