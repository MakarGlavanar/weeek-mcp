import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMoveTask } from "../../src/tools/write/move-task.js";
import { WeeekApiError } from "../../src/errors.js";

type MoveArgs = {
  task_id: string;
  board_column_id: string;
  board_id?: string;
  mr_url?: string;
  field_name?: string;
};

type Handler = (args: MoveArgs) => Promise<{
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
    server: server as unknown as Parameters<typeof registerMoveTask>[0],
    getName: () => capturedName,
    getDescription: () => capturedDescription,
    getHandler: () => {
      if (!capturedHandler) throw new Error("no handler captured");
      return capturedHandler;
    },
  };
}

describe("weeek_move_task tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;

  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers under the weeek_move_task name", () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(async () => ({ task: { id: "t1" } })),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);
    expect(fake.getName()).toBe("weeek_move_task");
  });

  it("description explains columns as the status mechanism and references weeek_list_board_columns", () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);
    const desc = fake.getDescription();
    expect(desc).toMatch(/weeek_list_board_columns/);
    expect(desc).toMatch(/weeek_update_task/);
    expect(desc).toMatch(/weeek_complete_task/);
  });

  it("PUTs boardColumnId to /tm/tasks/{id} without boardId when not provided", async () => {
    const putFn = vi.fn(async () => ({ task: { id: "t1", boardColumnId: "col-2" } }));
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: putFn,
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);

    await fake.getHandler()({ task_id: "t1", board_column_id: "col-2" });

    const [path, body] = putFn.mock.calls[0]!;
    expect(path).toBe("/tm/tasks/t1");
    expect(body).toEqual({ boardColumnId: "col-2" });
    expect((body as Record<string, unknown>).boardId).toBeUndefined();
  });

  it("includes boardId in the body when moving across boards", async () => {
    const putFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: putFn,
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);

    await fake.getHandler()({ task_id: "t1", board_column_id: "col-3", board_id: "board-B" });
    const body = putFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.boardColumnId).toBe("col-3");
    expect(body.boardId).toBe("board-B");
  });

  it("returns isError:true on WeeekApiError, does not throw", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(async () => { throw new WeeekApiError(404, "task not found"); }),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);

    const res = await fake.getHandler()({ task_id: "missing", board_column_id: "col-1" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Resource not found");
  });

  it("resolves the МР custom field and includes it in the same PUT when mr_url is provided", async () => {
    const getFn = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") return { task: { id: "t1", projectId: "p1" } };
      if (path === "/tm/projects/p1") {
        return { project: { customFields: [{ id: "field-mr", name: "МР" }] } };
      }
      throw new Error(`unexpected GET ${path}`);
    });
    const putFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = {
      get: getFn,
      post: vi.fn(),
      put: putFn,
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);

    await fake.getHandler()({
      task_id: "t1",
      board_column_id: "col-2",
      mr_url: "https://github.com/acme/repo/pull/9",
    });

    const [path, body] = putFn.mock.calls[0]!;
    expect(path).toBe("/tm/tasks/t1");
    expect(body).toEqual({
      boardColumnId: "col-2",
      customFields: { "field-mr": "https://github.com/acme/repo/pull/9" },
    });
  });

  it("does not touch customFields when mr_url is omitted", async () => {
    const getFn = vi.fn();
    const putFn = vi.fn(async () => ({ task: { id: "t1" } }));
    const client = {
      get: getFn,
      post: vi.fn(),
      put: putFn,
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerMoveTask>[1];
    registerMoveTask(fake.server, client);

    await fake.getHandler()({ task_id: "t1", board_column_id: "col-2" });

    expect(getFn).not.toHaveBeenCalled();
    const body = putFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.customFields).toBeUndefined();
  });
});
