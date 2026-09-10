// Shared with the auto-seeded text box on a brand-new entry, so both places
// invite the user with the same words.
export function getEntryPlaceholderText(userName?: string) {
  return `What's on your mind today, ${userName}?`
}
