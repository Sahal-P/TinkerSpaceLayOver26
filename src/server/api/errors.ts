import "server-only";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly retryable = false,
    public readonly retryAfter?: number,
  ) { super(message); }
}

export function storageError(): ApiError {
  return new ApiError("storage_unavailable", 503, "Guide storage is temporarily unavailable.", true, 30);
}

export function validationError(): ApiError {
  return new ApiError("invalid_request", 400, "The request does not match the documented contract.");
}

export function notFound(): ApiError {
  return new ApiError("not_found", 404, "Guide not found.");
}

export function requestAborted(): ApiError {
  return new ApiError("request_timeout", 504, "The request timed out or was cancelled.", true);
}
