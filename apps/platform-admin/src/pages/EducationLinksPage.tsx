import { useEffect, useState } from "react";
import { Button, Input } from "@store-builder/ui";
import { adminEducationGet, adminEducationSet, type TutorialTopic } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Panel } from "@/components/Panel";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";

/** Where each tutorial shows in the merchant's dashboard. */
const TOPIC_LABEL: Record<TutorialTopic, string> = {
  products: "Products",
  shipping: "Shipping & tax",
  payments: "Payments",
  website: "Store website & domains",
  funnels: "Funnels",
  offers: "Offers",
  marketing: "Marketing & pixels",
  automations: "Automations & WhatsApp messages",
  fraud: "Fake-order protection",
  profit: "Real profit & ad spend",
};

type General = { helpCenterUrl: string; telegramUrl: string; supportChatUrl: string };

/**
 * The links the merchant dashboard teaches with (SPEC §18.6, §15.1): the help
 * center, the Telegram channel and support chat as cards on the home page,
 * and a tutorial video under the title of each page below. Empty = not shown.
 */
export function EducationLinksPage() {
  const { can } = useAuth();
  const toast = useToast();
  const editable = can(P.ANNOUNCEMENTS_MANAGE);
  const { data, loading, error, refresh, setData } = useAsync(() => adminEducationGet(apiClient), []);
  const [general, setGeneral] = useState<General>({ helpCenterUrl: "", telegramUrl: "", supportChatUrl: "" });
  const [tutorials, setTutorials] = useState<Partial<Record<TutorialTopic, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setGeneral({
      helpCenterUrl: data.education.helpCenterUrl ?? "",
      telegramUrl: data.education.telegramUrl ?? "",
      supportChatUrl: data.education.supportChatUrl ?? "",
    });
    setTutorials(data.education.tutorials);
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      setData(await adminEducationSet(apiClient, { ...general, tutorials }));
      toast.success("Links saved. Merchants see them on their next page load.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, onChange: (v: string) => void) => (
    <label key={label} className="block text-sm text-ink">
      <span className="mb-1 block font-medium">{label}</span>
      <Input type="url" dir="ltr" placeholder="https://" value={value} disabled={!editable} onChange={(e) => onChange(e.target.value)} />
    </label>
  );

  return (
    <div>
      <PageHeader
        title="Education links"
        description="Help center, Telegram and support chat cards on the merchant's home page, and a tutorial video on each dashboard page. Leave a link empty to hide it."
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {data && (
          <div className="space-y-6">
            <Panel title="Home page cards">
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Help center", general.helpCenterUrl, (v) => setGeneral({ ...general, helpCenterUrl: v }))}
                {field("Telegram channel", general.telegramUrl, (v) => setGeneral({ ...general, telegramUrl: v }))}
                {field("Support chat", general.supportChatUrl, (v) => setGeneral({ ...general, supportChatUrl: v }))}
              </div>
            </Panel>
            <Panel title="Tutorial videos" description="Shown as “Watch the tutorial” under the page title.">
              <div className="grid gap-4 sm:grid-cols-2">
                {data.topics.map((topic) => field(TOPIC_LABEL[topic] ?? topic, tutorials[topic] ?? "", (v) => setTutorials({ ...tutorials, [topic]: v })))}
              </div>
            </Panel>
            {editable && (
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save links"}
              </Button>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
}
