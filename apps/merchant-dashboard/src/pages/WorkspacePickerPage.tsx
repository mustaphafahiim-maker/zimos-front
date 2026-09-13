import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, LogOut, Plus, Store } from "lucide-react";
import { Button, Input, Label, Alert, ZimosLogo, ZimosMark } from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/i18n/LocaleContext";
import { LanguageSwitch } from "@/components/LanguageSwitch";

const STRINGS = {
  en: {
    chooseTitle: "Choose a store",
    chooseSubtitle: "Pick the store you want to manage.",
    setupTitle: "Let's set up your store",
    setupSubtitle: "Give your store a name. You can change it later in settings.",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    open: "Open",
    createTitle: "Create a new store",
    createHint: "Run another brand or market from the same account.",
    storeName: "Store name",
    storePlaceholder: "Ahmed's Store",
    create: "Create store",
    creating: "Creating…",
    cancel: "Cancel",
    failed: "We couldn't create the store. Please try again.",
    loading: "Loading your stores…",
  },
  ar: {
    chooseTitle: "اختر متجرًا",
    chooseSubtitle: "اختر المتجر الذي تريد إدارته.",
    setupTitle: "لنجهّز متجرك",
    setupSubtitle: "اختر اسمًا لمتجرك. يمكنك تغييره لاحقًا من الإعدادات.",
    signedInAs: "مسجّل الدخول باسم",
    signOut: "تسجيل الخروج",
    open: "فتح",
    createTitle: "إنشاء متجر جديد",
    createHint: "أدِر علامة تجارية أو سوقًا آخر من الحساب نفسه.",
    storeName: "اسم المتجر",
    storePlaceholder: "متجر أحمد",
    create: "إنشاء المتجر",
    creating: "جارٍ الإنشاء…",
    cancel: "إلغاء",
    failed: "تعذّر إنشاء المتجر. حاول مرة أخرى.",
    loading: "جارٍ تحميل متاجرك…",
  },
};

export function WorkspacePickerPage() {
  const t = useT(STRINGS);
  const { user, logout } = useAuth();
  const { workspaces, loading, selectWorkspace, createWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasStores = workspaces.length > 0;
  const formVisible = !hasStores || showForm;

  function goToDashboard(workspaceId: string) {
    selectWorkspace(workspaceId);
    navigate("/");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createWorkspace(name.trim());
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failed);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-raised px-4 py-3 sm:px-8">
        <ZimosLogo height={30} />
        <div className="flex items-center gap-1">
          <LanguageSwitch />
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
            <span className="hidden sm:inline">{t.signOut}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{hasStores ? t.chooseTitle : t.setupTitle}</h1>
        <p className="mt-2 text-sm text-ink-soft">{hasStores ? t.chooseSubtitle : t.setupSubtitle}</p>
        {user?.email && (
          <p className="mt-1 text-xs text-ink-muted">
            {t.signedInAs} <span dir="ltr">{user.email}</span>
          </p>
        )}

        {loading ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-sm text-ink-muted" role="status">
            <ZimosMark size={40} className="animate-pulse" alt="" />
            <span>{t.loading}</span>
          </div>
        ) : (
          <>
            {hasStores && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => goToDashboard(workspace.id)}
                    className="group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-line bg-paper-raised p-4 text-start transition-colors hover:border-primary/50 hover:bg-primary-soft/30"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-soft text-base font-semibold text-primary">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{workspace.name}</span>
                      <span className="block truncate text-xs text-ink-muted" dir="ltr">
                        {workspace.slug}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
                      {t.open}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
                    </span>
                  </button>
                ))}

                {!showForm && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line-strong bg-transparent p-4 text-start transition-colors hover:border-primary/50 hover:bg-primary-soft/30"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-line bg-paper-raised text-primary">
                      <Plus className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">{t.createTitle}</span>
                      <span className="block text-xs text-ink-muted">{t.createHint}</span>
                    </span>
                  </button>
                )}
              </div>
            )}

            {formVisible && (
              <div className="animate-zimos-slide-up mt-8 rounded-2xl border border-line bg-paper-raised p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
                    <Store className="size-5" aria-hidden />
                  </span>
                  <h2 className="text-lg font-semibold text-ink">{t.createTitle}</h2>
                </div>
                <form onSubmit={handleCreate} className="mt-5 space-y-4">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="space-y-1.5">
                    <Label htmlFor="workspaceName">{t.storeName}</Label>
                    <Input
                      id="workspaceName"
                      required
                      autoFocus={showForm}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.storePlaceholder}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={creating || name.trim().length === 0}>
                      {creating ? t.creating : t.create}
                    </Button>
                    {hasStores && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setShowForm(false);
                          setError(null);
                        }}
                        disabled={creating}
                      >
                        {t.cancel}
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
