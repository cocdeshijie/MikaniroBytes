export interface RemoteFile {
  file_id: number;
  original_filename: string | null;
  direct_link: string;

  /* preview info */
  has_preview?: boolean;
  preview_url?: string;
}

/* Paginated payload coming from the backend */
export interface PaginatedFiles {
  items: RemoteFile[];
  total: number;
  page: number;
  page_size: number;
}
