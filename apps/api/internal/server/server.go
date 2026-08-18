package server

import (
	"context"
	"net/http"
	
	// "go-server/internal/pkg/webrtc"
)

type Server struct {
	httpServer *http.Server
}

func New(addr string, handler http.Handler) *Server {
	return &Server{
		httpServer: &http.Server {
			Addr: addr,
			Handler: handler,
		},
	}
}

// func (s *Server) startWebsocket() {
// 	webrtc.DispatchKeyFrame()
// 	if ()
// }

func (s *Server) Start() error {
	err := s.httpServer.ListenAndServe()
	if err == http.ErrServerClosed {
		return nil
	}	

	// go s.startWebsocket()
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
