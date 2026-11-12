import "dotenv/config";
import { db, pool } from "./index";
import { sql } from "drizzle-orm";

async function runDDL() {
  console.log("Applying P0 & P1 architectural remediation DDL...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS school_counters (
      school_id VARCHAR(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      entity_type VARCHAR(30) NOT NULL,
      current_val INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (school_id, entity_type)
    );
  `);
  console.log("✓ school_counters table created or verified");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS outbox_events (
      id VARCHAR(36) PRIMARY KEY,
      school_id VARCHAR(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      payload_json JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      scheduled_for TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMP WITH TIME ZONE
    );
  `);
  console.log("✓ outbox_events table created or verified");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS outbox_status_scheduled_idx ON outbox_events(status, scheduled_for);
    CREATE INDEX IF NOT EXISTS outbox_school_event_idx ON outbox_events(school_id, event_type);
  `);
  console.log("✓ outbox_events indexes created or verified");

  await pool.end();
  console.log("All DDL migrations applied successfully!");
}

runDDL().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

