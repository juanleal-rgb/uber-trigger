import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { CallStatus, Prisma } from "@prisma/client";

function normalizeStatus(status: unknown): CallStatus | null {
  if (typeof status !== "string") return null;
  const s = status.toLowerCase();
  if (s === "pending") return CallStatus.PENDING;
  if (s === "running") return CallStatus.RUNNING;
  if (s === "completed" || s === "success") return CallStatus.COMPLETED;
  if (s === "failed" || s === "error") return CallStatus.FAILED;
  if (s === "canceled" || s === "cancelled") return CallStatus.CANCELED;
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * HappyRobot callback endpoint.
 *
 * Configure your workflow to POST here when it has a final summary / contract draft.
 * Correlation:
 * - Prefer sending `context.source.call_id` (we set this when triggering).
 * - Optionally include `run_id` as well.
 *
 * Optional security:
 * - Set env HAPPYROBOT_CALLBACK_SECRET and send header `x-happyrobot-callback-secret`.
 */
export async function POST(req: NextRequest) {
  try {
    const requiredSecret = process.env.HAPPYROBOT_CALLBACK_SECRET;
    if (requiredSecret) {
      const provided =
        req.headers.get("x-happyrobot-callback-secret") ||
        req.headers.get("x-callback-secret");
      if (provided !== requiredSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const anyBody = body as any;

    const callId =
      asString(anyBody?.context?.source?.call_id) ||
      asString(anyBody?.call_id) ||
      asString(anyBody?.callId) ||
      asString(anyBody?.metadata?.callId);

    const runId =
      asString(anyBody?.run_id) || asString(anyBody?.runId) || asString(anyBody?.id);

    if (!callId && !runId) {
      return NextResponse.json(
        {
          error: "Missing correlation id",
          hint: "Send context.source.call_id (recommended) or run_id.",
        },
        { status: 400 },
      );
    }

    const status = normalizeStatus(anyBody?.status);

    // Flexible extraction for your workflow outputs
    const summary =
      asString(anyBody?.result?.summary) ||
      asString(anyBody?.summary) ||
      asString(anyBody?.outputs?.summary) ||
      asString(anyBody?.extracted?.summary);

    const contractDraft =
      asString(anyBody?.result?.contract_draft) ||
      asString(anyBody?.result?.contractDraft) ||
      asString(anyBody?.contract_draft) ||
      asString(anyBody?.contractDraft) ||
      asString(anyBody?.outputs?.contract_draft);

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const where = callId ? { id: callId } : { runId: runId! };
      const existing = await tx.call.findUnique({ where });
      if (!existing) return null;

      const existingMetadata =
        (existing.metadata as Record<string, unknown> | null) || {};

      const mergedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        workflowResult: {
          ...(typeof (existingMetadata as any).workflowResult === "object"
            ? (existingMetadata as any).workflowResult
            : {}),
          ...(summary ? { summary } : {}),
          ...(contractDraft ? { contractDraft } : {}),
          lastCallbackAt: now.toISOString(),
        },
        happyrobotCallback: {
          receivedAt: now.toISOString(),
          runId: runId || existing.runId,
        },
      };

      const terminalStatus =
        status === CallStatus.COMPLETED ||
        status === CallStatus.FAILED ||
        status === CallStatus.CANCELED;

      return tx.call.update({
        where,
        data: {
          ...(runId && !existing.runId ? { runId } : {}),
          ...(status ? { status } : {}),
          ...(terminalStatus ? { completedAt: now } : {}),
          metadata: mergedMetadata as unknown as Prisma.InputJsonValue,
        },
      });
    });

    if (!updated) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("HappyRobot callback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

