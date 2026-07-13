import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerListFunnels } from "../../src/tools/read/list-funnels.js";
import { WeeekApiError } from "../../src/errors.js";

type Handler = () => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

function makeFakeServer() {
  let name = "";
  let description = "";
  let handler: Handler | null = null;
  const server = {
    registerTool: vi.fn(
      (n: string, meta: { description: string }, h: Handler) => {
        name = n;
        description = meta.description;
        handler = h;
      }
    ),
  };
  return {
    server: server as unknown as Parameters<typeof registerListFunnels>[0],
    name: () => name,
    description: () => description,
    handler: () => {
      if (!handler) throw new Error("no handler captured");
      return handler;
    },
  };
}

describe("weeek_list_funnels tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;
  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers as weeek_list_funnels", () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerListFunnels>[1];
    registerListFunnels(fake.server, client);
    expect(fake.name()).toBe("weeek_list_funnels");
  });

  it("GETs /crm/funnels and shapes the funnels array", async () => {
    const getFn = vi.fn(async () => ({
      success: true,
      funnels: [
        { id: "f1", name: "Pipeline", currencyId: 1, dealsCount: 3, dealsAmount: 100, isPrivate: false },
      ],
    }));
    const client = { get: getFn, post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerListFunnels>[1];
    registerListFunnels(fake.server, client);

    const res = await fake.handler()();
    expect(getFn).toHaveBeenCalledWith("/crm/funnels");
    const payload = JSON.parse(res.content[0]!.text) as {
      funnels: Array<{ id: string; name: string; currencyId: string }>;
      count: number;
    };
    expect(payload.count).toBe(1);
    expect(payload.funnels[0]).toEqual({
      id: "f1",
      name: "Pipeline",
      currencyId: "1",
      dealsCount: 3,
      dealsAmount: 100,
      isPrivate: false,
    });
  });

  it("returns isError:true on WeeekApiError", async () => {
    const client = {
      get: vi.fn(async () => { throw new WeeekApiError(401, "unauthorized"); }),
      post: vi.fn(), put: vi.fn(), patch: vi.fn(),
    } as unknown as Parameters<typeof registerListFunnels>[1];
    registerListFunnels(fake.server, client);
    const res = await fake.handler()();
    expect(res.isError).toBe(true);
  });
});
