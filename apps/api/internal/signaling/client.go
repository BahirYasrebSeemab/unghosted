package signaling

import (
	"github.com/gorilla/websocket"
	"time"
)

type Client struct {
	ID			string
	RoomID		string
	conn		*websocket.Conn
	send		chan Message
	hub			*Hub
}

func NewClient(id, roomId string, conn *websocket.Conn, hub *Hub) *Client {
	return &Client{
		ID: id,
		RoomID: roomId,
		conn: conn,
		send: make(chan Message, 16),
		hub: hub,
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.leave <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(MaxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))	
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})


	for {
		var msg Message
		if err := c.conn.ReadJSON(&msg); err != nil {
			return
		}

		msg.From = c.ID
		c.hub.broadcast <- msg
	}	
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)

	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(msg); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}

}


