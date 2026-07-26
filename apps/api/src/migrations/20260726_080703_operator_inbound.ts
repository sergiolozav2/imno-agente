import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`whatsapp_phone\` text;`)
  await db.run(sql`CREATE INDEX \`users_whatsapp_phone_idx\` ON \`users\` (\`whatsapp_phone\`);`)
  await db.run(sql`ALTER TABLE \`whatsapp_instances\` ADD \`connected_number\` text;`)
  await db.run(sql`CREATE INDEX \`whatsapp_instances_connected_number_idx\` ON \`whatsapp_instances\` (\`connected_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`idempotencyKey_idx\` ON \`messages\` (\`idempotency_key\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`users_whatsapp_phone_idx\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`whatsapp_phone\`;`)
  await db.run(sql`DROP INDEX \`idempotencyKey_idx\`;`)
  await db.run(sql`DROP INDEX \`whatsapp_instances_connected_number_idx\`;`)
  await db.run(sql`ALTER TABLE \`whatsapp_instances\` DROP COLUMN \`connected_number\`;`)
}
