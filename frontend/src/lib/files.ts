import { api, ApiError } from "./api";

/* ------------------------------------------------------------------ */
/*                             TYPES                                  */
/* ------------------------------------------------------------------ */

export interface UploadedItem {
  file_id: number;
  original_filename: string;
  direct_link: string;
}

export interface BulkUploadResponse {
  success: number;
  failed: number | { path: string; reason: string }[];
  total?: number;
  result_text?: string;
}

/* ------------------------------------------------------------------ */
/*                       HELPERS (PRIVATE)                            */
/* ------------------------------------------------------------------ */

function mkXHR(
  url: string,
  token?: string,
  onProgress?: (pct: number) => void,
): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url);

  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

  if (onProgress) {
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
  }
  return xhr;
}

function failure(xhr: XMLHttpRequest): never {
  let msg = xhr.statusText || "Upload error";
  try {
    const j = JSON.parse(xhr.responseText);
    if (typeof j?.detail === "string") msg = j.detail;
  } catch { /* ignore */ }
  throw new ApiError(xhr.status || 520, msg);
}

/* ------------------------------------------------------------------ */
/*                     PUBLIC API – FILE ACTIONS                      */
/* ------------------------------------------------------------------ */

/** POST /files/upload – single file */
export function uploadFile(
  file: File,
  opts: { token?: string; onProgress?: (pct: number) => void } = {},
): Promise<UploadedItem> {
  const xhr = mkXHR(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/upload`, opts.token, opts.onProgress);

  return new Promise<UploadedItem>((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(failure(xhr));
      }
    };
    xhr.onerror = () => reject(failure(xhr));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** POST /files/bulk-upload – zip/tar.gz archive */
export function bulkUpload(
  archive: File,
  opts: { token?: string; onProgress?: (pct: number) => void } = {},
): Promise<BulkUploadResponse> {
  const xhr = mkXHR(`${process.env.NEXT_PUBLIC_BACKEND_URL}/files/bulk-upload`, opts.token, opts.onProgress);

  return new Promise<BulkUploadResponse>((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(failure(xhr));
      }
    };
    xhr.onerror = () => reject(failure(xhr));

    const form = new FormData();
    form.append("archive", archive);
    xhr.send(form);
  });
}

/** DELETE /files/batch-delete */
export async function batchDelete(ids: number[], token?: string): Promise<void> {
  await api("/files/batch-delete", {
    method: "DELETE",
    token,
    json: { ids },
  });
}

/** POST /files/batch-download – returns a .zip Blob */
export async function batchDownload(ids: number[], token?: string): Promise<Blob> {
  return api<Blob>("/files/batch-download", {
    method: "POST",
    token,
    json: { ids },
  });
}
