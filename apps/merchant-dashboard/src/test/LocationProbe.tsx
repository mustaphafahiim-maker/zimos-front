import { useLocation } from "react-router-dom";

/** Renders the current pathname + search so tests can assert navigation (see currentPath()). */
export function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <output data-testid="location" hidden>
      {pathname}
      {search}
    </output>
  );
}
