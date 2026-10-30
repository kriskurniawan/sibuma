export class WorkDocumentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "WorkDocumentError";
  }
}

export function workDocumentErrorMessage(error: unknown) {
  if (error instanceof WorkDocumentError) return error.message;
  return "Terjadi kesalahan pada dokumen kerja. Silakan coba lagi.";
}
