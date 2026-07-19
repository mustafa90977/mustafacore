import { IMediaStorage } from '@wacore/shared';
import { SupabaseClient } from './supabase-client';

export interface StorageAdapterConfig {
  bucket: string;
  client: SupabaseClient;
}

export class StorageAdapter implements IMediaStorage {
  private readonly _bucket: string;
  private readonly _client: SupabaseClient;

  constructor(config: StorageAdapterConfig) {
    this._bucket = config.bucket;
    this._client = config.client;
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const result = await this._client.storage
      .from(this._bucket)
      .upload(key, buffer, { contentType });

    if ((result as any).error) {
      throw new Error(`Upload failed: ${(result as any).error.message}`);
    }

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const result = await this._client.storage.from(this._bucket).download(key);

    if ((result as any).error) {
      throw new Error(`Download failed: ${(result as any).error.message}`);
    }

    return Buffer.from(await (result as any).data.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const result = await this._client.storage.from(this._bucket).remove([key]);

    if ((result as any).error) {
      throw new Error(`Delete failed: ${(result as any).error.message}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const result = await this._client.storage
      .from(this._bucket)
      .getSignedUrl(key, expiresIn);

    if ((result as any).error) {
      throw new Error(`Get signed URL failed: ${(result as any).error.message}`);
    }

    return (result as any).data.signedUrl;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this._client.storage.from(this._bucket).download(key);
      return true;
    } catch {
      return false;
    }
  }
}
