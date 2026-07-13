import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerListDeals } from "../../src/tools/read/list-deals.js";
import { WeeekApiError } from "../../src/errors.js";

type Args = { status_id: string; limit?: number; offset?: number };
type Handler = (a: Args) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

function makeFakeServer() {
  let name = "";
  let handler: Handler | null = null;
  const server = {
    registerTool: vi.fn((n: string, _m: { description: string }, h: Handler) => {
      name = n;
      handler = h;
    }),
  };
  return {
    server: server as unknown as Parameters<typeof registerListDeals>[0],
    name: () => name,
    handler: () => {
      if (!handler) throw new Error("no handler captured");
      return handler;
    },
  };
}

describe("weeek_list_deals tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;
  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers as weeek_list_deals", () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerListDeals>[1];
    registerListDeals(fake.server, client);
    expect(fake.name()).toBe("weeek_list_deals");
  });

  it("GETs the status-scoped deals path with pagination and shapes deals", async () => {
    const getFn = vi.fn(async () => ({
      success: true,
      deals: [
        {
          id: "d1",
          funnelId: "f1",
          statusId: "s1",
          title: "Big deal",
          description: null,
          amount: 5000,
          winStatus: null,
          assignees: ["u1"],
          organizations: [],
          contacts: ["c1"],
          tags: [7],
          updatedAt: "2026-07-01",
        },
      ],
      hasMoreDeals: true,
    }));
    const client = { get: getFn, post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerListDeals>[1];
    registerListDeals(fake.server, client);

    const res = await fake.handler()({ status_id: "s1", limit: 5, offset: 10 });
    expect(getFn).toHaveBeenCalledWith("/crm/statuses/s1/deals", {
      limit: 5,
      offset: 10,
    });
    const payload = JSON.parse(res.content[0]!.text) as {
      deals: Array<Record<string, unknown>>;
      count: number;
      hasMore: boolean;
    };
    expect(payload.count).toBe(1);
    expect(payload.hasMore).toBe(true);
    expect(payload.deals[0]).toEqual({
      id: "d1",
      funnelId: "f1",
      statusId: "s1",
      title: "Big deal",
      description: null,
      amount: 5000,
      winStatus: null,
      assigneeIds: ["u1"],
      organizationIds: [],
      contactIds: ["c1"],
      tags: ["7"],
      updatedAt: "2026-07-01",
    });
  });

  it("returns isError:true on WeeekApiError", async () => {
    const client = {
      get: vi.fn(async () => { throw new WeeekApiError(403, "forbidden"); }),
      post: vi.fn(), put: vi.fn(), patch: vi.fn(),
    } as unknown as Parameters<typeof registerListDeals>[1];
    registerListDeals(fake.server, client);
    const res = await fake.handler()({ status_id: "s1" });
    expect(res.isError).toBe(true);
  });
});
