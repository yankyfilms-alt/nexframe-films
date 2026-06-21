const key = "nexframe-state-v3-clean";

export const initialState = {
  active: "dashboard",
  credits: 12450,
  creditsUsed: 0,
  language: "es",
  theme: "NexFrame Dark Cinema",
  sidebar: true,
  notifications: 0,
  auth: { signedIn: true, role: "admin", name: "YANKYFILMS", email: "yankyfilms@gmail.com" },
  jobs: [],
  projects: [],
  history: [],
  trash: [],
  usage: { totalCost: 0, byStudio: {}, byModel: {} }
};

export function loadState() {
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return initialState;
  }
}

export function saveState(state) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function makeJob(studio, model, form) {
  return {
    id: `JOB-${Date.now()}`,
    studio,
    model: model?.name || "Modelo no seleccionado",
    status: "queued",
    progress: 0,
    credits: model?.credits || 0,
    form,
    createdAt: new Date().toLocaleString("es-ES")
  };
}

export function makeProject(input) {
  return {
    id: `PRJ-${Date.now()}`,
    title: input.title.trim(),
    type: input.type || "Produccion",
    quality: input.quality || "Pendiente",
    status: "Activo",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    favorite: false,
    assets: []
  };
}

export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
