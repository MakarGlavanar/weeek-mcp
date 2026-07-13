/**
 * weeek_update_task — TASK-05
 *
 * Updates editable fields on an existing task. Write tool: MCP clients may
 * prompt for confirmation. Only provided fields are sent to WEEEK — omitted
 * fields are left unchanged. Returns the updated task (same shape as weeek_get_task).
 *
 * This is NOT the right tool for:
 *   - Moving between columns → use weeek_move_task
 *   - Marking complete/incomplete → use weeek_complete_task
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
  task_id: z
    .string()
    .min(1)
    .describe(
      "WEEEK task ID to update. Required. Obtain from weeek_list_tasks — do not guess."
    ),
  title: z
    .string()
    .min(1)
    .describe("New task title. Optional. Omit to leave unchanged.")
    .optional(),
  description: z
    .string()
    .describe(
      "New task description. Optional. Omit to leave unchanged. Pass empty string to clear."
    )
    .optional(),
  priority: z
    .number()
    .int()
    .describe(
      "New priority integer (e.g. 0=none, 1=low, 2=medium, 3=high). Optional."
    )
    .optional(),
  assignee_id: z
    .string()
    .min(1)
    .describe(
      "New primary assignee WEEEK user UUID. Optional. Obtain from weeek_list_workspace_members. Omit to leave unchanged."
    )
    .optional(),
  due_date: z
    .string()
    .describe(
      "New deadline / due date. Optional. Omit to leave unchanged. Pass 'YYYY-MM-DD' (e.g. 2026-07-20) or an ISO 8601 timestamp (e.g. 2026-07-20T14:30:00Z). Maps to WEEEK's dueDate / dueDateTime."
    )
    .optional(),
  start_date: z
    .string()
    .describe(
      "New start date. Optional. Omit to leave unchanged. Same format as due_date. Maps to WEEEK's startDate / startDateTime."
    )
    .optional(),
};

export function registerUpdateTask(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_update_task",
    {
      description:
        "Update editable fields of an EXISTING task in WEEEK. WRITE OPERATION — the MCP client may prompt for confirmation. Required: task_id. Optional: title, description, priority, assignee_id, due_date (deadline), start_date — only provided fields are sent, omitted fields remain unchanged. Returns the updated task. Do NOT use this to move tasks between columns (use weeek_move_task) or to mark tasks complete (use weeek_complete_task) — those are separate operations in WEEEK. The task_id must come from weeek_list_tasks.",
      inputSchema,
    },
    async (args: {
      task_id: string;
      title?: string;
      description?: string;
      priority?: number;
      assignee_id?: string;
      due_date?: string;
      start_date?: string;
    }) => {
      try {
        const body: Record<string, unknown> = {};
        if (args.title !== undefined) body.title = args.title;
        if (args.description !== undefined) body.description = args.description;
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

        if (Object.keys(body).length === 0) {
          return toMcpError(
            new Error(
              "weeek_update_task: at least one editable field must be provided (title, description, priority, assignee_id, due_date, or start_date)"
            )
          );
        }

        const raw = await client.put<unknown>(
          `/tm/tasks/${encodeURIComponent(args.task_id)}`,
          body
        );
        const task = unwrapTask(raw);
        return jsonContent(task);
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_update_task");
}
