import { NEXT_PUBLIC_BACKEND_URL } from "@/lib/env";

/**
 * Custom error for non‑2xx responses.
 * You catch this in your UI code via .catch((err) => { ... }).
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Minimal helper that sets XHR progress, token, etc. */
function mkXHR(
  url: string,
  token?: string,
  onProgress?: (pct: number) => void
): XMLHttpRequest {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url);

  if (token) {
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
  }

  if (onProgress) {
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
  }
  return xhr;
}

/**
 * Return an ApiError with a user-friendly message from
 * the backend’s “detail” field if available. We do NOT throw
 * synchronously. We just return the error, letting the caller
 * do `reject(failure(xhr))`.
 */
function failure(xhr: XMLHttpRequest): ApiError {
  let msg = xhr.statusText || "Upload error";
  try {
    const json = JSON.parse(xhr.responseText);
    if (typeof json?.detail === "string") {
      msg = json.detail;
    }
  } catch {
    // fallback
  }
  return new ApiError(xhr.status || 520, msg);
}

/* ------------------------------------------------------------------
   SINGLE FILE UPLOAD
   /files/upload (multipart form)
------------------------------------------------------------------ */
export interface UploadedItem {
  file_id: number;
  original_filename: string;
  direct_link: string;
}

interface UploadOptions {
  token?: string;
  onProgress?: (pct: number) => void;
}

/**
 * Upload a single File via XHR, returning a promise that resolves
 * with { file_id, direct_link, ... } or rejects with an ApiError
 * if the server says 403 or 500 or anything non-2xx.
 */
export function uploadFile(
  file: File,
  opts: UploadOptions = {}
): Promise<UploadedItem> {
  const url = `${NEXT_PUBLIC_BACKEND_URL}/files/upload`;
  const xhr = mkXHR(url, opts.token, opts.onProgress);

  return new Promise<UploadedItem>((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Attempt to parse JSON
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new ApiError(500, "Invalid JSON response"));
        }
      } else {
        // e.g. 403 => "Public uploads disabled"
        reject(failure(xhr));
      }
    };

    xhr.onerror = () => reject(failure(xhr));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

/* ------------------------------------------------------------------
   BULK ARCHIVE UPLOAD
   /files/bulk-upload
------------------------------------------------------------------ */
export interface BulkUploadResponse {
  success: number;
  failed: number | { path: string; reason: string }[];
  total?: number;
  result_text?: string;
}

export function bulkUpload(
  archive: File,
  opts: UploadOptions = {}
): Promise<BulkUploadResponse> {
  const url = `${NEXT_PUBLIC_BACKEND_URL}/files/bulk-upload`;
  const xhr = mkXHR(url, opts.token, opts.onProgress);

  return new Promise<BulkUploadResponse>((resolve, reject) => {
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new ApiError(500, "Invalid JSON response"));
        }
      } else {
        reject(failure(xhr));
      }
    };

    xhr.onerror = () => reject(failure(xhr));

    const formData = new FormData();
    formData.append("archive", archive);
    xhr.send(formData);
  });
}

/* ------------------------------------------------------------------
   DELETE MULTIPLE FILES
   /files/batch-delete
------------------------------------------------------------------ */
export async function batchDelete(ids: number[], token?: string): Promise<void> {
  const url = `${NEXT_PUBLIC_BACKEND_URL}/files/batch-delete`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (typeof j?.detail === "string") msg = j.detail;
    } catch {
      // fallback
    }
    throw new ApiError(res.status, msg);
  }
}

/* ------------------------------------------------------------------
   BATCH DOWNLOAD ZIP
   /files/batch-download
------------------------------------------------------------------ */
export async function batchDownload(
  ids: number[],
  token?: string
): Promise<Blob> {
  const url = `${NEXT_PUBLIC_BACKEND_URL}/files/batch-download`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (typeof j?.detail === "string") msg = j.detail;
    } catch {
      // fallback
    }
    throw new ApiError(res.status, msg);
  }

  // Expecting binary .zip
  return await res.blob();
}
