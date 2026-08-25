package room

import (
	"context"
	"errors"
	"go-server/internal/companies"
	"go-server/internal/errors/apierr"
	"math"

	"github.com/google/uuid"
)

// tokensPerFifteenMinutes is the billing rate: a 15-minute interview costs 10 tokens, charged
// proportionally (not rounded up to the next 15-minute block) for however long the room was
// actually active — see EndRoom.
const tokensPerFifteenMinutes = 10.0

type RoomService struct {
	repo        *RoomRepository
	companyRepo *companies.CompanyRepository
}

func NewRoomService(repo *RoomRepository, companyRepo *companies.CompanyRepository) *RoomService {
	return &RoomService{
		repo:        repo,
		companyRepo: companyRepo,
	}
}

func (s *RoomService) CreateRoom(ctx context.Context, req CreateRoomRequest, creatorEmail string) (*Room, error) {
	if req.CandidateName == "" {
		return nil, apierr.Validation("candidate name is required", nil)
	}

	if req.Role == "" {
		return nil, apierr.Validation("role is required", nil)
	}

	company, err := s.companyRepo.GetCompanyByMemberEmail(ctx, creatorEmail)
	if errors.Is(err, companies.ErrCompanyNotFound) {
		return nil, apierr.Forbidden("only company accounts can create rooms", nil)
	}
	if err != nil {
		return nil, apierr.Internal(err)
	}

	room, err := s.repo.CreateRoom(ctx, req, company.Id)
	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}

// ListRooms scopes results to the caller's own company — each company only sees the rooms it
// created, never another company's.
func (s *RoomService) ListRooms(ctx context.Context, callerEmail string) ([]Room, error) {
	company, err := s.companyRepo.GetCompanyByMemberEmail(ctx, callerEmail)
	if errors.Is(err, companies.ErrCompanyNotFound) {
		return nil, apierr.Forbidden("not part of a company", nil)
	}
	if err != nil {
		return nil, apierr.Internal(err)
	}

	rooms, err := s.repo.ListRooms(ctx, company.Id)
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

func (s *RoomService) RequestJoin(ctx context.Context, id string, requestedBy string) (*Room, error) {
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

	if room.Status == StateEnded {
		return nil, apierr.Validation("room has already ended", nil)
	}

	if room.JoinStatus == JoinAccepted {
		return room, nil
	}

	room, err = s.repo.RequestJoin(ctx, roomID, requestedBy)
	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}

// AcceptJoin lets the interviewer let the candidate in — this is also the moment the interview
// is considered "started" for billing purposes, so it's gated on the owning company having at
// least one 15-minute block's worth of balance.
func (s *RoomService) AcceptJoin(ctx context.Context, id string) (*Room, error) {
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

	if room.CompanyID == nil {
		return nil, apierr.Forbidden("room has no owning company", nil)
	}

	company, err := s.companyRepo.GetByID(ctx, *room.CompanyID)
	if err != nil {
		return nil, apierr.Internal(err)
	}

	if company.Balance < int(tokensPerFifteenMinutes) {
		return nil, apierr.Forbidden("insufficient balance — at least 10 tokens are needed to start an interview", nil)
	}

	if _, err := s.repo.SetJoinStatus(ctx, roomID, JoinAccepted); err != nil {
		return nil, apierr.Internal(err)
	}

	room, err = s.repo.MarkActive(ctx, roomID)
	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}

func (s *RoomService) RejectJoin(ctx context.Context, id string) (*Room, error) {
	roomID, err := uuid.Parse(id)
	if err != nil {
		return nil, apierr.Validation("Invalid room id", err)
	}

	room, err := s.repo.SetJoinStatus(ctx, roomID, JoinRejected)
	if errors.Is(err, ErrRoomNotFound) {
		return nil, apierr.NotFound("Room not found", nil)
	}
	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}

// EndRoom closes out the interview and bills the owning company: elapsed time since
// AcceptJoin's started_at is charged proportionally at 10 tokens / 15 minutes (no rounding up
// to a full block) — a 20-minute interview costs 13.33 tokens, rounded to the nearest whole
// token. Idempotent: calling it again on an already-ended room is a no-op, not a double charge.
func (s *RoomService) EndRoom(ctx context.Context, id string) (*Room, error) {
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

	if room.Status == StateEnded {
		return room, nil
	}

	if room.StartedAt == nil {
		return nil, apierr.Validation("room was never started", nil)
	}

	ended, err := s.repo.MarkEnded(ctx, roomID)
	if err != nil {
		return nil, apierr.Internal(err)
	}

	if ended.CompanyID != nil && ended.EndedAt != nil {
		elapsedMinutes := ended.EndedAt.Sub(*ended.StartedAt).Minutes()
		tokens := int(math.Round(elapsedMinutes * tokensPerFifteenMinutes / 15.0))
		if tokens > 0 {
			if err := s.companyRepo.ReduceBalance(ctx, tokens, *ended.CompanyID); err != nil {
				return nil, apierr.Internal(err)
			}
		}
	}

	return ended, nil
}

// RecordCallJoin logs a signaling-WS connection into in_call_users, deriving the caller's role
// from the room itself (whoever created it vs. whoever's join was accepted) rather than trusting
// a client-supplied value.
func (s *RoomService) RecordCallJoin(ctx context.Context, id string, email string) error {
	roomID, err := uuid.Parse(id)
	if err != nil {
		return apierr.Validation("Invalid room id", err)
	}

	room, err := s.repo.GetByID(ctx, roomID)
	if err != nil {
		return apierr.Internal(err)
	}

	role := "unknown"
	if room.CreatedBy != nil && *room.CreatedBy == email {
		role = "interviewer"
	} else if room.RequestedBy != nil && *room.RequestedBy == email {
		role = "candidate"
	}

	return s.repo.RecordCallJoin(ctx, email, roomID, role)
}

func (s *RoomService) GetByJoinCode(ctx context.Context, joinCode string) (*Room, error) {
	room, err := s.repo.GetByJoinCode(ctx, joinCode)

	if errors.Is(err, ErrRoomNotFound) {
		return nil, apierr.NotFound("Room not found", nil)
	}

	if err != nil {
		return nil, apierr.Internal(err)
	}

	return room, nil
}
