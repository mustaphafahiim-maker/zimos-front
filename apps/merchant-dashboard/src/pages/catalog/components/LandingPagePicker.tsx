import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    label: "Landing page",
    standard: "The standard product page",
    hint: "A page you built in Online store → Website, shown at this product's link instead of the standard page, with this product as its product. It must be published.",
    missing: "(page no longer exists)",
  },
  ar: {
    label: "صفحة الهبوط",
    standard: "صفحة المنتج العادية",
    hint: "صفحة بنيتها من المتجر الإلكتروني ← الموقع، تظهر على رابط المنتج بدل الصفحة العادية، والمنتج ده هو منتجها. لازم تكون منشورة.",
    missing: "(الصفحة لم تعد موجودة)",
  },
} satisfies Messages;

/** Page settings → landing_page_id: one of the store website's pages, or none. */
export function LandingPagePicker({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (pageId: string | null) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const pages = useAsync(async () => {
    const websites = await apiClient.listWebsites(workspaceId);
    if (websites.length === 0) return [];
    const detail = await apiClient.getWebsite(workspaceId, websites[0].id);
    return detail.pages.filter((p) => p.path !== "/").map((p) => ({ id: p.id, title: p.title, path: p.path }));
  }, [workspaceId]);
  const list = pages.data ?? [];
  if (!pages.loading && list.length === 0 && !value) return null;
  return (
    <Field label={t.label} hint={t.hint}>
      {({ id }) => (
        <Select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">{t.standard}</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.path})
            </option>
          ))}
          {value && !pages.loading && !list.some((p) => p.id === value) && <option value={value}>{t.missing}</option>}
        </Select>
      )}
    </Field>
  );
}
