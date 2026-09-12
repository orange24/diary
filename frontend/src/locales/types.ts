export type Locale = "en" | "th"

// Keep this list in sync with backend/internal/apierr/apierr.go's constants
// — no shared codegen for a project this size, just keep both in view when
// adding a new one.
export type ErrorCode =
  | "validation_failed"
  | "internal_error"
  | "slug_generation_failed"
  | "registration_failed"
  | "invalid_credentials"
  | "token_generation_failed"
  | "unauthorized"
  | "invalid_token"
  | "cannot_friend_self"
  | "already_friends"
  | "friend_request_already_sent"
  | "invalid_friendship_id"
  | "request_not_found"
  | "friendship_not_found"
  | "entry_create_failed"
  | "entry_update_failed"
  | "entry_delete_failed"
  | "entry_not_found"
  | "no_permission"
  | "storage_not_configured"
  | "storage_init_failed"
  | "invalid_form_data"
  | "upload_failed"
  | "profile_not_found"
  | "invalid_group_id"
  | "group_not_found"
  | "not_your_friend"
  | "invalid_contact_id"
  | "contact_not_found"
  | "contact_already_linked"
  | "handle_taken"

// Phase 1 surfaces only (header, dashboard shell, login, register). Phase 2
// adds sections here for diary-grid, diary-form, friends-explorer,
// hashtag-explorer, and the profile pages — extend this interface and both
// en.ts/th.ts together at that point.
export interface Dictionary {
  common: {
    save: string
    cancel: string
  }
  header: {
    editProfile: string
    myPublicProfile: string
    darkMode: string
    language: string
    logout: string
    navHome: string
    navHashtag: string
    navFriends: string
    navNosy: string
    guestUser: string
  }
  dashboard: {
    welcomeBefore: string
    welcomeAfter: string
    masonryLayout: string
    singleColumnLayout: string
    comingSoon: string
    newEntryTitle: string
    editMemoryTitle: string
    endOfMemories: string
    nosyIntro: string
    nosyEmpty: string
    deleteEntryTitle: string
    deleteEntryDescription: string
    deleteEntryCancel: string
    deleteEntryConfirm: string
    deleteEntryDeleting: string
    deleteFailedAlert: string
    editEntryLoadFailedAlert: string
  }
  composer: {
    placeholder: string
  }
  date: {
    justNow: string
    minuteAgo: string
    minutesAgo: string
    hourAgo: string
    hoursAgo: string
    yesterday: string
    daysAgo: string
  }
  login: {
    title: string
    subtitle: string
    usernamePlaceholder: string
    passwordPlaceholder: string
    usernameRequired: string
    passwordRequired: string
    signIn: string
    loginFailed: string
    noAccount: string
    signUp: string
  }
  register: {
    titleBefore: string
    titleAfter: string
    subtitle: string
    usernameLabel: string
    fullNameLabel: string
    passwordLabel: string
    confirmPasswordLabel: string
    birthdateLabel: string
    genderLabel: string
    genderSelectPlaceholder: string
    genderMale: string
    genderFemale: string
    genderOther: string
    countryLabel: string
    countryPlaceholder: string
    socialLinksLabel: string
    facebookPlaceholder: string
    gmailPlaceholder: string
    appleIdPlaceholder: string
    xPlaceholder: string
    profilePictureOptional: string
    submitCreating: string
    submit: string
    alreadyMember: string
    signIn: string
    passwordMismatch: string
    successTitle: string
    successDescription: string
    somethingWrong: string
    imageError: string
  }
  errors: Record<ErrorCode, string>
}

// Dotted-path union of every leaf key, e.g. "header.editProfile" — used
// only for t()'s parameter type (autocomplete + typo safety at call
// sites). The dictionaries themselves are typed directly as `Dictionary`
// so a missing/misspelled key in either locale is a compile error there,
// which is the actual completeness guarantee.
type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeyOf<T[K]>}`
}[keyof T & string]

export type TranslationKey = NestedKeyOf<Dictionary>
