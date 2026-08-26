package signaling

import (
	"encoding/json"
	"log"
	"sync"
)

// TODO or TOREMEMBER: Edge case when one guy can
// Open let's say two tabs, or connections race with
// Each other second join will overwrite the first one

type Hub struct {
	mu 			sync.RWMutex
	rooms 		map[string]map[*Client]bool
	clientsByID	map[string]*Client

	join		chan *Client
	leave		chan *Client
	broadcast 	chan Message
}

func NewHub() *Hub {
	return &Hub {
		rooms: make(map[string]map[*Client]bool),
		clientsByID: make(map[string]*Client),
		join: make(chan *Client),
		leave: make(chan *Client),
		broadcast: make(chan Message),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.join:
			log.Println("register: client", c.ID, "joining room", c.RoomID)
			h.mu.Lock()
			// If there are no rooms and therefore no client lists inside initialized
			existing := make([]string, 0, len(h.rooms[c.RoomID]))
			for peer := range h.rooms[c.RoomID] {
				existing = append(existing, peer.ID)
			}

			if h.rooms[c.RoomID] == nil {
				h.rooms[c.RoomID] = make(map[*Client]bool)
			}
			// User joins
			h.rooms[c.RoomID][c] = true
			h.clientsByID[c.ID] = c
			h.mu.Unlock()

			payload, _ := json.Marshal(PeerListPayload{Peers: existing})
			c.send <- Message{
				Type: MessageTypePeerList,
				Payload: payload,
			}
			log.Println("register: sending peer-list to:", c.ID, "existing peers:", existing)

		case c := <-h.leave:
			h.mu.Lock()
			if clients, ok := h.rooms[c.RoomID]; ok {
				if _, ok := clients[c]; ok {
					delete(clients, c)
					delete(h.clientsByID, c.ID)
					close(c.send)
					if len(clients) == 0 {
						delete(h.rooms, c.RoomID)
					}
				}
			}

			h.mu.Unlock()

			h.mu.RLock()
			for peer := range h.rooms[c.RoomID] {
				select {
				case peer.send <- Message{Type: MessageTypePeerLeft, From: c.ID }:
				default:
				}
			}

			h.mu.RUnlock()
		case msg := <-h.broadcast:
			h.relay(msg)
		}
	}
}

func (h *Hub) relay(msg Message) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	sender, ok := h.clientsByID[msg.From]
	if !ok {
		return
	}

	h.deliverToRoom(sender.RoomID, msg, sender)
}

func (h *Hub) deliverToRoom(roomID string, msg Message, sender *Client) {
	for c := range h.rooms[roomID] {
		if c == sender {
			continue
		}

		if msg.To != "" && c.ID != msg.To {
			continue
		}

		select {
		case c.send <- msg:
		default:
		}
	}
}
