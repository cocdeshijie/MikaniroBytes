import { atom } from "jotai";

export interface FileItem {
  file_id: number;
  original_filename: string | null;
  direct_link: string;
}

/* --- caches ----------------------------------------------------------- */
export const filesAtom            = atom<FileItem[]>([]);
export const filesNeedsRefreshAtom = atom<boolean>(true);

/* --- selection -------------------------------------------------------- */
export const selectedIdsAtom = atom<Set<number>>(new Set<number>());

/* --- transient feedback ---------------------------------------------- */
export const fileActionMsgAtom = atom<string>("");
