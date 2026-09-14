import { Link } from "react-router-dom";
import { PageHeader as SharedPageHeader, type PageHeaderProps } from "@store-builder/ui";

/** Shared PageHeader with react-router back links. */
export function PageHeader(props: PageHeaderProps) {
  return <SharedPageHeader linkComponent={Link} {...props} />;
}
