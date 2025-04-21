import { atom } from "jotai";

/* ------------------------------------------------------------------ */
/*                              TYPES                                 */
/* ------------------------------------------------------------------ */

export interface UploadedItem {
  file_id: number;
  original_filename: string;
  direct_link: string;
}

/**
 * A single upload task (one file).
 */
export interface UploadTask {
  id: string;                 // ui‑id (uuid)
  file: File;                 // raw file object
  progress: number;           // 0-100
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  result?: UploadedItem;      // populated when done
}

/* ------------------------------------------------------------------ */
/*                               ATOMS                                */
/* ------------------------------------------------------------------ */

/** Drag‑over visual flag */
export const isDraggingAtom   = atom(false);

/** All current / past tasks (pending → uploading → done/error) */
export const uploadTasksAtom  = atom<UploadTask[]>([]);

/** Finished & successful items (shown at bottom) */
export const uploadedItemsAtom = atom<UploadedItem[]>([]);
