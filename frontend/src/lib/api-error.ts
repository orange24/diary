import { ErrorCode } from "@/locales/types"

// Thrown by every services/*.ts function on a non-ok response. Carries the
// backend's stable error_code (when present) alongside a plain-English
// message, so call sites with access to useLocale() can translate it —
// these plain service functions can't call hooks themselves.
export class ApiError extends Error {
  code?: ErrorCode

  constructor(message: string, code?: ErrorCode) {
    super(message)
    this.name = "ApiError"
    this.code = code
  }
}

export function apiError(data: { error?: string; error_code?: string } | null | undefined, fallback: string): ApiError {
  return new ApiError(data?.error || fallback, data?.error_code as ErrorCode | undefined)
}
