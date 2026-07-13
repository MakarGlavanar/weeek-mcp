import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerUpdateTask } from "../../src/tools/write/update-task.js";
import { WeeekApiError } from "../../src/errors.js";

type UpdateArgs = {
  task_id: string;
  title?: string;
  description?: string;
  priority?: number;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
};

type Handler = (args: UpdateArgs) => Promise<{
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
    server: server as unknown as Parameters<typeof registerUpdateTask>[0],
    getName: () => capturedName,
    getDescription: () => capturedDescription,
    getHandler: () => {
      if (!capturedHandler) throw new Error("no handler captured");
      return capturedHandler;
    },
  };
}

describe("weeek_update_task tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;

  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers under the weeek_update_task name", () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(async () => ({ task: { id: "t1" } })),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerUpdateTask>[1];
    registerUpdateTask(fake.server, client);
    expect(fake.getName()).toBe("weeek_update_task");
  });

  it("description distinguishes itself from move_task and complete_task", () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerUpdateTask>[1];
    registerUpdateTask(fake.server, client);
    const desc = fake.getDescription();
    expect(desc).toMatch(/weeek_move_task/);
    expect(desc).toMatch(/weeek_complete_task/);
  });

  it("PUTs to /tm/tasks/{id} with only provided camelCase fields", async () => {
    const putFn = vi.fn(async () => ({ task: { id: "t1", title: "Updated" } }));
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: putFn,
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerUpdateTask>[1];
    registerUpdateTask(fake.server, client);

    await fake.getHandler()({
      task_id: "t1",
      title: "Updated",
      assignee_id: "u5",
      due_date: "2026-12-31",
    });

    expect(putFn).toHaveBeenCalledTimes(1);
    const [path, body] = putFn.mock.calls[0]!;
    expect(path).toBe("/tm/tasks/t1");
    // WEEEK uses userId (not assigneeId) and dueDate (a plain Y-m-d date)
    expect(body).toEqual({ title: "Updated", userId: "u5", dueDate: "2026-12-31" });
    expect((body as Record<string, unknown>).description).toBeUndefined();
    expect((body as Record<string, unknown>).priority).toBeUndefined();
  });

  it("returns isError when no editable fields are provided", async () => {
    const putFn = vi.fn();
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: putFn,
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerUpdateTask>[1];
    registerUpdateTask(fake.server, client);

    const res = await fake.getHandler()({ task_id: "t1" });
    expect(res.isError).toBe(true);
    expect(putFn).not.toHaveBeenCalled();
  });

  it("returns isError:true on WeeekApiError, does not throw", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(async () => { throw new WeeekApiError(403, "forbidden"); }),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerUpdateTask>[1];
    registerUpdateTask(fake.server, client);

    const res = await fake.getHandler()({ task_id: "t1", title: "x" });
    expect(res.isError).toBe(true);
  });
});
