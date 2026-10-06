/**
 * Education links (backend: platformAdmin/educationLinks.js, SPEC §18.6 and
 * §15.1): the help center, the Telegram channel, support chat and a tutorial
 * video per dashboard topic. Set by the platform team; only the ones set are
 * returned (null / missing otherwise).
 *
 *   GET /me/education         the dashboard
 *   GET /admin/education      the console ({ education, topics })
 *   PUT /admin/education      the console (announcements.manage)
 */
import type { ApiClient } from "../client";

export type TutorialTopic =
  | "products"
  | "shipping"
  | "payments"
  | "website"
  | "funnels"
  | "offers"
  | "marketing"
  | "automations"
  | "fraud"
  | "profit";

export interface EducationLinks {
  helpCenterUrl: string | null;
  telegramUrl: string | null;
  supportChatUrl: string | null;
  tutorials: Partial<Record<TutorialTopic, string>>;
}

export async function educationLinksGet(client: ApiClient): Promise<EducationLinks> {
  const { education } = await client.request<{ education: EducationLinks }>(`/me/education`);
  return education;
}

export async function adminEducationGet(client: ApiClient): Promise<{ education: EducationLinks; topics: TutorialTopic[] }> {
  return client.request<{ education: EducationLinks; topics: TutorialTopic[] }>(`/admin/education`);
}

/** Empty strings clear a link. */
export async function adminEducationSet(
  client: ApiClient,
  input: { helpCenterUrl?: string; telegramUrl?: string; supportChatUrl?: string; tutorials: Partial<Record<TutorialTopic, string>> }
): Promise<{ education: EducationLinks; topics: TutorialTopic[] }> {
  return client.request<{ education: EducationLinks; topics: TutorialTopic[] }>(`/admin/education`, { method: "PUT", body: input });
}
