import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { CarrierAreaNode } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { useLevelLabel } from "@/pages/orders/components/useLevelLabel";
import { placeName } from "./carriers";

const STRINGS = {
  en: {
    chooseLevel: "Choose {level}",
    save: "Save",
    cancel: "Cancel",
    listFailed: "{name}'s list could not be loaded.",
  },
  ar: {
    chooseLevel: "اختر {level}",
    save: "حفظ",
    cancel: "إلغاء",
    listFailed: "تعذّر تحميل قائمة {name}.",
  },
};

/** The courier's list as one tree: city/district couriers answer cities with `districts`. */
async function courierTree(
  workspaceId: string,
  carrierCode: string,
  levels: string[],
) {
  const usable = (n: { dropOffAvailable?: boolean }) =>
    n.dropOffAvailable !== false;
  if (levels.length === 2 && levels[0] === "city" && levels[1] === "district") {
    const cities = await apiClient.listCarrierCities(workspaceId, carrierCode);
    return cities.filter(usable).map<CarrierAreaNode>((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.nameAr,
      children: (c.districts ?? [])
        .filter(usable)
        .map((d) => ({ id: d.id, name: d.name, nameAr: d.nameAr })),
    }));
  }
  const prune = (nodes: CarrierAreaNode[]): CarrierAreaNode[] =>
    nodes
      .filter(usable)
      .map((n) => ({
        ...n,
        children: n.children ? prune(n.children) : undefined,
      }));
  return prune(
    (await apiClient.listCarrierAddressTree(workspaceId, carrierCode)).nodes,
  );
}

/**
 * Picks a place on a courier's own address list, level by level (one select
 * per level, each narrowed by the one above). `onSave` gets the ids top
 * first and the place's name for a message.
 */
export function CourierPlacePicker({
  carrierCode,
  name,
  levels,
  initialPath = [],
  saveLabel,
  onCancel,
  onSave,
  onError,
}: {
  carrierCode: string;
  /** The courier's name, for messages. */
  name: string;
  levels: string[];
  initialPath?: string[];
  saveLabel?: string;
  onCancel: () => void;
  onSave: (path: string[], label: string) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const levelLabel = useLevelLabel();
  const workspaceId = useWorkspaceId();
  const tree = useAsync(
    () => courierTree(workspaceId, carrierCode, levels),
    [workspaceId, carrierCode, levels.join(">")],
  );
  const [path, setPath] = useState<string[]>(initialPath);
  const [saving, setSaving] = useState(false);

  // The options of each level: the top list, then the children of what is chosen above.
  const options: CarrierAreaNode[][] = [];
  const chosen: CarrierAreaNode[] = [];
  let nodes: CarrierAreaNode[] | undefined = tree.data ?? undefined;
  for (let i = 0; i < levels.length && nodes; i += 1) {
    options.push(nodes);
    const node: CarrierAreaNode | undefined = nodes.find(
      (n) => n.id === path[i],
    );
    if (!node) break;
    chosen.push(node);
    nodes = node.children;
  }
  const complete = chosen.length === levels.length;

  async function save() {
    setSaving(true);
    try {
      await onSave(
        chosen.map((n) => n.id),
        chosen.map((n) => placeName(n, locale)).join(" › "),
      );
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-[0.625rem] border border-line bg-paper p-3">
      {tree.error ? (
        <p className="text-sm text-danger">{fmt(t.listFailed, { name })}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {levels.map((level, i) => (
            <Select
              key={level}
              aria-label={fmt(t.chooseLevel, { level: levelLabel(level) })}
              value={path[i] ?? ""}
              disabled={tree.loading || saving || !options[i]}
              onChange={(e) => setPath([...path.slice(0, i), e.target.value])}
            >
              <option value="">
                {fmt(t.chooseLevel, { level: levelLabel(level) })}
              </option>
              {(options[i] ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {placeName(n, locale)}
                </option>
              ))}
            </Select>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={saving}
        >
          {t.cancel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!complete || saving}
        >
          {saveLabel ?? t.save}
        </Button>
      </div>
    </div>
  );
}
