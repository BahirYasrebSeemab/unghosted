package signaling

import "encoding/json"

type MessageType string

const (
	MessageTypeOffer 		MessageType = "offer"
	MessageTypeAnswer		MessageType = "answer"
	MessageTypeCandidate 	MessageType = "ice-candidate"
	// MessageTypeChat			MessageType = "chat"
	MessageTypeJoin			MessageType = "join"
	MessageTypeLeave 		MessageType = "leave"
	MessageTypePeerList		MessageType = "peer-list"
	MessageTypePeerLeft		MessageType = "peer-left"
)

type Message struct {
	Type 	MessageType	`json:"type"`
	From 	string			`json:"from"`
	To 	 	string			`json:"to,omitempty"`
	Payload json.RawMessage	`json:"payload,omitempty"`
}

type PeerListPayload struct {
	Peers []string `json:"peers"`
}
