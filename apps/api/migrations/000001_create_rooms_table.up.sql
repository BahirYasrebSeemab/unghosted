CREATE TYPE status AS ENUM ('scheduled', 'active', 'ended');

CREATE TABLE rooms (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- org_id         UUID,
    created_by     TEXT,
    candidate_name TEXT,
    role           TEXT,
    join_code      TEXT,
    status         status NOT NULL DEFAULT 'scheduled',
    started_at     TIMESTAMPTZ,
    ended_at       TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_created_by ON rooms(created_by);
CREATE INDEX idx_rooms_status ON rooms(status);
