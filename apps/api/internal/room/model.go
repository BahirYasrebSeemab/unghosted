package room

import (
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"net/http"
)

type RoomState string

var (
	StateScheduled 	RoomState = "scheduled"
	StateActive 	RoomState = "active"
	StateEnded 		RoomState = "ended"
)

var upgrader = websocket.Upgrader {
	ReadBufferSize: 1024 * 4,
	WriteBufferSize: 1024 * 4,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// var stateName = map[RoomState]string{
// 	StateScheduled: 	"scheduled",
// 	StateActive: 		"active",
// 	StateEnded: 		"ended",
// }
//
// func (ss RoomState) String() string {
// 	return stateName[ss]
// }

// Websocket model
type Hub struct {
	clients map[*Client]bool

	broadcast chan []byte

	join chan *Client

	leave chan *Client
}

type Client struct {
	hub *Hub

	conn *websocket.Conn

	send chan []byte
}

type JoinStatus string

const (
	JoinNone 		JoinStatus = "none"
	JoinRequested 	JoinStatus = "requested"
	JoinAccepted 	JoinStatus = "accepted"
	JoinRejected 	JoinStatus = "rejected"
)

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
	JoinStatus		JoinStatus	`json:"join_status"`
	RequestedBy		*string		`json:"requested_by,omitempty"`
	CompanyID		*int		`json:"company_id,omitempty"`
}

type CreateRoomRequest struct {
	// RoomID uuid.UUID `json:"room_id"`
	CandidateName string `json:"candidate_name"`
	Role			string `json:"role"`
	CreatedBy		string `json:"created_by"`
}
