/**
 * weeek_list_funnels — CRM navigation
 *
 * Lists the CRM sales funnels (pipelines) in the workspace. A funnel is the
 * top-level container for deals; each funnel has ordered statuses (stages).
 * This is the entry point for CRM work: obtain a funnelId here, then call
 * weeek_list_funnel_statuses to get the statusId a deal lives in.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { toMcpError } from "../../errors.js";
import { logger } from "../../logger.js";
import { extractArray, jsonContent } from "./_helpers.js";

interface RawFunnel {
  id?: string;
  name?: string;
  currencyId?: number | string | null;
  dealsCount?: number;
  dealsAmount?: number;
  isPrivate?: boolean;
  [k: string]: unknown;
}

interface ShapedFunnel {
  id: string;
  name: string;
  currencyId: string | null;
  dealsCount: number | null;
  dealsAmount: number | null;
  isPrivate: boolean;
}

function shapeFunnel(raw: RawFunnel): ShapedFunnel {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    currencyId: raw.currencyId == null ? null : String(raw.currencyId),
    dealsCount: typeof raw.dealsCount === "number" ? raw.dealsCount : null,
    dealsAmount: typeof raw.dealsAmount === "number" ? raw.dealsAmount : null,
    isPrivate: Boolean(raw.isPrivate),
  };
}

export function registerListFunnels(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_list_funnels",
    {
      description:
        "List CRM sales funnels (pipelines) in the WEEEK workspace. START HERE for any CRM/deal work. A funnel is the top-level container for deals; each has ordered statuses (stages). Returns array of {id, name, currencyId, dealsCount, dealsAmount, isPrivate}. Next step: pass a funnel id to weeek_list_funnel_statuses to get the status (stage) a deal should live in, then create a deal with weeek_create_deal.",
      inputSchema: {},
    },
    async () => {
      try {
        const raw = await client.get<unknown>("/crm/funnels");
        const funnels = extractArray<RawFunnel>(raw, "funnels").map(shapeFunnel);
        return jsonContent({ funnels, count: funnels.length });
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_list_funnels");
}
