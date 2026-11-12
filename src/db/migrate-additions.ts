import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying schema migrations...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS student_documents (
      id varchar(36) PRIMARY KEY,
      school_id varchar(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id varchar(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      document_type varchar(50) NOT NULL,
      title text NOT NULL,
      file_url text NOT NULL,
      file_size varchar(20),
      verification_status varchar(20) NOT NULL DEFAULT 'VERIFIED',
      uploaded_by_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS daily_homework (
      id varchar(36) PRIMARY KEY,
      school_id varchar(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id varchar(36) NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      section_id varchar(36) NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      subject_id varchar(36) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
      assigned_date date NOT NULL,
      due_date date NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      attachment_url text,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS student_leaves (
      id varchar(36) PRIMARY KEY,
      school_id varchar(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id varchar(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      start_date date NOT NULL,
      end_date date NOT NULL,
      leave_type varchar(30) NOT NULL,
      reason text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'PENDING',
      applied_by text,
      approved_by_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notification_outbox (
      id varchar(36) PRIMARY KEY,
      school_id varchar(36) NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      channel varchar(20) NOT NULL,
      recipient_phone varchar(30),
      recipient_name text,
      message text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'SENT',
      created_at timestamp with time zone NOT NULL DEFAULT now()
    );

    ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
    ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS locked_by_id varchar(36) REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE exam_schedules ADD COLUMN IF NOT EXISTS locked_at timestamp with time zone;

    ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS epf_deduction numeric(12, 2) NOT NULL DEFAULT 0.00;
    ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS esi_deduction numeric(12, 2) NOT NULL DEFAULT 0.00;
    ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS professional_tax numeric(12, 2) NOT NULL DEFAULT 0.00;

    ALTER TABLE notices ADD COLUMN IF NOT EXISTS applicable_class_ids text[] DEFAULT '{}';
  `);

  console.log("Migration executed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

