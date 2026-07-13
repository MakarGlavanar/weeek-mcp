/**
 * weeek_list_deals — CRM read
 *
 * Lists deals within one CRM funnel status (stage). Deals in WEEEK are scoped
 * to a status, so this reads a single stage at a time — iterate over statuses
 * (from weeek_list_funnel_statuses) to cover a whole funnel. Pagination is
 * enforced (default 20, max 50) to stay under the MCP response cap.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { WeeekApiClient } from "../../client/weeek-api-client.js";
import { toMcpError } from "../../errors.js";
import { logger } from "../../logger.js";
import { extractArray, jsonContent, listParamsSchema } from "./_helpers.js";

interface RawDeal {
  id?: string;
  funnelId?: string;
  statusId?: string;
  title?: string;
  description?: string | null;
  amount?: number | null;
  winStatus?: string | null;
  assignees?: Array<string>;
  organizations?: Array<string>;
  contacts?: Array<string>;
  tags?: Array<string | number>;
  updatedAt?: string | null;
  [k: string]: unknown;
}

interface ShapedDeal {
  id: string;
  funnelId: string | null;
  statusId: string | null;
  title: string;
  description: string | null;
  amount: number | null;
  winStatus: string | null;
  assigneeIds: string[];
  organizationIds: string[];
  contactIds: string[];
  tags: string[];
  updatedAt: string | null;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function shapeDeal(raw: RawDeal): ShapedDeal {
  return {
    id: String(raw.id ?? ""),
    funnelId: raw.funnelId == null ? null : String(raw.funnelId),
    statusId: raw.statusId == null ? null : String(raw.statusId),
    title: String(raw.title ?? ""),
    description: raw.description ?? null,
    amount: typeof raw.amount === "number" ? raw.amount : null,
    winStatus: raw.winStatus ?? null,
    assigneeIds: strArray(raw.assignees),
    organizationIds: strArray(raw.organizations),
    contactIds: strArray(raw.contacts),
    tags: strArray(raw.tags),
    updatedAt: raw.updatedAt ?? null,
  };
}

const inputSchema = {
  status_id: z
    .string()
    .min(1)
    .describe(
      "CRM funnel status (stage) ID whose deals to list. Obtain from weeek_list_funnel_statuses. Required — deals are scoped to a status."
    ),
  ...listParamsSchema,
};

export function registerListDeals(
  server: McpServer,
  client: WeeekApiClient
): void {
  server.registerTool(
    "weeek_list_deals",
    {
      description:
        "List CRM deals within one funnel status (stage). Deals are scoped to a status in WEEEK, so this reads a single stage — to scan a whole funnel, call this once per status from weeek_list_funnel_statuses. Pagination ENFORCED: default 20, max 50; call again with a higher offset if hasMore is true. Returns shaped deals with {id, funnelId, statusId, title, amount, winStatus, assigneeIds, contactIds, organizationIds, tags}. The status_id must come from weeek_list_funnel_statuses — do not guess.",
      inputSchema,
    },
    async (args: { status_id: string; limit?: number; offset?: number }) => {
      try {
        const raw = await client.get<unknown>(
          `/crm/statuses/${encodeURIComponent(args.status_id)}/deals`,
          { limit: args.limit, offset: args.offset }
        );
        const deals = extractArray<RawDeal>(raw, "deals").map(shapeDeal);
        const hasMore =
          raw && typeof raw === "object" && "hasMoreDeals" in (raw as object)
            ? Boolean((raw as Record<string, unknown>).hasMoreDeals)
            : deals.length === (args.limit ?? 20);
        return jsonContent({ deals, count: deals.length, hasMore });
      } catch (err) {
        return toMcpError(err);
      }
    }
  );
  logger.info("Registered tool: weeek_list_deals");
}
