import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { profileAvatarOf, profileUpdate } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { ACCEPTED_IMAGE_ACCEPT, compressImageIfNeeded, validateImageFile } from "@/lib/media";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    picture: "Your picture",
    upload: "Upload picture",
    change: "Change picture",
    uploading: "Uploading…",
    removePicture: "Remove",
    pictureSaved: "Your picture was updated.",
    pictureRemoved: "Your picture was removed.",
    name: "Your name",
    saveName: "Save name",
    saving: "Saving…",
    nameSaved: "Your name was saved.",
  },
  ar: {
    picture: "صورتك",
    upload: "رفع صورة",
    change: "تغيير الصورة",
    uploading: "بنرفع…",
    removePicture: "إزالة",
    pictureSaved: "تم تحديث صورتك.",
    pictureRemoved: "تمت إزالة صورتك.",
    name: "اسمك",
    saveName: "حفظ الاسم",
    saving: "بنحفظ…",
    nameSaved: "تم حفظ اسمك.",
  },
} satisfies Messages;

/** The owner's own picture and name (SPEC §17.3), in "Your account". */
export function ProfileEditor() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.fullName ?? "");
  const [busy, setBusy] = useState<"picture" | "name" | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const avatar = profileAvatarOf(user);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("picture");
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
      setBusy(null);
    }
  }

  async function removePicture() {
    setBusy("picture");
    setError(null);
    try {
      await profileUpdate(apiClient, { avatarUrl: null });
      await refreshUser();
      toast.success(t.pictureRemoved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy("name");
    setError(null);
    try {
      await profileUpdate(apiClient, { fullName: name.trim() });
      await refreshUser();
      toast.success(t.nameSaved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {avatar ? (
          <img src={avatar} alt={t.picture} className="size-16 rounded-full border border-line object-cover" />
        ) : (
          <div aria-hidden className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary">
            {(user.fullName || user.email || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_ACCEPT} className="sr-only" aria-label={t.picture} onChange={pick} />
          <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
            {busy === "picture" ? t.uploading : avatar ? t.change : t.upload}
          </Button>
          {avatar && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={busy !== null} onClick={() => void removePicture()}>
              {t.removePicture}
            </Button>
          )}
        </div>
      </div>
      <form onSubmit={saveName} className="flex max-w-md flex-wrap items-end gap-2">
        <TextField className="min-w-0 flex-1" label={t.name} required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" className="min-h-11" disabled={busy !== null || !name.trim() || name.trim() === user.fullName}>
          {busy === "name" ? t.saving : t.saveName}
        </Button>
      </form>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
