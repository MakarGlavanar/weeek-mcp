/**
 * weeek_create_deal — CRM write
 *
 * Creates a new deal inside a CRM funnel status (stage). WRITE tool: MCP
 * clients may prompt for confirmation. A deal is placed by its status — the
 * funnel is inferred from the status, so only status_id is required (plus a
 * title). Returns the created deal object.
 *
 * Endpoint: POST /crm/statuses/{statusId}/deals
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { toMcpError } from "../../errors.js";
import { logger } from "../../logger.js";
import { jsonContent } from "../read/_helpers.js";

function unwrapDeal(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "deal" in (raw as object)) {
    return (raw as Record<string, unknown>).deal;
  }
  return raw;
}

const inputSchema = {
  status_id: z
    .string()
    .min(1)
    .describe(
      "CRM funnel status (stage) the deal is created in. Required. Obtain from weeek_list_funnel_statuses — the funnel is inferred from the status. Do not guess."
    ),
  title: z
    .string()
    .min(1)
    .describe("Deal title. Required. Shown as the deal's headline in the CRM."),
  amount: z
    .number()
    .describe(
      "Deal amount (money value in the funnel's currency). Optional."
    )
    .optional(),
  description: z
    .string()
    .describe("Deal description / notes. Optional.")
    .optional(),
  win_status: z
    .enum(["won", "lost", "archived"])
    .describe(
      "Win status of the deal. Optional. One of: won, lost, archived. Omit for an active (open) deal."
    )
    .optional(),
  assignee_ids: z
    .array(z.string().min(1))
    .describe(
      "WEEEK user UUIDs responsible for the deal. Optional. Obtain from weeek_list_workspace_members — do not guess IDs."
    )
    .optional(),
  contact_ids: z
    .array(z.string().min(1))
    .describe(
      "CRM contact UUIDs to attach to the deal. Optional."
    )
    .optional(),
  organization_ids: z
    .array(z.string().min(1))
    .describe(
      "CRM organization UUIDs to attach to the deal. Optional."
    )
    .optional(),
  tags: z
    .array(z.number().int())
    .describe("CRM tag IDs (integers) to attach to the deal. Optional.")
    .optional(),
};

export function registerCreateDeal(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_create_deal",
    {
      description:
        "Create a NEW deal in the WEEEK CRM. WRITE OPERATION — the MCP client may prompt for confirmation before this runs. Required: status_id (which funnel stage the deal starts in) and title. Optional: amount, description, win_status (won/lost/archived), assignee_ids, contact_ids, organization_ids, tags. The deal's funnel is inferred from the status. Returns the created deal object. Discover status_id via weeek_list_funnels → weeek_list_funnel_statuses. All ID parameters must come from the corresponding list tools — do not guess IDs.",
      inputSchema,
    },
    async (args: {
      status_id: string;
      title: string;
      amount?: number;
      description?: string;
      win_status?: "won" | "lost" | "archived";
      assignee_ids?: string[];
      contact_ids?: string[];
      organization_ids?: string[];
      tags?: number[];
    }) => {
      try {
        const body: Record<string, unknown> = { title: args.title };
        if (args.amount !== undefined) body.amount = args.amount;
        if (args.description !== undefined) body.description = args.description;
        if (args.win_status !== undefined) body.winStatus = args.win_status;
        if (args.assignee_ids !== undefined) body.assignees = args.assignee_ids;
        if (args.contact_ids !== undefined) body.contacts = args.contact_ids;
        if (args.organization_ids !== undefined)
          body.organizations = args.organization_ids;
        if (args.tags !== undefined) body.tags = args.tags;

        const raw = await client.post<unknown>(
          `/crm/statuses/${encodeURIComponent(args.status_id)}/deals`,
          body
        );
        const deal = unwrapDeal(raw);
        return jsonContent(deal);
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_create_deal");
}
