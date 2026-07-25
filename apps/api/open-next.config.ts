import { defineCloudflareConfig } from '@opennextjs/cloudflare'

/**
 * OpenNext adapter config. Payload's admin panel and REST API are dynamic, and
 * every read already goes to D1, so no incremental cache is configured — adding
 * one would only serve stale CMS data.
 */
export default defineCloudflareConfig()
