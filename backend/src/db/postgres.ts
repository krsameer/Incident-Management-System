import { Pool, PoolClient } from 'pg';

const schemaSql = `
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL,
  component_type TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  alert_channel TEXT NOT NULL,
  responder_team TEXT NOT NULL,
  first_signal_at TIMESTAMPTZ NOT NULL,
  last_signal_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  mttr_minutes NUMERIC NULL,
  closed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rca_records (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL UNIQUE REFERENCES work_items(id) ON DELETE CASCADE,
  incident_start_at TIMESTAMPTZ NOT NULL,
  incident_end_at TIMESTAMPTZ NOT NULL,
  root_cause_category TEXT NOT NULL,
  fix_applied TEXT NOT NULL,
  prevention_steps TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  responder_team TEXT NOT NULL,
  alert_channel TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export function createPostgresPool(postgresUrl: string): Pool {
  return new Pool({ connectionString: postgresUrl });
}

export async function initializePostgres(pool: Pool): Promise<void> {
  await pool.query(schemaSql);
}

export async function withTransaction<T>(pool: Pool, handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
