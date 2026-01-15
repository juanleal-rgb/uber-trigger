"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PhoneHappyRobotMorph } from "@/components/ui/PhoneHappyRobotMorph";
import { LogoAnimationLoop } from "@/components/logo-animation-loop";
import { useToast } from "@/components/ui/toaster";

// Zod schema for form validation
const triggerFormSchema = z.object({
  nombreAlumno: z.string().min(1, "Nombre del alumno es requerido"),
  telefono: z
    .string()
    .min(1, "Teléfono es requerido")
    .regex(/^\+\d/, "El teléfono debe incluir el prefijo del país (ej: +34)"),
});

type TriggerFormData = z.infer<typeof triggerFormSchema>;

interface CallUser {
  id: string;
  email: string;
  name: string | null;
}

interface Call {
  id: string;
  runId: string | null;
  nombreAlumno: string;
  telefono: string;
  programa: string | null;
  formacionPrevia: string | null;
  pais: string | null;
  edad: string | null;
  estudiosPrevios: string | null;
  motivacion: string | null;
  canal: string | null;
  razonNoInteres: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errorMsg: string | null;
  metadata: Record<string, unknown> | null;
  user: CallUser | null;
}

// HappyRobot Platform URL configuration
const HAPPYROBOT_ORG_SLUG = process.env.NEXT_PUBLIC_HAPPYROBOT_ORG_SLUG;
const HAPPYROBOT_WORKFLOW_ID = process.env.NEXT_PUBLIC_HAPPYROBOT_WORKFLOW_ID;

function getHappyRobotRunUrl(runId: string): string {
  return `https://v2.platform.happyrobot.ai/${HAPPYROBOT_ORG_SLUG}/workflow/${HAPPYROBOT_WORKFLOW_ID}/runs?run_id=${runId}`;
}

const statusConfig = {
  PENDING: { icon: Clock, class: "pill-pending", label: "Pendiente" },
  RUNNING: { icon: RefreshCw, class: "pill-running", label: "En Curso" },
  COMPLETED: {
    icon: CheckCircle,
    class: "pill-completed",
    label: "Completada",
  },
  FAILED: { icon: XCircle, class: "pill-failed", label: "Fallida" },
  CANCELED: { icon: AlertCircle, class: "pill-canceled", label: "Cancelada" },
};

export default function TriggerPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [formData, setFormData] = useState<TriggerFormData>({
    nombreAlumno: "",
    telefono: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "calls">("form");
  const { success: showSuccess } = useToast();

  // Prepopulate first name from session
  useEffect(() => {
    if (session?.user?.name && !formData.nombreAlumno) {
      const firstName = session.user.name.split(" ")[0];
      setFormData((prev) => ({
        ...prev,
        nombreAlumno: firstName,
      }));
    }
  }, [session?.user?.name]);

  // ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCall(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Query for active calls
  const { data: activeCalls = [], isLoading: isLoadingCalls } = useQuery<
    Call[]
  >({
    queryKey: ["activeCalls"],
    queryFn: async () => {
      const res = await fetch("/api/calls/status");
      if (!res.ok) throw new Error("Error al obtener las llamadas");
      return res.json();
    },
    refetchInterval: 3000, // Auto-refresh every 3 seconds
  });

  // Mutation for triggering a call
  const triggerMutation = useMutation({
    mutationFn: async (data: TriggerFormData) => {
      const res = await fetch("/api/calls/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error al iniciar la llamada");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeCalls"] });
      setErrors({});
      showSuccess("Llamada iniciada correctamente");
      // Switch to calls tab on mobile after triggering
      setActiveTab("calls");
    },
  });

  const handleInputChange = (field: keyof TriggerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = triggerFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Show disclaimer modal before triggering
    setShowDisclaimer(true);
  };

  const handleConfirmCall = () => {
    setShowDisclaimer(false);
    triggerMutation.mutate(formData);
  };

  const isFormValid =
    formData.nombreAlumno.trim() !== "" && formData.telefono.trim() !== "";

  const firstName =
    formData.nombreAlumno.trim().split(" ")[0] ||
    session?.user?.name?.split(" ")[0] ||
    "{!firstname}";

  // Count active/running calls for badge
  const activeCallsCount = activeCalls.filter(
    (c) => c.status === "PENDING" || c.status === "RUNNING",
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Mobile Tab Bar */}
      <div className="flex border-b border-border-subtle md:hidden">
        <button
          onClick={() => setActiveTab("form")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "form"
              ? "border-b-2 border-accent-primary text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary",
          )}
        >
          Iniciar Llamada
        </button>
        <button
          onClick={() => setActiveTab("calls")}
          className={cn(
            "flex-1 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === "calls"
              ? "border-b-2 border-accent-primary text-fg-primary"
              : "text-fg-muted hover:text-fg-secondary",
          )}
        >
          Llamadas Activas
          {activeCallsCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-primary px-1.5 text-xs font-medium text-white">
              {activeCallsCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Form */}
        <div
          className={cn(
            "flex-1 overflow-auto border-r border-border-subtle p-4 md:p-6",
            activeTab !== "form" && "hidden md:block",
          )}
        >
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 hidden md:block">
              <h1 className="text-xl font-semibold text-fg-primary">
                Iniciar Llamada
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email thread (reference) */}
              <div className="linear-card p-5">
                <h2 className="mb-4 text-sm font-medium text-fg-secondary">
                  Hilo de correo (referencia)
                </h2>

                <div className="space-y-4">
                  {/* EMAIL 1 */}
                  <div className="flex justify-start">
                    <div className="w-full max-w-[720px] rounded-xl border border-border-subtle bg-bg-elevated p-4">
                      <div className="mb-3 grid gap-1 text-[12px] text-fg-muted sm:grid-cols-3">
                        <div>
                          <span className="font-medium text-fg-secondary">
                            From:
                          </span>{" "}
                          Uber
                        </div>
                        <div>
                          <span className="font-medium text-fg-secondary">
                            To:
                          </span>{" "}
                          User
                        </div>
                        <div className="sm:text-right">
                          <span className="font-medium text-fg-secondary">
                            Subject:
                          </span>{" "}
                          Movilidad corporativa para Milano–Cortina 2026
                        </div>
                      </div>

                      <div className="whitespace-pre-line text-[13px] leading-relaxed text-fg-primary">
                        {`Buenos días ${firstName},
mi nombre es Ismael y me ocupo de Business Partnerships en Uber for Business.

De cara a los Juegos Olímpicos y Paralímpicos Milano–Cortina 2026, de los que Uber es Official Mobility Partner, muchas empresas están evaluando cómo gestionar de la mejor manera los desplazamientos de sus equipos y de sus invitados durante el evento. ¿Cómo estáis planificando la movilidad de vuestra empresa para los Juegos?

Nuestra plataforma, totalmente gratuita, permite:
● centralizar todos los viajes (Uber y taxi) en un único panel;
● definir políticas y controlar el gasto en tiempo real;
● gestionar traslados y desplazamientos entre Milán y las sedes de los eventos;
● recibir una única factura mensual con IVA desglosado, sin anticipos ni gestión de recibos.

Es importante destacar que Uber for Business no es una solución limitada a los Juegos Olímpicos: la plataforma puede utilizarse también para gestionar de forma centralizada toda la movilidad corporativa de los empleados, tanto a nivel local como internacional, antes, durante y después del evento, para la operativa diaria, viajes de trabajo, reuniones y eventos.

¿Tienes disponibilidad esta semana para una breve llamada?
${firstName}, puedes responder directamente indicando los horarios que prefieras y te enviaré la invitación.

Un saludo,
Ismael`}
                      </div>
                    </div>
                  </div>

                  {/* EMAIL 2 */}
                  <div className="flex justify-start">
                    <div className="w-full max-w-[680px] rounded-xl border border-border-subtle bg-bg-elevated-alt p-4">
                      <div className="mb-3 grid gap-1 text-[12px] text-fg-muted sm:grid-cols-3">
                        <div>
                          <span className="font-medium text-fg-secondary">
                            From:
                          </span>{" "}
                          Uber
                        </div>
                        <div>
                          <span className="font-medium text-fg-secondary">
                            To:
                          </span>{" "}
                          User
                        </div>
                        <div className="sm:text-right">
                          <span className="font-medium text-fg-secondary">
                            Subject:
                          </span>{" "}
                          Re: Movilidad corporativa para Milano–Cortina 2026
                        </div>
                      </div>

                      <div className="whitespace-pre-line text-[13px] leading-relaxed text-fg-primary">
                        {`Hola ${firstName},
¿Pudiste ver mi correo anterior? ¿Te gustaría tener una llamada?`}
                      </div>
                    </div>
                  </div>

                  {/* EMAIL 3 */}
                  <div className="flex justify-end">
                    <div className="w-full max-w-[520px] rounded-xl border border-border-subtle bg-interactive-hover p-4">
                      <div className="mb-3 grid gap-1 text-[12px] text-fg-muted sm:grid-cols-3">
                        <div>
                          <span className="font-medium text-fg-secondary">
                            From:
                          </span>{" "}
                          User
                        </div>
                        <div>
                          <span className="font-medium text-fg-secondary">
                            To:
                          </span>{" "}
                          Uber
                        </div>
                        <div className="sm:text-right">
                          <span className="font-medium text-fg-secondary">
                            Subject:
                          </span>{" "}
                          Re: Movilidad corporativa para Milano–Cortina 2026
                        </div>
                      </div>

                      <div className="whitespace-pre-line text-[13px] leading-relaxed text-fg-primary">
                        {"Si, en una hora aproximadamente estoy disponible"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Required fields */}
              <div className="linear-card p-5">
                <h2 className="mb-4 text-sm font-medium text-fg-secondary">
                  Campos Requeridos
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Nombre del Alumno *
                    </label>
                    <input
                      type="text"
                      value={formData.nombreAlumno}
                      onChange={(e) =>
                        handleInputChange("nombreAlumno", e.target.value)
                      }
                      placeholder={session?.user?.name || "Juan Pérez"}
                      className={cn(
                        "linear-input",
                        errors.nombreAlumno && "border-red-500/50",
                      )}
                    />
                    {errors.nombreAlumno && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors.nombreAlumno}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Telefono *
                    </label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(e) =>
                        handleInputChange("telefono", e.target.value)
                      }
                      placeholder="+34 612 345 678"
                      className={cn(
                        "linear-input",
                        errors.telefono && "border-red-500/50",
                      )}
                    />
                    {errors.telefono && (
                      <p className="mt-1 text-xs text-red-400">
                        {errors.telefono}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit button with PhoneHappyRobotMorph animation */}
              <button
                type="submit"
                disabled={!isFormValid || triggerMutation.isPending}
                className="linear-btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                <PhoneHappyRobotMorph
                  size={18}
                  logoColor="white"
                  variant="flip"
                  isActive={isFormValid}
                />
                <span>
                  {triggerMutation.isPending
                    ? "Iniciando llamada..."
                    : "Iniciar Llamada"}
                </span>
              </button>

              {triggerMutation.isError && (
                <div className="rounded-lg border border-status-danger/20 bg-status-danger/10 p-3">
                  <p className="text-sm text-status-danger">
                    {triggerMutation.error.message}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right: Active calls */}
        <div
          className={cn(
            "w-full overflow-auto bg-bg-surface p-4 md:w-[400px] md:p-6",
            activeTab !== "calls" && "hidden md:block",
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image
                src="/happyrobot/Footer-logo-white.svg"
                alt="HappyRobot"
                width={20}
                height={16}
                className="opacity-60"
              />
              <h2 className="text-sm font-semibold text-fg-primary">
                Historial
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Auto-refresh
            </div>
          </div>

          {isLoadingCalls ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-fg-muted" />
            </div>
          ) : activeCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <LogoAnimationLoop size={40} pauseDuration={5} />
              <p className="mt-4 text-sm text-fg-muted">
                No hay llamadas aún
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCalls.map((call) => {
                const config = statusConfig[call.status];
                const StatusIcon = config.icon;
                return (
                  <div
                    key={call.id}
                    className="linear-card cursor-pointer p-4 transition-all hover:border-accent-primary/50"
                    onClick={() => setSelectedCall(call)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-fg-primary">
                          {call.nombreAlumno}
                        </p>
                        <p className="mt-0.5 text-sm text-fg-muted">
                          {call.telefono}
                        </p>
                      </div>
                      <div className={cn("pill", config.class)}>
                        <StatusIcon
                          className={cn(
                            "h-3 w-3",
                            call.status === "RUNNING" && "animate-spin",
                          )}
                        />
                        {config.label}
                      </div>
                    </div>
                    {call.user && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="font-medium text-fg-secondary">
                          {call.user.name}
                        </span>
                        <span className="text-fg-disabled">
                          ({call.user.email})
                        </span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
                      <span>
                        {formatRelativeTime(new Date(call.createdAt))}
                      </span>
                      {call.runId && (
                        <span className="font-mono text-[10px]">
                          {call.runId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    {call.errorMsg && (
                      <div className="mt-2 rounded bg-status-danger/10 px-2 py-1 text-xs text-status-danger">
                        {call.errorMsg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-backdrop backdrop-blur-sm"
          onClick={() => setSelectedCall(null)}
        >
          <div
            className="relative mx-4 max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCall(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <h2 className="mb-1 text-lg font-semibold text-fg-primary">
              {selectedCall.nombreAlumno}
            </h2>
            <p className="mb-6 font-mono text-sm text-fg-muted">
              {selectedCall.telefono}
            </p>

            <div className="mb-6">
              {(() => {
                const config = statusConfig[selectedCall.status];
                const StatusIcon = config.icon;
                return (
                  <span className={cn("pill", config.class)}>
                    <StatusIcon
                      className={cn(
                        "h-3 w-3",
                        selectedCall.status === "RUNNING" && "animate-spin",
                      )}
                    />
                    {config.label}
                  </span>
                );
              })()}
            </div>

            {/* Workflow result (summary / contract) */}
            {selectedCall.metadata &&
              typeof selectedCall.metadata === "object" &&
              (selectedCall.metadata as any)?.workflowResult && (
                <div className="linear-card mt-6 p-4">
                  <p className="mb-2 text-sm font-medium text-fg-secondary">
                    Resumen de la llamada
                  </p>
                  <pre className="whitespace-pre-wrap break-words text-sm text-fg-primary">
                    {(selectedCall.metadata as any).workflowResult.summary ||
                      "—"}
                  </pre>

                  {(selectedCall.metadata as any).workflowResult.contractDraft && (
                    <>
                      <p className="mb-2 mt-4 text-sm font-medium text-fg-secondary">
                        Boceto de contrato
                      </p>
                      <pre className="whitespace-pre-wrap break-words text-sm text-fg-primary">
                        {(selectedCall.metadata as any).workflowResult
                          .contractDraft as string}
                      </pre>
                    </>
                  )}
                </div>
              )}

            {selectedCall.errorMsg && (
              <div className="mt-6 rounded-lg border border-status-danger/20 bg-status-danger/10 p-4">
                <p className="text-sm font-medium text-status-danger">Error</p>
                <p className="mt-1 text-sm text-status-danger/80">
                  {selectedCall.errorMsg}
                </p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-backdrop backdrop-blur-sm"
          onClick={() => setShowDisclaimer(false)}
        >
          <div
            className="relative mx-4 w-full max-w-md rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary">
                ¡Aviso a navegantes!
              </h3>
            </div>

            <div className="mb-6 space-y-3 text-sm leading-relaxed text-fg-secondary">
              <p>
                Por ahora, el paso final de paso de la llamada con un director
                no está implementado. Es normal que haya un silencio un poco más
                largo de lo habitual o algo incómodo.
              </p>
              <p>
                <span className="font-medium text-fg-primary">
                  Omitir en el feedback por favor
                </span>
                , es normal hasta que se habilite.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisclaimer(false)}
                className="linear-btn-secondary flex-1 py-2.5"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCall}
                className="linear-btn-primary flex flex-1 items-center justify-center gap-2 py-2.5"
              >
                <PhoneHappyRobotMorph
                  size={16}
                  logoColor="white"
                  variant="flip"
                  isActive={true}
                />
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string | null | undefined;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : ""}>
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-sm text-fg-primary">{value || "-"}</p>
    </div>
  );
}
