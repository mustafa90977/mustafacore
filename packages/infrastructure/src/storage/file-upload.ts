export interface FileUpload {
  key: string;
  buffer: Buffer;
  contentType: string;
  originalName?: string;
  size: number;
}

export interface FileUploadResult {
  key: string;
  url?: string;
  size: number;
  contentType: string;
}

export interface IFileUploader {
  upload(file: FileUpload): Promise<FileUploadResult>;
  uploadMany(files: FileUpload[]): Promise<FileUploadResult[]>;
}
