import { Dictionary, TranslationKey } from "@/locales/types"
import { ApiError } from "./api-error"

function getByPath(dict: Dictionary, path: string): string | undefined {
  return path.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment]
    }
    return undefined
  }, dict) as string | undefined
}

// Looks up `key` in `dict` and substitutes any `{name}`-style placeholders
// from `vars`. Falls back to returning the key itself if the lookup misses
// (should only happen if a locale file is out of sync — TypeScript is
// supposed to prevent that at compile time) so a broken key is visibly
// wrong rather than silently blank.
export function translate(dict: Dictionary, key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = getByPath(dict, key) ?? key
  if (!vars) return template
  return Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Translates an ApiError's code via `t`, falling back to the error's plain
// English message if the code has no entry in the active locale yet (e.g.
// a newly-added code the dictionaries haven't caught up with) or if `err`
// isn't an ApiError at all.
export function translateError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError && err.code) {
    const key = `errors.${err.code}` as TranslationKey
    const translated = t(key)
    if (translated !== key) return translated
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}
