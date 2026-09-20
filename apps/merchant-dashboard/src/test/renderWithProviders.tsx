import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LocaleProvider, type Locale } from "@/i18n/LocaleContext";
import { ToastProvider } from "@/components/Toast";
import { authMock, workspaceMock, type AuthMock, type WorkspaceMock } from "./mocks";

export interface RenderOptions {
  /** Initial URL for the MemoryRouter. */
  route?: string;
  /** Route pattern the page is mounted on (enables useParams). Omit to render `ui` as-is. */
  path?: string;
  /** Forces the dashboard language (LocaleProvider reads it from storage on mount). */
  locale?: Locale;
  auth?: Partial<AuthMock>;
  workspace?: Partial<WorkspaceMock>;
}

/** Renders the current pathname + search so tests can assert navigation. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <output data-testid="location" hidden>
      {pathname}
      {search}
    </output>
  );
}

export function currentPath(): string {
  return screen.getByTestId("location").textContent ?? "";
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", path, locale = "en", auth, workspace }: RenderOptions = {}
) {
  localStorage.setItem("zimos.locale", locale);
  if (auth) Object.assign(authMock, auth);
  if (workspace) Object.assign(workspaceMock, workspace);

  const user = userEvent.setup();
  const content = path ? (
    <Routes>
      <Route path={path} element={ui} />
      <Route path="*" element={null} />
    </Routes>
  ) : (
    ui
  );

  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <LocaleProvider>
        <ToastProvider>
          {content}
          <LocationProbe />
        </ToastProvider>
      </LocaleProvider>
    </MemoryRouter>
  );
  return { user, ...result };
}
