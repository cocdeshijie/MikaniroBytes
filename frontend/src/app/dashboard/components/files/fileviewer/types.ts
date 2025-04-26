export interface RemoteFile {
  file_id: number;
  original_filename: string | null;
  direct_link: string;

  /* preview info (optional) */
  has_preview?: boolean;
  preview_url?: string;
}
