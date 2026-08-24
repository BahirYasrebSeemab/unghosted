package room

import (
	"context"
	"errors"
	_ "fmt"
	_ "go-server/internal/utils/randomString"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)


var ErrRoomNotFound = errors.New("room not found")

type Repository interface {
	CreateRoom(ctx context.Context, candidateName string) (*Room, error)
	ListRooms(ctx context.Context) ([]Room, error)
	GetByID(ctx context.Context, id string)
	GetByJoinCode(ctx context.Context, join_code string) (*Room, error)
}

type RoomRepository struct {
	DB *pgxpool.Pool
}

func NewRepository(DB *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{
		DB: DB,
	}
}

// columns is the shared SELECT/RETURNING list for every query that scans a full Room — kept in
// one place so the scan order below never drifts out of sync with the query text. join_code is
// wrapped in COALESCE because rooms no longer generate one (see CreateRoom) — candidates join by
// the room's real UUID now, not a short code — so it's NULL for every new room.
const columns = `id, candidate_name, created_at, status, created_by,
	started_at, ended_at, COALESCE(join_code, '') AS join_code, role,
	join_status, requested_by, company_id`

func scanRoom(row pgx.Row, room *Room) error {
	return row.Scan(&room.ID, &room.CandidateName, &room.CreatedAt, &room.Status,
		&room.CreatedBy, &room.StartedAt, &room.EndedAt, &room.JoinCode, &room.Role,
		&room.JoinStatus, &room.RequestedBy, &room.CompanyID,
	)
}

func (r *RoomRepository) CreateRoom(ctx context.Context, req CreateRoomRequest, companyID int) (*Room, error) {
	query := `
		INSERT INTO rooms (candidate_name, role, created_by, company_id)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + columns

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, req.CandidateName, req.Role, req.CreatedBy, companyID), &room)

	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) ListRooms(ctx context.Context, companyID int) ([]Room, error) {
	query := `
		SELECT ` + columns + `
		FROM rooms
		WHERE company_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.DB.Query(ctx, query, companyID)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var rooms []Room
	for rows.Next() {
		var room Room
		if err := scanRoom(rows, &room); err != nil {
			return nil, err
		}

		rooms = append(rooms, room)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return rooms, nil
}

func (r *RoomRepository) GetByID(ctx context.Context, id uuid.UUID) (*Room, error) {
	query := `SELECT ` + columns + ` FROM rooms WHERE id = $1`

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, id), &room)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) GetByJoinCode(ctx context.Context, joinCode string) (*Room, error) {
	query := `SELECT ` + columns + ` FROM rooms WHERE join_code = $1`

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, joinCode), &room)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}

	if err != nil {
		slog.Error("Error from inside GetByJoinCode")
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) RequestJoin(ctx context.Context, id uuid.UUID, requestedBy string) (*Room, error) {
	query := `
		UPDATE rooms
		SET join_status = 'requested', requested_by = $2
		WHERE id = $1
		RETURNING ` + columns

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, id, requestedBy), &room)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) SetJoinStatus(ctx context.Context, id uuid.UUID, status JoinStatus) (*Room, error) {
	query := `
		UPDATE rooms
		SET join_status = $2
		WHERE id = $1
		RETURNING ` + columns

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, id, status), &room)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) MarkActive(ctx context.Context, id uuid.UUID) (*Room, error) {
	query := `
		UPDATE rooms
		SET status = 'active', started_at = now()
		WHERE id = $1
		RETURNING ` + columns

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, id), &room)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) MarkEnded(ctx context.Context, id uuid.UUID) (*Room, error) {
	query := `
		UPDATE rooms
		SET status = 'ended', ended_at = now()
		WHERE id = $1
		RETURNING ` + columns

	var room Room
	err := scanRoom(r.DB.QueryRow(ctx, query, id), &room)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	if err != nil {
		return nil, err
	}

	return &room, nil
}
