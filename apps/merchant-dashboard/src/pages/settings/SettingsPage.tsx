import { useState, type ChangeEvent, type FormEvent } from "react";
import { Languages } from "lucide-react";
import { Alert, Button, Label, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import type {
  InviteMemberPayload,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
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
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import { CheckoutSettingsTab } from "./CheckoutSettingsTab";
import { DomainsTab } from "./DomainsTab";
import { CamouflageTab } from "./CamouflageTab";
import { PlanTab } from "./PlanTab";

const STRINGS = {
  en: {
    title: "Settings",
    description: "Store profile, team, checkout, domains, ad review shield and your plan.",
    tabGeneral: "General",
    tabTeam: "Team",
    tabCheckout: "Checkout",
    tabDomains: "Domains",
    tabCamouflage: "Ad review shield",
    tabPlan: "Plan & billing",

    languageTitle: "Language",
    languageHint: "The language and direction of your dashboard. Saved on this device.",

    profileTitle: "Store profile",
    profileHint: "The name, logo, and tagline shown across your dashboard and storefront.",
    profileSaved: "Store profile saved.",
    name: "Name",
    logo: "Logo",
    logoAlt: "Store logo",
    none: "None",
    resizing: "Resizing…",
    uploading: "Uploading…",
    uploadLogo: "Upload logo",
    remove: "Remove",
    logoHint: "PNG, JPEG, GIF or WEBP, up to 5MB.",
    tagline: "Tagline",
    taglineHint: "Optional — a short line shown under your store name.",
    colorsTitle: "Store colours",
    colorsHint: "Used for your storefront header, buttons and links.",
    primary: "Primary",
    primaryHint: "Buttons, links and highlights.",
    secondary: "Secondary",
    secondaryHint: "Accents and badges.",
    preview: "Preview",
    previewAddToCart: "Add to cart",
    previewSale: "Sale",
    previewDetails: "View details",

    teamTitle: "Team members",
    teamHint: "People who can sign in to this store, and the role that sets what they can do.",
    inviteMember: "Invite member",
    roleUpdated: "Role updated.",
    inviteResent: "Invite re-sent to {email}.",
    memberRemoved: "Member removed.",
    colMember: "Member",
    colRole: "Role",
    colEmail: "Email",
    you: "(you)",
    roleFor: "Role for {email}",
    memberFallback: "member",
    cantRemoveSelf: "You can't remove yourself",
    pendingInvites: "Pending invites",
    invited: "Invited",
    resend: "Resend",
    inviteDescription: "They'll get an email with a link to join this store.",
    removeNamed: "Remove {name}?",
    removeThis: "Remove this member?",
    removeDescription: "They lose access to this store immediately. You can invite them again later.",
    removeMember: "Remove member",
    inviteSent: "Invite sent to {email}.",
    email: "Email",
    role: "Role",
    sending: "Sending…",
    sendInvite: "Send invite",
  },
  ar: {
    title: "الإعدادات",
    description: "ملف المتجر، الفريق، صفحة الدفع، النطاقات، حماية مراجعة الإعلانات والخطة.",
    tabGeneral: "عام",
    tabTeam: "الفريق",
    tabCheckout: "صفحة الدفع",
    tabDomains: "النطاقات (الدومين)",
    tabCamouflage: "حماية مراجعة الإعلانات",
    tabPlan: "الخطة والفوترة",

    languageTitle: "اللغة",
    languageHint: "لغة لوحة التحكم واتجاهها. يُحفظ الاختيار على هذا الجهاز.",

    profileTitle: "ملف المتجر",
    profileHint: "الاسم والشعار والوصف المختصر الظاهر في لوحة التحكم وواجهة المتجر.",
    profileSaved: "تم حفظ ملف المتجر.",
    name: "الاسم",
    logo: "الشعار",
    logoAlt: "شعار المتجر",
    none: "لا يوجد",
    resizing: "جارٍ تصغير الصورة…",
    uploading: "جارٍ الرفع…",
    uploadLogo: "رفع الشعار",
    remove: "إزالة",
    logoHint: "PNG أو JPEG أو GIF أو WEBP، بحد أقصى 5 ميجابايت.",
    tagline: "الوصف المختصر",
    taglineHint: "اختياري — سطر قصير يظهر أسفل اسم متجرك.",
    colorsTitle: "ألوان المتجر",
    colorsHint: "تُستخدم في رأس واجهة المتجر والأزرار والروابط.",
    primary: "اللون الأساسي",
    primaryHint: "الأزرار والروابط والعناصر البارزة.",
    secondary: "اللون الثانوي",
    secondaryHint: "اللمسات الإضافية والشارات.",
    preview: "معاينة",
    previewAddToCart: "أضف إلى السلة",
    previewSale: "تخفيض",
    previewDetails: "عرض التفاصيل",

    teamTitle: "أعضاء الفريق",
    teamHint: "الأشخاص الذين يمكنهم الدخول إلى هذا المتجر، والدور الذي يحدد صلاحياتهم.",
    inviteMember: "دعوة عضو",
    roleUpdated: "تم تحديث الدور.",
    inviteResent: "تمت إعادة إرسال الدعوة إلى {email}.",
    memberRemoved: "تمت إزالة العضو.",
    colMember: "العضو",
    colRole: "الدور",
    colEmail: "البريد الإلكتروني",
    you: "(أنت)",
    roleFor: "دور {email}",
    memberFallback: "العضو",
    cantRemoveSelf: "لا يمكنك إزالة نفسك",
    pendingInvites: "دعوات قيد الانتظار",
    invited: "تمت الدعوة",
    resend: "إعادة الإرسال",
    inviteDescription: "سيصله بريد إلكتروني برابط للانضمام إلى هذا المتجر.",
    removeNamed: "إزالة {name}؟",
    removeThis: "إزالة هذا العضو؟",
    removeDescription: "سيفقد الوصول إلى هذا المتجر فورًا. يمكنك دعوته مرة أخرى لاحقًا.",
    removeMember: "إزالة العضو",
    inviteSent: "تم إرسال الدعوة إلى {email}.",
    email: "البريد الإلكتروني",
    role: "الدور",
    sending: "جارٍ الإرسال…",
    sendInvite: "إرسال الدعوة",
  },
} satisfies Messages;

const SECTION_CARD = "rounded-2xl border border-line bg-paper-raised p-5 shadow-card";
const TABLE_WRAP = "overflow-x-auto rounded-2xl border border-line bg-paper-raised";
const TH_ROW = "border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft";

export function SettingsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);

  return (
    <div className="max-w-5xl">
      <PageHeader title={t.title} description={t.description} />
      <Tabs defaultValue="general">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="flex-wrap">
            <TabsTrigger value="general">{t.tabGeneral}</TabsTrigger>
            <TabsTrigger value="team">{t.tabTeam}</TabsTrigger>
            <TabsTrigger value="checkout">{t.tabCheckout}</TabsTrigger>
            <TabsTrigger value="domains">{t.tabDomains}</TabsTrigger>
            <TabsTrigger value="camouflage">{t.tabCamouflage}</TabsTrigger>
            <TabsTrigger value="plan">{t.tabPlan}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="general" className="max-w-3xl space-y-6 pt-4">
          <LanguageSection />
          <WorkspaceProfileSection key={`profile-${workspaceId}`} />
        </TabsContent>
        <TabsContent value="team" className="max-w-3xl pt-4">
          <TeamSection key={`team-${workspaceId}`} />
        </TabsContent>
        <TabsContent value="checkout" className="pt-4">
          <CheckoutSettingsTab key={`checkout-${workspaceId}`} />
        </TabsContent>
        <TabsContent value="domains" className="max-w-3xl pt-4">
          <DomainsTab key={`domains-${workspaceId}`} />
        </TabsContent>
        <TabsContent value="camouflage" className="max-w-3xl pt-4">
          <CamouflageTab key={`camo-${workspaceId}`} />
        </TabsContent>
        <TabsContent value="plan" className="pt-4">
          <PlanTab key={`plan-${workspaceId}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------

const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string; lang: string; dir: "rtl" | "ltr" }> = [
  { value: "ar", label: "العربية", lang: "ar", dir: "rtl" },
  { value: "en", label: "English", lang: "en", dir: "ltr" },
];

function LanguageSection() {
  const t = useT(STRINGS);
  const { locale, setLocale } = useLocale();

  return (
    <section className={SECTION_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Languages className="size-4 text-primary" /> {t.languageTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{t.languageHint}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={t.languageTitle}
          className="inline-flex rounded-xl border border-line bg-paper p-1"
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const selected = locale === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                lang={opt.lang}
                dir={opt.dir}
                onClick={() => setLocale(opt.value)}
                className={cn(
                  "min-w-24 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  selected ? "bg-primary text-primary-foreground shadow-sm" : "text-ink-soft hover:text-ink"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Workspace profile
// ---------------------------------------------------------------------

function WorkspaceProfileSection() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh } = useWorkspace();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();

  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [tagline, setTagline] = useState(currentWorkspace?.tagline ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(currentWorkspace?.logoUrl ?? null);
  const [logoStage, setLogoStage] = useState<"preparing" | "uploading" | null>(null);
  const uploading = logoStage !== null;
  const [primaryColor, setPrimaryColor] = useState(() =>
    readThemeColor(currentWorkspace?.themeSettings, "primaryColor", DEFAULT_PRIMARY)
  );
  const [secondaryColor, setSecondaryColor] = useState(() =>
    readThemeColor(currentWorkspace?.themeSettings, "secondaryColor", DEFAULT_SECONDARY)
  );
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
      await apiClient.updateWorkspace(workspaceId, {
        name: name.trim(),
        tagline: tagline.trim() || null,
        logoUrl,
        // Merge, never replace: themeSettings is a shared blob and may already
        // carry keys owned by other parts of the product.
        themeSettings: {
          ...(currentWorkspace?.themeSettings ?? {}),
          primaryColor: normalizeHex(primaryColor) ?? DEFAULT_PRIMARY,
          secondaryColor: normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY,
        },
      });
      toast.success(t.profileSaved);
      // Refresh the workspace list so the new name shows in the header switcher.
      await refresh();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const primaryHex = normalizeHex(primaryColor) ?? DEFAULT_PRIMARY;
  const secondaryHex = normalizeHex(secondaryColor) ?? DEFAULT_SECONDARY;

  return (
    <section className={SECTION_CARD}>
      <h2 className="font-display text-lg font-semibold text-ink">{t.profileTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.profileHint}</p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <TextField
          label={t.name}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          dir="auto"
        />

        <div className="space-y-1.5">
          <Label>{t.logo}</Label>
          <div className="flex flex-wrap items-center gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={t.logoAlt}
                className="size-16 rounded-xl border border-line bg-paper object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-line text-xs text-ink-soft">
                {t.none}
              </div>
            )}
            <label
              className={cn(
                "inline-flex cursor-pointer items-center rounded-[var(--radius-button)] border border-line bg-paper-raised px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper",
                uploading && "pointer-events-none opacity-50"
              )}
            >
              {logoStage === "preparing" ? t.resizing : logoStage === "uploading" ? t.uploading : t.uploadLogo}
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
          <p className="text-xs text-ink-soft">{t.logoHint}</p>
        </div>

        <TextField
          label={t.tagline}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          error={fieldErrors.tagline}
          hint={t.taglineHint}
          dir="auto"
        />

        <div className="space-y-4 rounded-xl border border-line bg-paper p-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t.colorsTitle}</h3>
            <p className="mt-0.5 text-xs text-ink-soft">{t.colorsHint}</p>
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
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
              style={{ backgroundColor: `${primaryHex}14` }}
            >
              <span
                className="rounded-[var(--radius-button)] px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: primaryHex }}
              >
                {t.previewAddToCart}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: secondaryHex }}
              >
                {t.previewSale}
              </span>
              <span className="text-sm font-medium" style={{ color: primaryHex }}>
                {t.previewDetails}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || uploading || !name.trim() || !colorsValid}>
            {saving ? c.saving : c.save}
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
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();
  const t = useT(STRINGS);

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
      toast.success(fmt(t.inviteResent, { email: invite.invitedEmail ?? "" }));
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
          <h2 className="font-display text-lg font-semibold text-ink">{t.teamTitle}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.teamHint}</p>
        </div>
        <Button onClick={() => setInviting(true)} disabled={roles.length === 0}>
          {t.inviteMember}
        </Button>
      </div>

      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        <div className="mt-4 space-y-8">
          <div className={TABLE_WRAP}>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className={TH_ROW}>
                  <th className="px-4 py-3 text-start font-medium">{t.colMember}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colRole}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = Boolean(member.user && user && member.user.id === user.id);
                  return (
                    <tr key={member.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          <bdi>{member.user?.fullName || member.user?.email || "—"}</bdi>
                          {isSelf && (
                            <span className="ms-1.5 text-xs font-normal text-ink-soft">{t.you}</span>
                          )}
                        </div>
                        {member.user?.email && (
                          <div className="text-xs text-ink-soft">
                            <bdi dir="ltr">{member.user.email}</bdi>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-ink-soft">{member.role.name}</span>
                        ) : (
                          <Select
                            aria-label={fmt(t.roleFor, { email: member.user?.email ?? t.memberFallback })}
                            value={member.role.id}
                            onChange={(e) => changeRole(member, e.target.value)}
                            className="max-w-[220px]"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {isSelf ? (
                          <span className="text-xs text-ink-soft" title={t.cantRemoveSelf}>
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

          {invites.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t.pendingInvites}</h3>
              <div className={TABLE_WRAP}>
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className={TH_ROW}>
                      <th className="px-4 py-3 text-start font-medium">{t.colEmail}</th>
                      <th className="px-4 py-3 text-start font-medium">{t.colRole}</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((invite) => (
                      <tr key={invite.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <bdi dir="ltr" className="text-ink">
                              {invite.invitedEmail}
                            </bdi>
                            <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                              {t.invited}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{invite.role.name}</td>
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
        <InviteMemberForm
          roles={roles}
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
            ? fmt(t.removeNamed, { name: removing.user.fullName || removing.user.email || "" })
            : t.removeThis
        }
        description={t.removeDescription}
        confirmLabel={t.removeMember}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

function InviteMemberForm({
  roles,
  onCancel,
  onDone,
}: {
  roles: WorkspaceRole[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const payload: InviteMemberPayload = { email: email.trim(), roleId };
      await apiClient.inviteMember(workspaceId, payload);
      toast.success(fmt(t.inviteSent, { email: payload.email }));
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <TextField
        label={t.email}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder="teammate@example.com"
        dir="ltr"
      />

      <Field label={t.role} required error={fieldErrors.roleId}>
        {({ id }) => (
          <Select id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || !email.trim() || !roleId}>
          {saving ? t.sending : t.sendInvite}
        </Button>
      </div>
    </form>
  );
}
