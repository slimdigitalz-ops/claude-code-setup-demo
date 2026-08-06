/**
 * Every error that reaches a client goes out in one shape:
 *
 *   { "error": { "code": "not_found", "message": "..." } }
 *
 * Routes throw ApiError. The error middleware in src/index.ts is the only place
 * that writes an error response.
 */

export type ErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'internal';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  internal: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }

  static badRequest(message: string): ApiError {
    return new ApiError('bad_request', message);
  }

  static notFound(message: string): ApiError {
    return new ApiError('not_found', message);
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}
