import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Alert } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { useLandingPath } from "@/lib/nav";

/**
 * Renders `children` only for an account holding `permission`. The backend
 * refuses the page's endpoints anyway; this keeps the page from rendering a
 * row of 403s.
 *
 * `redirect` is for the overview (`/`), where everyone lands after signing
 * in: an account without it goes to its own first page instead (an agent's is
 * My referrals). Anywhere else, the page says why it is empty.
 */
export function RequirePermission({
  permission,
  redirect = false,
  children,
}: {
  permission: string;
  redirect?: boolean;
  children: ReactNode;
}) {
  const { can } = useAuth();
  const landing = useLandingPath();
  if (can(permission)) return <>{children}</>;
  if (redirect && landing && landing !== "/") return <Navigate to={landing} replace />;
  return (
    <Alert variant="danger">
      Your platform role doesn&rsquo;t include this section. Ask a creator if you need access.
    </Alert>
  );
}
