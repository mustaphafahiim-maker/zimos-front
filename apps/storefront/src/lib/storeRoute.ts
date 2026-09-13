import { headers } from "next/headers";
import { STORE_SLUG_HEADER } from "./domains";

/**
 * How the store being rendered was reached, for the server components that
 * build links and redirects.
 *
 * The proxy marks a request it rewrote from a store's subdomain, and that mark
 * is the only difference between the two ways in: on `<slug>.zimos.co` the
 * store owns the whole origin and its links are plain site paths, while on the
 * shared host they all hang off `/store/<workspaceId>`.
 *
 * Reading a request header makes the caller render per request, which the
 * store routes already do — see `serverApiClient`.
 */
export async function getStoreBasePath(workspaceId: string): Promise<string> {
  const slug = (await headers()).get(STORE_SLUG_HEADER);
  return slug ? "" : `/store/${workspaceId}`;
}
