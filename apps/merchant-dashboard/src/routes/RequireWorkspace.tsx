import { Navigate, Outlet } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";
import { BrandLoader } from "@/components/BrandLoader";

export function RequireWorkspace() {
  const { loading, workspaces, currentWorkspace } = useWorkspace();

  if (loading) {
    return <BrandLoader />;
  }

  if (workspaces.length === 0 || !currentWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  return <Outlet />;
}
