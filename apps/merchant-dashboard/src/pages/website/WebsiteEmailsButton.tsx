import { useState } from "react";
import { IconEmail } from "@/components/icons";
import { Button } from "@store-builder/ui";
import type { Website } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { OrderEmailTemplates } from "@/pages/settings/OrderEmailTemplates";

const STRINGS = {
  en: {
    emails: "Emails",
    emailsFor: "Emails for “{name}”",
    title: "Order emails — {name}",
    intro: "The emails customers get about orders placed on this website. Each one is the store's email until you change it here — then this website gets its own version. A funnel's own version comes first.",
  },
  ar: {
    emails: "الإيميلات",
    emailsFor: "إيميلات «{name}»",
    title: "إيميلات الطلبات — {name}",
    intro: "الإيميلات اللي العملاء بياخدوها عن الأوردرات اللي جاية من الموقع ده. كل إيميل زي إيميل المتجر لحد ما تغيّره هنا — ساعتها الموقع ياخد نسخة خاصة بيه. ولو مسار البيع ليه نسخة خاصة، هي اللي بتتبعت.",
  },
} satisfies Messages;

/**
 * Website → "Emails" (handoff item 175): a website's own versions of the
 * order emails, offered once the store has more than one website (with one,
 * the store's emails in Settings already are that website's). The editor
 * opens in place inside this dialog.
 */
export function WebsiteEmailsButton({ site }: { site: Pick<Website, "id" | "name"> }) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" aria-label={fmt(t.emailsFor, { name: site.name })} onClick={() => setOpen(true)}>
        <IconEmail className="size-4" aria-hidden />
        {t.emails}
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={fmt(t.title, { name: site.name })} description={t.intro} className="max-w-6xl">
          <OrderEmailTemplates scope={{ kind: "website", id: site.id }} editorLayout="inline" />
        </Modal>
      )}
    </>
  );
}
