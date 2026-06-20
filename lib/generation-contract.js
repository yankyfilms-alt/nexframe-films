import crypto from "node:crypto";

const DEFAULT_STAGES = [
  { id: "analysis", label: "Analisis IA", progress: 20 },
  { id: "script", label: "Guion / estructura", progress: 35 },
  { id: "scenes", label: "Definicion de escenas", progress: 50 },
  { id: "assets", label: "Generacion de assets", progress: 70 },
  { id: "assembly", label: "Montaje", progress: 85 },
  { id: "delivery", label: "Archivo final", progress: 100 }
];

export function assertRemoteGenerationReady({ apiKey, endpoint, prompt }) {
  if (!String(apiKey || "").trim()) {
    const error = new Error("MUAPI_API_KEY no esta configurada. No se puede ejecutar una generacion IA real.");
    error.status = 503;
    error.code = "muapi_not_configured";
    throw error;
  }
  if (!String(endpoint || "").trim()) {
    const error = new Error("No hay un modelo compatible con endpoint MuAPI para esta solicitud.");
    error.status = 422;
    error.code = "muapi_model_missing";
    throw error;
  }
  if (!String(prompt || "").trim()) {
    const error = new Error("El prompt es obligatorio.");
    error.status = 400;
    error.code = "prompt_required";
    throw error;
  }
}

export function createGenerationJob({ studio, model, endpoint = "", input, provider = "muapi", stages = DEFAULT_STAGES }) {
  return {
    id: `nf_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`,
    remoteRequestId: "",
    status: "queued",
    progress: 10,
    provider,
    model,
    endpoint,
    studio,
    input,
    outputs: [],
    stages: stages.map((stage) => ({ ...stage, status: "queued" })),
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function isRealOutput(output) {
  if (!output || typeof output !== "object") return false;
  const url = String(output.url || output.video_url || output.image_url || output.audio_url || "");
  const remoteUrl = /^https?:\/\//i.test(url);
  const persistedLocalUrl = /^\/uploads\//i.test(url) && Number(output.bytes) > 0;
  if (!remoteUrl && !persistedLocalUrl) return false;
  const mime = String(output.mimeType || output.mime_type || "").toLowerCase();
  const type = String(output.type || "").toLowerCase();
  if (mime === "application/json" || type === "metadata") return false;
  return /^(video|image|audio)\//.test(mime) || ["video", "image", "audio", "media"].includes(type) || /\.(mp4|mov|webm|mp3|wav|m4a|png|jpe?g|webp)(?:\?|$)/i.test(url);
}

export function markJobCompleted(job, outputs) {
  const realOutputs = (outputs || []).filter(isRealOutput);
  if (!realOutputs.length) {
    const error = new Error("La IA no devolvio un archivo multimedia real; el job no puede marcarse como completado.");
    error.code = "real_output_missing";
    throw error;
  }
  return {
    ...job,
    status: "completed",
    progress: 100,
    outputs: realOutputs,
    stages: (job.stages || DEFAULT_STAGES).map((stage) => ({ ...stage, status: "completed" })),
    updatedAt: new Date().toISOString()
  };
}

export function markJobFailed(job, error) {
  return {
    ...job,
    status: "failed",
    error: error?.message || String(error || "Error de generacion."),
    updatedAt: new Date().toISOString()
  };
}

export function updateJobFromRemote(job, { status, progress, outputs = [] }) {
  const normalized = String(status || "").toLowerCase();
  if (["failed", "error", "cancelled", "canceled"].includes(normalized)) return markJobFailed(job, new Error(`MuAPI finalizo con estado ${normalized}.`));
  if (["completed", "succeeded", "success", "done"].includes(normalized) || outputs.some(isRealOutput)) return markJobCompleted(job, outputs);
  const safeProgress = Math.max(10, Math.min(95, Number(progress) || job.progress || 10));
  return { ...job, status: "processing", progress: safeProgress, updatedAt: new Date().toISOString() };
}
