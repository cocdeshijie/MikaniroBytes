import { atom } from "jotai";

export interface UploadedItem {
  file_id: number;
  original_filename: string;
  direct_link: string;
}

export const selectedFileAtom = atom<File | null>(null);
export const isDraggingAtom = atom<boolean>(false);
export const uploadingAtom = atom<boolean>(false);
export const uploadProgressAtom = atom<number>(0);
export const uploadErrorAtom = atom<string>("");
export const uploadedItemsAtom = atom<UploadedItem[]>([]);
