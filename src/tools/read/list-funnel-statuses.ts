/**
 * weeek_list_funnel_statuses — CRM navigation
 *
 * Lists the statuses (stages) of one CRM funnel. A deal always sits in exactly
 * one funnel status, so the statusId returned here is what weeek_create_deal
 * and weeek_list_deals require. Statuses come back in pipeline order.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { toMcpError } from "../../errors.js";
import { logger } from "../../logger.js";
import { extractArray, jsonContent } from "./_helpers.js";

interface RawStatus {
  id?: string;
  name?: string;
  dealsCount?: number;
  dealsAmount?: number;
  [k: string]: unknown;
}

interface ShapedStatus {
  id: string;
  name: string;
  dealsCount: number | null;
  dealsAmount: number | null;
}

function shapeStatus(raw: RawStatus): ShapedStatus {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    dealsCount: typeof raw.dealsCount === "number" ? raw.dealsCount : null,
    dealsAmount: typeof raw.dealsAmount === "number" ? raw.dealsAmount : null,
  };
}

const inputSchema = {
  funnel_id: z
    .string()
    .min(1)
    .describe(
      "CRM funnel ID whose statuses (stages) to list. Obtain from weeek_list_funnels. Required."
    ),
};

export function registerListFunnelStatuses(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_list_funnel_statuses",
    {
      description:
        "List the statuses (stages) of one CRM funnel, in pipeline order. Use this AFTER weeek_list_funnels. A deal always sits in exactly one status, so the status id returned here is what you pass as status_id to weeek_create_deal (to place a new deal) and to weeek_list_deals (to read deals in that stage). Returns array of {id, name, dealsCount, dealsAmount}. The funnel_id must come from weeek_list_funnels — do not guess.",
      inputSchema,
    },
    async (args: { funnel_id: string }) => {
      try {
        const raw = await client.get<unknown>(
          `/crm/funnels/${encodeURIComponent(args.funnel_id)}/statuses`
        );
        const statuses = extractArray<RawStatus>(raw, "statuses").map(
          shapeStatus
        );
        return jsonContent({ statuses, count: statuses.length });
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_list_funnel_statuses");
}
