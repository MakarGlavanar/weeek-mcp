import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerListTasks } from "../../src/tools/read/list-tasks.js";
import { WeeekApiError } from "../../src/errors.js";

type Handler = (args: {
  project_id?: string;
  board_id?: string;
  column_id?: string;
  assignee_id?: string;
  is_completed?: boolean;
  limit?: number;
  offset?: number;
}) => Promise<{
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
    server: server as unknown as Parameters<typeof registerListTasks>[0],
    getName: () => capturedName,
    getDescription: () => capturedDescription,
    getHandler: () => {
      if (!capturedHandler) throw new Error("no handler captured");
      return capturedHandler;
    },
  };
}

function makeFakeClient(getImpl: (path: string, query?: unknown) => Promise<unknown>) {
  return {
    get: vi.fn(getImpl),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  } as unknown as Parameters<typeof registerListTasks>[1];
}

describe("weeek_list_tasks tool", () => {
  let fake: ReturnType<typeof makeFakeServer>;

  beforeEach(() => {
    fake = makeFakeServer();
  });

  it("registers under the weeek_list_tasks name", () => {
    const client = makeFakeClient(async () => ({ tasks: [] }));
    registerListTasks(fake.server, client);
    expect(fake.getName()).toBe("weeek_list_tasks");
  });

  it("description mentions pagination enforcement and sibling tools", () => {
    const client = makeFakeClient(async () => ({ tasks: [] }));
    registerListTasks(fake.server, client);
    const desc = fake.getDescription();
    expect(desc).toMatch(/weeek_get_task/);
    expect(desc).toMatch(/pagination/i);
  });

  it("shapes raw tasks using userId and assignees array per WEEEK schema", async () => {
    const client = makeFakeClient(async () => ({
      tasks: [
        {
          id: 4017,
          title: "Alpha",
          type: "action",
          projectId: 76,
          boardId: 181,
          boardColumnId: 574,
          userId: "a0f583cb-b8a9-4408-a822-c05213b3fb91",
          assignees: ["a0f583cb-b8a9-4408-a822-c05213b3fb91"],
          authorId: "a10dd031-807b-49c0-a595-fa7db986b129",
          isCompleted: false,
          priority: 2,
          dateEnd: "2026-05-01",
          updatedAt: "2026-04-08T07:32:46Z",
          tags: [39, 42],
        },
        {
          id: "t2",
          title: "Beta",
          isCompleted: true,
          // No userId — falls back to first assignee
          assignees: ["u2", "u3"],
        },
      ],
    }));
    registerListTasks(fake.server, client);

    const res = await fake.getHandler()({});
    expect(res.isError).toBeUndefined();

    const payload = JSON.parse(res.content[0]!.text) as {
      tasks: Array<{
        id: string;
        title: string;
        type: string | null;
        projectId: string | null;
        boardId: string | null;
        boardColumnId: string | null;
        assigneeId: string | null;
        assigneeIds: string[];
        authorId: string | null;
        isCompleted: boolean;
        priority: string | null;
        startDate: string | null;
        dueDate: string | null;
        startDateTime: string | null;
        dueDateTime: string | null;
        tags: string[];
        updatedAt: string | null;
      }>;
      count: number;
      hasMore: boolean;
    };
    expect(payload.count).toBe(2);
    expect(payload.tasks[0]!.id).toBe("4017");
    expect(payload.tasks[0]!.projectId).toBe("76");
    expect(payload.tasks[0]!.assigneeId).toBe(
      "a0f583cb-b8a9-4408-a822-c05213b3fb91"
    );
    expect(payload.tasks[0]!.assigneeIds).toEqual([
      "a0f583cb-b8a9-4408-a822-c05213b3fb91",
    ]);
    expect(payload.tasks[0]!.type).toBe("action");
    // Legacy dateEnd is surfaced as dueDate (fallback when dueDate is absent)
    expect(payload.tasks[0]!.dueDate).toBe("2026-05-01");
    expect(payload.tasks[0]!.tags).toEqual(["39", "42"]);
    // When userId is absent, first assignee from array is used
    expect(payload.tasks[1]!.assigneeId).toBe("u2");
    expect(payload.tasks[1]!.assigneeIds).toEqual(["u2", "u3"]);
  });

  it("maps snake_case filter args to camelCase query params", async () => {
    const getFn = vi.fn(async () => ({ tasks: [] }));
    const client = {
      get: getFn,
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
    } as unknown as Parameters<typeof registerListTasks>[1];
    registerListTasks(fake.server, client);

    await fake.getHandler()({
      project_id: "p1",
      board_id: "b1",
      column_id: "c1",
      assignee_id: "u1",
      is_completed: false,
      limit: 10,
      offset: 20,
    });

    const query = getFn.mock.calls[0]![1] as Record<string, unknown>;
    expect(query.projectId).toBe("p1");
    expect(query.boardId).toBe("b1");
    expect(query.boardColumnId).toBe("c1");
    // WEEEK uses userId as the assignee filter param, not assigneeId
    expect(query.userId).toBe("u1");
    expect(query.isCompleted).toBe(false);
    expect(query.limit).toBe(10);
    expect(query.offset).toBe(20);
  });

  it("returns isError:true on WeeekApiError, does not throw", async () => {
    const client = makeFakeClient(async () => {
      throw new WeeekApiError(401, "unauthorized");
    });
    registerListTasks(fake.server, client);

    const res = await fake.getHandler()({});
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Invalid WEEEK_API_TOKEN");
  });
});
