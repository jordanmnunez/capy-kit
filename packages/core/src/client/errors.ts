// Single typed error envelope for every surface. Ops/transport throw CapyError;
// the CLI maps `code` -> exit code, the MCP server maps it -> {error:{code,message,requestId}}.

export type CapyErrorCode =
  | "no_api_key"
  | "network_error"
  | "bad_response"
  | "timeout"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "no_project"
  | "validation_error"
  | "api_error";

export interface CapyErrorInit {
  code: CapyErrorCode;
  message: string;
  status?: number;
  retryAfterMs?: number;
  requestId?: string;
  details?: unknown;
  cause?: unknown;
}

export class CapyError extends Error {
  readonly code: CapyErrorCode;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(init: CapyErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "CapyError";
    this.code = init.code;
    this.status = init.status;
    this.retryAfterMs = init.retryAfterMs;
    this.requestId = init.requestId;
    this.details = init.details;
  }

  /** Stable, secret-free wire shape used by the MCP server and `--json` error output. */
  toEnvelope(): { error: { code: CapyErrorCode; message: string; requestId?: string; details?: unknown } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.requestId !== undefined ? { requestId: this.requestId } : {}),
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

/**
 * Permanent (non-retryable) codes. Transport never retries these, and
 * pollUntilTerminal aborts fast on them rather than spinning until timeout.
 */
export const PERMANENT_CODES: ReadonlySet<CapyErrorCode> = new Set<CapyErrorCode>([
  "no_api_key",
  "unauthorized",
  "forbidden",
  "not_found",
  "validation_error",
  "no_project",
]);

export function isCapyError(e: unknown): e is CapyError {
  return e instanceof CapyError;
}

export function isPermanent(e: unknown): boolean {
  return e instanceof CapyError && PERMANENT_CODES.has(e.code);
}

/** Map an HTTP status to our error vocabulary. */
export function statusToCode(status: number): CapyErrorCode {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
    case 410:
      return "not_found";
    case 422:
      return "validation_error";
    case 429:
      return "rate_limited";
    default:
      return "api_error";
  }
}

/** CLI exit code for a given error code (everything else -> 1). */
export function exitCodeFor(code: CapyErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 77;
    case "not_found":
      return 69;
    case "rate_limited":
      return 75;
    case "timeout":
      return 124;
    default:
      return 1;
  }
}

/**
 * `wait`/`delegate --wait` exit codes for a NON-error stop (the poll itself succeeded):
 *   0   — terminal (genuinely done)
 *   123 — settled but BLOCKED: needs you (a human/integration gate; see blockedOn)
 *   124 — timed out: the poll budget ran out while still progressing
 * 123 pairs with the 124 timeout code so a script can branch on needs-you vs ran-out vs done.
 * (Genuine API errors still exit via exitCodeFor: unauthorized 77, not_found 69, etc.)
 */
export const WAIT_BLOCKED_EXIT_CODE = 123;
export const WAIT_TIMEOUT_EXIT_CODE = 124;
