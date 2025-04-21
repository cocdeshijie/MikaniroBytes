/**
 * Types shared across several admin components.
 * “aggregate” fields (file_count / storage_bytes) are included so we
 * never hit the TS variance error again.
 */
export interface GroupItem {
  id: number;
  name: string;
  allowed_extensions: string[];
  max_file_size: number | null;
  max_storage_size: number | null;
  file_count: number;
  storage_bytes: number;
}

/** Handy when you only care about the limits / metadata. */
export type GroupBasic = Omit<GroupItem, "file_count" | "storage_bytes">;
