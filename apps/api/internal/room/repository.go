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

func (r *RoomRepository) CreateRoom(ctx context.Context, req CreateRoomRequest) (*Room, error) {
	const query = `
		INSERT INTO rooms (candidate_name, join_code, role, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, candidate_name, created_at, join_code, role, created_by
	`

	var room Room
	// Generate it on a whim for now
	
	err := r.DB.QueryRow(ctx, query, req.CandidateName, "DUMM33", req.Role, req.CreatedBy).
		Scan(&room.ID, &room.CandidateName, &room.CreatedAt, &room.JoinCode, &room.Role, &room.CreatedBy)
	
	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) ListRooms(ctx context.Context) ([]Room, error) {
	const query = `
		SELECT id, created_by, created_at, candidate_name, 
			   status, started_at, ended_at, join_code, role
		FROM rooms
		ORDER BY created_at DESC
	`

	rows, err := r.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var rooms []Room
	for rows.Next() {
		var room Room
		if err := rows.Scan(
			&room.ID, &room.CreatedBy, &room.CreatedAt, &room.CandidateName,
			&room.Status, &room.StartedAt, &room.EndedAt, &room.JoinCode, &room.Role,
		); err != nil {
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
	const query = `
		SELECT id, candidate_name, created_at, status, created_by,
			   started_at, ended_at, join_code, role
		FROM rooms
		WHERE id = $1
	`

	var room Room

	err := r.DB.QueryRow(ctx, query, id).
			Scan(&room.ID, &room.CandidateName, &room.CreatedAt, &room.Status,
				 &room.CreatedBy, &room.StartedAt, &room.EndedAt, &room.JoinCode, &room.Role,
			 )

	if err != nil {
		return nil, err
	}

	return &room, nil
}

func (r *RoomRepository) GetByJoinCode(ctx context.Context, joinCode string) (*Room, error) {
	const query = `
		SELECT id, candidate_name, created_at, status, created_by,
			   started_at, ended_at, join_code, role
		FROM rooms
		WHERE join_code = $1
	`

	var room Room
	err := r.DB.QueryRow(ctx, query, joinCode).
			Scan(&room.ID, &room.CandidateName, &room.CreatedAt, &room.Status,
				 &room.CreatedBy, &room.StartedAt, &room.EndedAt, &room.JoinCode, &room.Role,
			 )

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomNotFound
	}
	
	if err != nil {
		slog.Error("Error from inside GetByJoinCode")
		return nil, err
	}

	return &room, nil
}
