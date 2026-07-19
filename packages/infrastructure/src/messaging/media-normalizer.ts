export class MediaNormalizer {
  normalizeFromBaileys(
    msg: any,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mimetype?: string | null,
    fileLength?: number | string | null,
  ): NormalizedMedia {
    const messageContent = msg.message as any;
    const mediaObj = messageContent?.[`${mediaType}Message`];

    const resolvedMimetype = this._resolveMimetype(mimetype ?? undefined, mediaObj?.fileName);
    const resolvedSize = this._resolveFileSize(fileLength, mediaObj?.fileLength);

    return {
      mediaId: msg.key?.id || `media_${Date.now()}`,
      mimetype: resolvedMimetype,
      fileSize: resolvedSize,
      isEncrypted: !!(mediaObj?.fileEncSha256),
      isAnimated: mediaObj?.isAnimated ?? false,
      fileSha256: mediaObj?.fileSha256,
      fileEncSha256: mediaObj?.fileEncSha256,
      mediaKey: mediaObj?.mediaKey,
      directPath: mediaObj?.directPath,
      url: mediaObj?.url,
      caption: mediaObj?.caption,
      mediaType,
    };
  }

  normalizeForUpload(
    buffer: Buffer,
    mimetype: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    fileName?: string,
    caption?: string,
  ): NormalizedMediaForUpload {
    return {
      buffer,
      mimetype: this._resolveMimetype(mimetype, fileName),
      fileName,
      caption,
      mediaType,
    };
  }

  resolveMimetype(fileName: string): string {
    return this._resolveMimetype(undefined, fileName);
  }

  getMediaType(mimetype: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private _resolveMimetype(explicitMime?: string, fileName?: string): string {
    if (explicitMime && MIME_TYPE_MAP[explicitMime]) {
      return explicitMime;
    }

    if (fileName) {
      const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
      if (ext && EXTENSION_MAP[ext]) {
        return EXTENSION_MAP[ext];
      }
    }

    return explicitMime || 'application/octet-stream';
  }

  private _resolveFileSize(
    fileLength?: number | string | null,
    rawFileLength?: number | string | null,
  ): number {
    const raw = fileLength ?? rawFileLength;
    if (raw === undefined || raw === null) return 0;

    if (typeof raw === 'number') return raw;

    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
}

export interface NormalizedMedia {
  readonly mediaId: string;
  readonly mimetype: string;
  readonly fileSize: number;
  readonly isEncrypted: boolean;
  readonly isAnimated: boolean;
  readonly fileSha256?: string;
  readonly fileEncSha256?: string;
  readonly mediaKey?: string;
  readonly directPath?: string;
  readonly url?: string;
  readonly caption?: string;
  readonly mediaType: 'image' | 'video' | 'audio' | 'document';
}

export interface NormalizedMediaForUpload {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly fileName?: string;
  readonly caption?: string;
  readonly mediaType: 'image' | 'video' | 'audio' | 'document';
}

const MIME_TYPE_MAP: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
  'video/mp4': 'video/mp4',
  'video/webm': 'video/webm',
  'audio/ogg': 'audio/ogg',
  'audio/mpeg': 'audio/mpeg',
  'audio/mp4': 'audio/mp4',
  'application/pdf': 'application/pdf',
  'application/msword': 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const EXTENSION_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
