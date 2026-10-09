/** Saves `data` as a readable JSON file through the browser's own download. */
export function downloadJson(data: unknown, filename: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // After the click has been handled: some browsers read the blob a moment later.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
