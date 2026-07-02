/**
 * Shared helper for writing the MR (merge/pull request) link custom field.
 *
 * WEEEK custom fields are defined per-project and identified by an opaque id
 * (see project.customFields: [{ id, name, type, ... }]) — the update-task
 * endpoint accepts values as customFields: { [fieldId]: value }, keyed by
 * that id, not by name. Since callers only know the field by its human name
 * ("МР"), this resolves task -> projectId -> matching custom field id on
 * every call. There is no cache: field ids can change if the field is
 * recreated, and this runs at most once per write-tool call.
 */
import type { WeeekApiClient } from "../../client/weeek-api-client.js";

export const DEFAULT_MR_FIELD_NAME = "МР";

interface RawCustomField {
  id?: string | number;
  name?: string;
  [k: string]: unknown;
}

function unwrapKeyed(raw: unknown, key: string): Record<string, unknown> {
  if (raw && typeof raw === "object" && key in (raw as object)) {
    return (raw as Record<string, unknown>)[key] as Record<string, unknown>;
  }
  return raw as Record<string, unknown>;
}

/**
 * Resolves the custom field id for `fieldName` on the project that owns
 * `taskId`. Throws a descriptive error (listing the project's actual custom
 * field names) if the task has no project or the field doesn't exist —
 * field ids are per-project and cannot be guessed.
 */
export async function resolveTaskCustomFieldId(
  client: WeeekApiClient,
  taskId: string,
  fieldName: string
): Promise<string> {
  const rawTask = await client.get<unknown>(
    `/tm/tasks/${encodeURIComponent(taskId)}`
  );
  const task = unwrapKeyed(rawTask, "task");
  const projectId = task?.projectId;
  if (projectId === undefined || projectId === null || projectId === "") {
    throw new Error(
      `weeek: task ${taskId} has no projectId — cannot resolve custom field "${fieldName}".`
    );
  }

  const rawProject = await client.get<unknown>(
    `/tm/projects/${encodeURIComponent(String(projectId))}`
  );
  const project = unwrapKeyed(rawProject, "project");
  const fields = Array.isArray(project?.customFields)
    ? (project.customFields as RawCustomField[])
    : [];

  const normalized = fieldName.trim().toLowerCase();
  const match = fields.find(
    (f) => String(f.name ?? "").trim().toLowerCase() === normalized
  );

  if (!match || match.id === undefined || match.id === null) {
    const available =
      fields
        .map((f) => f.name)
        .filter((n): n is string => Boolean(n))
        .join(", ") || "(none)";
    throw new Error(
      `weeek: no custom field named "${fieldName}" on project ${String(
        projectId
      )}. Available custom fields: ${available}. Create the field in WEEEK first, or pass field_name matching its exact name.`
    );
  }

  return String(match.id);
}
