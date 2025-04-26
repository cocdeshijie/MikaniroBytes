import { atom } from "jotai";
import type { RemoteFile } from "./types";

/**
 * Factory helpers – every FileViewer instance gets its own
 * private atoms so state never clashes between dialogs/tabs.
 */

export const filesA       = () => atom<RemoteFile[]>([]);
export const loadingA     = () => atom(false);
export const errorA       = () => atom("");
export const selectedIdsA = () => atom<Set<number>>(new Set<number>());
export const downloadingA = () => atom<number | null>(null);
export const zipBusyA     = () => atom(false);
export const wantsDeleteA = () => atom(false);

/* NEW – pagination */
export const pageA        = () => atom(1);
export const totalA       = () => atom(0);      // total items
export const colsA        = () => atom(1);      // current column count
