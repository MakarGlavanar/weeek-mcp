import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerCreateTask } from "../../src/tools/write/create-task.js";
import { WeeekApiError } from "../../src/errors.js";

type CreateArgs = {
  title: string;
  project_id: string;
  description?: string;
  board_id?: string;
  board_column_id?: string;
  priority?: number;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
};

type Handler = (args: CreateArgs) => Promise<{
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
    server: server as unknown as Parameters<typeof registerCreateTask>[0],
    name: () => capturedName,
    description: () => capturedDescription,
    handler: () => {
      if (!capturedHandler) throw new Error("no handler captured");
      return capturedHandler;
    },
  };
}

describe("weeek_create_task tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;

  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers as weeek_create_task", () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ task: { id: "t1", title: "hello" } })),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);
    expect(fake.name()).toBe("weeek_create_task");
  });

  it("description distinguishes itself from update/move/complete", () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);
    const desc = fake.description();
    expect(desc).toMatch(/create/i);
    expect(desc).toMatch(/weeek_update_task/);
  });

  it("POSTs to /tm/tasks with camelCase body fields", async () => {
    const postFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = {
      get: vi.fn(),
      post: postFn,
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);

    await fake.handler()({
      title: "Ship it",
      project_id: "p1",
      description: "body text",
      board_id: "b1",
      board_column_id: "col1",
      priority: 3,
      assignee_id: "u1",
      due_date: "2026-05-01",
    });

    expect(postFn).toHaveBeenCalledTimes(1);
    const [path, body] = postFn.mock.calls[0]!;
    expect(path).toBe("/tm/tasks");
    // WEEEK uses userId (not assigneeId) and dueDate (a plain Y-m-d date)
    expect(body).toEqual({
      title: "Ship it",
      projectId: "p1",
      description: "body text",
      boardId: "b1",
      boardColumnId: "col1",
      priority: 3,
      userId: "u1",
      dueDate: "2026-05-01",
    });
  });

  it("maps a datetime due_date to dueDateTime (UTC Z format)", async () => {
    const postFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = {
      get: vi.fn(),
      post: postFn,
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);

    await fake.handler()({
      title: "Timed",
      project_id: "p1",
      due_date: "2026-05-01T14:30:00Z",
      start_date: "2026-04-30",
    });
    const body = postFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.dueDateTime).toBe("2026-05-01T14:30:00Z");
    expect("dueDate" in body).toBe(false);
    // start_date as a plain date maps to startDate
    expect(body.startDate).toBe("2026-04-30");
  });

  it("omits optional fields when not provided", async () => {
    const postFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = {
      get: vi.fn(),
      post: postFn,
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);

    await fake.handler()({ title: "minimal", project_id: "p1" });
    const body = postFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({ title: "minimal", projectId: "p1" });
    expect("description" in body).toBe(false);
    expect("boardId" in body).toBe(false);
    expect("dueDate" in body).toBe(false);
    expect("dueDateTime" in body).toBe(false);
    expect("userId" in body).toBe(false);
  });

  it("unwraps the {task: ...} envelope in the response", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ task: { id: "t1", title: "hello" } })),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);

    const res = await fake.handler()({ title: "hello", project_id: "p1" });
    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content[0]!.text) as { id: string; title: string };
    expect(payload).toEqual({ id: "t1", title: "hello" });
  });

  it("handles raw (non-enveloped) response", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => ({ id: "t2", title: "raw" })),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);
    const res = await fake.handler()({ title: "raw", project_id: "p1" });
    const payload = JSON.parse(res.content[0]!.text) as { id: string };
    expect(payload.id).toBe("t2");
  });

  it("returns isError:true on 401 WeeekApiError", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(async () => {
        throw new WeeekApiError(401, "unauthorized");
      }),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerCreateTask>[1];
    registerCreateTask(fake.server, client);

    const res = await fake.handler()({ title: "x", project_id: "p1" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Invalid WEEEK_API_TOKEN");
  });
});
