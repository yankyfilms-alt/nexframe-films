const STYLE_KEYWORDS = {
  hiperrealista: ["hiperrealista", "hyperrealistic", "fotorrealista", "photorealistic", "como una foto real", "realista"],
  comic: ["comic", "cómic", "comic book", "ilustracion", "ilustración", "dibujo animado", "cartoon"],
  vector: ["vector", "logo", "icono", "icon", "svg"],
  anime: ["anime", "manga"],
  producto: ["producto", "anuncio", "publicidad", "marketing", "ad", "campaña", "campaign"],
  edicion: ["edita esta", "cambia esta", "modifica esta imagen", "edit this image"]
};

const IMAGE_MODEL_BY_STYLE = {
  hiperrealista: { model: "nano-banana-pro", params: { resolution: "4k" } },
  comic: { model: "recraft-v4-1", params: { model_type: "standard" } },
  vector: { model: "recraft-v4-1", params: { model_type: "vector" } },
  anime: { model: "recraft-v4-1", params: { model_type: "standard" }, forcePromptSuffix: "anime style" },
  producto: { model: "marketing-studio-image", params: { resolution: "2k" } },
  edicion: { model: "seedream-v5-lite", params: {} },
  general: { model: "nano-banana", params: {} }
};

const VIDEO_MODEL_DEFAULT = { model: "seedance-2-0-text-to-video", params: { mode: "std", resolution: "720p" } };
const AUDIO_MODELS = {
  music: { model: "sonilo-music" },
  sfx: { model: "mirelo-text-to-audio" },
  voice: { model: "inworld-tts" }
};

export const VIDEO_DURATION_RANGES = {
  "seedance-2-0-text-to-video": { min: 4, max: 15 },
  "seedance-2-0-image-to-video": { min: 4, max: 15 },
  "seedance-1-5-image-to-video": { allowed: [4, 8, 12] },
  "minimax-hailuo-2-3": { allowed: [6, 10] }
};

export function detectStyle(promptText = "") {
  const text = String(promptText).toLowerCase();
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword))) return style;
  }
  return "general";
}

export function sanitizeTextForTTS(text = "") {
  const replacements = {
    "Dr.": "Doctor",
    "Dra.": "Doctora",
    "Sr.": "Señor",
    "Sra.": "Señora",
    "EE. UU.": "Estados Unidos",
    EEUU: "Estados Unidos",
    "p. ej.": "por ejemplo",
    "etc.": "etcétera"
  };
  let clean = String(text);
  for (const [from, to] of Object.entries(replacements)) clean = clean.split(from).join(to);
  return clean.replace(/([.,;:!?])(\S)/g, "$1 $2").trim();
}

export function selectAgentForStudio(studioName, userPrompt, projectContext = {}) {
  const studio = String(studioName || "").toLowerCase();
  const style = detectStyle(userPrompt);
  const notes = [];

  if (["image", "flyer"].includes(studio)) {
    const entry = IMAGE_MODEL_BY_STYLE[style] || IMAGE_MODEL_BY_STYLE.general;
    let prompt = String(userPrompt || "");
    if (entry.forcePromptSuffix && !prompt.toLowerCase().includes(entry.forcePromptSuffix)) {
      prompt = `${prompt}, ${entry.forcePromptSuffix}`;
      notes.push(`Prompt ajustado para forzar estilo: ${entry.forcePromptSuffix}`);
    }
    return { model: entry.model, params: entry.params, prompt, notes, agent: "Director de Fotografía / Ilustrador Senior" };
  }

  if (["video", "cinema", "documentary", "musicvideo", "effects", "lipsync"].includes(studio)) {
    const selected = projectContext.model || VIDEO_MODEL_DEFAULT.model;
    const range = VIDEO_DURATION_RANGES[selected];
    const params = {};
    if (range && projectContext.duration) params.duration = clampDuration(projectContext.duration, range);
    if (projectContext.image_url || projectContext.video_url || projectContext.audio_url) {
      notes.push("Referencias locales clasificadas y enviadas al modelo con rol de imagen, video o audio.");
    }
    return { model: selected, params, notes, agent: "Director de Cine / Supervisor de Producción" };
  }

  if (["sound", "narrative"].includes(studio)) {
    const kind = studio === "narrative" ? "voice" : projectContext.audioKind || "music";
    const entry = AUDIO_MODELS[kind] || AUDIO_MODELS.music;
    return {
      model: projectContext.model || entry.model,
      params: { duration: projectContext.duration },
      prompt: studio === "narrative" ? sanitizeTextForTTS(userPrompt) : userPrompt,
      notes,
      agent: studio === "narrative" ? "Locutor Profesional / Director de Doblaje" : "Ingeniero de Audio / Compositor"
    };
  }

  return { model: projectContext.model, params: {}, prompt: userPrompt, notes, agent: "Agente general NEXFRAME" };
}

export function validateAgentOutput(decision, muapiResponse, requestedCount = 1) {
  const outputs = extractOutputsForValidation(muapiResponse);
  const issues = [];
  if (outputs.length && requestedCount > 1 && outputs.length < requestedCount) {
    issues.push(`Se pidieron ${requestedCount} resultados y llegaron ${outputs.length}.`);
  }
  if (outputs.some((output) => output?.error)) issues.push("Uno o más outputs llegaron con error explícito.");
  return { ok: issues.length === 0, issues, outputs };
}

export function classifyUploads(files = []) {
  return files.map((file) => {
    const name = file.originalname || file.name || "";
    const mime = file.mimetype || "";
    const type = mime.startsWith("image/") ? "image"
      : mime.startsWith("audio/") ? "audio"
        : mime.startsWith("video/") ? "video"
          : mime === "application/pdf" ? "pdf"
            : mime.startsWith("text/") ? "text"
              : "file";
    return { name, type, mime, size: file.size || 0 };
  });
}

function clampDuration(value, range) {
  const numeric = Number(String(value).match(/\d+/)?.[0] || 10);
  if (range.allowed) {
    return range.allowed.reduce((best, item) => Math.abs(item - numeric) < Math.abs(best - numeric) ? item : best, range.allowed[0]);
  }
  return Math.max(range.min, Math.min(range.max, numeric));
}

function extractOutputsForValidation(response = {}) {
  if (Array.isArray(response.outputs)) return response.outputs;
  if (Array.isArray(response.data?.outputs)) return response.data.outputs;
  if (Array.isArray(response.output)) return response.output;
  if (response.output || response.url || response.data?.url) return [response.output || response.url || response.data.url];
  return [];
}
