import { atom } from "jotai";

/** Row returned by GET /files/my-files */
export interface FileItem {
  file_id: number;
  original_filename: string | null;
  direct_link: string;
}

/** Client‑side cache of the user’s files */
export const filesAtom = atom<FileItem[]>([]);

/**
 * When `true`, the cache is considered stale and should be re‑fetched
 * from the backend.  After a successful fetch set it back to `false`.
 */
export const filesNeedsRefreshAtom = atom<boolean>(true);
