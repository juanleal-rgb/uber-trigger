import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const triggerSchema = z.object({
  nombreAlumno: z.string().min(1),
  telefono: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = triggerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.errors },
        { status: 400 },
      );
    }

    const data = result.data;

    // Get userId from session
    const userId = session.user?.id as string | undefined;

    // Require HappyRobot endpoint
    const endpoint = process.env.HAPPYROBOT_ENDPOINT;
    if (!endpoint || endpoint.trim() === "") {
      return NextResponse.json(
        { error: "HappyRobot endpoint not configured" },
        { status: 500 },
      );
    }

    // Create call record
    const call = await prisma.call.create({
      data: {
        nombreAlumno: data.nombreAlumno,
        telefono: data.telefono,
        programa: null,
        formacionPrevia: null,
        pais: null,
        edad: null,
        estudiosPrevios: null,
        motivacion: null,
        canal: null,
        razonNoInteres: null,
        palanca: null,
        status: "PENDING",
        userId: userId || null,
      },
    });

    // Call HappyRobot webhook
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: data.telefono,
          metadata: {
            callId: call.id,
            nombreAlumno: data.nombreAlumno,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await prisma.call.update({
          where: { id: call.id },
          data: {
            status: "FAILED",
            errorMsg: "HappyRobot API error: " + errorText,
          },
        });
        return NextResponse.json(
          { error: "Failed to trigger call", details: errorText },
          { status: 500 },
        );
      }

      const result = await response.json();
      console.log(
        "[Trigger] HappyRobot response:",
        JSON.stringify(result, null, 2),
      );

      // HappyRobot returns queued_run_ids array
      const runId = result.queued_run_ids?.[0] || result.run_id || result.id;
      console.log("[Trigger] Extracted runId:", runId);

      // Update call with run ID
      await prisma.call.update({
        where: { id: call.id },
        data: {
          runId: runId,
          status: "RUNNING",
        },
      });

      return NextResponse.json({ call: { ...call, runId } });
    } catch (error) {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: "FAILED",
          errorMsg: "Failed to connect to HappyRobot API: " + String(error),
        },
      });
      return NextResponse.json(
        { error: "Failed to trigger call" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Trigger error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
