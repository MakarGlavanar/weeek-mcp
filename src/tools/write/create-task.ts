/**
 * weeek_create_task — TASK-04
 *
 * Creates a new task in WEEEK. Write tool: MCP clients may prompt the user for
 * confirmation before this runs. Requires title + projectId; all other fields
 * optional. Returns the shaped task object (same shape as weeek_get_task).
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { toMcpError } from "../../errors.js";
import { logger } from "../../logger.js";
import { jsonContent } from "../read/_helpers.js";
import { splitWeeekDate } from "./_dates.js";

function unwrapTask(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "task" in (raw as object)) {
    return (raw as Record<string, unknown>).task;
  }
  return raw;
}

const inputSchema = {
  title: z
    .string()
    .min(1)
    .describe("Task title. Required. Shown as the task's headline in WEEEK."),
  project_id: z
    .string()
    .min(1)
    .describe(
      "WEEEK project ID. Required. Obtain from weeek_list_projects — do not guess."
    ),
  description: z
    .string()
    .describe(
      "Task description / body. Optional. Plain text; WEEEK may render basic formatting."
    )
    .optional(),
  board_id: z
    .string()
    .min(1)
    .describe(
      "Board to place the task on. Optional. Obtain from weeek_list_boards. If omitted, WEEEK assigns to the project's default board."
    )
    .optional(),
  board_column_id: z
    .string()
    .min(1)
    .describe(
      "Column (status) to place the task in. Optional. Obtain from weeek_list_board_columns. Determines the task's initial status."
    )
    .optional(),
  priority: z
    .number()
    .int()
    .describe(
      "Task priority as an integer (WEEEK uses numeric priority levels, e.g. 0=none, 1=low, 2=medium, 3=high). Optional."
    )
    .optional(),
  assignee_id: z
    .string()
    .min(1)
    .describe(
      "WEEEK user UUID to assign as primary. Optional. Obtain from weeek_list_workspace_members — do not guess IDs."
    )
    .optional(),
  due_date: z
    .string()
    .describe(
      "Deadline / due date. Optional. Pass a calendar date 'YYYY-MM-DD' (e.g. 2026-07-20) OR an ISO 8601 timestamp for a time-specific due (e.g. 2026-07-20T14:30:00Z). A naive datetime is treated as UTC. Maps to WEEEK's dueDate / dueDateTime."
    )
    .optional(),
  start_date: z
    .string()
    .describe(
      "Start date. Optional. Same format as due_date ('YYYY-MM-DD' or ISO 8601 timestamp). Maps to WEEEK's startDate / startDateTime."
    )
    .optional(),
};

export function registerCreateTask(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_create_task",
    {
      description:
        "Create a NEW task in WEEEK. WRITE OPERATION — the MCP client may prompt for user confirmation before this runs. Required: title and project_id. Optional: description, board_id, board_column_id (status), priority, assignee_id, due_date (deadline), start_date. Returns the created task object in the same shape as weeek_get_task. Use this ONLY when creating a brand-new task; to change an existing task's fields use weeek_update_task, to move it to a different column use weeek_move_task, to mark it done use weeek_complete_task. All *_id parameters must come from the corresponding list tools — do not guess IDs.",
      inputSchema,
    },
    async (args: {
      title: string;
      project_id: string;
      description?: string;
      board_id?: string;
      board_column_id?: string;
      priority?: number;
      assignee_id?: string;
      due_date?: string;
      start_date?: string;
    }) => {
      try {
        const body: Record<string, unknown> = {
          title: args.title,
          projectId: args.project_id,
        };
        if (args.description !== undefined) body.description = args.description;
        if (args.board_id !== undefined) body.boardId = args.board_id;
        if (args.board_column_id !== undefined)
          body.boardColumnId = args.board_column_id;
        if (args.priority !== undefined) body.priority = args.priority;
        if (args.assignee_id !== undefined) body.userId = args.assignee_id;
        if (args.due_date !== undefined) {
          const { date, dateTime } = splitWeeekDate(args.due_date);
          if (date !== undefined) body.dueDate = date;
          if (dateTime !== undefined) body.dueDateTime = dateTime;
        }
        if (args.start_date !== undefined) {
          const { date, dateTime } = splitWeeekDate(args.start_date);
          if (date !== undefined) body.startDate = date;
          if (dateTime !== undefined) body.startDateTime = dateTime;
        }

        const raw = await client.post<unknown>("/tm/tasks", body);
        const task = unwrapTask(raw);
        return jsonContent(task);
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_create_task");
}
