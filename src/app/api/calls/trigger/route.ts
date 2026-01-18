import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

const triggerSchema = z.object({
  nombreAlumno: z.string().min(1),
  telefono: z
    .string()
    .min(1)
    .transform((s) => s.replace(/\s+/g, ""))
    .refine(
      (s) => E164_PHONE_REGEX.test(s),
      "Invalid phone format. Use international E.164 without spaces, e.g. +34612345678",
    ),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Get userId from session
    const userId = session.user?.id as string | undefined;

    // Require HappyRobot endpoint
    const endpoint =
      process.env.HAPPYROBOT_ENDPOINT || process.env.HAPPYROBOT_WEBHOOK_URL;
    if (!endpoint || endpoint.trim() === "") {
      return NextResponse.json(
        {
          error: "HappyRobot endpoint not configured",
          hint: "Set HAPPYROBOT_ENDPOINT (or HAPPYROBOT_WEBHOOK_URL) in your environment variables.",
        },
        { status: 500 },
      );
    }
    const apiKey = process.env.HAPPYROBOT_X_API_KEY;
    const appUrl = process.env.APP_URL;

    const result = triggerSchema.safeParse(body);

    if (!result.success) {
      // Best-effort: record the failed attempt so it doesn't linger as "RUNNING" and you keep audit trail.
      const rawNombre =
        typeof (body as any)?.nombreAlumno === "string"
          ? (body as any).nombreAlumno
          : "";
      const rawTelefono =
        typeof (body as any)?.telefono === "string" ? (body as any).telefono : "";

      const nombreAlumno = rawNombre.trim() || "—";
      const telefono = rawTelefono.replace(/\s+/g, "");
      const validationErrors = result.error.errors.map((e) => ({
        code: e.code,
        message: e.message,
        path: e.path,
      }));

      const now = new Date();
      await prisma.call.create({
        data: {
          nombreAlumno,
          telefono: telefono || "—",
          programa: null,
          formacionPrevia: null,
          pais: null,
          edad: null,
          estudiosPrevios: null,
          motivacion: null,
          canal: null,
          razonNoInteres: null,
          palanca: null,
          status: "FAILED",
          completedAt: now,
          errorMsg:
            result.error.errors?.[0]?.message
              ? `Validation failed: ${result.error.errors[0].message}`
              : "Validation failed",
          metadata: {
            validationErrors,
            lead: { fullName: rawNombre, phoneNumber: rawTelefono },
          } as unknown as Prisma.InputJsonValue,
          userId: userId || null,
        },
      });

      return NextResponse.json(
        { error: "Validation failed", details: result.error.errors },
        { status: 400 },
      );
    }

    const data = result.data;

    const firstName = data.nombreAlumno.trim().split(" ")[0] || data.nombreAlumno.trim();

    const emailThread = [
      {
        from: "Uber",
        to: "User",
        subject: "Corporate mobility for Milano–Cortina 2026",
        body: `Good morning ${firstName},
my name is Ismael and I look after Business Partnerships at Uber for Business.

Ahead of the Milano–Cortina 2026 Olympic and Paralympic Games, where Uber is an Official Mobility Partner, many companies are evaluating how to best manage travel for their teams and guests during the event. How are you planning your company’s mobility for the Games?

Our platform, completely free to use, enables you to:
● centralize all trips (Uber and taxi) in one dashboard;
● set policies and control spend in real time;
● manage transfers and travel between Milan and event venues;
● receive a single monthly invoice with VAT broken out, without advances or receipt management.

It’s worth noting Uber for Business is not limited to the Games: it can also centralize corporate mobility for employees locally and internationally—before, during, and after the event—for day-to-day operations, business travel, meetings, and events.

Do you have availability this week for a brief call?
${firstName}, you can reply with times that work for you and I’ll send an invite.

Best,
Ismael`,
      },
      {
        from: "Uber",
        to: "User",
        subject: "Re: Corporate mobility for Milano–Cortina 2026",
        body: `Hi ${firstName},
Did you get a chance to see my previous email? Would you be open to a quick call?`,
      },
      {
        from: "User",
        to: "Uber",
        subject: "Re: Corporate mobility for Milano–Cortina 2026",
        body: "Yes, I’m available in about one hour.",
      },
    ] as const;

    const workflowContext = {
      lead: {
        first_name: firstName,
        full_name: data.nombreAlumno.trim(),
        phone_number: data.telefono.trim(),
      },
      email_thread: emailThread,
      source: {
        app: "uber-trigger",
        call_id: undefined as string | undefined, // filled after call record creation
        initiated_by_user_id: userId,
      },
    };

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
        metadata: {
          lead: {
            firstName,
            fullName: data.nombreAlumno.trim(),
            phoneNumber: data.telefono.trim(),
          },
          emailThread,
        },
        userId: userId || null,
      },
    });

    workflowContext.source.call_id = call.id;

    // Call HappyRobot webhook
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-KEY": apiKey } : {}),
        },
        body: JSON.stringify({
          phone_number: data.telefono.trim(),
          ...(appUrl ? { callback_url: `${appUrl.replace(/\/$/, "")}/api/calls/callback` } : {}),
          // Legacy fields for workflows expecting metadata.*
          metadata: {
            callId: call.id,
            nombreAlumno: data.nombreAlumno.trim(),
          },
          context: workflowContext,
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
