/**
 * weeek_set_task_mr_link
 *
 * Records a merge/pull request URL on a task's "МР" custom field. Call this
 * right after opening an MR for a task. Write tool: MCP clients may prompt
 * for confirmation.
 *
 * DISTINCT from weeek_move_task / weeek_complete_task: those also accept an
 * optional mr_url so the link can be recorded in the same call as a status
 * change — use this tool when there's no status change happening, e.g.
 * right after opening the MR, before the task moves.
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
      "WEEEK task ID to update. Required. Obtain from weeek_list_tasks — do not guess."
    ),
  mr_url: z
    .string()
    .min(1)
    .describe("Merge/pull request URL to store on the task. Required."),
  field_name: z
    .string()
    .min(1)
    .describe(
      `Name of the WEEEK custom field to write mr_url into. Optional — defaults to "${DEFAULT_MR_FIELD_NAME}". Must match an existing custom field on the task's project exactly (case-insensitive). This tool does not create the field.`
    )
    .optional(),
};

export function registerSetTaskMrLink(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_set_task_mr_link",
    {
      description: `Attach a merge/pull request URL to a WEEEK task by writing it into the "${DEFAULT_MR_FIELD_NAME}" custom field. WRITE OPERATION — the MCP client may prompt for confirmation. Required: task_id, mr_url. Optional: field_name (defaults to "${DEFAULT_MR_FIELD_NAME}"). Call this right after opening an MR/PR for a task. The custom field must already exist on the task's project in WEEEK — this tool only writes to it, it does not create custom fields. To record the MR link at the same time as a status change, pass mr_url to weeek_move_task or weeek_complete_task instead. task_id must come from weeek_list_tasks.`,
      inputSchema,
    },
    async (args: { task_id: string; mr_url: string; field_name?: string }) => {
      try {
        const fieldName = args.field_name ?? DEFAULT_MR_FIELD_NAME;
        const fieldId = await resolveTaskCustomFieldId(
          client,
          args.task_id,
          fieldName
        );

        const raw = await client.put<unknown>(
          `/tm/tasks/${encodeURIComponent(args.task_id)}`,
          { customFields: { [fieldId]: args.mr_url } }
        );
        const task = unwrapTask(raw);
        return jsonContent(task);
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_set_task_mr_link");
}
