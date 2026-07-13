import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateDeal } from "../../src/tools/write/create-deal.js";
import { WeeekApiError } from "../../src/errors.js";

type Args = {
  status_id: string;
  title: string;
  amount?: number;
  description?: string;
  win_status?: "won" | "lost" | "archived";
  assignee_ids?: string[];
  contact_ids?: string[];
  organization_ids?: string[];
  tags?: number[];
};
type Handler = (a: Args) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

function makeFakeServer() {
  let name = "";
  let description = "";
  let handler: Handler | null = null;
  const server = {
    registerTool: vi.fn((n: string, meta: { description: string }, h: Handler) => {
      name = n;
      description = meta.description;
      handler = h;
    }),
  };
  return {
    server: server as unknown as Parameters<typeof registerCreateDeal>[0],
    name: () => name,
    description: () => description,
    handler: () => {
      if (!handler) throw new Error("no handler captured");
      return handler;
    },
  };
}

describe("weeek_create_deal tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;
  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers as weeek_create_deal", () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerCreateDeal>[1];
    registerCreateDeal(fake.server, client);
    expect(fake.name()).toBe("weeek_create_deal");
  });

  it("POSTs to the status-scoped deals path with camelCase body", async () => {
    const postFn = vi.fn(async () => ({ deal: { id: "d1", title: "New" } }));
    const client = { get: vi.fn(), post: postFn, put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerCreateDeal>[1];
    registerCreateDeal(fake.server, client);

    await fake.handler()({
      status_id: "s1",
      title: "New",
      amount: 1000,
      description: "notes",
      win_status: "won",
      assignee_ids: ["u1"],
      contact_ids: ["c1"],
      organization_ids: ["o1"],
      tags: [7],
    });

    expect(postFn).toHaveBeenCalledTimes(1);
    const [path, body] = postFn.mock.calls[0]!;
    expect(path).toBe("/crm/statuses/s1/deals");
    expect(body).toEqual({
      title: "New",
      amount: 1000,
      description: "notes",
      winStatus: "won",
      assignees: ["u1"],
      contacts: ["c1"],
      organizations: ["o1"],
      tags: [7],
    });
  });

  it("omits optional fields when not provided", async () => {
    const postFn = vi.fn(async () => ({ deal: { id: "d1" } }));
    const client = { get: vi.fn(), post: postFn, put: vi.fn(), patch: vi.fn() } as unknown as Parameters<typeof registerCreateDeal>[1];
    registerCreateDeal(fake.server, client);

    await fake.handler()({ status_id: "s1", title: "Minimal" });
    const body = postFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({ title: "Minimal" });
  });

  it("unwraps the {deal: ...} envelope in the response", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ deal: { id: "d1", title: "New" } })),
      put: vi.fn(), patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateDeal>[1];
    registerCreateDeal(fake.server, client);
    const res = await fake.handler()({ status_id: "s1", title: "New" });
    const payload = JSON.parse(res.content[0]!.text) as { id: string; title: string };
    expect(payload).toEqual({ id: "d1", title: "New" });
  });

  it("returns isError:true on WeeekApiError", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => { throw new WeeekApiError(422, "invalid"); }),
      put: vi.fn(), patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateDeal>[1];
    registerCreateDeal(fake.server, client);
    const res = await fake.handler()({ status_id: "s1", title: "x" });
    expect(res.isError).toBe(true);
  });
});
