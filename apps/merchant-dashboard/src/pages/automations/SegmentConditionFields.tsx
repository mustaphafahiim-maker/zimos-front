import { Link } from "react-router-dom";
import { segmentsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    inSegment: "Contact is in the segment",
    notInSegment: "Contact is not in the segment",
    any: "Any contact",
    none: "No segment excluded",
    hint: "Checked when the automation starts, for any trigger that has a contact.",
    noSegments: "No segments yet.",
    create: "Create one in Customers → Segments",
    gone: "(deleted segment)",
  },
  ar: {
    inSegment: "العميل ضمن الشريحة",
    notInSegment: "العميل ليس ضمن الشريحة",
    any: "أي عميل",
    none: "بدون استبعاد",
    hint: "يُفحص عند بدء الأتمتة، لأي مُشغّل له عميل.",
    noSegments: "لا توجد شرائح بعد.",
    create: "أنشئ واحدة من العملاء ← الشرائح",
    gone: "(شريحة محذوفة)",
  },
} satisfies Messages;

export type SegmentConditions = { segmentId: string | null; excludeSegmentId: string | null };

/** The rule editor's segment conditions (backend automations/segmentCondition.js). */
export function SegmentConditionFields({ value, onChange }: { value: SegmentConditions; onChange: (next: SegmentConditions) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const segments = useAsync(() => segmentsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const list = segments.data ?? [];
  const known = new Set(list.map((s) => s.id));

  if (!segments.loading && list.length === 0 && !value.segmentId && !value.excludeSegmentId) {
    return (
      <p className="text-sm text-ink-soft sm:col-span-2">
        {t.noSegments}{" "}
        <Link to="/customers?tab=segments" className="font-medium text-primary hover:underline">
          {t.create}
        </Link>
      </p>
    );
  }

  const options = (selected: string | null) => (
    <>
      {list.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      {selected && !known.has(selected) && !segments.loading && <option value={selected}>{t.gone}</option>}
    </>
  );

  return (
    <>
      <Field label={t.inSegment} hint={t.hint}>
        {({ id }) => (
          <Select id={id} value={value.segmentId ?? ""} onChange={(e) => onChange({ ...value, segmentId: e.target.value || null })}>
            <option value="">{t.any}</option>
            {options(value.segmentId)}
          </Select>
        )}
      </Field>
      <Field label={t.notInSegment}>
        {({ id }) => (
          <Select id={id} value={value.excludeSegmentId ?? ""} onChange={(e) => onChange({ ...value, excludeSegmentId: e.target.value || null })}>
            <option value="">{t.none}</option>
            {options(value.excludeSegmentId)}
          </Select>
        )}
      </Field>
    </>
  );
}
