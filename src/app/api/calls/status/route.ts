import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { CallStatus, Prisma } from "@prisma/client";

const HAPPYROBOT_PLATFORM_API_V1 = "https://platform.happyrobot.ai/api/v1";
const HAPPYROBOT_PLATFORM_API_V2 = "https://platform.happyrobot.ai/api/v2";

// Map HappyRobot status to our status
const statusMap: Record<string, CallStatus> = {
  pending: CallStatus.PENDING,
  running: CallStatus.RUNNING,
  completed: CallStatus.COMPLETED,
  failed: CallStatus.FAILED,
  canceled: CallStatus.CANCELED,
};

// Normalize phone for comparison (remove spaces)
function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "");
}

// Extract phone number from HappyRobot run data (dynamic key like "uuid.data.phone_number")
function extractPhoneFromRunData(data: Record<string, unknown>): string | null {
  for (const key of Object.keys(data)) {
    if (key.endsWith(".data.phone_number") || key === "phone_number") {
      const val = data[key];
      if (typeof val === "string") return val;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation: Fetch failed runs from HappyRobot v2 API and mark local calls
// ─────────────────────────────────────────────────────────────────────────────
interface HappyRobotRun {
  id: string;
  status: string;
  timestamp: string;
  completed_at?: string;
  data?: Record<string, unknown>;
}

interface HappyRobotRunsResponse {
  data: HappyRobotRun[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
  };
}

let cachedFailedRuns: HappyRobotRun[] = [];
let cachedFailedRunsAt = 0;
const FAILED_RUNS_CACHE_MS = 10_000; // 10 seconds

async function fetchRecentFailedRuns(): Promise<HappyRobotRun[]> {
  const token = process.env.HAPPYROBOT_PLATFORM_TOKEN;
  const useCaseId = process.env.HAPPYROBOT_USE_CASE_ID;

  if (!token || !useCaseId) {
    return [];
  }

  // Use cache if fresh
  if (Date.now() - cachedFailedRunsAt < FAILED_RUNS_CACHE_MS) {
    return cachedFailedRuns;
  }

  try {
    const url = `${HAPPYROBOT_PLATFORM_API_V2}/runs/?page=1&page_size=100&sort=desc&use_case_id=${useCaseId}&status=failed`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error(`[Reconcile] Failed to fetch runs: ${res.status}`);
      return cachedFailedRuns; // return stale cache on error
    }

    const json: HappyRobotRunsResponse = await res.json();
    cachedFailedRuns = json.data || [];
    cachedFailedRunsAt = Date.now();

    console.log(`[Reconcile] Fetched ${cachedFailedRuns.length} failed runs from HappyRobot`);
    return cachedFailedRuns;
  } catch (err) {
    console.error("[Reconcile] Error fetching failed runs:", err);
    return cachedFailedRuns;
  }
}

// Poll HappyRobot Platform API for a single run (v1)
async function pollRunStatus(runId: string): Promise<CallStatus | null> {
  const pollingSecret = process.env.HAPPYROBOT_POLLING_SECRET;
  const orgId = process.env.HAPPYROBOT_ORG_ID;

  console.log(`[HappyRobot Poll] Checking run: ${runId}`);
  console.log(
    `[HappyRobot Poll] Polling Secret configured: ${!!pollingSecret}, Org ID configured: ${!!orgId}`,
  );

  // Skip polling if not configured
  if (!pollingSecret || !orgId) {
    console.log(`[HappyRobot Poll] SKIPPING - missing credentials`);
    return null;
  }

  try {
    const url = `${HAPPYROBOT_PLATFORM_API_V1}/runs/${runId}`;
    console.log(`[HappyRobot Poll] Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pollingSecret}`,
        "X-Organization-Id": orgId,
      },
    });

    console.log(`[HappyRobot Poll] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[HappyRobot Poll] FAILED for ${runId}: ${response.status} - ${errorText}`,
      );
      return null;
    }

    const data = await response.json();
    console.log(
      `[HappyRobot Poll] SUCCESS - Status from HappyRobot: ${data.status}`,
    );
    return statusMap[data.status] || null;
  } catch (error) {
    console.error(`[HappyRobot Poll] ERROR for ${runId}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pollingSecret = process.env.HAPPYROBOT_POLLING_SECRET;
    const orgId = process.env.HAPPYROBOT_ORG_ID;
    const canPollHappyRobot = Boolean(pollingSecret && orgId);

    const platformToken = process.env.HAPPYROBOT_PLATFORM_TOKEN;
    const useCaseId = process.env.HAPPYROBOT_USE_CASE_ID;
    const canReconcile = Boolean(platformToken && useCaseId);

    // Get recent calls (include completed) so the UI can show history + summaries.
    const calls = await prisma.call.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Reconciliation: for RUNNING calls older than 60s, check HappyRobot failed runs
    // ─────────────────────────────────────────────────────────────────────────
    const RECONCILE_AFTER_MS = 60_000; // 60 seconds
    const RECONCILE_WINDOW_MS = 5 * 60_000; // 5 minutes
    const now = Date.now();

    let failedRuns: HappyRobotRun[] = [];
    const runningCallsNeedReconcile = calls.filter((c) => {
      if (c.status !== "RUNNING") return false;
      const age = now - new Date(c.createdAt).getTime();
      return age > RECONCILE_AFTER_MS;
    });

    if (canReconcile && runningCallsNeedReconcile.length > 0) {
      failedRuns = await fetchRecentFailedRuns();
      // Filter to runs in the last 5 minutes
      failedRuns = failedRuns.filter((r) => {
        const ts = new Date(r.timestamp).getTime();
        return now - ts < RECONCILE_WINDOW_MS;
      });
      console.log(
        `[Reconcile] ${runningCallsNeedReconcile.length} RUNNING calls > 60s, ${failedRuns.length} recent failed runs`,
      );
    }

    // Build a map: normalizedPhone -> failed run (most recent first)
    const failedByPhone = new Map<string, HappyRobotRun>();
    for (const run of failedRuns) {
      const phone = run.data ? extractPhoneFromRunData(run.data) : null;
      if (phone) {
        const norm = normalizePhone(phone);
        if (!failedByPhone.has(norm)) {
          failedByPhone.set(norm, run);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Process each call
    // ─────────────────────────────────────────────────────────────────────────
    console.log(
      `[Status API] Found ${calls.length} calls, checking for RUNNING...`,
    );

    const updatedCalls = await Promise.all(
      calls.map(async (call) => {
        if (call.status !== "RUNNING") {
          return call;
        }

        console.log(
          `[Status API] Call ${call.id}: status=${call.status}, runId=${call.runId}`,
        );

        // 1) Try v1 polling if configured
        if (canPollHappyRobot && call.runId) {
          console.log(`[Status API] -> Polling HappyRobot for this call...`);
          const newStatus = await pollRunStatus(call.runId);

          if (newStatus && newStatus !== call.status) {
            const updated = await prisma.call.update({
              where: { id: call.id },
              data: {
                status: newStatus,
                completedAt:
                  newStatus === CallStatus.COMPLETED ||
                  newStatus === CallStatus.FAILED ||
                  newStatus === CallStatus.CANCELED
                    ? new Date()
                    : null,
              },
              include: {
                user: { select: { id: true, email: true, name: true } },
              },
            });
            console.log(`[Status API] Updated call ${call.id} to ${newStatus}`);
            return updated;
          }
        }

        // 2) Reconciliation: match by phone in failed runs
        const callAge = now - new Date(call.createdAt).getTime();
        if (canReconcile && callAge > RECONCILE_AFTER_MS) {
          const callPhoneNorm = normalizePhone(call.telefono);
          const matchedRun = failedByPhone.get(callPhoneNorm);

          if (matchedRun) {
            console.log(
              `[Reconcile] MATCH found for call ${call.id} -> run ${matchedRun.id}`,
            );

            const existingMeta =
              (call.metadata as Record<string, unknown> | null) || {};
            const mergedMeta: Record<string, unknown> = {
              ...existingMeta,
              happyrobotReconcile: {
                runId: matchedRun.id,
                runTimestamp: matchedRun.timestamp,
                reconciledAt: new Date().toISOString(),
              },
            };

            const updated = await prisma.call.update({
              where: { id: call.id },
              data: {
                status: CallStatus.FAILED,
                completedAt: new Date(),
                errorMsg: "HappyRobot run failed (reconciled from /api/v2/runs)",
                metadata: mergedMeta as unknown as Prisma.InputJsonValue,
              },
              include: {
                user: { select: { id: true, email: true, name: true } },
              },
            });
            console.log(`[Reconcile] Marked call ${call.id} as FAILED`);
            return updated;
          }
        }

        return call;
      }),
    );

    return NextResponse.json(updatedCalls);
  } catch (error) {
    console.error("Status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
