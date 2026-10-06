import { GOOGLE_FONTS, storeFontsList, type StoreFont } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { Select } from "@/components/Select";
import { useEditorLocale } from "./editorLocale";

/**
 * Picking a font by reference (api-client endpoints/storeFonts.ts): `g:Name`
 * for a Google font, `c:<id>` for one the store uploaded, "" for whatever the
 * place falls back to (the look's own font, or the store's for an element).
 */

const STRINGS = {
  en: { arabic: "Arabic and Latin (Google)", latin: "Latin only (Google)", uploaded: "Your fonts" },
  ar: { arabic: "عربي ولاتيني (Google)", latin: "لاتيني فقط (Google)", uploaded: "خطوطك" },
} as const;

/** The store's uploaded fonts; shared by every picker on the screen through useAsync's own cache-less load. */
export function useStoreFonts() {
  const workspaceId = useWorkspaceId();
  return useAsync<StoreFont[]>(() => storeFontsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
}

export function FontSelect({
  id,
  value,
  onChange,
  emptyLabel,
  uploaded,
  ...rest
}: {
  id?: string;
  value: string;
  onChange: (ref: string) => void;
  emptyLabel: string;
  uploaded: StoreFont[];
  "aria-label"?: string;
}) {
  const t = STRINGS[useEditorLocale()];
  const known = value === "" || GOOGLE_FONTS.some((f) => `g:${f.name}` === value) || uploaded.some((f) => `c:${f.id}` === value);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">{emptyLabel}</option>
      {/* A saved reference this list no longer has (a deleted upload) still shows, so it can be changed. */}
      {!known && <option value={value}>{value.replace(/^g:/, "")}</option>}
      {uploaded.length > 0 && (
        <optgroup label={t.uploaded}>
          {uploaded.map((f) => (
            <option key={f.id} value={`c:${f.id}`}>
              {f.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={t.arabic}>
        {GOOGLE_FONTS.filter((f) => f.arabic).map((f) => (
          <option key={f.name} value={`g:${f.name}`}>
            {f.name}
          </option>
        ))}
      </optgroup>
      <optgroup label={t.latin}>
        {GOOGLE_FONTS.filter((f) => !f.arabic).map((f) => (
          <option key={f.name} value={`g:${f.name}`}>
            {f.name}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}
