import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(
    sql`ALTER TABLE \`properties\` ADD \`video_id\` integer REFERENCES media_assets(id);`,
  )
  await db.run(sql`CREATE INDEX \`properties_video_idx\` ON \`properties\` (\`video_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`properties_video_idx\`;`)
  await db.run(sql`ALTER TABLE \`properties\` DROP COLUMN \`video_id\`;`)
}
