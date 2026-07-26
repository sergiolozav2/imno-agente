import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`system_whatsapp\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`instance_name\` text,
  	\`external_instance_id\` text,
  	\`api_key\` text,
  	\`connection_state\` text DEFAULT 'close',
  	\`webhook_configured\` integer DEFAULT false,
  	\`connected_number\` text,
  	\`connected_at\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`system_whatsapp_instance_name_idx\` ON \`system_whatsapp\` (\`instance_name\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`system_whatsapp\`;`)
}
