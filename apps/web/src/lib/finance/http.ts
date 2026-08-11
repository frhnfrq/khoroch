import { ZodError } from "zod";

export class ApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiInputError";
  }
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(message = "Not found") {
  return Response.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return Response.json({ error: message }, { status: 409 });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return Response.json(
      {
        error: firstIssue?.message ?? "Check the highlighted fields and try again.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const databaseError = findDatabaseError(error);
  if (databaseError?.code === "23505") {
    const message = databaseError.constraint?.startsWith("categories_")
      ? "A category with that name already exists at this level."
      : databaseError.constraint === "budgets_user_period_active_uidx"
        ? "A budget already exists for this month."
        : "That entry already exists. Refresh and try again.";
    return Response.json({ error: message }, { status: 409 });
  }

  console.error("Finance API request failed", error);
  return Response.json({ error: "The request could not be completed" }, { status: 500 });
}

function findDatabaseError(error: unknown): { code?: string; constraint?: string } | null {
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") {
      return {
        code: candidate.code,
        constraint: typeof candidate.constraint === "string" ? candidate.constraint : undefined,
      };
    }
    current = candidate.cause;
  }
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiInputError("Request body must contain valid JSON");
  }
}
