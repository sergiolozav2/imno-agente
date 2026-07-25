import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`display_name\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`tenants\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`slug\` text NOT NULL,
  	\`name\` text NOT NULL,
  	\`country_code\` text DEFAULT 'ES' NOT NULL,
  	\`public_chat_key\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`tenants_slug_idx\` ON \`tenants\` (\`slug\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`tenants_public_chat_key_idx\` ON \`tenants\` (\`public_chat_key\`);`)
  await db.run(sql`CREATE INDEX \`tenants_updated_at_idx\` ON \`tenants\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`tenants_created_at_idx\` ON \`tenants\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`tenants_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`tenants_texts_order_parent\` ON \`tenants_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`memberships\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`user_id\` integer NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`role\` text DEFAULT 'member' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`memberships_user_idx\` ON \`memberships\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`memberships_tenant_idx\` ON \`memberships\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`memberships_updated_at_idx\` ON \`memberships\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`memberships_created_at_idx\` ON \`memberships\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`user_tenant_idx\` ON \`memberships\` (\`user_id\`,\`tenant_id\`);`)
  await db.run(sql`CREATE TABLE \`properties\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`reference\` text NOT NULL,
  	\`title\` text NOT NULL,
  	\`description\` text,
  	\`price\` numeric NOT NULL,
  	\`currency\` text DEFAULT 'EUR' NOT NULL,
  	\`zone\` text NOT NULL,
  	\`pricing_unit\` text DEFAULT 'total' NOT NULL,
  	\`status\` text DEFAULT 'available' NOT NULL,
  	\`main_image_id\` integer,
  	\`model3d_id\` integer,
  	\`bedrooms\` numeric,
  	\`bathrooms\` numeric,
  	\`area_sqm\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`main_image_id\`) REFERENCES \`media_assets\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`model3d_id\`) REFERENCES \`media_assets\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`properties_tenant_idx\` ON \`properties\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`properties_zone_idx\` ON \`properties\` (\`zone\`);`)
  await db.run(sql`CREATE INDEX \`properties_main_image_idx\` ON \`properties\` (\`main_image_id\`);`)
  await db.run(sql`CREATE INDEX \`properties_model3d_idx\` ON \`properties\` (\`model3d_id\`);`)
  await db.run(sql`CREATE INDEX \`properties_updated_at_idx\` ON \`properties\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`properties_created_at_idx\` ON \`properties\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`properties_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`media_assets_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`properties\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_assets_id\`) REFERENCES \`media_assets\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`properties_rels_order_idx\` ON \`properties_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`properties_rels_parent_idx\` ON \`properties_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`properties_rels_path_idx\` ON \`properties_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`properties_rels_media_assets_id_idx\` ON \`properties_rels\` (\`media_assets_id\`);`)
  await db.run(sql`CREATE TABLE \`buyer_clients\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`name\` text NOT NULL,
  	\`normalized_phone\` text,
  	\`email\` text,
  	\`lead_status\` text DEFAULT 'Cold' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`buyer_clients_tenant_idx\` ON \`buyer_clients\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`buyer_clients_normalized_phone_idx\` ON \`buyer_clients\` (\`normalized_phone\`);`)
  await db.run(sql`CREATE INDEX \`buyer_clients_updated_at_idx\` ON \`buyer_clients\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`buyer_clients_created_at_idx\` ON \`buyer_clients\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`tenant_normalizedPhone_idx\` ON \`buyer_clients\` (\`tenant_id\`,\`normalized_phone\`);`)
  await db.run(sql`CREATE TABLE \`media_assets\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`kind\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`media_assets_tenant_idx\` ON \`media_assets\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`media_assets_kind_idx\` ON \`media_assets\` (\`kind\`);`)
  await db.run(sql`CREATE INDEX \`media_assets_updated_at_idx\` ON \`media_assets\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_assets_created_at_idx\` ON \`media_assets\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_assets_filename_idx\` ON \`media_assets\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`zonal_prices\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`zone\` text NOT NULL,
  	\`pricing_unit\` text NOT NULL,
  	\`amount\` numeric NOT NULL,
  	\`currency\` text DEFAULT 'EUR' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`zonal_prices_tenant_idx\` ON \`zonal_prices\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`zonal_prices_zone_idx\` ON \`zonal_prices\` (\`zone\`);`)
  await db.run(sql`CREATE INDEX \`zonal_prices_updated_at_idx\` ON \`zonal_prices\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`zonal_prices_created_at_idx\` ON \`zonal_prices\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`tenant_zone_pricingUnit_idx\` ON \`zonal_prices\` (\`tenant_id\`,\`zone\`,\`pricing_unit\`);`)
  await db.run(sql`CREATE TABLE \`conversations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`client_id\` integer NOT NULL,
  	\`channel\` text NOT NULL,
  	\`channel_thread_id\` text NOT NULL,
  	\`bot_paused\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`client_id\`) REFERENCES \`buyer_clients\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`conversations_tenant_idx\` ON \`conversations\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`conversations_client_idx\` ON \`conversations\` (\`client_id\`);`)
  await db.run(sql`CREATE INDEX \`conversations_channel_thread_id_idx\` ON \`conversations\` (\`channel_thread_id\`);`)
  await db.run(sql`CREATE INDEX \`conversations_updated_at_idx\` ON \`conversations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`conversations_created_at_idx\` ON \`conversations\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`tenant_channel_channelThreadId_idx\` ON \`conversations\` (\`tenant_id\`,\`channel\`,\`channel_thread_id\`);`)
  await db.run(sql`CREATE TABLE \`messages\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`conversation_id\` integer NOT NULL,
  	\`direction\` text NOT NULL,
  	\`author\` text NOT NULL,
  	\`text\` text NOT NULL,
  	\`provider_message_id\` text,
  	\`idempotency_key\` text NOT NULL,
  	\`processing_state\` text,
  	\`delivery_state\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`messages_tenant_idx\` ON \`messages\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`messages_conversation_idx\` ON \`messages\` (\`conversation_id\`);`)
  await db.run(sql`CREATE INDEX \`messages_provider_message_id_idx\` ON \`messages\` (\`provider_message_id\`);`)
  await db.run(sql`CREATE INDEX \`messages_idempotency_key_idx\` ON \`messages\` (\`idempotency_key\`);`)
  await db.run(sql`CREATE INDEX \`messages_updated_at_idx\` ON \`messages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`messages_created_at_idx\` ON \`messages\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`whatsapp_instances\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`instance_name\` text NOT NULL,
  	\`external_instance_id\` text,
  	\`connection_state\` text DEFAULT 'close' NOT NULL,
  	\`webhook_configured\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`whatsapp_instances_tenant_idx\` ON \`whatsapp_instances\` (\`tenant_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`whatsapp_instances_instance_name_idx\` ON \`whatsapp_instances\` (\`instance_name\`);`)
  await db.run(sql`CREATE INDEX \`whatsapp_instances_updated_at_idx\` ON \`whatsapp_instances\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`whatsapp_instances_created_at_idx\` ON \`whatsapp_instances\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`tenant_idx\` ON \`whatsapp_instances\` (\`tenant_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`instanceName_idx\` ON \`whatsapp_instances\` (\`instance_name\`);`)
  await db.run(sql`CREATE TABLE \`webhook_receipts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`instance_id\` integer NOT NULL,
  	\`provider_event_key\` text NOT NULL,
  	\`accepted_event_type\` text NOT NULL,
  	\`received_at\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`instance_id\`) REFERENCES \`whatsapp_instances\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`webhook_receipts_tenant_idx\` ON \`webhook_receipts\` (\`tenant_id\`);`)
  await db.run(sql`CREATE INDEX \`webhook_receipts_instance_idx\` ON \`webhook_receipts\` (\`instance_id\`);`)
  await db.run(sql`CREATE INDEX \`webhook_receipts_provider_event_key_idx\` ON \`webhook_receipts\` (\`provider_event_key\`);`)
  await db.run(sql`CREATE INDEX \`webhook_receipts_updated_at_idx\` ON \`webhook_receipts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`webhook_receipts_created_at_idx\` ON \`webhook_receipts\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`instance_providerEventKey_idx\` ON \`webhook_receipts\` (\`instance_id\`,\`provider_event_key\`);`)
  await db.run(sql`CREATE TABLE \`message_processing\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tenant_id\` integer NOT NULL,
  	\`inbound_message_id\` integer NOT NULL,
  	\`state\` text DEFAULT 'pending' NOT NULL,
  	\`attempts\` numeric DEFAULT 0,
  	\`safe_error\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`inbound_message_id\`) REFERENCES \`messages\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`message_processing_tenant_idx\` ON \`message_processing\` (\`tenant_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`message_processing_inbound_message_idx\` ON \`message_processing\` (\`inbound_message_id\`);`)
  await db.run(sql`CREATE INDEX \`message_processing_updated_at_idx\` ON \`message_processing\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`message_processing_created_at_idx\` ON \`message_processing\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`inboundMessage_idx\` ON \`message_processing\` (\`inbound_message_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`tenants_id\` integer,
  	\`memberships_id\` integer,
  	\`properties_id\` integer,
  	\`buyer_clients_id\` integer,
  	\`media_assets_id\` integer,
  	\`zonal_prices_id\` integer,
  	\`conversations_id\` integer,
  	\`messages_id\` integer,
  	\`whatsapp_instances_id\` integer,
  	\`webhook_receipts_id\` integer,
  	\`message_processing_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`tenants_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`memberships_id\`) REFERENCES \`memberships\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`properties_id\`) REFERENCES \`properties\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`buyer_clients_id\`) REFERENCES \`buyer_clients\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_assets_id\`) REFERENCES \`media_assets\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`zonal_prices_id\`) REFERENCES \`zonal_prices\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`conversations_id\`) REFERENCES \`conversations\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`messages_id\`) REFERENCES \`messages\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`whatsapp_instances_id\`) REFERENCES \`whatsapp_instances\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`webhook_receipts_id\`) REFERENCES \`webhook_receipts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`message_processing_id\`) REFERENCES \`message_processing\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_tenants_id_idx\` ON \`payload_locked_documents_rels\` (\`tenants_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_memberships_id_idx\` ON \`payload_locked_documents_rels\` (\`memberships_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_properties_id_idx\` ON \`payload_locked_documents_rels\` (\`properties_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_buyer_clients_id_idx\` ON \`payload_locked_documents_rels\` (\`buyer_clients_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_assets_id_idx\` ON \`payload_locked_documents_rels\` (\`media_assets_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_zonal_prices_id_idx\` ON \`payload_locked_documents_rels\` (\`zonal_prices_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_conversations_id_idx\` ON \`payload_locked_documents_rels\` (\`conversations_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_messages_id_idx\` ON \`payload_locked_documents_rels\` (\`messages_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_whatsapp_instances_id_idx\` ON \`payload_locked_documents_rels\` (\`whatsapp_instances_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_webhook_receipts_id_idx\` ON \`payload_locked_documents_rels\` (\`webhook_receipts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_message_processing_id_idx\` ON \`payload_locked_documents_rels\` (\`message_processing_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`tenants\`;`)
  await db.run(sql`DROP TABLE \`tenants_texts\`;`)
  await db.run(sql`DROP TABLE \`memberships\`;`)
  await db.run(sql`DROP TABLE \`properties\`;`)
  await db.run(sql`DROP TABLE \`properties_rels\`;`)
  await db.run(sql`DROP TABLE \`buyer_clients\`;`)
  await db.run(sql`DROP TABLE \`media_assets\`;`)
  await db.run(sql`DROP TABLE \`zonal_prices\`;`)
  await db.run(sql`DROP TABLE \`conversations\`;`)
  await db.run(sql`DROP TABLE \`messages\`;`)
  await db.run(sql`DROP TABLE \`whatsapp_instances\`;`)
  await db.run(sql`DROP TABLE \`webhook_receipts\`;`)
  await db.run(sql`DROP TABLE \`message_processing\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
}
