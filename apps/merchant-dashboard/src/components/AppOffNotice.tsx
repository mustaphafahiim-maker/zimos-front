import { Link } from "react-router-dom";
import { Alert } from "@store-builder/ui";
import { appsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    off: "{name} is uninstalled, so it is off in your store and nothing here can be added or changed. What you set up is kept.",
    install: "Install it again from Apps",
  },
  ar: {
    off: "تطبيق {name} غير مثبّت، فهو متوقف في متجرك ولا يمكن إضافة أو تعديل شيء هنا. إعداداتك محفوظة.",
    install: "ثبّته من صفحة التطبيقات",
  },
} satisfies Messages;

/**
 * Shown on a feature's page when the store took that feature's app off in
 * the app store (backend apps/appGate.js): the page still shows what was set
 * up, but the feature does not run and changes are refused. Nothing when the
 * app is on, or when the app list can't be read.
 */
export function AppOffNotice({ app }: { app: string }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const apps = useAsync(() => appsList(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const entry = apps.data?.apps.find((a) => a.key === app);
  if (!entry || entry.installed) return null;
  return (
    <Alert className="mb-4">
      {fmt(t.off, { name: entry.name[locale] })}{" "}
      <Link to="/apps" className="font-medium underline">
        {t.install}
      </Link>
    </Alert>
  );
}
