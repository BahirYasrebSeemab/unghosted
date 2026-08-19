package viewer

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type ViewerWsHandler struct {
	service *Hub
}


func NewViewerWsHandler(service *Hub) *ViewerWsHandler {
	return &ViewerWsHandler {
		service: service,
	}
}

func (v *ViewerWsHandler) ServeWs(w http.ResponseWriter, r *http.Request)  {
	joinCode := chi.URLParam(r, "{join_code}")
	log.Printf("JOIN CODE: %s", joinCode)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{hub: v.service, conn: conn, send: make(chan []byte, 1024)}
	client.hub.join <- client

	go client.writePump()
	go client.readPump()
}
