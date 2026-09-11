import en from "./en"
import th from "./th"
import { Dictionary, Locale } from "./types"

export const SUPPORTED_LOCALES: Locale[] = ["en", "th"]

export const DICTIONARIES: Record<Locale, Dictionary> = { en, th }

export * from "./types"
