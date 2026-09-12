// backend/internal/apierr/apierr.go
package apierr

import "github.com/gin-gonic/gin"

// Stable codes the frontend translates into the active locale. Keep this
// list in sync with frontend/src/locales/types.ts's ErrorCode union — no
// shared codegen for a project this size, just keep both in view when
// adding a new one.
const (
	ValidationFailed      = "validation_failed"
	InternalError         = "internal_error"
	SlugGenerationFailed  = "slug_generation_failed"
	RegistrationFailed    = "registration_failed"
	InvalidCredentials    = "invalid_credentials"
	TokenGenerationFailed = "token_generation_failed"
	Unauthorized          = "unauthorized"
	InvalidToken          = "invalid_token"
	CannotFriendSelf      = "cannot_friend_self"
	AlreadyFriends        = "already_friends"
	FriendRequestSent     = "friend_request_already_sent"
	InvalidFriendshipID   = "invalid_friendship_id"
	RequestNotFound       = "request_not_found"
	FriendshipNotFound    = "friendship_not_found"
	EntryCreateFailed     = "entry_create_failed"
	EntryUpdateFailed     = "entry_update_failed"
	EntryDeleteFailed     = "entry_delete_failed"
	EntryNotFound         = "entry_not_found"
	NoPermission          = "no_permission"
	StorageNotConfigured  = "storage_not_configured"
	StorageInitFailed     = "storage_init_failed"
	InvalidFormData       = "invalid_form_data"
	UploadFailed          = "upload_failed"
	ProfileNotFound       = "profile_not_found"
	InvalidGroupID        = "invalid_group_id"
	GroupNotFound         = "group_not_found"
	NotYourFriend         = "not_your_friend"
	InvalidContactID      = "invalid_contact_id"
	ContactNotFound       = "contact_not_found"
	ContactAlreadyLinked  = "contact_already_linked"
	HandleTaken           = "handle_taken"
)

// JSON responds with both the stable code (for the frontend to translate)
// and a plain-English fallback (for logs, and any caller that doesn't
// bother translating — e.g. an older cached frontend build).
func JSON(c *gin.Context, status int, code string, englishMessage string) {
	c.JSON(status, gin.H{"error_code": code, "error": englishMessage})
}
