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
  ChevronDown,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { cn, formatRelativeTime } from "@/lib/utils";
import { PhoneHappyRobotMorph } from "@/components/ui/PhoneHappyRobotMorph";
import { LogoAnimationLoop } from "@/components/logo-animation-loop";
import { useToast } from "@/components/ui/toaster";

// Palanca options for the dropdown
const PALANCAS = [
  {
    id: "enfoque-practico",
    title: "Enfoque práctico (neuropsicología educativa)",
    example:
      "Lo interesante es que no es formación clínica, sino práctica. Aprende a identificar dificultades de aprendizaje en el aula y cómo intervenir directamente.",
    when: "Usar cuando busca aplicación real en su trabajo",
  },
  {
    id: "estrategias-neurodidacticas",
    title: "Estrategias neurodidácticas",
    example:
      "Va a aprender a diseñar actividades que mejoren lectura, escritura, atención, memoria... todo lo que necesita un docente en el día a día.",
    when: "Usar cuando menciona problemas con estudiantes o quiere mejorar su práctica",
  },
  {
    id: "funcionamiento-cerebral-tic",
    title: "Funcionamiento cerebral + TIC",
    example:
      "Entiende cómo procesa información el cerebro y cómo aprovechar la tecnología para potenciar el aprendizaje.",
    when: "Usar cuando su perfil indica interés en neurociencia o tecnología",
  },
  {
    id: "deteccion-temprana",
    title: "Detección temprana",
    example:
      "Le prepara para identificar inteligencias múltiples, talento, dificultades lingüísticas... detectar a tiempo hace toda la diferencia.",
    when: "Usar cuando trabaja con niños o su historial menciona casos difíciles",
  },
  {
    id: "reportes-psicopedagogicos",
    title: "Reportes psicopedagógicos",
    example:
      "Aprende a elaborar reportes profesionales con datos cuantitativos y cualitativos, basados en pruebas estandarizadas. Es algo muy solicitado.",
    when: "Usar cuando busca diferenciarse o tiene rol de orientador",
  },
  {
    id: "perfil-profesional-ampliado",
    title: "Perfil profesional ampliado",
    example:
      "Al terminar, puede asesorar, diagnosticar, intervenir... se convierte en un experto que mejora la práctica educativa de forma significativa.",
    when: "Usar cuando busca crecimiento profesional o mejores oportunidades",
  },
  {
    id: "doble-titulacion",
    title: "Doble titulación",
    example:
      "Obtiene la Maestría Oficial Mexicana avalada por SEP y además un Título Propio Europeo de UNIR España.",
    when: "Usar siempre como diferenciador",
  },
  {
    id: "diplomas-extra",
    title: "Diplomas extra incluidos",
    example:
      "Además de la maestría, le incluyen diplomas como 'Procesos cognitivos en neuroeducación' e 'Innovación para el desarrollo cognitivo'.",
    when: "Usar para mostrar valor adicional",
  },
];

// Zod schema for form validation
const triggerFormSchema = z.object({
  nombreAlumno: z.string().min(1, "Nombre del alumno es requerido"),
  telefono: z
    .string()
    .min(1, "Teléfono es requerido")
    .regex(/^\+\d/, "El teléfono debe incluir el prefijo del país (ej: +34)"),
  programa: z.string().optional(),
  formacionPrevia: z.string().optional(),
  pais: z.string().optional(),
  edad: z.string().optional(),
  estudiosPrevios: z.string().optional(),
  motivacion: z.string().optional(),
  canal: z.string().optional(),
  razonNoInteres: z.string().optional(),
  palanca: z.string().optional(),
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
    programa: "Maestría en Aprendizaje, Cognición y Desarrollo Educativo",
    formacionPrevia: "Licenciado",
    pais: "México",
    edad: "25",
    estudiosPrevios:
      "Grado en Educación en la Universidad Nacional Autónoma de México",
    motivacion: "",
    canal: "Web",
    razonNoInteres: "",
    palanca: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [palancaDropdownOpen, setPalancaDropdownOpen] = useState(false);
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
              <p className="mt-1 text-sm text-fg-muted">
                Inicia una nueva llamada con los datos del alumno
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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

              {/* Optional fields */}
              <div className="linear-card p-5">
                <h2 className="mb-4 text-sm font-medium text-fg-secondary">
                  Rellenar informacion adicional
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Programa de Interés
                    </label>
                    <input
                      type="text"
                      value={formData.programa}
                      onChange={(e) =>
                        handleInputChange("programa", e.target.value)
                      }
                      placeholder="Maestría en..."
                      className="linear-input"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Formacion Previa
                    </label>
                    <input
                      type="text"
                      value={formData.formacionPrevia}
                      onChange={(e) =>
                        handleInputChange("formacionPrevia", e.target.value)
                      }
                      placeholder="Licenciado"
                      className="linear-input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Estudios Previos
                    </label>
                    <input
                      type="text"
                      value={formData.estudiosPrevios}
                      onChange={(e) =>
                        handleInputChange("estudiosPrevios", e.target.value)
                      }
                      placeholder="Grado en Educación en la Universidad Nacional Autónoma de México"
                      className="linear-input"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Pais
                      </label>
                      <input
                        type="text"
                        value={formData.pais}
                        onChange={(e) =>
                          handleInputChange("pais", e.target.value)
                        }
                        placeholder="México"
                        className="linear-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Edad
                      </label>
                      <input
                        type="text"
                        value={formData.edad}
                        onChange={(e) =>
                          handleInputChange("edad", e.target.value)
                        }
                        placeholder="25"
                        className="linear-input"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                        Canal
                      </label>
                      <input
                        type="text"
                        value={formData.canal}
                        onChange={(e) =>
                          handleInputChange("canal", e.target.value)
                        }
                        placeholder="Web, Telefono..."
                        className="linear-input"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Motivacion
                    </label>
                    <textarea
                      value={formData.motivacion}
                      onChange={(e) =>
                        handleInputChange("motivacion", e.target.value)
                      }
                      placeholder="Describir motivacion del alumno..."
                      rows={2}
                      className="linear-input resize-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Razon de No Interes
                    </label>
                    <textarea
                      value={formData.razonNoInteres}
                      onChange={(e) =>
                        handleInputChange("razonNoInteres", e.target.value)
                      }
                      placeholder="Si aplica, describir razon..."
                      rows={2}
                      className="linear-input resize-none"
                    />
                  </div>

                  {/* Palanca dropdown */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-[13px] font-medium text-fg-muted">
                      Palanca de Valor
                      <span className="ml-1 text-fg-disabled">(opcional)</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setPalancaDropdownOpen(!palancaDropdownOpen)
                        }
                        className="linear-input flex w-full items-center justify-between text-left"
                      >
                        <span
                          className={
                            formData.palanca
                              ? "text-fg-primary"
                              : "text-fg-muted"
                          }
                        >
                          {formData.palanca
                            ? PALANCAS.find((p) => p.id === formData.palanca)
                                ?.title
                            : "Seleccionar palanca..."}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-fg-muted transition-transform",
                            palancaDropdownOpen && "rotate-180",
                          )}
                        />
                      </button>

                      {palancaDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setPalancaDropdownOpen(false)}
                          />
                          <div className="absolute left-0 right-0 z-50 mt-2 max-h-[300px] overflow-y-auto rounded-xl border border-border-subtle bg-bg-elevated py-2 shadow-xl md:bottom-full md:top-auto md:mb-2 md:mt-0 md:max-h-[400px]">
                            {/* Clear option */}
                            {formData.palanca && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleInputChange("palanca", "");
                                  setPalancaDropdownOpen(false);
                                }}
                                className="flex w-full items-center gap-2 border-b border-border-subtle px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-500/10"
                              >
                                <X className="h-3.5 w-3.5" />
                                Limpiar selección
                              </button>
                            )}

                            {/* Options */}
                            {PALANCAS.map((palanca) => (
                              <button
                                key={palanca.id}
                                type="button"
                                onClick={() => {
                                  handleInputChange("palanca", palanca.id);
                                  setPalancaDropdownOpen(false);
                                }}
                                className={cn(
                                  "w-full border-b border-border-subtle px-4 py-3 text-left transition-colors last:border-0 hover:bg-bg-hover",
                                  formData.palanca === palanca.id &&
                                    "bg-blue-500/10",
                                )}
                              >
                                <div className="mb-1 text-sm font-medium text-fg-primary">
                                  {palanca.title}
                                </div>
                                <div className="mb-1.5 text-xs italic leading-relaxed text-fg-secondary">
                                  &ldquo;{palanca.example}&rdquo;
                                </div>
                                <div className="text-[11px] font-medium text-blue-400">
                                  {palanca.when}
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
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
                Llamadas Activas
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
                No hay llamadas activas
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
                        {call.programa && (
                          <p className="mt-1 truncate text-xs text-fg-disabled">
                            {call.programa}
                          </p>
                        )}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Programa" value={selectedCall.programa} />
              <DetailField
                label="Formacion Previa"
                value={selectedCall.formacionPrevia}
              />
              <DetailField label="Pais" value={selectedCall.pais} />
              <DetailField label="Edad" value={selectedCall.edad} />
              <DetailField
                label="Estudios Previos"
                value={selectedCall.estudiosPrevios}
              />
              <DetailField label="Canal" value={selectedCall.canal} />
              <DetailField
                label="Motivacion"
                value={selectedCall.motivacion}
                fullWidth
              />
              <DetailField
                label="Razon No Interes"
                value={selectedCall.razonNoInteres}
                fullWidth
              />
              {selectedCall.user && (
                <DetailField
                  label="Iniciada por"
                  value={selectedCall.user.name || selectedCall.user.email}
                />
              )}
              {selectedCall.runId && (
                <div>
                  <p className="text-xs font-medium text-fg-muted">Run ID</p>
                  <p className="mt-1 font-mono text-sm text-fg-primary">
                    {selectedCall.runId}
                  </p>
                  {isAdmin && HAPPYROBOT_ORG_SLUG && HAPPYROBOT_WORKFLOW_ID && (
                    <a
                      href={getHappyRobotRunUrl(selectedCall.runId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="happyrobot-link mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white transition-all"
                    >
                      <Image
                        src="/happyrobot/Footer-logo-white.svg"
                        alt="HappyRobot"
                        width={18}
                        height={14}
                      />
                      Ver en HappyRobot
                      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                    </a>
                  )}
                </div>
              )}
              <DetailField
                label="Creado"
                value={new Date(selectedCall.createdAt).toLocaleString("es-ES")}
              />
              {selectedCall.completedAt && (
                <DetailField
                  label="Completado"
                  value={new Date(selectedCall.completedAt).toLocaleString(
                    "es-ES",
                  )}
                />
              )}
            </div>

            {selectedCall.errorMsg && (
              <div className="mt-6 rounded-lg border border-status-danger/20 bg-status-danger/10 p-4">
                <p className="text-sm font-medium text-status-danger">Error</p>
                <p className="mt-1 text-sm text-status-danger/80">
                  {selectedCall.errorMsg}
                </p>
              </div>
            )}

            {selectedCall.metadata &&
              Object.keys(selectedCall.metadata).length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-fg-secondary">
                    Metadata
                  </p>
                  <pre className="overflow-auto rounded-lg bg-bg-elevated p-4 text-xs text-fg-secondary">
                    {JSON.stringify(selectedCall.metadata, null, 2)}
                  </pre>
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
