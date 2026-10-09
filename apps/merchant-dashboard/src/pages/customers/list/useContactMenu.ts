import type { Contact } from "@store-builder/api-client";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconCopy, IconCustomers, IconMinus, IconPhone, IconQuickLook, IconTag, IconWhatsApp } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { dialablePhone, orderTelHref } from "@/pages/home/today/OrderQuickLook";
import { copyText } from "@/pages/orders/list/orderRow";
import { contactPhone } from "./contactRow";

const STRINGS = {
  en: {
    open: "Open the customer",
    peek: "Quick look",
    call: "Call",
    whatsapp: "WhatsApp",
    copyPhone: "Copy the number",
    addTags: "Add tags",
    removeTags: "Remove tags",
    copiedPhone: "The number is copied",
    copyFailed: "We couldn't copy that. Try again.",
  },
  ar: {
    open: "افتح العميل",
    peek: "نظرة سريعة",
    call: "اتصل",
    whatsapp: "واتساب",
    copyPhone: "انسخ الرقم",
    addTags: "ضيف وسوم",
    removeTags: "شيل وسوم",
    copiedPhone: "الرقم اتنسخ",
    copyFailed: "معرفناش ننسخ. جرّب تاني.",
  },
} satisfies Messages;

/**
 * The menu of a contact's row (right-click, a long press, Shift+F10): open the
 * customer, Quick Look, call, WhatsApp, copy the number, add or remove tags. A
 * number the role is sent masked (010****665) is not one to dial or copy, so
 * the lines that need the whole number are left out for it.
 */
export function useContactMenu({
  onOpen,
  onPeek,
  onTag,
}: {
  /** Open the contact's own page. */
  onOpen: (contact: Contact) => void;
  /** Quick Look. */
  onPeek: (contact: Contact) => void;
  /** The tags sheet, for this one contact. */
  onTag: (contact: Contact, mode: "add" | "remove") => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();

  const copy = async (value: string, done: string) => {
    if (await copyText(value)) toast.success(done);
    else toast.error(t.copyFailed);
  };

  return (contact: Contact): ContextMenuItem[] => {
    const phone = dialablePhone(contactPhone(contact));
    const whatsapp = phone ? toWhatsAppNumber(phone) : null;
    const items: ContextMenuItem[] = [
      { id: "open", label: t.open, icon: IconCustomers, onSelect: () => onOpen(contact) },
      { id: "peek", label: t.peek, icon: IconQuickLook, onSelect: () => onPeek(contact) },
    ];
    if (phone) {
      items.push({
        id: "call",
        label: t.call,
        icon: IconPhone,
        separatorBefore: true,
        onSelect: () => {
          window.location.href = orderTelHref(phone);
        },
      });
    }
    if (whatsapp) {
      items.push({
        id: "whatsapp",
        label: t.whatsapp,
        icon: IconWhatsApp,
        onSelect: () => {
          window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
        },
      });
    }
    if (phone) {
      items.push({ id: "copy-phone", label: t.copyPhone, icon: IconCopy, onSelect: () => void copy(phone, t.copiedPhone) });
    }
    items.push({ id: "add-tags", label: t.addTags, icon: IconTag, separatorBefore: true, onSelect: () => onTag(contact, "add") });
    if (contact.tags.length > 0) {
      items.push({ id: "remove-tags", label: t.removeTags, icon: IconMinus, onSelect: () => onTag(contact, "remove") });
    }
    return items;
  };
}
