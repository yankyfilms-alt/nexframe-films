function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["completed", "complete", "succeeded", "success", "done"].includes(value)) return "done";
  if (["failed", "failure", "cancelled", "canceled", "error"].includes(value)) return "error";
  if (["processing", "running"].includes(value)) return "processing";
  return "queued";
}

export async function pollJob(jobId, { intervalMs = 2000, timeoutMs = 180000, taskPath = "/api/task" } = {}) {
  if (!jobId) return { ok: false, error: "Falta job_id para consultar el estado." };
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${taskPath}/${encodeURIComponent(jobId)}`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        return { ok: false, error: data.error?.message || data.message || `HTTP ${response.status}`, data };
      }
      const job = data.job || data;
      const status = normalizeStatus(data.status || job.status);
      if (status === "done") return { ok: true, result: data.result || job.outputs || job.result || null, job, data };
      if (status === "error") return { ok: false, error: data.error || job.error || "El job termino con error.", job, data };
    } catch (error) {
      return { ok: false, error: `Fallo de red consultando job: ${error.message}` };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ok: false, error: `Timeout: el job tardo mas de ${Math.round(timeoutMs / 1000)} segundos.` };
}
