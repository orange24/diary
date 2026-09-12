package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"

	"diary_app/backend/internal/apierr"
	"github.com/gin-gonic/gin"
)

// A group is private to its owner — the friends inside it are never told
// which group they're in, only whether a given post is visible to them.
type FriendGroup struct {
	ID      int          `json:"id"`
	Name    string       `json:"name"`
	Members []FriendUser `json:"members"`
}

// GET /friend-groups — the caller's own groups, each with its member list.
func (h *EntryHandler) ListFriendGroups(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	groupRows, err := h.DB.Query(`SELECT id, name FROM friend_groups WHERE owner_id = $1 ORDER BY name`, userID)
	if err != nil {
		log.Printf("ListFriendGroups error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	defer groupRows.Close()

	groups := []FriendGroup{}
	groupIndex := map[int]int{} // group id -> index in `groups`
	for groupRows.Next() {
		var g FriendGroup
		if err := groupRows.Scan(&g.ID, &g.Name); err != nil {
			log.Printf("ListFriendGroups error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		g.Members = []FriendUser{}
		groupIndex[g.ID] = len(groups)
		groups = append(groups, g)
	}

	if len(groups) > 0 {
		memberRows, err := h.DB.Query(`
			SELECT fgm.group_id, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, '')
			FROM friend_group_members fgm
			JOIN friend_groups fg ON fg.id = fgm.group_id
			JOIN users u ON u.id = fgm.friend_user_id
			WHERE fg.owner_id = $1
			ORDER BY u.full_name`, userID)
		if err != nil {
			log.Printf("ListFriendGroups error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		defer memberRows.Close()
		for memberRows.Next() {
			var groupID int
			var member FriendUser
			if err := memberRows.Scan(&groupID, &member.ID, &member.Username, &member.FullName, &member.ProfilePicture); err != nil {
				log.Printf("ListFriendGroups error: %v", err)
				apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
				return
			}
			if idx, ok := groupIndex[groupID]; ok {
				groups[idx].Members = append(groups[idx].Members, member)
			}
		}
	}

	c.JSON(http.StatusOK, groups)
}

type createFriendGroupInput struct {
	Name string `json:"name" binding:"required"`
}

// POST /friend-groups — create a new (initially empty) group.
func (h *EntryHandler) CreateFriendGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var input createFriendGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	var id int
	err := h.DB.QueryRow(
		`INSERT INTO friend_groups (owner_id, name) VALUES ($1, $2) RETURNING id`,
		userID, input.Name,
	).Scan(&id)
	if err != nil {
		log.Printf("CreateFriendGroup error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	c.JSON(http.StatusOK, FriendGroup{ID: id, Name: input.Name, Members: []FriendUser{}})
}

type renameFriendGroupInput struct {
	Name string `json:"name" binding:"required"`
}

// PUT /friend-groups/:id — rename. Only the owner may rename their own group.
func (h *EntryHandler) RenameFriendGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidGroupID, "Invalid group id")
		return
	}

	var input renameFriendGroupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	result, err := h.DB.Exec(
		`UPDATE friend_groups SET name = $1 WHERE id = $2 AND owner_id = $3`,
		input.Name, groupID, userID,
	)
	if err != nil {
		log.Printf("RenameFriendGroup error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.GroupNotFound, "Group not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Renamed"})
}

// DELETE /friend-groups/:id — deleting a group cascades its memberships and
// clears it from any entry that was scoped to it (FK ON DELETE CASCADE).
func (h *EntryHandler) DeleteFriendGroup(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidGroupID, "Invalid group id")
		return
	}

	result, err := h.DB.Exec(`DELETE FROM friend_groups WHERE id = $1 AND owner_id = $2`, groupID, userID)
	if err != nil {
		log.Printf("DeleteFriendGroup error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.GroupNotFound, "Group not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

type addGroupMemberInput struct {
	FriendUserID int `json:"friend_user_id" binding:"required"`
}

// POST /friend-groups/:id/members — add one accepted friend to one of the
// caller's own groups. Toggled one at a time (rather than replacing the
// whole member list) so a checkbox-per-friend UI can't clobber a change
// made from another tab.
func (h *EntryHandler) AddGroupMember(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidGroupID, "Invalid group id")
		return
	}

	var input addGroupMemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	var ownerCheck int
	err = h.DB.QueryRow(`SELECT id FROM friend_groups WHERE id = $1 AND owner_id = $2`, groupID, userID).Scan(&ownerCheck)
	if err == sql.ErrNoRows {
		apierr.JSON(c, http.StatusNotFound, apierr.GroupNotFound, "Group not found")
		return
	} else if err != nil {
		log.Printf("AddGroupMember error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	var friendCheck int
	err = h.DB.QueryRow(
		`SELECT id FROM friendships WHERE status = 'accepted'
		 AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
		userID, input.FriendUserID,
	).Scan(&friendCheck)
	if err == sql.ErrNoRows {
		apierr.JSON(c, http.StatusBadRequest, apierr.NotYourFriend, "That person isn't your friend")
		return
	} else if err != nil {
		log.Printf("AddGroupMember error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	if _, err := h.DB.Exec(
		`INSERT INTO friend_group_members (group_id, friend_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		groupID, input.FriendUserID,
	); err != nil {
		log.Printf("AddGroupMember error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Added"})
}

// DELETE /friend-groups/:id/members/:friend_user_id
func (h *EntryHandler) RemoveGroupMember(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidGroupID, "Invalid group id")
		return
	}
	friendUserID, err := strconv.Atoi(c.Param("friend_user_id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, "Invalid user id")
		return
	}

	result, err := h.DB.Exec(
		`DELETE FROM friend_group_members fgm USING friend_groups fg
		 WHERE fgm.group_id = fg.id AND fg.id = $1 AND fg.owner_id = $2 AND fgm.friend_user_id = $3`,
		groupID, userID, friendUserID,
	)
	if err != nil {
		log.Printf("RemoveGroupMember error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.GroupNotFound, "Group not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Removed"})
}
