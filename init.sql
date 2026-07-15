CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS command_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    output TEXT,
    exit_code INTEGER
);

CREATE TABLE IF NOT EXISTS crawler_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    total_url_count INTEGER
);