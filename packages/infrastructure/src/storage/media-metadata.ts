export interface MediaMetadata {
  key: string;
  originalName?: string;
  contentType: string;
  size: number;
  checksum?: string;
  uploadedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IMediaMetadataStore {
  get(key: string): Promise<MediaMetadata | null>;
  set(metadata: MediaMetadata): Promise<void>;
  delete(key: string): Promise<void>;
  listByPrefix(prefix: string): Promise<MediaMetadata[]>;
}
