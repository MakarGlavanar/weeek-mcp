import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSetTaskMrLink } from "../../src/tools/write/set-task-mr-link.js";
import { WeeekApiError } from "../../src/errors.js";

type SetMrArgs = {
  task_id: string;
  mr_url: string;
  field_name?: string;
};

type Handler = (args: SetMrArgs) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

function makeFakeServer() {
  let capturedName = "";
  let capturedDescription = "";
  let capturedHandler: Handler | null = null;
  const server = {
    registerTool: vi.fn(
      (name: string, meta: { description: string }, handler: Handler) => {
        capturedName = name;
        capturedDescription = meta.description;
        capturedHandler = handler;
      }
    ),
  };
  return {
    server: server as unknown as Parameters<typeof registerSetTaskMrLink>[0],
    getName: () => capturedName,
    getDescription: () => capturedDescription,
    getHandler: () => {
      if (!capturedHandler) throw new Error("no handler captured");
      return capturedHandler;
    },
  };
}

function makeClient(overrides: {
  get?: ReturnType<typeof vi.fn>;
  put?: ReturnType<typeof vi.fn>;
}) {
  return {
    get: overrides.get ?? vi.fn(),
    post: vi.fn(),
    put: overrides.put ?? vi.fn(),
    patch: vi.fn(),
  } as unknown as Parameters<typeof registerSetTaskMrLink>[1];
}

describe("weeek_set_task_mr_link tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;

  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers under the weeek_set_task_mr_link name", () => {
    registerSetTaskMrLink(fake.server, makeClient({}));
    expect(fake.getName()).toBe("weeek_set_task_mr_link");
  });

  it("description references the МР field and weeek_list_tasks", () => {
    registerSetTaskMrLink(fake.server, makeClient({}));
    const desc = fake.getDescription();
    expect(desc).toMatch(/МР/);
    expect(desc).toMatch(/weeek_list_tasks/);
  });

  it("resolves the field id by name then PUTs customFields keyed by that id", async () => {
    const getFn = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") {
        return { task: { id: "t1", projectId: "p1" } };
      }
      if (path === "/tm/projects/p1") {
        return {
          project: {
            id: "p1",
            customFields: [
              { id: "field-mr-id", name: "МР" },
              { id: "field-other", name: "Some other field" },
            ],
          },
        };
      }
      throw new Error(`unexpected GET ${path}`);
    });
    const putFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = makeClient({ get: getFn, put: putFn });
    registerSetTaskMrLink(fake.server, client);

    await fake.getHandler()({
      task_id: "t1",
      mr_url: "https://github.com/acme/repo/pull/42",
    });

    expect(getFn).toHaveBeenCalledWith("/tm/tasks/t1");
    expect(getFn).toHaveBeenCalledWith("/tm/projects/p1");
    const [path, body] = putFn.mock.calls[0]!;
    expect(path).toBe("/tm/tasks/t1");
    expect(body).toEqual({
      customFields: { "field-mr-id": "https://github.com/acme/repo/pull/42" },
    });
  });

  it("matches field_name case-insensitively when overriding the default name", async () => {
    const getFn = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") return { task: { id: "t1", projectId: "p1" } };
      if (path === "/tm/projects/p1") {
        return {
          project: {
            customFields: [{ id: "custom-1", name: "Merge Request" }],
          },
        };
      }
      throw new Error(`unexpected GET ${path}`);
    });
    const putFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = makeClient({ get: getFn, put: putFn });
    registerSetTaskMrLink(fake.server, client);

    await fake.getHandler()({
      task_id: "t1",
      mr_url: "https://gitlab.com/acme/repo/-/merge_requests/7",
      field_name: "merge request",
    });

    const body = putFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({
      customFields: {
        "custom-1": "https://gitlab.com/acme/repo/-/merge_requests/7",
      },
    });
  });

  it("returns isError:true when the named custom field does not exist, without calling put", async () => {
    const getFn = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") return { task: { id: "t1", projectId: "p1" } };
      if (path === "/tm/projects/p1") {
        return { project: { customFields: [{ id: "x", name: "Other" }] } };
      }
      throw new Error(`unexpected GET ${path}`);
    });
    const putFn = vi.fn();
    const client = makeClient({ get: getFn, put: putFn });
    registerSetTaskMrLink(fake.server, client);

    const res = await fake.getHandler()({
      task_id: "t1",
      mr_url: "https://github.com/acme/repo/pull/1",
    });

    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("МР");
    expect(putFn).not.toHaveBeenCalled();
  });

  it("returns isError:true on WeeekApiError, does not throw", async () => {
    const getFn = vi.fn(async () => {
      throw new WeeekApiError(404, "task not found");
    });
    const client = makeClient({ get: getFn });
    registerSetTaskMrLink(fake.server, client);

    const res = await fake.getHandler()({
      task_id: "missing",
      mr_url: "https://github.com/acme/repo/pull/1",
    });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Resource not found");
  });
});
