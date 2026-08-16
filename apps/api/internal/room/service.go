package room

import (
	"context"
	"errors"
	"fmt"
	"go-server/internal/errors/apierr"
	_ "time"

	"github.com/google/uuid"
)

// type RoomRequest struct {
//
// }
//
// func newRoomRequest() {
//
// }

type RoomService struct {
	repo *RoomRepository
}

func NewRoomService(repo *RoomRepository) *RoomService {
	return &RoomService {
		repo: repo,
	}
}

func (s *RoomService) CreateRoom(ctx context.Context, req CreateRoomRequest) (*Room, error) {
	if (req.CandidateName == "") {
		return nil, apierr.Validation("candidate name is required", nil)
	}

	if (req.Role == "") {
		return nil, apierr.Validation("role is required", nil)
	}

	// room, err := s.repo.GetByID(ctx, req.RoomID)
	// if errors.Is(err, ErrRoomNotFound) {
	// 	return nil, apierr.NotFound("Room not found", nil)
	// }
	//
	// if err != nil {
	// 	return nil, apierr.Internal(err)
	// }


	// existing, err := s.repo.GetByID(ctx, req.RoomID)
	// if err != nil && !errors.Is(err, ErrRoomNotFound) {
	// 	return nil, apierr.Internal(err)
	// }
	//
	// if existing != nil {
	// 	return nil, apierr.Conflict("an active room already exists for this interview", nil)
	// }

	room, err := s.repo.CreateRoom(ctx, req)
	fmt.Println("CREATED ROOM")
	if err != nil {
		return nil, apierr.Internal(err)
	}


	return room, nil
}

func (s *RoomService) ListRooms(ctx context.Context) ([]Room, error) {
	rooms, err := s.repo.ListRooms(ctx)
	if err != nil {
		return nil, apierr.Internal(err)
	}

	return rooms, nil
}

func (s *RoomService) GetByID(ctx context.Context, id string) (*Room, error) {
	roomID, err := uuid.Parse(id)
	if err != nil {
		return nil, apierr.Validation("Invalid room id", err)
	}

	room, err := s.repo.GetByID(ctx, roomID)

	if errors.Is(err, ErrRoomNotFound) {
		return nil, apierr.NotFound("Room not found", nil)
	}

	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}

func (s *RoomService) GetByJoinCode(ctx context.Context, joinCode string) (*Room, error) {
	room, err := s.repo.GetByJoinCode(ctx, joinCode)

	if (errors.Is(err, ErrRoomNotFound)) {
		return nil, apierr.NotFound("Room not found", nil)
	}

	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}

// func (s *RoomService) ConnectToRoom(ctx context.Context, joinCode string) (*Room, error) {
//
// }
