#!/usr/bin/env node
/**
 * Entry point for the WEEEK MCP server.
 *
 * Startup sequence:
 *   1. Load config (validates WEEEK_API_TOKEN — exits with clear error if missing)
 *   2. Instantiate WeeekApiClient with the token and base URL
 *   3. Create McpServer with package name + version
 *   4. Register read tool group (Phase 1: empty)
 *   5. Register write tool group (Phase 1: empty)
 *   6. Connect StdioServerTransport — blocks on stdin until the client disconnects
 *
 * CRITICAL: All diagnostic output goes to stderr via `logger`. Never use
 * console.log anywhere in this file — stdout is the JSON-RPC channel.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig, MissingConfigError } from "./config.js";
import { WeeekApiClient } from "./client/weeek-api-client.js";
import { registerReadTools } from "./tools/read/index.js";
import { registerWriteTools } from "./tools/write/index.js";
import { logger } from "./logger.js";

const SERVER_NAME = "weeek-mcp-server";
const SERVER_VERSION = "0.2.0";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof MissingConfigError) {
      // Write the actionable message to stderr and exit cleanly (non-zero).
      // Never write to stdout — stdio transport would corrupt the JSON-RPC channel.
      logger.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const client = new WeeekApiClient(config.token, {
    baseUrl: config.baseUrl,
    timeoutMs: config.requestTimeoutMs,
  });

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerReadTools(server, client);
  registerWriteTools(server, client);

  const transport = new StdioServerTransport();

  // Log before connect — once connected, the process blocks on stdin.
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} starting on stdio transport`);

  await server.connect(transport);
}

// Top-level unhandled error guard: log to stderr and exit non-zero.
// Without this, an uncaught rejection would crash with a stack trace to stderr
// (which is acceptable but less friendly than a tagged log line).
main().catch((err: unknown) => {
  if (err instanceof Error) {
    logger.error(`Fatal startup error: ${err.message}`, { stack: err.stack });
  } else {
    logger.error(`Fatal startup error: ${String(err)}`);
  }
  process.exit(1);
});
