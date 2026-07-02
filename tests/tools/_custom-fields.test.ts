import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_MR_FIELD_NAME,
  resolveTaskCustomFieldId,
} from "../../src/tools/write/_custom-fields.js";

function makeClient(get: ReturnType<typeof vi.fn>) {
  return {
    get,
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  } as unknown as Parameters<typeof resolveTaskCustomFieldId>[0];
}

describe("resolveTaskCustomFieldId", () => {
  it("defaults to the МР field name", () => {
    expect(DEFAULT_MR_FIELD_NAME).toBe("МР");
  });

  it("fetches the task, then the project, and returns the matching field id", async () => {
    const get = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") return { task: { projectId: 42 } };
      if (path === "/tm/projects/42") {
        return { project: { customFields: [{ id: "f-1", name: "МР" }] } };
      }
      throw new Error(`unexpected ${path}`);
    });
    const id = await resolveTaskCustomFieldId(makeClient(get), "t1", "МР");
    expect(id).toBe("f-1");
  });

  it("throws with available field names when no match is found", async () => {
    const get = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") return { task: { projectId: "p1" } };
      if (path === "/tm/projects/p1") {
        return { project: { customFields: [{ id: "f-1", name: "Priority" }] } };
      }
      throw new Error(`unexpected ${path}`);
    });
    await expect(
      resolveTaskCustomFieldId(makeClient(get), "t1", "МР")
    ).rejects.toThrow(/Priority/);
  });

  it("throws when the task has no projectId", async () => {
    const get = vi.fn(async () => ({ task: { id: "t1" } }));
    await expect(
      resolveTaskCustomFieldId(makeClient(get), "t1", "МР")
    ).rejects.toThrow(/projectId/);
  });

  it("handles responses that are not wrapped in {task:} / {project:}", async () => {
    const get = vi.fn(async (path: string) => {
      if (path === "/tm/tasks/t1") return { projectId: "p1" };
      if (path === "/tm/projects/p1") {
        return { customFields: [{ id: "f-2", name: "МР" }] };
      }
      throw new Error(`unexpected ${path}`);
    });
    const id = await resolveTaskCustomFieldId(makeClient(get), "t1", "МР");
    expect(id).toBe("f-2");
  });
});
