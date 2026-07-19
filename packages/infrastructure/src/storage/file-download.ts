export interface FileDownload {
  key: string;
  buffer: Buffer;
  contentType: string;
  size: number;
}

export interface IFileDownloader {
  download(key: string): Promise<FileDownload>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
