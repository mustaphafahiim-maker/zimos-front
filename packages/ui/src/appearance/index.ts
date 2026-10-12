// How a dashboard looks on this device (store.ts) and the toolbar switch that
// reads it. A subpath of its own, never re-exported from the package's index:
// importing the store draws the kept look on <html>, which only the two
// dashboards want (the storefront and the marketing site import the index).
export * from "./store";
export { ThemeToggle } from "./ThemeToggle";
