import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router-dom";

/**
 * The link the ported screens use for navigation the merchant repeats all
 * day (list rows, section links). Same props as the router's `Link`, which is
 * what it is here.
 */
export const ViewLink = forwardRef<HTMLAnchorElement, LinkProps>(function ViewLink(props, ref) {
  return <Link ref={ref} {...props} />;
});
