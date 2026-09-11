"use client"

import { useLocale } from "@/context/locale-context"
import { SUPPORTED_LOCALES } from "@/locales"
import { cn } from "@/lib/utils"

const LOCALE_LABELS: Record<string, string> = { en: "EN", th: "ไทย" }

// A lighter-weight switcher for login/register — those pages are pinned to
// a fixed light theme pre-auth (see CLAUDE.md), so this avoids pulling in
// the full dropdown-menu chrome the authenticated header uses.
export function LanguageLinkSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div className={cn("flex items-center justify-center gap-2 text-xs font-semibold text-neutral-400", className)}>
      {SUPPORTED_LOCALES.map((code, i) => (
        <span key={code} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          <button
            type="button"
            onClick={() => setLocale(code)}
            className={cn("transition-colors hover:text-logo", locale === code && "text-logo")}
          >
            {LOCALE_LABELS[code] ?? code}
          </button>
        </span>
      ))}
    </div>
  )
}
