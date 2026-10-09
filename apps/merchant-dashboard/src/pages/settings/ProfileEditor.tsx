import { useRef, useState, type ChangeEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { profileAvatarOf, profileUpdate } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { SettingsCard } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    picture: "Your picture",
    upload: "Upload picture",
    change: "Change picture",
    uploading: "Uploading…",
    removePicture: "Remove",
    pictureSaved: "Your picture was updated.",
    pictureRemoved: "Your picture was removed.",
  },
  ar: {
    picture: "صورتك",
    upload: "ارفع صورة",
    change: "غيّر الصورة",
    uploading: "بنرفع…",
    removePicture: "شيلها",
    pictureSaved: "صورتك اتغيّرت.",
    pictureRemoved: "صورتك اتشالت.",
  },
} satisfies Messages;

/**
 * The person's own picture (SPEC §17.3), at the top of «الملف الشخصي»: who is
 * signed in, and the picture changed or removed at once (upload, then
 * PATCH /auth/me/profile { avatarUrl }). The name is saved with the rest of
 * the profile, from the section's save bar (AccountSection.tsx).
 */
export function ProfileEditor() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const avatar = profileAvatarOf(user);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const prepared = await compressImageIfNeeded(file);
      const problem = validateImageFile(prepared);
      if (problem) {
        setError(problem);
        return;
      }
      const media = await apiClient.uploadMedia(workspaceId, prepared);
      await profileUpdate(apiClient, { avatarUrl: media.url });
      await refreshUser();
      toast.success(t.pictureSaved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removePicture() {
    setBusy(true);
    setError(null);
    try {
      await profileUpdate(apiClient, { avatarUrl: null });
      await refreshUser();
      toast.success(t.pictureRemoved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {avatar ? (
          <img src={avatar} alt={t.picture} className="size-16 shrink-0 rounded-full object-cover ring-1 ring-line" />
        ) : (
          <div aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-soft text-2xl font-semibold text-primary">
            {(user.fullName || user.email || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-[1_1_10rem]">
          <p className="truncate text-[17px] leading-6 font-semibold text-ink">
            <bdi>{user.fullName || user.email}</bdi>
          </p>
          <p className="truncate text-sm text-ink-soft">
            <bdi dir="ltr">{user.email}</bdi>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-label={t.picture} onChange={pick} />
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t.uploading : avatar ? t.change : t.upload}
          </Button>
          {avatar && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void removePicture()}>
              {t.removePicture}
            </Button>
          )}
        </div>
      </div>
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
    </SettingsCard>
  );
}
