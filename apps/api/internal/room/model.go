package room

import (
	"time"

	"github.com/google/uuid"
)

type RoomState string

const (
	StateScheduled 	RoomState = "scheduled"
	StateActive 	RoomState = "active"
	StateEnded 		RoomState = "ended"
)

// var stateName = map[RoomState]string{
// 	StateScheduled: 	"scheduled",
// 	StateActive: 		"active",
// 	StateEnded: 		"ended",
// }
//
// func (ss RoomState) String() string {
// 	return stateName[ss]
// }
//
type Room struct {
	ID				uuid.UUID `json:"id"`
	// OrgID	 uuid.UUID `json:"OrgID"`
	CreatedBy		*string		`json:"created_by"`
	CreatedAt 		time.Time	`json:"created_at"`
	StartedAt		*time.Time	`json:"started_at,omitempty"`
	EndedAt			*time.Time	`json:"ended_at,omitempty"`
	JoinCode 		string  	`json:"join_code"`
	CandidateName	string		`json:"candidate_name"`
	Role			string		`json:"role"`
	Status			RoomState	`json:"status"`
}

type CreateRoomRequest struct {
	// RoomID uuid.UUID `json:"room_id"`
	CandidateName string `json:"candidate_name"`
	Role			string `json:"role"`
	CreatedBy		string `json:"created_by"`
}
