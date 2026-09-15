import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, PartyPopper } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Alert, Spinner } from "@store-builder/ui";
import type { Workspace } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useSlugCheck } from "@/lib/useSlugCheck";
import { suggestSlug, storeHost, storeUrl } from "@/lib/storeAddress";
import { getErrorMessage } from "@/lib/errors";
import { StoreAddressField } from "@/components/StoreAddressField";
import { CopyButton } from "@/components/CopyButton";

export function WorkspacePickerPage() {
  const { user, logout } = useAuth();
  const { workspaces, loading, selectWorkspace, createWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const addressId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Until the merchant touches the address it follows the name, so the common
  // case needs no thought. Once they have edited it, it is theirs and the name
  // stops overwriting it.
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ workspace: Workspace; addressError?: string } | null>(
    null
  );

  const slugCheck = useSlugCheck(slug);

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(suggestSlug(value));
  }

  function onSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(value);
  }

  function goToDashboard(workspaceId: string) {
    selectWorkspace(workspaceId);
    navigate("/");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const result = await createWorkspace(name.trim(), slug);
      setCreated(result);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't create the store. Try again."));
    } finally {
      setCreating(false);
    }
  }

  // The address has to be known-good before the store is created: a store can
  // be moved afterwards, but the merchant should not find that out by being
  // given an address they didn't choose.
  const canSubmit = name.trim().length > 0 && slugCheck.status === "available" && !creating;

  if (created) {
    return <StoreCreated {...created} onOpenDashboard={() => goToDashboard(created.workspace.id)} />;
  }

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium text-ink">
              {workspaces.length > 0 ? "Choose a store" : "Let's set up your store"}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Signed in as {user?.email}.{" "}
              <button onClick={() => logout()} className="cursor-pointer text-primary hover:underline">
                Sign out
              </button>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center text-ink-soft">
            <Spinner className="size-6" />
          </div>
        ) : (
          <>
            {workspaces.length > 0 && (
              <div className="mt-8 space-y-3">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => goToDashboard(workspace.id)}
                    className="cursor-pointer flex w-full items-center justify-between rounded-[var(--radius-card)] border border-line bg-paper-raised px-5 py-4 text-start transition-colors hover:border-primary"
                  >
                    <div>
                      <p className="font-medium text-ink">{workspace.name}</p>
                      <p className="text-xs text-ink-soft">{storeHost(workspace.slug)}</p>
                    </div>
                    <span className="text-sm text-primary">Open →</span>
                  </button>
                ))}
              </div>
            )}

            <Card className="mt-8">
              <CardContent className="pt-6">
                <h2 className="font-display text-lg font-medium text-ink">Create a new store</h2>
                <form onSubmit={handleCreate} className="mt-4 space-y-4">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="space-y-1.5">
                    <Label htmlFor="workspaceName">Store name</Label>
                    <Input
                      id="workspaceName"
                      required
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Ahmed's Store"
                    />
                  </div>

                  <StoreAddressField
                    id={addressId}
                    value={slug}
                    onChange={onSlugChange}
                    state={slugCheck}
                    disabled={creating}
                  />

                  <Button type="submit" disabled={!canSubmit}>
                    {creating ? "Creating…" : "Create store"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * What a merchant sees the moment their store exists.
 *
 * The link is the whole point of this screen: it is the first time the store
 * has a public address, and it is the thing they will need to send to someone.
 * So it gets the screen to itself rather than a line in a toast that is gone in
 * four seconds.
 */
function StoreCreated({
  workspace,
  addressError,
  onOpenDashboard,
}: {
  workspace: Workspace;
  addressError?: string;
  onOpenDashboard: () => void;
}) {
  const url = storeUrl(workspace.slug);

  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-soft">
          <PartyPopper className="size-6 text-success" aria-hidden />
        </div>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink">
          {workspace.name} is live
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Your store has its own address. This is the link to share with customers.
        </p>

        {addressError && (
          <Alert variant="danger" className="mt-6">
            We couldn&rsquo;t give your store the address you picked — {addressError} It was created
            at the address below instead.
          </Alert>
        )}

        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
          <Label>Your store link</Label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="font-display text-lg font-medium break-all text-primary hover:underline"
            >
              {storeHost(workspace.slug)}
            </a>
            <CopyButton value={url} />
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            You can always find this link at the top of your dashboard.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={onOpenDashboard}>Go to dashboard</Button>
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              Visit store
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
