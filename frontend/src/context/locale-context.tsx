"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { DICTIONARIES, SUPPORTED_LOCALES, Locale } from "@/locales"
import { TranslationKey } from "@/locales/types"
import { translate } from "@/lib/i18n"
import { updateLocale } from "@/services/auth"
import { useAuth } from "./auth-context"

const STORAGE_KEY = "papymory_locale"

function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as string[]).includes(value)
}

// Resolution order: the logged-in account's saved choice, then
// localStorage, then the browser's own language, then English.
function detectInitialLocale(accountLocale: string | undefined): Locale {
  if (isSupportedLocale(accountLocale)) return accountLocale
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isSupportedLocale(stored)) return stored
    const browserLang = window.navigator.language?.slice(0, 2)
    if (isSupportedLocale(browserLang)) return browserLang
  }
  return "en"
}

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { token, user, updateUser } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale(user?.locale))

  // If the account's saved locale becomes available after this provider's
  // first render (e.g. it mounts before AuthProvider finishes resolving),
  // adopt it once — but never override a choice the user already made this
  // session by clicking the switcher. Also resets the guard on logout (the
  // `!user` branch) so a *different* account logging in afterward (same
  // browser tab, no page reload) gets its own saved locale adopted instead
  // of inheriting whatever the previous account left active — kept in this
  // same effect, rather than a separate one, so it doesn't add a second
  // instance of the (already-accepted) set-state-in-effect pattern below.
  const [adoptedAccountLocale, setAdoptedAccountLocale] = useState(false)
  useEffect(() => {
    if (!user) {
      if (adoptedAccountLocale) setAdoptedAccountLocale(false)
      return
    }
    if (!adoptedAccountLocale && isSupportedLocale(user.locale)) {
      setLocaleState(user.locale)
      setAdoptedAccountLocale(true)
    }
  }, [user, adoptedAccountLocale])

  // Catch-up sync: an explicit in-session pick (made either before this
  // login or after, via the switcher) is deliberately allowed to win over
  // the account's saved locale — see the adoption effect above, which
  // skips overriding it. But that win should also be written back to the
  // account instead of leaving it permanently out of sync. This only ever
  // fires when `adoptedAccountLocale` is already true going into a render
  // (i.e. NOT the same tick the adoption effect just adopted the account's
  // own locale, in which case `locale` already equals `user.locale` and
  // there's nothing to sync) — so it can't loop: it never itself changes
  // `locale`, `user.locale`, or `adoptedAccountLocale`.
  useEffect(() => {
    if (!user || !token || !adoptedAccountLocale) return
    if (user.locale !== locale) {
      updateLocale(locale, token).catch(() => {
        /* best-effort; account just stays out of sync until the next
           successful locale change or login */
      })
    }
  }, [user, token, adoptedAccountLocale, locale])

  // Keep <html lang> in step with the active locale for screen readers /
  // browser heuristics — layout.tsx is a server component and can't know
  // the client-resolved locale up front, so this is the only place it can
  // be kept current, on mount and on every subsequent switch.
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    setAdoptedAccountLocale(true)
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next)
    updateUser({ locale: next })
    if (token) {
      updateLocale(next, token).catch(() => {
        /* localStorage + in-memory state already reflect the choice; a
           failed sync just means it won't follow this account to another
           device until the next successful change. */
      })
    }
  }, [token, updateUser])

  const t = useMemo(() => {
    const dict = DICTIONARIES[locale]
    return (key: TranslationKey, vars?: Record<string, string | number>) => translate(dict, key, vars)
  }, [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export const useLocale = () => {
  const context = useContext(LocaleContext)
  if (!context) throw new Error("useLocale must be used within LocaleProvider")
  return context
}
