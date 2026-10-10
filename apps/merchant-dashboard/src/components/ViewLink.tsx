import { forwardRef, type MouseEvent } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { prefetchRoute } from "@/lib/prefetch";
import { isPlainNavigationClick, useViewNavigate } from "@/lib/viewTransition";

/**
 * A router `<Link>` that feels instant:
 * it fetches the page's code on hover / touch-start / focus, and changes page
 * inside a view transition. Same props as `Link`; a modified click (new tab,
 * new window) is left to the browser. Use it for navigation the merchant
 * repeats all day — the side menu, the dock, list rows; a plain `Link` is
 * still fine for a one-off.
 */
export const ViewLink = forwardRef<HTMLAnchorElement, LinkProps>(function ViewLink(
  { to, onClick, onPointerEnter, onTouchStart, onFocus, replace, state, ...rest },
  ref
) {
  const navigate = useViewNavigate();
  const path = typeof to === "string" ? to : (to.pathname ?? "");
  const warm = () => {
    if (path) prefetchRoute(path);
  };
  return (
    <Link
      ref={ref}
      to={to}
      replace={replace}
      state={state}
      {...rest}
      onPointerEnter={(e) => {
        warm();
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!isPlainNavigationClick(e) || rest.reloadDocument) return;
        e.preventDefault();
        navigate(to, { replace, state });
      }}
    />
  );
});
