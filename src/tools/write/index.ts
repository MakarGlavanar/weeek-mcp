/**
 * Write tool group for WEEEK MCP server.
 *
 * INFRA-06: Write tools live in this group separate from read tools so MCP
 * clients (Claude Desktop, Cursor) can require user confirmation for mutations
 * while auto-approving reads.
 *
 * 5 write tools registered:
 *   Task authoring (Plan 03-01): create_task, update_task
 *   Task lifecycle (Plan 03-02): move_task, complete_task
 *   MR tracking: set_task_mr_link (also wired into move_task/complete_task
 *   via their optional mr_url parameter)
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { logger } from "../../logger.js";
import { registerCreateTask } from "./create-task.js";
import { registerUpdateTask } from "./update-task.js";
import { registerMoveTask } from "./move-task.js";
import { registerCompleteTask } from "./complete-task.js";
import { registerSetTaskMrLink } from "./set-task-mr-link.js";

export function registerWriteTools(
  server: McpServer,
  client: WeeekApiClient
): void {
  // Task authoring (Plan 03-01)
  registerCreateTask(server, client);
  registerUpdateTask(server, client);

  // Task lifecycle (Plan 03-02)
  registerMoveTask(server, client);
  registerCompleteTask(server, client);

  // MR tracking
  registerSetTaskMrLink(server, client);

  logger.info("registerWriteTools: 5 write tools registered");
}
