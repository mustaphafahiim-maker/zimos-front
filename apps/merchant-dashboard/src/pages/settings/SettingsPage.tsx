import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Label, cn } from "@store-builder/ui";
import type {
  WorkspaceInvite,
  WorkspaceMember,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { ColorField } from "@/components/ColorField";
import {
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  normalizeHex,
  readThemeColor,
} from "@/lib/brandColors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { BillingSection } from "./BillingSection";
import { WhatsAppMessageSection } from "./WhatsAppMessageSection";
import { WhatsappSection } from "./WhatsappSection";
import { CatalogSettingsSection } from "./CatalogSettingsSection";
import { OrderBumpSettingsSection } from "./OrderBumpSettingsSection";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import { AccountSettingsSection } from "./AccountSettingsSection";
import { StoreAddressSection } from "./StoreAddressSection";
import { SecuritySection } from "./SecuritySection";
import { TeamInviteForm } from "./TeamInviteForm";
import { TeamMemberGroups } from "./TeamMemberGroups";
import { DevelopersSection } from "./DevelopersSection";
import { NotificationPreferencesSection } from "./NotificationPreferencesSection";
import { OrderEmailsSection } from "./OrderEmailsSection";

const STRINGS = {
  en: {
    pageTitle: "Settings",
    pageDescription: "Your store profile and the people who can manage it.",
    // Store profile
    profileTitle: "Store profile",
    profileDescription: "The name, logo, and tagline shown across your dashboard and storefront.",
    profileSaved: "Store profile saved.",
    name: "Name",
    logo: "Logo",
    logoAlt: "Store logo",
    logoNone: "None",
    logoResizing: "Resizing…",
    logoUploading: "Uploading…",
    logoUpload: "Upload logo",
    logoFormats: "PNG, JPEG, GIF or WEBP, up to 5MB.",
    remove: "Remove",
    tagline: "Tagline",
    taglineHint: "Optional — a short line shown under your store name.",
    coloursTitle: "Store colours",
    coloursHint: "Used for your storefront header, buttons and links.",
    primary: "Primary",
    primaryHint: "Buttons, links and highlights.",
    secondary: "Secondary",
    secondaryHint: "Accents and badges.",
    preview: "Preview",
    previewAddToCart: "Add to cart",
    previewSale: "Sale",
    previewDetails: "View details",
    save: "Save",
    saving: "Saving…",
    // Team members
    teamTitle: "Team members",
    teamDescription: "People who can sign in to this store, and the role that sets what they can do.",
    inviteMember: "Invite member",
    inviteDescription: "They'll get an email with a link to join this store.",
    member: "Member",
    role: "Role",
    email: "Email",
    you: "(you)",
    roleFor: "Role for {who}",
    roleForFallback: "member",
    cantRemoveSelf: "You can't remove yourself",
    pendingInvites: "Pending invites",
    invited: "Invited",
    resend: "Resend",
    roleUpdated: "Role updated.",
    inviteResent: "Invite re-sent to {email}.",
    memberRemoved: "Member removed.",
    removeTitle: "Remove {name}?",
    removeTitleFallback: "Remove this member?",
    removeDescription: "They lose access to this store immediately. You can invite them again later.",
    removeConfirm: "Remove member",
    cancel: "Cancel",
    working: "Working…",
    // The built-in roles, by role key (the names the server gives them). A role
    // made for one store has no entry here and keeps the name it was given.
    role_owner: "Owner",
    role_workspace_manager: "Workspace Manager",
    role_editor: "Editor",
    role_order_operator: "Order Operator",
    role_confirmation_agent: "Confirmation Agent",
    role_fulfillment: "Fulfillment",
    role_accountant: "Accountant",
  },
  ar: {
    pageTitle: "الإعدادات",
    pageDescription: "بيانات متجرك والأشخاص الذين يمكنهم إدارته.",
    profileTitle: "بيانات المتجر",
    profileDescription: "اسم المتجر وشعاره وشعاره النصي كما تظهر في لوحة التحكم والمتجر.",
    profileSaved: "تم حفظ بيانات المتجر.",
    name: "الاسم",
    logo: "الشعار",
    logoAlt: "شعار المتجر",
    logoNone: "لا يوجد",
    logoResizing: "جارٍ تصغير الصورة…",
    logoUploading: "جارٍ الرفع…",
    logoUpload: "رفع الشعار",
    logoFormats: "PNG أو JPEG أو GIF أو WEBP، بحد أقصى 5 ميجابايت.",
    remove: "إزالة",
    tagline: "الشعار النصي",
    taglineHint: "اختياري — سطر قصير يظهر تحت اسم متجرك.",
    coloursTitle: "ألوان المتجر",
    coloursHint: "تُستخدم في الشريط العلوي والأزرار والروابط في متجرك.",
    primary: "اللون الأساسي",
    primaryHint: "الأزرار والروابط والعناصر البارزة.",
    secondary: "اللون الثانوي",
    secondaryHint: "عناصر التمييز والشارات.",
    preview: "معاينة",
    previewAddToCart: "أضف إلى السلة",
    previewSale: "تخفيض",
    previewDetails: "عرض التفاصيل",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    teamTitle: "أعضاء الفريق",
    teamDescription: "الأشخاص الذين يمكنهم الدخول إلى هذا المتجر، والدور الذي يحدد ما يمكنهم فعله.",
    inviteMember: "دعوة عضو",
    inviteDescription: "ستصله رسالة على بريده الإلكتروني فيها رابط للانضمام إلى هذا المتجر.",
    member: "العضو",
    role: "الدور",
    email: "البريد الإلكتروني",
    you: "(أنت)",
    roleFor: "دور {who}",
    roleForFallback: "العضو",
    cantRemoveSelf: "لا يمكنك إزالة نفسك",
    pendingInvites: "دعوات في انتظار القبول",
    invited: "مدعو",
    resend: "إعادة الإرسال",
    roleUpdated: "تم تحديث الدور.",
    inviteResent: "تمت إعادة إرسال الدعوة إلى {email}.",
    memberRemoved: "تمت إزالة العضو.",
    removeTitle: "إزالة {name}؟",
    removeTitleFallback: "إزالة هذا العضو؟",
    removeDescription: "سيفقد إمكانية الدخول إلى هذا المتجر فورًا. يمكنك دعوته مرة أخرى لاحقًا.",
    removeConfirm: "إزالة العضو",
    cancel: "إلغاء",
    working: "جارٍ التنفيذ…",
    role_owner: "مالك المتجر",
    role_workspace_manager: "مدير مساحة العمل",
    role_editor: "محرر",
    role_order_operator: "مسؤول الطلبات",
    role_confirmation_agent: "موظف التأكيد",
    role_fulfillment: "موظف الشحن",
    role_accountant: "محاسب",
  },
} satisfies Messages;

/**
 * A link that names one of the user's stores (?workspace=<id>, as on the way
 * back from the subscription payment page) opens that store, since the
 * current store is whichever was picked last in this browser.
 */
function useStoreFromLink() {
  const [params] = useSearchParams();
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace();
  const wanted = params.get("workspace");
  useEffect(() => {
    if (wanted && wanted !== currentWorkspace?.id && workspaces.some((w) => w.id === wanted)) selectWorkspace(wanted);
  }, [wanted, currentWorkspace?.id, workspaces, selectWorkspace]);
}

export function SettingsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  useStoreFromLink();

  return (
    <div className="max-w-3xl space-y-10">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
      />
      <AccountSection />
      <AppearanceSection />
      <NotificationPreferencesSection key={`notifications-${workspaceId}`} />
      <WorkspaceProfileSection key={`profile-${workspaceId}`} />
      {/* The store's address (<slug>.zimos.co), part of the account settings (SPEC §17.3). */}
      <StoreAddressSection key={`store-address-${workspaceId}`} />
      <AccountSettingsSection key={`account-settings-${workspaceId}`} />
      <OrderBumpSettingsSection key={`order-bump-${workspaceId}`} />
      <CatalogSettingsSection key={`catalog-${workspaceId}`} />
      <WhatsAppMessageSection key={`whatsapp-${workspaceId}`} />
      {/* The WhatsApp Cloud API connection behind the inbox and automations. */}
      <WhatsappSection key={`whatsapp-connection-${workspaceId}`} />
      {/* The emails customers get about their orders. */}
      <OrderEmailsSection key={`order-emails-${workspaceId}`} />
      <BillingSection key={`billing-${workspaceId}`} />
      <TeamSection key={`team-${workspaceId}`} />
      <SecuritySection key={`security-${workspaceId}`} />
      <DevelopersSection key={`developers-${workspaceId}`} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Workspace profile
// ---------------------------------------------------------------------

function WorkspaceProfileSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [tagline, setTagline] = useState(currentWorkspace?.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(currentWorkspace?.logoUrl ?? null);
  const [logoStage, setLogoStage] = useState<"preparing" | "uploading" | null>(null);
  const uploading = logoStage !== null;
  // What the colour fields opened with: a colour is only written once the
  // merchant changes it here, so saving the name or logo never pins the
  // platform default over a store theme's own accent.
  const [initialColors] = useState(() => ({
    primary: readThemeColor(currentWorkspace?.themeSettings, "primaryColor", DEFAULT_PRIMARY),
    secondary: readThemeColor(currentWorkspace?.themeSettings, "secondaryColor", DEFAULT_SECONDARY),
  }));
  const [primaryColor, setPrimaryColor] = useState(initialColors.primary);
  const [secondaryColor, setSecondaryColor] = useState(initialColors.secondary);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const colorsValid = Boolean(normalizeHex(primaryColor) && normalizeHex(secondaryColor));

  async function onLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a failure
    if (!file) return;
    setFormError(null);
    try {
      // Resize first if it is over the 5 MB cap, so a big logo export uploads
      // instead of being rejected.
      setLogoStage("preparing");
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setFormError(problem);
        return;
      }
      setLogoStage("uploading");
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      setLogoUrl(media.url);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLogoStage(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const primary = normalizeHex(primaryColor) ?? DEFAULT_PRIMARY;
      const secondary = normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY;
      await saveThemeSettings((current) => {
        // Merge, never replace: themeSettings is a shared blob and may already
        // carry keys owned by other parts of the product.
        const themeSettings: Record<string, unknown> = { ...current };
        if (primary !== initialColors.primary) {
          themeSettings.primaryColor = primary;
          // The merchant's own colour now, no longer one a template carried over.
          delete themeSettings.primaryColorSource;
        }
        if (secondary !== initialColors.secondary) themeSettings.secondaryColor = secondary;
        return { name: name.trim(), tagline: tagline.trim() || null, logoUrl, themeSettings };
      });
      toast.success(t.profileSaved);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.profileTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {t.profileDescription}
      </p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <TextField
          label={t.name}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />

        <div className="space-y-1.5">
          <Label>{t.logo}</Label>
          <div className="flex flex-wrap items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={t.logoAlt}
                className="size-16 rounded-[0.5rem] border border-line bg-paper object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-[0.5rem] border border-dashed border-line text-xs text-ink-soft">
                {t.logoNone}
              </div>
            )}
            <label
              className={cn(
                "inline-flex cursor-pointer items-center rounded-[0.5rem] border border-line bg-paper-raised px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper",
                uploading && "pointer-events-none opacity-50"
              )}
            >
              {logoStage === "preparing" ? t.logoResizing : logoStage === "uploading" ? t.logoUploading : t.logoUpload}
              <input
                type="file"
                accept={ACCEPTED_IMAGE_ACCEPT}
                className="hidden"
                disabled={uploading}
                onChange={onLogoFile}
              />
            </label>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>
                {t.remove}
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-soft">{t.logoFormats}</p>
        </div>

        <TextField
          label={t.tagline}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          error={fieldErrors.tagline}
          hint={t.taglineHint}
        />

        <div className="space-y-4 rounded-[0.5rem] border border-line p-4">
          <div>
            <h3 className="text-sm font-medium text-ink">{t.coloursTitle}</h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              {t.coloursHint}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ColorField
              label={t.primary}
              hint={t.primaryHint}
              value={primaryColor}
              onChange={setPrimaryColor}
            />
            <ColorField
              label={t.secondary}
              hint={t.secondaryHint}
              value={secondaryColor}
              onChange={setSecondaryColor}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.preview}</Label>
            <div
              className="flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-line p-3"
              style={{ backgroundColor: `${normalizeHex(primaryColor) ?? DEFAULT_PRIMARY}14` }}
            >
              <span
                className="rounded-[0.5rem] px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY }}
              >
                {t.previewAddToCart}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY }}
              >
                {t.previewSale}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY }}
              >
                {t.previewDetails}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || uploading || !name.trim() || !colorsValid}>
            {saving ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------

function TeamSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();
  const roleName = (role: { key: string; name: string }) => (t as Record<string, string>)[`role_${role.key}`] ?? role.name;

  const data = useAsync(
    () =>
      Promise.all([
        apiClient.listWorkspaceMembers(workspaceId),
        apiClient.listPendingInvites(workspaceId),
        apiClient.listWorkspaceRoles(workspaceId),
      ]).then(([members, invites, roles]) => ({ members, invites, roles })),
    [workspaceId]
  );

  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null);

  const reload = () => data.refresh({ silent: true });
  const members = data.data?.members ?? [];
  const invites = data.data?.invites ?? [];
  const roles = data.data?.roles ?? [];

  async function changeRole(member: WorkspaceMember, roleId: string) {
    try {
      await apiClient.updateMemberRole(workspaceId, member.id, roleId);
      toast.success(t.roleUpdated);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function resend(invite: WorkspaceInvite) {
    try {
      await apiClient.resendInvite(workspaceId, invite.id);
      toast.success(fmt(t.inviteResent, { email: String(invite.invitedEmail) }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    await apiClient.removeMember(workspaceId, removing.id);
    toast.success(t.memberRemoved);
    setRemoving(null);
    reload();
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-ink">{t.teamTitle}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t.teamDescription}
          </p>
        </div>
        <Button onClick={() => setInviting(true)} disabled={roles.length === 0}>
          {t.inviteMember}
        </Button>
      </div>

      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        <div className="mt-4 space-y-8">
          <TeamMemberGroups members={members} invitedCount={invites.length}>
            {(list) => (
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                      <th className="px-4 py-3 font-medium">{t.member}</th>
                      <th className="px-4 py-3 font-medium">{t.role}</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((member) => {
                      const isSelf = Boolean(member.user && user && member.user.id === user.id);
                      return (
                        <tr key={member.id} className="border-b border-line last:border-0">
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink">
                              {member.user?.fullName || member.user?.email || "—"}
                              {isSelf && (
                                <span className="ms-1.5 text-xs font-normal text-ink-soft">{t.you}</span>
                              )}
                            </div>
                            {member.user?.email && (
                              <div className="text-xs text-ink-soft">{member.user.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isSelf ? (
                              <span className="text-ink-soft">{roleName(member.role)}</span>
                            ) : (
                              <Select
                                aria-label={fmt(t.roleFor, { who: member.user?.email ?? t.roleForFallback })}
                                value={member.role.id}
                                onChange={(e) => changeRole(member, e.target.value)}
                                className="max-w-[220px]"
                              >
                                {roles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {roleName(role)}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-end">
                            {isSelf ? (
                              <span
                                className="text-xs text-ink-soft"
                                title={t.cantRemoveSelf}
                              >
                                —
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-danger hover:bg-danger-soft"
                                onClick={() => setRemoving(member)}
                              >
                                {t.remove}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TeamMemberGroups>

          {invites.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">{t.pendingInvites}</h3>
              <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                      <th className="px-4 py-3 font-medium">{t.email}</th>
                      <th className="px-4 py-3 font-medium">{t.role}</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-ink">{invite.invitedEmail}</span>
                            <StatusBadge value="invited" tone="warning" text={t.invited} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{roleName(invite.role)}</td>
                        <td className="px-4 py-3 text-end">
                          <Button size="sm" variant="ghost" onClick={() => resend(invite)}>
                            {t.resend}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DataState>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title={t.inviteMember}
        description={t.inviteDescription}
      >
        <TeamInviteForm
          onCancel={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            reload();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={
          removing?.user
            ? fmt(t.removeTitle, { name: removing.user.fullName || removing.user.email })
            : t.removeTitleFallback
        }
        description={t.removeDescription}
        confirmLabel={t.removeConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

