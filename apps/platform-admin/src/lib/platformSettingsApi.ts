import type { SocialPlatform } from "@store-builder/ui/social-links";
import { apiClient } from "@/lib/apiClient";

/**
 * The console's "Platform settings" (backend modules/platformSettings): the
 * platform's public details, one group at a time. Every write is audited, and
 * the history is read back from the audit log.
 */
export type SettingsGroup = "contact" | "social" | "company" | "footer" | "email";
export const SETTINGS_GROUPS: SettingsGroup[] = ["contact", "social", "company", "footer", "email"];

export interface Localized {
  ar: string;
  en: string;
}

export interface ContactSettings {
  supportEmail: string;
  phone: string;
  address: Localized;
  hours: Localized;
}

export interface SocialLinkSetting {
  platform: SocialPlatform;
  url: string | null;
  enabled: boolean;
}

export interface SocialSettings {
  links: SocialLinkSetting[];
}

export interface CompanySettings {
  platformName: string;
  legalName: Localized;
  registration: Localized;
  taxRegistration: string;
}

export interface FooterSettings {
  tagline: Localized;
  rights: Localized;
}

export interface EmailSettings {
  senderName: string;
  signature: Localized;
  footer: { showSupportEmail: boolean; showSocialLinks: boolean };
}

export interface SettingsValues {
  contact: ContactSettings;
  social: SocialSettings;
  company: CompanySettings;
  footer: FooterSettings;
  email: EmailSettings;
}

export interface GroupState<G extends SettingsGroup = SettingsGroup> {
  value: SettingsValues[G];
  /** `default`: never saved, the sites show the values in their code (the form starts from the same ones). */
  source: "saved" | "default";
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string } | null;
}

export interface PlatformSettingsState {
  /** PLATFORM_SETTINGS_ENABLED on the API: off, the sites and emails ignore what is saved here. */
  enabled: boolean;
  groups: { [G in SettingsGroup]: GroupState<G> };
  defaults: SettingsValues;
  rules: {
    socialPlatforms: SocialPlatform[];
    socialDomains: Partial<Record<SocialPlatform, string[]>>;
    limits: Record<string, number>;
  };
}

export interface SaveResult<G extends SettingsGroup = SettingsGroup> extends GroupState<G> {
  group: G;
  /** false: the value was already that, nothing was written. */
  changed: boolean;
}

export interface HistoryEntry {
  id: string;
  action: "update" | "reset" | "revert";
  at: string;
  actor: { id: string; name: string; email: string } | null;
  /** The value before the change; null = the default (the group was not saved yet). */
  before: unknown;
  after: unknown;
  fields: string[];
}

export function getState() {
  return apiClient.request<PlatformSettingsState>("/admin/platform-settings");
}

export function saveGroup<G extends SettingsGroup>(group: G, value: SettingsValues[G]) {
  return apiClient.request<SaveResult<G>>(`/admin/platform-settings/${group}`, { method: "PUT", body: value });
}

export function resetGroup<G extends SettingsGroup>(group: G) {
  return apiClient.request<SaveResult<G>>(`/admin/platform-settings/${group}/reset`, { method: "POST", body: {} });
}

export function getHistory(group: SettingsGroup) {
  return apiClient.request<{ group: SettingsGroup; entries: HistoryEntry[] }>(`/admin/platform-settings/${group}/history`);
}

export function revertChange<G extends SettingsGroup>(group: G, auditId: string) {
  return apiClient.request<SaveResult<G>>(`/admin/platform-settings/${group}/revert`, { method: "POST", body: { auditId } });
}
