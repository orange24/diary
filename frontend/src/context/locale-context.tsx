"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
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
  // session by clicking the switcher.
  const [adoptedAccountLocale, setAdoptedAccountLocale] = useState(false)
  useEffect(() => {
    if (!adoptedAccountLocale && isSupportedLocale(user?.locale)) {
      setLocaleState(user.locale)
      setAdoptedAccountLocale(true)
    }
  }, [user?.locale, adoptedAccountLocale])

  const setLocale = (next: Locale) => {
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
  }

  const t = useMemo(() => {
    const dict = DICTIONARIES[locale]
    return (key: TranslationKey, vars?: Record<string, string | number>) => translate(dict, key, vars)
  }, [locale])

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
}

export const useLocale = () => {
  const context = useContext(LocaleContext)
  if (!context) throw new Error("useLocale must be used within LocaleProvider")
  return context
}
