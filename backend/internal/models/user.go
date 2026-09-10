package models

type User struct {
	ID        int    `json:"id"`
	Username  string `json:"username" binding:"required"`
	Password  string `json:"password,omitempty"` // omitempty คือไม่ส่งรหัสกลับไปใน JSON
	FullName  string `json:"full_name"`
	Birthdate string `json:"birthdate"` // ใช้ Pointer เพื่อให้เป็น Nullable
	Gender    string `json:"gender"`
	Country   string `json:"country"`

	// Social Links
	FacebookLink string `json:"facebook_link"`
	GmailLink    string `json:"gmail_link"`
	AppleIDLink  string `json:"apple_id_link"`
	XLink        string `json:"x_link"`

	// A data: URI (resized+compressed client-side) rather than a hosted
	// Cloudinary URL — registration happens before the user has a JWT, and
	// the existing upload endpoint requires one.
	ProfilePicture string `json:"profile_picture"`

	// URL slug for this user's public profile page (/<slug>) — generated
	// once at registration from their full name (or username), de-duplicated
	// with a numeric suffix. Immutable: no endpoint accepts changes to it.
	Slug string `json:"slug"`
}
