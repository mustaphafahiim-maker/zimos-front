import { Modal as SharedModal, type ModalProps } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { close: "Close" },
  ar: { close: "إغلاق" },
};

/** Shared Modal with the dashboard's translated close label. */
export function Modal(props: ModalProps) {
  const t = useT(STRINGS);
  return <SharedModal closeLabel={t.close} {...props} />;
}
