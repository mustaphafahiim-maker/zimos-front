/**
 * The anonymous id the checkout autosave upserts on (the backend wants 8–64
 * chars). One per workspace per browser tab: sessionStorage, so a new tab is a
 * new shopping trip and nothing outlives the session.
 *
 * When storage or crypto.randomUUID is unavailable (private mode, an insecure
 * origin) the id lives in memory for the life of the page instead.
 *
 * It is the storefront's one visitor identity, so it now lives in ./visitor
 * next to the analytics session it is reported with; this module keeps the
 * name the checkout autosave imports.
 */
export { getVisitorId } from "./visitor";
