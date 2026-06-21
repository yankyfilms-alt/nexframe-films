import { pollJob } from "./pollJob";

function directApiUrl(path) {
  if (!path.startsWith("/api") || typeof window === "undefined") return path;
  const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!configuredBaseUrl && !["localhost", "127.0.0.1"].includes(window.location.hostname)) return path;
  const baseUrl = configuredBaseUrl || `${window.location.protocol}//${window.location.hostname}:8787`;
  return `${baseUrl}${path}`;
}

export function normalizeGenerationResponse(data = {}) {
  const job = data.job || {};
  const jobId = data.job_id || job.id || data.id || "";
  const status = data.status || job.status || "queued";
  return {
    ok: data.ok !== false,
    job_id: jobId,
    status,
    studio: data.studio || job.studio || "",
    model: data.model || job.model || "",
    result: data.result || (Array.isArray(job.outputs) ? { outputs: job.outputs } : null),
    error: data.error || (data.message && data.ok === false ? { code: "generation_error", message: data.message } : null),
    job,
    raw: data
  };
}

export async function createGenerationJob(studio, payload = {}, { endpoint = "/api/generate", poll = false, pollOptions = {} } = {}) {
  try {
    const response = await fetch(directApiUrl(endpoint), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studio, ...payload })
    });
    const data = await response.json().catch(() => ({}));
    const normalized = normalizeGenerationResponse(data);
    if (!response.ok || !normalized.ok) {
      return { ok: false, error: normalized.error?.message || data.message || `HTTP ${response.status}`, data: normalized };
    }
    if (!poll) return { ok: true, job: normalized.job, data: normalized };
    const finalState = await pollJob(normalized.job_id, pollOptions);
    return finalState.ok ? { ok: true, job: finalState.job || normalized.job, data: normalized, result: finalState.result } : finalState;
  } catch (error) {
    return { ok: false, error: `Fallo de red: ${error.message}` };
  }
}
