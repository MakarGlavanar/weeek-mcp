import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerListFunnelStatuses } from "../../src/tools/read/list-funnel-statuses.js";
import { WeeekApiError } from "../../src/errors.js";

type Args = { funnel_id: string };
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
    server: server as unknown as Parameters<typeof registerListFunnelStatuses>[0],
    name: () => name,
    handler: () => {
      if (!handler) throw new Error("no handler captured");
      return handler;
    },
  };
}

describe("weeek_list_funnel_statuses tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;
  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers as weeek_list_funnel_statuses", () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerListFunnelStatuses>[1];
    registerListFunnelStatuses(fake.server, client);
    expect(fake.name()).toBe("weeek_list_funnel_statuses");
  });

  it("GETs the funnel-scoped statuses path (URL-encoded)", async () => {
    const getFn = vi.fn(async () => ({
      success: true,
      statuses: [{ id: "s1", name: "Lead", dealsCount: 2, dealsAmount: 0 }],
    }));
    const client = { get: getFn, post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerListFunnelStatuses>[1];
    registerListFunnelStatuses(fake.server, client);

    const res = await fake.handler()({ funnel_id: "f 1" });
    expect(getFn).toHaveBeenCalledWith("/crm/funnels/f%201/statuses");
    const payload = JSON.parse(res.content[0]!.text) as {
      statuses: Array<{ id: string; name: string }>;
      count: number;
    };
    expect(payload.count).toBe(1);
    expect(payload.statuses[0]).toEqual({
      id: "s1",
      name: "Lead",
      dealsCount: 2,
      dealsAmount: 0,
    });
  });

  it("returns isError:true on WeeekApiError", async () => {
    const client = {
      get: vi.fn(async () => { throw new WeeekApiError(404, "not found"); }),
      post: vi.fn(), put: vi.fn(), patch: vi.fn(),
    } as unknown as Parameters<typeof registerListFunnelStatuses>[1];
    registerListFunnelStatuses(fake.server, client);
    const res = await fake.handler()({ funnel_id: "f1" });
    expect(res.isError).toBe(true);
  });
});
