import { atom } from "jotai";
import type { RemoteFile } from "./types";

/**
 * Helper factory functions that return *fresh* atoms for every
 * FileViewer instance so they never clash across multiple viewers.
 */

export const filesA       = () => atom<RemoteFile[]>([]);
export const loadingA     = () => atom(false);
export const errorA       = () => atom("");
export const selectedIdsA = () => atom<Set<number>>(new Set<number>());
export const downloadingA = () => atom<number | null>(null);
export const zipBusyA     = () => atom(false);
export const wantsDeleteA = () => atom(false);
