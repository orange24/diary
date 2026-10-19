import { ErrorCode } from "@/locales/types"

// Thrown by every services/*.ts function on a non-ok response. Carries the
// backend's stable error_code (when present) alongside a plain-English
// message, so call sites with access to useLocale() can translate it —
// these plain service functions can't call hooks themselves.
export class ApiError extends Error {
  code?: ErrorCode
  // HTTP status of the failed response. Call sites that need to react to the
  // kind of failure rather than show its message — an expired session has to
  // send the user back to /login, not print "Unauthorized" into the feed —
  // branch on this, which is present even when the body carries no JSON.
  status?: number

  constructor(message: string, code?: ErrorCode, status?: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

export function apiError(
  data: { error?: string; error_code?: string } | null | undefined,
  fallback: string,
  status?: number
): ApiError {
  return new ApiError(data?.error || fallback, data?.error_code as ErrorCode | undefined, status)
}
