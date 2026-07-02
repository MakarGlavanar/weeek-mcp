/**
 * weeek_complete_task — TASK-07
 *
 * Marks a task complete or reopens it. Distinct from move_task (which changes
 * column) and update_task (which edits fields). Default is to mark complete;
 * pass completed=false to reopen.
 *
 * Also optionally records an MR link on the same call (see mr_url) so an
 * agent completing a task can attach the merge request in one write instead
 * of two.
 *
 * Write tool: MCP clients may prompt for confirmation.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { toMcpError } from "../../errors.js";
import { logger } from "../../logger.js";
import { jsonContent } from "../read/_helpers.js";
import { DEFAULT_MR_FIELD_NAME, resolveTaskCustomFieldId } from "./_custom-fields.js";

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
      "WEEEK task ID to complete or reopen. Required. Obtain from weeek_list_tasks."
    ),
  completed: z
    .boolean()
    .default(true)
    .describe(
      "Whether to mark the task as completed. Default: true (mark done). Pass false to REOPEN a previously-completed task."
    )
    .optional(),
  mr_url: z
    .string()
    .min(1)
    .describe(
      `Merge/pull request URL to record on the task's "${DEFAULT_MR_FIELD_NAME}" custom field in the same call as completion. Optional. Omit to leave the field unchanged. Use weeek_set_task_mr_link instead if there is no completion change happening.`
    )
    .optional(),
  field_name: z
    .string()
    .min(1)
    .describe(
      `Name of the custom field to write mr_url into. Optional — defaults to "${DEFAULT_MR_FIELD_NAME}". Only used when mr_url is provided.`
    )
    .optional(),
};

export function registerCompleteTask(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_complete_task",
    {
      description: `Mark a WEEEK task as COMPLETE or REOPEN a completed task. WRITE OPERATION — the MCP client may prompt for confirmation. Required: task_id. Optional: completed (default true), mr_url (records a merge/pull request link on the "${DEFAULT_MR_FIELD_NAME}" custom field in the same call), field_name (only with mr_url). Pass completed=false to reopen. Returns the updated task. DISTINCT from weeek_move_task: completing a task is a done/undone toggle, independent of which column it lives in. DISTINCT from weeek_update_task: completion is not an editable field — it has its own dedicated semantics in WEEEK. Use this tool when the user says 'mark done', 'complete', 'finish', 'close', 'reopen', or 'uncomplete'. task_id must come from weeek_list_tasks.`,
      inputSchema,
    },
    async (args: {
      task_id: string;
      completed?: boolean;
      mr_url?: string;
      field_name?: string;
    }) => {
      try {
        const completed = args.completed ?? true;
        const body: Record<string, unknown> = { isCompleted: completed };

        if (args.mr_url !== undefined) {
          const fieldName = args.field_name ?? DEFAULT_MR_FIELD_NAME;
          const fieldId = await resolveTaskCustomFieldId(
            client,
            args.task_id,
            fieldName
          );
          body.customFields = { [fieldId]: args.mr_url };
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
  logger.info("Registered tool: weeek_complete_task");
}
