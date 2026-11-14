import { Link } from "react-router-dom";
import { useT } from "@/i18n/LocaleContext";
import { SPEC_STRINGS } from "./specStrings";

/** The products list's way to Products → Specifications, beside "Collections". */
export function SpecKeysLink() {
  const t = useT(SPEC_STRINGS);
  return (
    <Link to="/catalog/specifications" className="inline-flex min-h-11 items-center text-sm font-medium text-primary-dark hover:underline">
      {t.title}
    </Link>
  );
}
