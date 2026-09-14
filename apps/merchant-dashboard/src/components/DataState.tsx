import { DataState as SharedDataState, type DataStateProps } from "@store-builder/ui";
import { getErrorMessage, isPermissionError } from "@/lib/errors";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    loading: "Loading…",
    permission: "You don't have permission to view this. Ask an owner to update your role.",
    retry: "Try again",
    empty: "Nothing here yet.",
  },
  ar: {
    loading: "جارٍ التحميل…",
    permission: "ليست لديك صلاحية لعرض هذا المحتوى. اطلب من مالك المتجر تحديث دورك.",
    retry: "حاول مرة أخرى",
    empty: "لا يوجد شيء هنا بعد.",
  },
};

/** Shared DataState bound to the dashboard's strings and API error helpers. */
export function DataState(props: DataStateProps) {
  const t = useT(STRINGS);
  return (
    <SharedDataState
      labels={t}
      getErrorMessage={(err) => getErrorMessage(err)}
      isPermissionError={isPermissionError}
      {...props}
    />
  );
}
