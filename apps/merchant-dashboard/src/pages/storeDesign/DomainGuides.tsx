import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger, buttonVariants } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { legalUrl } from "@/lib/legalLinks";

/**
 * Where to add the two records at the common registrars, and how to forward
 * the bare domain (example.com) to www. One tab per registrar; each step is a
 * line of its string. The registrars' menus change: the steps name the
 * screens as they were written, not a guarantee.
 */

const REGISTRARS = ["godaddy", "namecheap", "hostinger", "cloudflare"] as const;
type Registrar = (typeof REGISTRARS)[number];

const STRINGS = {
  en: {
    title: "Step-by-step at your registrar",
    tabsLabel: "Registrar",
    godaddy: "GoDaddy",
    namecheap: "Namecheap",
    hostinger: "Hostinger",
    cloudflare: "Cloudflare DNS",
    recordsTitle: "Add the two records",
    forwardTitle: "Want visitors who type the domain without www to arrive too?",
    forwardLead: "Enable Domain Forwarding from {apex} to https://{www} at your registrar:",
    godaddyRecords:
      "Sign in, open My Products, then DNS next to {apex}.\nAdd a CNAME record: Name {cnameName}, Value {cnameValue}, TTL 1 hour or less. If a CNAME named www already exists (usually pointing to @), edit it instead of adding a new one.\nAdd a TXT record: Name {txtName}, Value {txtValue}.\nRemove any A record on the name {cnameName}.",
    godaddyForward:
      "Open the domain's DNS page, then the Forwarding tab.\nUnder Domain, choose Add Forwarding.\nDestination: https:// and {www}. Type: Permanent (301). Save.",
    namecheapRecords:
      "Open Domain List, choose Manage next to {apex}, then Advanced DNS.\nAdd a CNAME Record: Host {cnameName}, Value {cnameValue}, TTL Automatic.\nAdd a TXT Record: Host {txtName}, Value {txtValue}.\nDelete any parking page or URL Redirect record on the host {cnameName}.",
    namecheapForward:
      "In Advanced DNS, add a URL Redirect Record.\nHost @, Value https://{www}, type Permanent (301). Save.",
    hostingerRecords:
      "In hPanel open Domains, choose {apex}, then DNS / Nameservers.\nFirst delete any A or CNAME record already on the name {cnameName}.\nAdd a CNAME record: Name {cnameName}, Target {cnameValue}, TTL 300.\nAdd a TXT record: Name {txtName}, Value {txtValue}.",
    hostingerForward:
      "In hPanel open Domains, choose {apex}, then Redirects (domain forwarding).\nRedirect to https://{www}, type 301 (permanent). Save.",
    cloudflareRecords:
      "In the Cloudflare dashboard open {apex}, then DNS, then Records.\nAdd a CNAME record: Name {cnameName}, Target {cnameValue}. Set Proxy status to DNS only (grey cloud), not Proxied.\nAdd a TXT record: Name {txtName}, Content {txtValue}.",
    cloudflareForward:
      "Make sure {apex} itself has a Proxied (orange cloud) record, for example A @ 192.0.2.1.\nOpen Rules, then Redirect Rules, and create a rule: hostname equals {apex}.\nThen: Static redirect to https://{www}, status 301, preserve the query string. Deploy.",
    note: "Changes can take from a few minutes up to 48 hours to spread. If your domain has a CAA record, it must allow letsencrypt.org, pki.goog and ssl.com.",
    help: "Need more help? Contact us",
  },
  ar: {
    title: "الخطوات عند مزوّد الدومين",
    tabsLabel: "مزوّد الدومين",
    godaddy: "GoDaddy",
    namecheap: "Namecheap",
    hostinger: "Hostinger",
    cloudflare: "Cloudflare DNS",
    recordsTitle: "أضف السجلين",
    forwardTitle: "هل تريد أن يصل الزوار الذين يكتبون الدومين بدون www أيضًا؟",
    forwardLead: "فعّل توجيه الدومين (Domain Forwarding) من {apex} إلى https://{www} عند مزوّد الدومين:",
    godaddyRecords:
      "سجّل الدخول وافتح My Products، ثم DNS بجوار {apex}.\nأضف سجل CNAME: الاسم {cnameName}، والقيمة {cnameValue}، وTTL ساعة أو أقل. إذا كان هناك سجل CNAME باسم www بالفعل (غالبًا يشير إلى @)، فعدّله بدلًا من إضافة سجل جديد.\nأضف سجل TXT: الاسم {txtName}، والقيمة {txtValue}.\nاحذف أي سجل A على الاسم {cnameName}.",
    godaddyForward:
      "افتح صفحة DNS للدومين، ثم تبويب Forwarding.\nتحت Domain اختر Add Forwarding.\nالوجهة: https:// ثم {www}. النوع: Permanent (301). احفظ.",
    namecheapRecords:
      "افتح Domain List، واختر Manage بجوار {apex}، ثم Advanced DNS.\nأضف CNAME Record: الـ Host هو {cnameName}، والقيمة {cnameValue}، وTTL على Automatic.\nأضف TXT Record: الـ Host هو {txtName}، والقيمة {txtValue}.\nاحذف أي سجل صفحة انتظار (parking) أو URL Redirect على الـ Host {cnameName}.",
    namecheapForward:
      "من Advanced DNS أضف URL Redirect Record.\nالـ Host هو @، والقيمة https://{www}، والنوع Permanent (301). احفظ.",
    hostingerRecords:
      "من hPanel افتح Domains، واختر {apex}، ثم DNS / Nameservers.\nاحذف أولًا أي سجل A أو CNAME موجود على الاسم {cnameName}.\nأضف سجل CNAME: الاسم {cnameName}، والهدف {cnameValue}، وTTL 300.\nأضف سجل TXT: الاسم {txtName}، والقيمة {txtValue}.",
    hostingerForward:
      "من hPanel افتح Domains، واختر {apex}، ثم Redirects (توجيه الدومين).\nوجّه إلى https://{www} بالنوع 301 (دائم). احفظ.",
    cloudflareRecords:
      "من لوحة Cloudflare افتح {apex}، ثم DNS، ثم Records.\nأضف سجل CNAME: الاسم {cnameName}، والهدف {cnameValue}. اجعل حالة الـ Proxy على DNS only (السحابة الرمادية)، وليس Proxied.\nأضف سجل TXT: الاسم {txtName}، والمحتوى {txtValue}.",
    cloudflareForward:
      "تأكد أن {apex} نفسه عليه سجل Proxied (السحابة البرتقالية)، مثل A @ 192.0.2.1.\nافتح Rules، ثم Redirect Rules، وأنشئ قاعدة: الـ hostname يساوي {apex}.\nثم: Static redirect إلى https://{www} بالحالة 301 مع الإبقاء على الـ query string. انشر القاعدة.",
    note: "قد يستغرق انتشار التغييرات من بضع دقائق حتى 48 ساعة. إذا كان لدومينك سجل CAA، فيجب أن يسمح بـ letsencrypt.org وpki.goog وssl.com.",
    help: "تحتاج مساعدة أكثر؟ تواصل معنا",
  },
} satisfies Messages;

export interface DomainGuidesProps {
  /** The connected host (www.example.com). */
  hostname: string;
  /** The bare domain it belongs to (example.com). */
  apex: string;
  cnameName: string;
  cnameValue: string;
  txtName: string;
  txtValue: string;
}

function Steps({ text }: { text: string }) {
  return (
    <ol className="list-decimal space-y-1 ps-5 text-sm text-ink">
      {text.split("\n").map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ol>
  );
}

export function DomainGuides(props: DomainGuidesProps) {
  const t = useT(STRINGS);
  const [registrar, setRegistrar] = useState<Registrar>("godaddy");
  // Host names and values stay left-to-right inside Arabic sentences.
  const ltr = (value: string) => `⁦${value}⁩`;
  const values = {
    apex: ltr(props.apex),
    www: ltr(props.hostname),
    cnameName: ltr(props.cnameName),
    cnameValue: ltr(props.cnameValue),
    txtName: ltr(props.txtName),
    txtValue: ltr(props.txtValue),
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">{t.title}</p>
      <Tabs value={registrar} onValueChange={(value) => setRegistrar(value as Registrar)}>
        <TabsList aria-label={t.tabsLabel} className="w-full max-w-full overflow-x-auto sm:w-fit group-data-horizontal/tabs:h-auto">
          {REGISTRARS.map((key) => (
            <TabsTrigger key={key} value={key} className="min-h-11 px-4">
              {t[key]}
            </TabsTrigger>
          ))}
        </TabsList>
        {REGISTRARS.map((key) => (
          <TabsContent key={key} value={key} className="space-y-4 pt-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t.recordsTitle}</p>
              <Steps text={fmt(t[`${key}Records`], values)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">{t.forwardTitle}</p>
              <p className="text-sm text-ink-soft">{fmt(t.forwardLead, values)}</p>
              <Steps text={fmt(t[`${key}Forward`], values)} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-ink-soft">{t.note}</p>
      <a
        href={legalUrl("contact")}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <LifeBuoy className="size-4" />
        {t.help}
      </a>
    </div>
  );
}
