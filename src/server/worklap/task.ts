import { worklapFetch } from "./client";

type CreateTaskInput = {
  title: string;
  description: string;
};

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function worklapEnabled(): boolean {
  return Boolean(
    optionalEnv("WORKLAP_API_URL") &&
      optionalEnv("WORKLAP_EMAIL") &&
      optionalEnv("WORKLAP_PASSWORD") &&
      optionalEnv("WORKLAP_PROJECT_UUID") &&
      optionalEnv("WORKLAP_WORK_TYPE_UUID") &&
      optionalEnv("WORKLAP_WORK_STATUS_UUID"),
  );
}

export async function createWorklapTask(input: CreateTaskInput): Promise<{
  workItemUuid?: string;
  rawMessage?: string;
}> {
  if (!worklapEnabled()) {
    throw new Error("Worklap is not configured (missing env vars)");
  }

  const body = {
    projectUuid: optionalEnv("WORKLAP_PROJECT_UUID"),
    workTypeUuid: optionalEnv("WORKLAP_WORK_TYPE_UUID"),
    workStatusUuid: optionalEnv("WORKLAP_WORK_STATUS_UUID"),
    workItemAssigneeAppUserUuid: optionalEnv("WORKLAP_ASSIGNEE_USER_UUID"),
    workItemTitle: input.title,
    workItemDescription: input.description,
  };

  const res = await worklapFetch<{ workItemUuid?: string; uuid?: string }>(
    "/pmo/add-or-update-work-item",
    { method: "POST", body: JSON.stringify(body) },
  );

  return {
    workItemUuid: res.data?.workItemUuid ?? res.data?.uuid,
    rawMessage: res.message,
  };
}
