import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_assistant_name\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_business_name\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_language\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_tone\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_greeting\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_business_notes\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_handoff_line\` text;`)
  await db.run(sql`ALTER TABLE \`tenants\` ADD \`agent_max_reply_characters\` numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_assistant_name\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_business_name\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_language\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_tone\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_greeting\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_business_notes\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_handoff_line\`;`)
  await db.run(sql`ALTER TABLE \`tenants\` DROP COLUMN \`agent_max_reply_characters\`;`)
}
