const PIPELINE_STATES = new Set(["queued", "processing", "completed", "failed", "blocked"]);

const manifests = {
  image: [
    ["brief", "Dirección creativa", "agent"],
    ["generate", "Generación de imagen", "image"],
    ["quality", "Control de calidad", "quality"],
    ["delivery", "Entrega", "delivery"]
  ],
  flyer: [
    ["brief", "Brief y composición", "agent"],
    ["asset_prep", "Preparación de referencias", "image-edit"],
    ["generate", "Diseño principal", "image"],
    ["variants", "Variantes", "image"],
    ["quality", "Legibilidad y formato", "quality"],
    ["delivery", "Entrega y envío al editor", "delivery"]
  ],
  narrative: [
    ["analysis", "Analisis del texto", "agent"],
    ["voice", "Locucion profesional", "audio"],
    ["quality", "Revision de voz", "quality"],
    ["delivery", "Entrega MP3", "delivery"]
  ],
  sound: [
    ["brief", "Direccion sonora", "agent"],
    ["music", "Musica o ambiente", "music"],
    ["quality", "Revision de audio", "quality"],
    ["delivery", "Entrega de audio", "delivery"]
  ],
  marketing: [
    ["strategy", "Brief y estrategia", "agent"],
    ["research", "Investigación", "agent"],
    ["creative", "Concepto creativo", "agent"],
    ["visuals", "Creatividades", "image"],
    ["video", "Video promocional", "video"],
    ["voice", "Locución", "audio"],
    ["music", "Música", "music"],
    ["assembly", "Edición y montaje", "assembly"],
    ["quality", "Revisión", "quality"],
    ["delivery", "Pack de campaña", "delivery"]
  ],
  documentary: [
    ["research", "Investigación", "agent"],
    ["script", "Guion", "agent"],
    ["scenes", "Plan de escenas", "agent"],
    ["voice", "Narración", "audio"],
    ["visuals", "Visuales", "video"],
    ["music", "Música", "music"],
    ["subtitles", "Subtítulos", "assembly"],
    ["assembly", "Montaje", "assembly"],
    ["quality", "Control de calidad", "quality"],
    ["delivery", "Entrega", "delivery"]
  ],
  musicvideo: [
    ["analysis", "Análisis musical", "agent"],
    ["concept", "Concepto y storyboard", "agent"],
    ["visuals", "Generación de escenas", "video"],
    ["effects", "Efectos", "video-edit"],
    ["assembly", "Montaje al beat", "assembly"],
    ["quality", "Revisión", "quality"],
    ["delivery", "Entrega", "delivery"]
  ]
};

export function productionManifest(studio, input = {}) {
  const source = manifests[studio] || [
    ["brief", "Preparación", "agent"],
    ["generate", "Generación", studio],
    ["quality", "Control de calidad", "quality"],
    ["delivery", "Entrega", "delivery"]
  ];
  const staticOnly = studio === "marketing" && /miniatura|flyer|poster|cover/i.test(input.outputType || "");
  return source
    .filter(([, , capability]) => !(staticOnly && ["video", "audio", "music", "assembly"].includes(capability)))
    .map(([id, label, capability], index) => ({
      id,
      label,
      capability,
      order: index + 1,
      status: "queued",
      model: null,
      output: null,
      error: null
    }));
}

export function validateProductionRequest(studio, input = {}) {
  const errors = [];
  if (!String(studio || "").trim()) errors.push("Falta el estudio.");
  if (!String(input.prompt || input.topic || "").trim()) errors.push("Falta la dirección creativa o tema principal.");
  if (studio === "flyer" && !String(input.designType || "").trim()) errors.push("Selecciona el tipo de diseño.");
  if (studio === "marketing" && !String(input.productName || "").trim()) errors.push("Indica el producto o servicio.");
  return { ok: errors.length === 0, errors };
}

export function updateProductionStage(stages, stageId, patch = {}) {
  if (!PIPELINE_STATES.has(patch.status || "queued")) throw new Error("Estado de pipeline inválido.");
  return stages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage);
}

export function productionProgress(stages = []) {
  if (!stages.length) return 0;
  const weight = { queued: 0, blocked: 0, processing: 0.5, completed: 1, failed: 0 };
  return Math.round(stages.reduce((total, stage) => total + (weight[stage.status] || 0), 0) / stages.length * 100);
}

export function projectFromProduction(job = {}) {
  const input = job.input || {};
  return {
    id: `project_${job.id}`,
    jobId: job.id,
    title: input.title || input.productName || input.topic || input.prompt?.slice(0, 80) || "Producción NEXFRAME",
    type: job.studio,
    status: job.status,
    progress: productionProgress(job.stages),
    stages: job.stages || [],
    assets: job.outputs || [],
    timeline: job.timeline || { duration: 0, tracks: [] },
    createdAt: job.createdAt,
    updatedAt: new Date().toISOString()
  };
}
