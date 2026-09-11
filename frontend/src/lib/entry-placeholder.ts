import { TFunction } from "@/lib/i18n"

// Shared with the auto-seeded text box on a brand-new entry, so both places
// invite the user with the same words.
export function getEntryPlaceholderText(t: TFunction, userName?: string) {
  return t("composer.placeholder", { name: userName ?? "" })
}
