import { useMemo, useRef, useState } from "react";
import { Button } from "@store-builder/ui";
import { ApiError, digitalDeleteFile, digitalListFiles, digitalUploadFile, digitalUploadLargeFile, type DigitalFile } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { IconClose, IconDelete, IconFileDown, IconSearch, IconUpload } from "@/components/icons";
import { ListRowCard, ListSkeleton, ListToolbar } from "@/components/list";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { FactChip, fold, matches } from "@/pages/quotes/kit/Facts";
import { DeskList, DeskRow } from "@/pages/returns/rowkit/DeskList";
import { RowAction } from "@/pages/returns/rowkit/RowBits";
import { useIsCompact } from "@/pages/returns/rowkit/useScreen";
import { DIGITAL_STRINGS, sizeText } from "./digitalText";

const FILE_COLUMNS = "grid-cols-[minmax(0,1.6fr)_max-content_max-content_max-content_max-content]";

const codeOf = (err: unknown) => (err instanceof ApiError ? err.code : undefined);

type FilesAnswer = Awaited<ReturnType<typeof digitalListFiles>>;

/**
 * The private file library: what the digital products deliver. Upload is the
 * one action of the toolbar (a large file shows its progress in the button
 * and can be stopped); a row says how big a file is and what uses it, and its
 * ONE action deletes it — after asking, since buyers lose their download.
 */
export function FilesView() {
  const t = useT(DIGITAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const compact = useIsCompact();
  const list = useCachedAsync<FilesAnswer>(`digital:${workspaceId}:files`, () => digitalListFiles(apiClient, workspaceId), [workspaceId]);
  const files = useMemo(() => list.data?.files ?? [], [list.data]);
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  // A large file's progress (0–100) and the way to stop it; null for a small one.
  const [progress, setProgress] = useState<number | null>(null);
  const cancel = useRef<AbortController | null>(null);
  const [removing, setRemoving] = useState<{ file: DigitalFile; open: boolean } | null>(null);
  const maxBytes = list.data?.maxFileBytes ?? 100 * 1024 * 1024;

  const query = fold(search.trim());
  const visible = useMemo(() => files.filter((f) => matches(query, [f.name])), [files, query]);

  /** After a change: this list is read again, and the products' own list (which names its file) is dropped. */
  function reload() {
    invalidateCached(`digital:${workspaceId}:products`);
    void list.refresh({ silent: true });
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      let saved: DigitalFile;
      if (file.size > maxBytes) {
        if (list.data?.maxLargeFileBytes && file.size > list.data.maxLargeFileBytes) throw new ApiError("too large", 413, "FILE_TOO_LARGE");
        cancel.current = new AbortController();
        setProgress(0);
        saved = await digitalUploadLargeFile(apiClient, workspaceId, file, {
          signal: cancel.current.signal,
          onProgress: (sent, total) => setProgress(Math.floor((sent / total) * 100)),
        });
      } else {
        saved = await digitalUploadFile(apiClient, apiBaseUrl, workspaceId, file);
      }
      toast.success(fmt(t.uploaded, { name: saved.name }));
      reload();
    } catch (err) {
      if (!cancel.current?.signal.aborted) toast.error(codeOf(err) === "FILE_TOO_LARGE" ? t.fileTooLarge : errorMessage(err));
    } finally {
      setUploading(false);
      setProgress(null);
      cancel.current = null;
      if (input.current) input.current.value = "";
    }
  }

  async function confirmRemove() {
    const file = removing?.file;
    if (!file) return;
    try {
      await digitalDeleteFile(apiClient, workspaceId, file.id);
    } catch (err) {
      throw new Error(codeOf(err) === "FILE_IN_USE" ? t.fileInUse : errorMessage(err));
    }
    toast.success(t.fileDeleted);
    setRemoving((current) => (current ? { ...current, open: false } : current));
    reload();
  }

  const uploadButton = (
    <>
      <Button className="h-11 gap-2 rounded-full px-4" disabled={uploading} aria-busy={uploading || undefined} onClick={() => input.current?.click()}>
        <IconUpload className="size-4" weight="bold" aria-hidden />
        <span className="tabular-nums">{progress !== null ? fmt(t.uploadingPercent, { percent: progress }) : uploading ? t.uploading : t.upload}</span>
      </Button>
      {progress !== null && (
        <Button variant="outline" aria-label={t.cancelUpload} title={t.cancelUpload} className="size-11 rounded-full p-0" onClick={() => cancel.current?.abort()}>
          <IconClose className="size-4" weight="bold" aria-hidden />
        </Button>
      )}
    </>
  );

  const rows = visible.map((file) => {
    const ask = () => setRemoving({ file, open: true });
    const menu: ContextMenuItem[] = [{ id: "delete", label: t.delete, icon: IconDelete, destructive: true, onSelect: ask }];
    const size = <bdi dir="ltr">{sizeText(t, file.sizeBytes)}</bdi>;
    const used = file.usedByProducts ? pluralOf(t, "usedBy", file.usedByProducts) : t.unused;
    const action = <RowAction tone="danger" label={t.delete} onClick={ask} />;
    if (compact) {
      return (
        <li key={file.id}>
          <ContextMenu items={menu} label={file.name}>
            <ListRowCard
              leading={
                <span className="flex size-full items-center justify-center bg-primary-soft text-primary">
                  <IconFileDown className="size-5" aria-hidden />
                </span>
              }
              title={<bdi>{file.name}</bdi>}
              amount={size}
              status={<FactChip tone={file.usedByProducts ? "success" : undefined}>{used}</FactChip>}
              meta={formatDate(file.createdAt)}
              action={action}
            />
          </ContextMenu>
        </li>
      );
    }
    return (
      <DeskRow key={file.id} menu={menu} menuLabel={file.name}>
        <p className="min-w-0 text-[15px] leading-6 font-medium break-all text-ink">
          <bdi>{file.name}</bdi>
        </p>
        <div className="text-sm whitespace-nowrap text-ink-soft tabular-nums">{size}</div>
        <div className="text-sm whitespace-nowrap text-ink-soft">{used}</div>
        <div className="text-xs whitespace-nowrap text-ink-soft">{formatDate(file.createdAt)}</div>
        <div className="flex items-center justify-end">{action}</div>
      </DeskRow>
    );
  });

  const sizeNote = fmt(t.maxSize, {
    size: Math.round(maxBytes / 1024 / 1024),
    large: list.data?.maxLargeFileBytes ? Math.round(list.data.maxLargeFileBytes / 1024 ** 3) : 10,
  });

  return (
    <div className="flex flex-col gap-3">
      <input ref={input} type="file" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
      <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t.filesSearchPlaceholder, label: t.filesSearchLabel }}>{uploadButton}</ListToolbar>
      <p className="max-w-3xl text-[13px] leading-5 text-ink-soft max-md:hidden">{sizeNote}</p>

      <DataState
        loading={list.loading}
        error={files.length === 0 ? list.error : null}
        onRetry={() => void list.refresh()}
        skeleton={<ListSkeleton variant={compact ? "card" : "table"} rows={4} />}
      >
        {visible.length === 0 ? (
          files.length === 0 ? (
            <EmptyState
              icon={<IconUpload aria-hidden />}
              title={t.emptyFilesTitle}
              description={t.emptyFilesDescription}
              action={
                <Button className="min-h-11 gap-2 rounded-full px-5" disabled={uploading} onClick={() => input.current?.click()}>
                  <IconUpload className="size-4" weight="bold" aria-hidden />
                  {uploading ? t.uploading : t.upload}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconSearch aria-hidden />}
              title={t.emptyFilesFiltered}
              action={
                <Button variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setSearch("")}>
                  {t.clearSearch}
                </Button>
              }
            />
          )
        ) : compact ? (
          <ul aria-label={t.filesList} className="flex flex-col gap-2.5">
            {rows}
          </ul>
        ) : (
          <DeskList columns={FILE_COLUMNS} label={t.filesList} head={[{ label: t.colFile }, { label: t.colSize }, { label: t.colUsed }, { label: t.colAdded }, { label: t.delete, end: true }]}>
            {rows}
          </DeskList>
        )}
      </DataState>

      <p className="text-[13px] leading-5 text-ink-soft md:hidden">{sizeNote}</p>

      <ConfirmDialog
        open={Boolean(removing?.open)}
        title={removing ? fmt(t.deleteFileTitle, { name: removing.file.name }) : ""}
        description={t.deleteFileDescription}
        confirmLabel={t.delete}
        busyLabel={t.deleting}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setRemoving((current) => (current ? { ...current, open: false } : current))}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
