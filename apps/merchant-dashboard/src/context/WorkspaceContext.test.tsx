import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, fake, type ListedWorkspace } from "@/test/mocks";

// setup.ts swaps this module for a test double on every screen; here it is the thing under test.
const { WorkspaceProvider, useWorkspace } =
  await vi.importActual<typeof import("./WorkspaceContext")>("./WorkspaceContext");

function renderWorkspace() {
  const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider>{children}</WorkspaceProvider>;
  return renderHook(() => useWorkspace(), { wrapper }).result;
}

describe("WorkspaceProvider applySavedWorkspace", () => {
  it("replaces the saved store in the list, keeping the role the list read gave", async () => {
    api.listWorkspaces.mockResolvedValue([
      fake<ListedWorkspace>({ id: "ws_1", name: "Nile Store", role: "owner", themeSettings: { primaryColor: "#1F5D5B" } }),
      fake<ListedWorkspace>({ id: "ws_2", name: "Delta Store", role: "editor", themeSettings: {} }),
    ]);
    const result = renderWorkspace();
    await waitFor(() => expect(result.current.currentWorkspace?.id).toBe("ws_1"));

    // A PATCH reply: no role.
    act(() =>
      result.current.applySavedWorkspace(
        fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: { primaryColor: "#BE123C", storeTheme: "warm" } })
      )
    );

    expect(result.current.currentWorkspace).toMatchObject({
      id: "ws_1",
      role: "owner",
      themeSettings: { primaryColor: "#BE123C", storeTheme: "warm" },
    });
    expect(result.current.workspaces[1]).toMatchObject({ id: "ws_2", role: "editor", themeSettings: {} });
    // Applied in place: no re-read, so `loading` never flipped.
    expect(result.current.loading).toBe(false);
    expect(api.listWorkspaces).toHaveBeenCalledTimes(1);
  });
});
