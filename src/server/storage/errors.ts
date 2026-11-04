export class StorageDisabledError extends Error {
  constructor() {
    super('File storage is off: BLOB_READ_WRITE_TOKEN is not set');
    this.name = 'StorageDisabledError';
  }
}

export type UploadRejection = 'too-large' | 'unsupported-type' | 'unreadable-image' | 'invalid-address';

// The message names the rule, never the file: names and bytes come from the visitor.
export class UploadRejectedError extends Error {
  readonly reason: UploadRejection;

  constructor(reason: UploadRejection, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'UploadRejectedError';
    this.reason = reason;
  }
}

// The storage service failed or refused the request. Keeps the vendor error out of callers' types.
export class StorageRequestError extends Error {
  constructor(operation: 'upload' | 'delete' | 'lookup', cause: unknown) {
    super(`File storage ${operation} failed`, { cause });
    this.name = 'StorageRequestError';
  }
}
