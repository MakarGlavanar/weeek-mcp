/**
 * Read tool group for WEEEK MCP server.
 *
 * INFRA-06: Read tools live in this group separate from write tools so MCP
 * clients (Claude Desktop, Cursor) can configure auto-approve per group.
 *
 * 10 read tools registered:
 *   Navigation: list_projects, get_project, list_boards, list_board_columns
 *   Tasks: list_tasks, get_task
 *   Workspace: list_workspace_members
 *   CRM: list_funnels, list_funnel_statuses, list_deals
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { logger } from "../../logger.js";
import { registerListProjects } from "./list-projects.js";
import { registerGetProject } from "./get-project.js";
import { registerListBoards } from "./list-boards.js";
import { registerListBoardColumns } from "./list-board-columns.js";
import { registerListTasks } from "./list-tasks.js";
import { registerGetTask } from "./get-task.js";
import { registerListWorkspaceMembers } from "./list-workspace-members.js";
import { registerListFunnels } from "./list-funnels.js";
import { registerListFunnelStatuses } from "./list-funnel-statuses.js";
import { registerListDeals } from "./list-deals.js";

export function registerReadTools(
  server: McpServer,
  client: WeeekApiClient
): void {
  // Navigation
  registerListProjects(server, client);
  registerGetProject(server, client);
  registerListBoards(server, client);
  registerListBoardColumns(server, client);

  // Tasks
  registerListTasks(server, client);
  registerGetTask(server, client);

  // Workspace
  registerListWorkspaceMembers(server, client);

  // CRM
  registerListFunnels(server, client);
  registerListFunnelStatuses(server, client);
  registerListDeals(server, client);

  logger.info("registerReadTools: 10 read tools registered");
}
