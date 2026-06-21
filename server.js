import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import Stripe from "stripe";
import { assertRemoteGenerationReady, createGenerationJob, isRealOutput, markJobCompleted, markJobFailed, updateJobFromRemote } from "./lib/generation-contract.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { getModelContract, getMuapiModelById, getMuapiModelsForStudio, muapiRegistry } from "./src/data/models-registry.js";
import { classifyUploads, sanitizeTextForTTS, selectAgentForStudio, validateAgentOutput } from "./src/data/agents-runtime.js";
import { productionManifest, projectFromProduction, validateProductionRequest } from "./lib/production-engine.js";
import { openMontageStatus } from "./lib/openmontage-bridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "nexframe-db.json");
const sessionCookie = "nf_session";

function loadServerEnv() {
  const envFile = path.join(__dirname, ".env");
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadServerEnv();
const authSecret = process.env.NEXFRAME_AUTH_SECRET || "nexframe-local-auth-secret-change-before-production";
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-17.clover" }) : null;

const app = express();
const jobs = new Map();
const audit = [];
const v6ProviderRegistry = readJsonFile("nexframe_v6_provider_registry.json", { panels: {}, gateway: "MuAPI first" });
const v6ButtonActionMap = readJsonFile("nexframe_v6_full_button_action_map.json", { global: [], states_required: [] });
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/json",
  "text/plain",
  "text/markdown",
  "application/octet-stream"
]);
function localNetworkOrigins() {
  const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 8787];
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
  return addresses.flatMap((address) => ports.map((portNumber) => `http://${address}:${portNumber}`));
}

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:5178",
  "http://localhost:5179",
  "http://localhost:5180",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5177",
  "http://127.0.0.1:5178",
  "http://127.0.0.1:5179",
  "http://127.0.0.1:5180",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  ...localNetworkOrigins()
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultAllowedOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateBuckets = new Map();
const blockedIps = new Map();

function readJsonFile(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, filename), "utf8"));
  } catch {
    return fallback;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function defaultPlans() {
  return [
    {
      id: "creator",
      name: "Creator",
      active: true,
      highlighted: false,
      credits: 2000,
      projectLimit: 3,
      resolution: "1080p",
      watermark: false,
      commercialUse: "Estandar",
      storage: "50 GB",
      support: "Email",
      teamSeats: 1,
      cycles: {
        monthly: { label: "Mensual", months: 1, price: 19, stripePriceId: process.env.STRIPE_PRICE_CREATOR_MONTHLY || "" },
        quarterly: { label: "Trimestral", months: 3, price: 54, stripePriceId: process.env.STRIPE_PRICE_CREATOR_QUARTERLY || "" },
        annual: { label: "Anual", months: 12, price: 182, stripePriceId: process.env.STRIPE_PRICE_CREATOR_ANNUAL || "" }
      }
    },
    {
      id: "professional",
      name: "Professional",
      active: true,
      highlighted: true,
      credits: 8000,
      projectLimit: "Ilimitados",
      resolution: "4K",
      watermark: false,
      commercialUse: "Extendido",
      storage: "100 GB",
      support: "Prioritario",
      teamSeats: 3,
      cycles: {
        monthly: { label: "Mensual", months: 1, price: 49, stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || "" },
        quarterly: { label: "Trimestral", months: 3, price: 139, stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL_QUARTERLY || "" },
        annual: { label: "Anual", months: 12, price: 470, stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || "" }
      }
    },
    {
      id: "studio",
      name: "Studio",
      active: true,
      highlighted: false,
      credits: 20000,
      projectLimit: "Ilimitados",
      resolution: "8K",
      watermark: false,
      commercialUse: "Ilimitado",
      storage: "500 GB",
      support: "VIP 24/7",
      teamSeats: 10,
      cycles: {
        monthly: { label: "Mensual", months: 1, price: 99, stripePriceId: process.env.STRIPE_PRICE_STUDIO_MONTHLY || "" },
        quarterly: { label: "Trimestral", months: 3, price: 282, stripePriceId: process.env.STRIPE_PRICE_STUDIO_QUARTERLY || "" },
        annual: { label: "Anual", months: 12, price: 950, stripePriceId: process.env.STRIPE_PRICE_STUDIO_ANNUAL || "" }
      }
    }
  ];
}

function defaultPublicData() {
  const studioImages = {
    video: "/assets/panel-cards/video-studio.png",
    image: "/assets/panel-cards/image-studio.png",
    sound: "/assets/panel-cards/sound-studio.png",
    script: "/assets/panel-cards/script-engine.png",
    lipsync: "/assets/panel-cards/lip-sync-studio.png",
    documentary: "/assets/panel-cards/documentary-studio.png",
    musicvideo: "/assets/panel-cards/music-video-studio.png",
    flyer: "/assets/panel-cards/flyer-studio.png",
    editor: "/assets/nexframe-official/pack2/panels/29_video_editor_timeline.png",
    marketing: "/assets/public-web/landing-reference.png",
    cinema: "/assets/panel-cards/cinema-studio.png",
    narrative: "/assets/panel-cards/narrativa-y-voz.png"
  };
  return {
    site: {
      logoUrl: "/assets/nexframe-official-logo.png",
      faviconUrl: "/nexframe-favicon.svg",
      primaryColor: "#9e1b1b",
      accentColor: "#d4a437",
      neonEnabled: true,
      particlesEnabled: true,
      animationsEnabled: true,
      heroLayout: "cinematic-panel",
      publicEnabled: true,
      updatedAt: new Date().toISOString()
    },
    landing: {
      announcementText: "NexFrame 2.5 ya disponible con efectos cinematograficos avanzados y mas control creativo.",
      announcementLink: "/resources",
      heroTitle: "Crea historias que merecen ser vistas.",
      heroSubtitle: "Produce peliculas, videos y campanas de nivel profesional con herramientas de IA intuitivas. Menos tiempo tecnico, mas tiempo para crear historias que conectan.",
      primaryCtaText: "Comenzar gratis",
      primaryCtaUrl: "/register",
      secondaryCtaText: "Ver como funciona",
      secondaryCtaUrl: "/how-it-works",
      footerDescription: "La plataforma de produccion audiovisual con IA para creadores, equipos y productoras.",
      updatedAt: new Date().toISOString()
    },
    heroVideo: {
      videoUrl: "",
      thumbnailUrl: "/assets/nexframe-hero-scene.png",
      fallbackImageUrl: "/assets/nexframe-hero-scene.png",
      title: "Tu proxima historia empieza aqui.",
      subtitle: "Crea, revisa y publica con un flujo de estudio completo.",
      ctaText: "Explorar estudios",
      ctaUrl: "/studios",
      autoplay: false,
      muted: true,
      loop: true,
      showPlayButton: true,
      isActive: true,
      previews: [
        { id: "urban", title: "Urban Nights", imageUrl: "/assets/panel-cards/video-studio.png" },
        { id: "echoes", title: "Echoes of Time", imageUrl: "/assets/panel-cards/cinema-studio.png" },
        { id: "neon", title: "Neon District", imageUrl: "/assets/panel-cards/flyer-studio.png" },
        { id: "signal", title: "The Last Signal", imageUrl: "/assets/panel-cards/documentary-studio.png" },
        { id: "stars", title: "Beyond the Stars", imageUrl: "/assets/panel-cards/image-studio.png" }
      ],
      updatedAt: new Date().toISOString()
    },
    benefits: [
      { id: "creativity", title: "Desata tu creatividad", body: "Ideas sin limites con herramientas inteligentes.", icon: "Zap", isVisible: true, order: 1 },
      { id: "time", title: "Ahorra tiempo", body: "De semanas a minutos. Crea y publica mas rapido.", icon: "RefreshCw", isVisible: true, order: 2 },
      { id: "quality", title: "Calidad profesional", body: "Resultados cinematograficos que impresionan.", icon: "Gem", isVisible: true, order: 3 },
      { id: "control", title: "Control total", body: "Ajusta cada detalle y manten tu vision intacta.", icon: "Settings", isVisible: true, order: 4 },
      { id: "team", title: "Colabora sin fricciones", body: "Invita, comenta y crea en equipo en tiempo real.", icon: "Users", isVisible: true, order: 5 },
      { id: "scale", title: "Publica y escala", body: "Entrega en cualquier formato y multiplica tu impacto.", icon: "Send", isVisible: true, order: 6 }
    ],
    howItWorks: [
      { id: "choose", title: "Elige tu estudio", body: "Selecciona la herramienta ideal para tu proyecto.", order: 1 },
      { id: "create", title: "Crea con IA", body: "Genera, edita y ajusta con control total.", order: 2 },
      { id: "review", title: "Colabora y revisa", body: "Invita a tu equipo y mejora en tiempo real.", order: 3 },
      { id: "publish", title: "Publica y comparte", body: "Exporta, publica y haz que tu historia llegue lejos.", order: 4 }
    ],
    studios: [
      { id: "video", title: "Video Studio", description: "Crea videos y cortos con calidad cinematografica.", imageUrl: studioImages.video, route: "/app/video", isVisible: true, order: 1, ctaText: "Abrir estudio" },
      { id: "image", title: "Image Studio", description: "Genera imagenes de alto impacto y realismo.", imageUrl: studioImages.image, route: "/app/image", isVisible: true, order: 2, ctaText: "Abrir estudio" },
      { id: "sound", title: "Sound Studio", description: "Musica, efectos y ambientes para tus producciones.", imageUrl: studioImages.sound, route: "/app/sound", isVisible: true, order: 3, ctaText: "Abrir estudio" },
      { id: "script", title: "Script Engine", description: "Escribe guiones y desarrolla historias inolvidables.", imageUrl: studioImages.script, route: "/app/script", isVisible: true, order: 4, ctaText: "Abrir estudio" },
      { id: "lipsync", title: "Lip Sync Studio", description: "Sincroniza labios y voces con realismo perfecto.", imageUrl: studioImages.lipsync, route: "/app/lipsync", isVisible: true, order: 5, ctaText: "Abrir estudio" },
      { id: "documentary", title: "Documentary Studio", description: "Crea documentales y reportajes impactantes.", imageUrl: studioImages.documentary, route: "/app/documentary", isVisible: true, order: 6, ctaText: "Abrir estudio" },
      { id: "musicvideo", title: "Music Video Studio", description: "Videoclips y visuales que llevan tu musica mas lejos.", imageUrl: studioImages.musicvideo, route: "/app/musicvideo", isVisible: true, order: 7, ctaText: "Abrir estudio" },
      { id: "flyer", title: "Flyer Studio", description: "Disena posters y flyers que atraen todas las miradas.", imageUrl: studioImages.flyer, route: "/app/flyer", isVisible: true, order: 8, ctaText: "Abrir estudio" },
      { id: "editor", title: "Video Editor Studio AI", description: "Edita, subtitula y exporta con timeline inteligente.", imageUrl: studioImages.editor, route: "/editor", isVisible: true, order: 9, ctaText: "Abrir editor" },
      { id: "marketing", title: "Marketing", description: "Crea campanas visuales y piezas listas para publicar.", imageUrl: studioImages.marketing, route: "/app/marketing", isVisible: true, order: 10, ctaText: "Crear campana" },
      { id: "cinema", title: "Cinema Studio", description: "Control de camara, lente y toma cinematografica.", imageUrl: studioImages.cinema, route: "/app/cinema", isVisible: true, order: 11, ctaText: "Abrir estudio" },
      { id: "narrative", title: "Narrativa y Voz", description: "Narraciones, locucion profesional y salida en audio.", imageUrl: studioImages.narrative, route: "/app/narrative", isVisible: true, order: 12, ctaText: "Crear voz" }
    ],
    testimonials: [
      { id: "valeria", name: "Valeria M.", role: "Directora Creativa", avatarUrl: "", text: "NexFrame cambio por completo mi forma de trabajar. Pase de una idea a un video terminado en minutos.", stars: 5, isVisible: true, featured: true, order: 1 },
      { id: "diego", name: "Diego R.", role: "Filmmaker", avatarUrl: "", text: "La calidad es increible y el flujo me permite concentrarme en contar historias, no en pelearme con herramientas.", stars: 5, isVisible: true, featured: false, order: 2 },
      { id: "andrea", name: "Andrea G.", role: "Marketing Manager", avatarUrl: "", text: "Antes tardabamos dias en preparar piezas de campana. Ahora podemos probar ideas y publicar mucho mas rapido.", stars: 5, isVisible: true, featured: false, order: 3 },
      { id: "laura", name: "Laura C.", role: "Productora", avatarUrl: "", text: "Lo mejor es tener video, guion, musica, edicion y entrega en un solo lugar.", stars: 5, isVisible: true, featured: false, order: 4 }
    ],
    metrics: [
      { id: "creators", value: "+250K", label: "Creadores y productoras", isVisible: true, order: 1 },
      { id: "projects", value: "+2.5M", label: "Proyectos creados", isVisible: true, order: 2 },
      { id: "satisfaction", value: "98%", label: "Satisfaccion de usuarios", isVisible: true, order: 3 },
      { id: "support", value: "24/7", label: "Soporte para tu equipo", isVisible: true, order: 4 }
    ],
    faq: [
      { id: "experience", question: "Necesito experiencia para usar NexFrame?", answer: "No. La plataforma guia el proceso para que puedas crear contenido profesional sin dominar herramientas tecnicas complejas.", isVisible: true, order: 1 },
      { id: "commercial", question: "Puedo usar mis proyectos comercialmente?", answer: "Si. Los planes estan pensados para creadores, marcas y equipos que necesitan publicar contenido profesional.", isVisible: true, order: 2 },
      { id: "cancel", question: "Puedo cancelar cuando quiera?", answer: "Si. Puedes cambiar o cancelar tu plan desde tu cuenta segun el ciclo contratado.", isVisible: true, order: 3 },
      { id: "team", question: "Puedo trabajar con mi equipo?", answer: "Si. Los planes profesionales permiten organizar proyectos, revisar piezas y colaborar con mas control.", isVisible: true, order: 4 },
      { id: "credits", question: "Que ocurre si se acaban mis creditos?", answer: "Puedes comprar creditos adicionales o cambiar a un plan superior desde la seccion de planes.", isVisible: true, order: 5 },
      { id: "edit", question: "Puedo editar un proyecto despues de generarlo?", answer: "Si. Los proyectos pueden abrirse en los estudios compatibles para ajustar escenas, audio, subtitulos y exportacion.", isVisible: true, order: 6 }
    ],
    examples: [
      { id: "urban", title: "Urban Nights", category: "Videoclip", imageUrl: "/assets/panel-cards/music-video-studio.png" },
      { id: "echoes", title: "Echoes of Time", category: "Cortometraje", imageUrl: "/assets/panel-cards/cinema-studio.png" },
      { id: "neon", title: "Neon District", category: "Flyer", imageUrl: "/assets/panel-cards/flyer-studio.png" },
      { id: "signal", title: "The Last Signal", category: "Trailer", imageUrl: "/assets/panel-cards/video-studio.png" },
      { id: "stars", title: "Beyond the Stars", category: "Documental", imageUrl: "/assets/panel-cards/documentary-studio.png" },
      { id: "dark", title: "Dark Currents", category: "Campana", imageUrl: "/assets/public-web/landing-reference.png" }
    ],
    seo: {
      metaTitle: "NEXFRAME FILMS - Plataforma de cine con IA",
      metaDescription: "Crea videos, imagenes, musica, documentales y campanas audiovisuales con herramientas profesionales de IA.",
      ogImage: "/assets/public-web/landing-reference.png",
      keywords: "cine con ia, video con ia, produccion audiovisual, creadores, documentales",
      canonicalUrl: "/"
    },
    legal: {
      terms: "Terminos de servicio NEXFRAME FILMS.",
      privacy: "Politica de privacidad NEXFRAME FILMS.",
      cookies: "Politica de cookies NEXFRAME FILMS.",
      contact: "soporte@nexframefilms.com",
      socials: ["YouTube", "Instagram", "TikTok", "Discord"],
      copyright: "© 2026 NexFrame Films. Todos los derechos reservados."
    }
  };
}

function defaultDb() {
  const adminEmail = process.env.NEXFRAME_ADMIN_EMAIL || "admin@nexframe.local";
  const adminPassword = process.env.NEXFRAME_ADMIN_PASSWORD || "NexFrameLocal2026!";
  return {
    users: [{
      id: `usr_${requestId()}`,
      name: "YANKYFILMS",
      email: adminEmail,
      role: "admin",
      passwordHash: hashPassword(adminPassword),
      createdAt: new Date().toISOString(),
      active: true
    }],
    plans: defaultPlans(),
    subscriptions: [],
    payments: [],
    passwordResets: [],
    siteContent: {
      heroTitle: "Crea historias que merecen ser vistas",
      heroSubtitle: "Produccion cinematografica con IA para creadores, estudios y marcas.",
      ctaPrimary: "Comenzar gratis",
      ctaSecondary: "Ver planes",
      publicEnabled: true
    },
    publicWebsite: defaultPublicData(),
    projects: [],
    documentaryProjects: [],
    productionProjects: [],
    jobs: [],
    usage: { creditsTotal: 12450, creditsUsed: 0, byStudio: {}, byModel: {} },
    createdAt: new Date().toISOString()
  };
}

function ensureDbShape(database) {
  let changed = false;
  if (!Array.isArray(database.plans) || database.plans.length < 3) {
    database.plans = defaultPlans();
    changed = true;
  }
  if (!Array.isArray(database.subscriptions)) {
    database.subscriptions = [];
    changed = true;
  }
  if (!Array.isArray(database.payments)) {
    database.payments = [];
    changed = true;
  }
  if (!Array.isArray(database.passwordResets)) {
    database.passwordResets = [];
    changed = true;
  }
  if (!Array.isArray(database.documentaryProjects)) {
    database.documentaryProjects = [];
    changed = true;
  }
  if (!Array.isArray(database.productionProjects)) {
    database.productionProjects = [];
    changed = true;
  }
  if (!database.siteContent) {
    database.siteContent = {
      heroTitle: "Crea historias que merecen ser vistas",
      heroSubtitle: "Produccion cinematografica con IA para creadores, estudios y marcas.",
      ctaPrimary: "Comenzar gratis",
      ctaSecondary: "Ver planes",
      publicEnabled: true
    };
    changed = true;
  }
  const publicDefaults = defaultPublicData();
  if (!database.publicWebsite) {
    database.publicWebsite = publicDefaults;
    changed = true;
  } else {
    for (const [key, value] of Object.entries(publicDefaults)) {
      if (database.publicWebsite[key] === undefined) {
        database.publicWebsite[key] = value;
        changed = true;
      }
    }
  }
  return changed;
}

function loadDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    const created = defaultDb();
    fs.writeFileSync(dbFile, JSON.stringify(created, null, 2));
    return created;
  }
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}

function saveDb(db) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

const db = loadDb();
if (ensureDbShape(db)) saveDb(db);
(db.jobs || []).forEach((job) => jobs.set(job.id, job));

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  safe.subscription = activeSubscriptionFor(user.id);
  return safe;
}

function activeSubscriptionFor(userId) {
  const now = Date.now();
  return (db.subscriptions || [])
    .filter((item) => item.userId === userId && item.status === "active" && new Date(item.renewsAt).getTime() > now)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] || null;
}

function findPlan(planId, cycleId) {
  const plan = (db.plans || []).find((item) => item.id === planId && item.active !== false);
  const cycle = plan?.cycles?.[cycleId];
  if (!plan || !cycle) return null;
  return { plan, cycle };
}

function activatePlanForUser({ userId, planId, cycleId, provider = "local-ledger", paymentId = "", invoiceId = "" }) {
  const found = findPlan(planId, cycleId);
  if (!found) throw new Error("Plan o ciclo no valido.");
  const { plan, cycle } = found;
  const startedAt = new Date();
  const renewsAt = addMonths(startedAt, cycle.months);
  const subscription = {
    id: `sub_${requestId()}`,
    userId,
    planId: plan.id,
    planName: plan.name,
    cycleId,
    cycleLabel: cycle.label,
    price: Number(cycle.price),
    credits: Number(plan.credits),
    status: "active",
    provider,
    paymentId,
    invoiceId,
    startedAt: startedAt.toISOString(),
    renewsAt: renewsAt.toISOString()
  };
  db.subscriptions = [
    subscription,
    ...(db.subscriptions || []).map((item) => item.userId === userId ? { ...item, status: "replaced" } : item)
  ];
  db.payments = [{
    id: paymentId || `pay_${requestId()}`,
    invoiceId: invoiceId || `inv_${requestId()}`,
    userId,
    planId: plan.id,
    cycleId,
    provider,
    amount: Number(cycle.price),
    currency: "usd",
    status: "paid",
    createdAt: new Date().toISOString()
  }, ...(db.payments || [])];
  db.usage = db.usage || { creditsTotal: 0, creditsUsed: 0, byStudio: {}, byModel: {} };
  db.usage.creditsTotal = Number(plan.credits);
  db.usage.creditsUsed = 0;
  saveDb(db);
  return subscription;
}

function signSession(user, maxAgeMs = 1000 * 60 * 60 * 12) {
  const payload = Buffer.from(JSON.stringify({
    userId: user.id,
    role: user.role,
    exp: Date.now() + maxAgeMs
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function sessionCookieHeader(token, maxAgeSeconds) {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

function clearSessionCookieHeader() {
  const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}

function publicBaseUrl(req) {
  return process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
}

function verifySession(token) {
  const [payload, sig] = String(token || "").split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return db.users.find((user) => user.id === parsed.userId && user.active) || null;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((part) => part.trim()).filter((part) => part.includes("=")).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
  }));
}

function currentUser(req) {
  return verifySession(parseCookies(req)[sessionCookie]);
}

function recordUsage({ studio, model, credits = 0, cost = 0 }) {
  db.usage = db.usage || { creditsTotal: 12450, creditsUsed: 0, byStudio: {}, byModel: {}, totalCost: 0 };
  const numericCredits = Number(credits) || 0;
  const numericCost = Number(cost) || 0;
  db.usage.creditsUsed = Number(db.usage.creditsUsed || 0) + numericCredits;
  db.usage.totalCost = Number(db.usage.totalCost || 0) + numericCost;
  if (studio) db.usage.byStudio[studio] = Number(db.usage.byStudio[studio] || 0) + numericCredits;
  if (model) db.usage.byModel[model] = Number(db.usage.byModel[model] || 0) + numericCredits;
  saveDb(db);
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ ok: false, message: "Sesion requerida." });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user || user.role !== "admin") return res.status(403).json({ ok: false, message: "Acceso de administrador requerido." });
  req.user = user;
  next();
}

function ensureEditorStore() {
  if (!Array.isArray(db.editorProjects)) db.editorProjects = [];
  if (!Array.isArray(db.editorVersions)) db.editorVersions = [];
}

function editorProjectForUser(projectId, userId) {
  ensureEditorStore();
  return db.editorProjects.find((project) => project.id === projectId && project.userId === userId) || null;
}

function editorMediaDir(projectId) {
  const directory = path.join(__dirname, "public", "uploads", "editor", projectId);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

async function probeEditorMedia(filePath) {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath], { timeout: 30000 });
  const result = JSON.parse(stdout || "{}");
  const video = (result.streams || []).find((stream) => stream.codec_type === "video");
  const audio = (result.streams || []).find((stream) => stream.codec_type === "audio");
  return {
    duration: Number(result.format?.duration || video?.duration || audio?.duration || 0),
    width: Number(video?.width || 0),
    height: Number(video?.height || 0),
    fps: video?.avg_frame_rate || "0/0",
    videoCodec: video?.codec_name || null,
    audioCodec: audio?.codec_name || null,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio)
  };
}

function applyEditorOperation(project, operation) {
  const tracks = project.timeline?.tracks || [];
  const locate = (clipId) => tracks.flatMap((track) => track.clips.map((clip) => ({ track, clip }))).find((entry) => entry.clip.id === clipId);
  const numeric = (value, name) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} invalido.`);
    return parsed;
  };
  if (!operation?.type) throw new Error("Operacion sin type.");
  if (operation.type === "delete_clip") {
    const entry = locate(operation.clipId);
    if (!entry) throw new Error("Clip no encontrado.");
    entry.track.clips = entry.track.clips.filter((clip) => clip.id !== operation.clipId);
  } else if (operation.type === "split_clip") {
    const entry = locate(operation.clipId);
    const time = numeric(operation.time, "time");
    if (!entry || time <= entry.clip.start || time >= entry.clip.end) throw new Error("El playhead debe estar dentro del clip.");
    const second = { ...entry.clip, id: `clip_${requestId()}`, start: time, in: Number(entry.clip.in || 0) + (time - entry.clip.start) };
    entry.clip.end = time;
    entry.track.clips.push(second);
  } else if (operation.type === "trim_clip") {
    const entry = locate(operation.clipId);
    if (!entry) throw new Error("Clip no encontrado.");
    const start = numeric(operation.newIn, "newIn");
    const end = numeric(operation.newOut, "newOut");
    if (end <= start) throw new Error("El final debe ser posterior al inicio.");
    entry.clip.start = start;
    entry.clip.end = end;
  } else if (operation.type === "move_clip") {
    const entry = locate(operation.clipId);
    const target = tracks.find((track) => track.id === operation.trackId);
    if (!entry || !target) throw new Error("Clip o pista no encontrado.");
    if (entry.track.type !== target.type && !(entry.track.type === "video" && target.type === "image")) throw new Error("Tipo de pista incompatible.");
    const start = numeric(operation.newStart, "newStart");
    const length = entry.clip.end - entry.clip.start;
    entry.track.clips = entry.track.clips.filter((clip) => clip.id !== entry.clip.id);
    target.clips.push({ ...entry.clip, start, end: start + length });
  } else if (operation.type === "duplicate_clip") {
    const entry = locate(operation.clipId);
    if (!entry) throw new Error("Clip no encontrado.");
    const length = entry.clip.end - entry.clip.start;
    entry.track.clips.push({ ...entry.clip, id: `clip_${requestId()}`, start: entry.clip.end, end: entry.clip.end + length, name: `${entry.clip.name} copia` });
  } else if (operation.type === "delete_range") {
    const track = tracks.find((item) => item.id === operation.trackId);
    const start = numeric(operation.start, "start");
    const end = numeric(operation.end, "end");
    if (!track || end <= start) throw new Error("Pista o rango invalido.");
    track.clips = track.clips.flatMap((clip) => {
      if (clip.end <= start || clip.start >= end) return [clip];
      const result = [];
      if (clip.start < start) result.push({ ...clip, end: start });
      if (clip.end > end) result.push({ ...clip, id: `clip_${requestId()}`, start: end, in: Number(clip.in || 0) + (end - clip.start) });
      return result;
    });
  } else if (operation.type === "add_subtitles") {
    let track = tracks.find((item) => item.type === "text");
    if (!track) { track = { id: `track_${requestId()}`, type: "text", name: "Subtitulos", clips: [] }; tracks.push(track); }
    track.clips.push({ id: `clip_${requestId()}`, type: "text", name: "Subtitulos", text: operation.text || "Subtitulos pendientes de transcripcion", start: 0, end: project.timeline.duration || 1, style: operation.style || "nexframe-default" });
  } else {
    throw new Error(`Operacion no implementada: ${operation.type}`);
  }
  project.timeline.duration = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => Number(clip.end || 0))));
  project.updatedAt = new Date().toISOString();
  return project;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Tipo de archivo no permitido."));
      return;
    }
    cb(null, true);
  }
});

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false,
  referrerPolicy: false,
  xContentTypeOptions: false
}));
app.use((req, res, next) => {
  const localConnectSrc = [...allowedOrigins, ...Array.from({ length: 9 }, (_, index) => `http://localhost:${8787 + index}`), ...Array.from({ length: 9 }, (_, index) => `http://127.0.0.1:${8787 + index}`)].join(" ");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", `default-src 'self'; img-src 'self' data: blob: https://cdn.muapi.ai https://*.muapi.ai https://d3adwkbyhxyrtq.cloudfront.net; media-src 'self' blob: https://cdn.muapi.ai https://*.muapi.ai https://d3adwkbyhxyrtq.cloudfront.net; connect-src 'self' ${localConnectSrc} https://api.muapi.ai https://cdn.muapi.ai https://*.muapi.ai https://d3adwkbyhxyrtq.cloudfront.net; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`);
  next();
});
app.use(cors({
  credentials: true,
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error("Origen no autorizado por CORS."));
  }
}));
app.use(express.json({ limit: "2mb" }));

function rateLimit(limit = 300, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "local";
    const isLocalRequest = ["::1", "127.0.0.1", "::ffff:127.0.0.1", "local"].includes(key);
    const effectiveLimit = isLocalRequest && process.env.NODE_ENV !== "production" ? Math.max(limit, 5000) : limit;
    const now = Date.now();
    const blockedUntil = blockedIps.get(key) || 0;
    if (blockedUntil > now) {
      return res.status(429).json({ ok: false, message: "IP bloqueada temporalmente por exceso de solicitudes." });
    }
    const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    rateBuckets.set(key, bucket);
    if (bucket.count > effectiveLimit) {
      blockedIps.set(key, now + windowMs);
      log("IP_TEMPORARILY_BLOCKED", { ip: key, limit: effectiveLimit, windowMs });
      return res.status(429).json({ ok: false, message: "Demasiadas solicitudes. Intenta de nuevo en un minuto." });
    }
    next();
  };
}

app.use("/api", rateLimit());

app.use((req, res, next) => {
  if (/\.(env|json)$/i.test(req.path) && /api key|secret|env/i.test(req.path)) {
    return res.status(403).json({ ok: false, message: "Archivo protegido." });
  }
  next();
});

const providers = {
  muapi: {
    name: "MUAPI Universal",
    baseUrl: process.env.MUAPI_API_BASE_URL || "https://api.muapi.ai",
    apiKey: process.env.MUAPI_API_KEY || ""
  },
  kling: {
    name: "Kling AI",
    baseUrl: process.env.KLING_API_BASE || process.env.KLING_API_BASE_URL || "",
    apiKey: process.env.KLING_API_KEY || ""
  },
  openai: {
    name: "OpenAI",
    baseUrl: process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY || ""
  }
};

function requestId() {
  return crypto.randomBytes(8).toString("hex");
}

function log(action, metadata = {}) {
  audit.unshift({ id: requestId(), action, metadata, createdAt: new Date().toISOString() });
  audit.splice(200);
}

function persistJob(job) {
  const jobsList = db.jobs || [];
  const index = jobsList.findIndex((item) => item.id === job.id);
  if (index >= 0) jobsList[index] = job;
  else jobsList.unshift(job);
  db.jobs = jobsList.slice(0, 500);
  if (job.pipeline && Array.isArray(db.productionProjects)) {
    const projectIndex = db.productionProjects.findIndex((item) => item.jobId === job.id);
    if (projectIndex >= 0) {
      const previous = db.productionProjects[projectIndex];
      db.productionProjects[projectIndex] = { ...previous, ...projectFromProduction(job), userId: previous.userId, editorProjectId: previous.editorProjectId };
    }
  }
  saveDb(db);
}

function publicProviderStatus() {
  return Object.entries(providers).map(([id, provider]) => ({
    id,
    name: provider.name,
    configured: Boolean(provider.baseUrl && provider.apiKey),
    baseUrl: safeProviderOrigin(provider.baseUrl),
    status: provider.baseUrl && provider.apiKey ? "ready" : "requires_configuration"
  }));
}

function safeProviderOrigin(baseUrl) {
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "configured";
  }
}

async function testProvider(id) {
  const provider = providers[id];
  if (!provider) return { ok: false, status: "unknown_provider", message: "Proveedor no registrado." };
  if (!provider.baseUrl || !provider.apiKey) {
    return { ok: false, status: "requires_configuration", message: "Configura API base URL y API key en variables de entorno del servidor." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(provider.baseUrl,
    {
      method: "GET",
      headers: id === "muapi" ? { "x-api-key": provider.apiKey } : { Authorization: `Bearer ${provider.apiKey}` },
      signal: controller.signal
    });
    const ok = response.status < 500;
    return { ok, status: response.status, message: ok ? `Conexion segura validada. El proveedor respondio con HTTP ${response.status} sin ejecutar generacion.` : `Proveedor respondio con HTTP ${response.status}.` };
  } catch (error) {
    return { ok: false, status: "connection_failed", message: error.name === "AbortError" ? "Timeout probando el proveedor." : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function formatMuapiRemoteError(remote = {}, fallback = "MuAPI rechazo la solicitud.") {
  if (Array.isArray(remote.detail) && remote.detail.length) {
    const details = remote.detail.map((item) => {
      const field = Array.isArray(item.loc) ? item.loc.filter((part) => part !== "body").join(".") : "";
      return [field, item.msg].filter(Boolean).join(": ");
    }).filter(Boolean);
    if (details.length) return details.join(" | ");
  }
  return remote.message || remote.error || fallback;
}

function targetAspectRatio(input = {}) {
  const text = `${input.target || input.format || input.ratio || input.aspect_ratio || ""}`;
  if (text.includes("9:16")) return "9:16";
  if (text.includes("1:1")) return "1:1";
  if (text.includes("21:9")) return "21:9";
  if (text.includes("4:3")) return "4:3";
  if (text.includes("3:4")) return "3:4";
  return text.includes("16:9") ? "16:9" : undefined;
}

function parseDuration(value) {
  if (value === undefined || value === null) return undefined;
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

const providerInputAliases = {
  negative: "negative_prompt",
  ratio: "aspect_ratio",
  format: "aspect_ratio",
  quality: "resolution",
  amount: "num_images",
  variants: "num_images",
  referenceImage: "image_url",
  image: "image_url",
  avatar_url: "image_url",
  avatarImage: "image_url",
  referenceVideo: "video_url",
  cloneVideo: "video_url",
  localAudio: "audio_url",
  referenceAudio: "audio_url"
};

function inferredRequiredMediaKeys(studio, modelInfo = {}) {
  const text = `${studio || ""} ${modelInfo.id || ""} ${modelInfo.name || ""} ${modelInfo.endpoint || ""} ${modelInfo.type || ""}`.toLowerCase();
  const keys = [];
  if (text.includes("lipsync") || text.includes("lip-sync") || text.includes("lip sync") || text.includes("infinitetalk")) {
    keys.push(text.includes("video-to-video") ? "video_url" : "image_url", "audio_url");
  } else {
    if (text.includes("image-to-video") || text.includes("img2video")) keys.push("image_url");
    if (text.includes("video-to-video") || text.includes("extend") || text.includes("effects") || text.includes("vfx")) keys.push("video_url");
  }
  return [...new Set(keys)];
}

function isSunoSongModel(modelInfo = {}) {
  const text = `${modelInfo.id || ""} ${modelInfo.name || ""} ${modelInfo.endpoint || ""}`.toLowerCase();
  return text.includes("suno") && !/sounds|voice-clone|mashup/.test(text);
}

function schemaDefault(schema = {}) {
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.minimum !== undefined) return schema.minimum;
  if (schema.minValue !== undefined) return schema.minValue;
  if (schema.type === "boolean") return false;
  return undefined;
}

function canonicalInputKey(key) {
  return providerInputAliases[key] || key;
}

function coerceSchemaValue(key, value, schema = {}) {
  if (value === undefined || value === null || value === "") return value;
  if (key === "duration") return parseDuration(value);
  if (key === "aspect_ratio") return targetAspectRatio({ aspect_ratio: value }) || value;
  if (schema.type === "boolean") return value === true || value === "true";
  if (schema.type === "int" || schema.type === "integer" || schema.type === "number") {
    const parsed = Number(String(value).match(/-?\d+(\.\d+)?/)?.[0] ?? value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}

function validateMuapiPayload(input = {}, modelInfo = {}, studio = "") {
  const supports = new Set(modelInfo.supports || Object.keys(modelInfo.inputs || {}));
  [modelInfo.imageField, modelInfo.videoField, modelInfo.audioField].filter(Boolean).forEach((field) => supports.add(field));
  inferredRequiredMediaKeys(studio, modelInfo).forEach((field) => supports.add(field));
  const schemas = modelInfo.inputs || {};
  if (!supports.size) return cleanObject(input);
  if (modelInfo.hasPrompt !== false && !String(input.prompt || "").trim()) {
    const error = new Error("Falta el prompt. El texto del usuario es obligatorio para este modelo.");
    error.status = 400;
    throw error;
  }
  const mapped = {};
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith("__")) continue;
    if (["uploads", "agent", "agentDecision"].includes(key)) continue;
    if (key === "text_context" && value && supports.has("prompt")) {
      mapped.prompt = `${mapped.prompt || input.prompt || ""}\n\nContexto adicional del archivo subido:\n${String(value).slice(0, 3000)}`.trim();
      continue;
    }
    const canonicalKey = supports.has(key) ? key : canonicalInputKey(key);
    if (!supports.has(canonicalKey) && canonicalKey !== "prompt") continue;
    mapped[canonicalKey] = coerceSchemaValue(canonicalKey, value, schemas[canonicalKey]);
  }
  for (const [key, schema] of Object.entries(schemas)) {
    if (mapped[key] === undefined) {
      const fallback = schemaDefault(schema);
      if (fallback !== undefined) mapped[key] = fallback;
    }
    if (schema.required && (mapped[key] === undefined || mapped[key] === "")) {
      const error = new Error(`Falta el parametro obligatorio "${schema.title || key}" para este modelo.`);
      error.status = 400;
      throw error;
    }
    if (Array.isArray(schema.enum) && schema.enum.length && mapped[key] !== undefined && !schema.enum.includes(mapped[key])) {
      const error = new Error(`El parametro "${schema.title || key}" no soporta "${mapped[key]}". Opciones validas: ${schema.enum.join(", ")}.`);
      error.status = 400;
      throw error;
    }
    if ((schema.type === "int" || schema.type === "integer" || schema.type === "number") && mapped[key] !== undefined) {
      if (!Number.isFinite(Number(mapped[key]))) {
        const error = new Error(`El parametro "${schema.title || key}" debe ser numerico.`);
        error.status = 400;
        throw error;
      }
      const min = schema.minValue ?? schema.minimum;
      const max = schema.maxValue ?? schema.maximum;
      if (min !== undefined && Number(mapped[key]) < Number(min)) {
        const error = new Error(`El parametro "${schema.title || key}" debe ser mayor o igual a ${min}.`);
        error.status = 400;
        throw error;
      }
      if (max !== undefined && Number(mapped[key]) > Number(max)) {
        const error = new Error(`El parametro "${schema.title || key}" debe ser menor o igual a ${max}.`);
        error.status = 400;
        throw error;
      }
    }
  }
  for (const key of inferredRequiredMediaKeys(studio, modelInfo)) {
    if (mapped[key] === undefined || mapped[key] === "") {
      const error = new Error(`Falta el parametro obligatorio "${key}" para este modelo.`);
      error.status = 400;
      throw error;
    }
  }
  if (studio === "sound" && isSunoSongModel(modelInfo) && (mapped.style === undefined || mapped.style === "")) {
    const error = new Error('Falta el parametro obligatorio "style" para Suno. Es el prompt instrumental / estilo musical.');
    error.status = 400;
    throw error;
  }
  return cleanObject(mapped);
}

function extractRequestId(remote = {}) {
  return remote.request_id || remote.requestId || remote.prediction_id || remote.predictionId || remote.id || remote.job_id || "";
}

function extractOutputs(remote = {}) {
  const candidates = [
    remote.output,
    remote.outputs,
    remote.result,
    remote.data?.output,
    remote.data?.outputs,
    remote.data?.result,
    remote.url,
    remote.video_url,
    remote.image_url,
    remote.audio_url
  ].filter(Boolean);
  return candidates.flatMap((item) => Array.isArray(item) ? item : [item]).map((item, index) => {
    if (typeof item === "string") return { type: "media", title: `MuAPI output ${index + 1}`, url: item };
    return item;
  });
}

function outputExtension(url, contentType = "") {
  let pathname = "";
  try { pathname = new URL(url).pathname; } catch { pathname = ""; }
  const ext = path.extname(pathname).toLowerCase();
  if (/^\.(mp4|mov|webm|mp3|wav|m4a|png|jpg|jpeg|webp)$/.test(ext)) return ext;
  if (contentType.includes("video/mp4")) return ".mp4";
  if (contentType.includes("audio/mpeg")) return ".mp3";
  if (contentType.includes("audio/wav")) return ".wav";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("image/")) return ".jpg";
  throw new Error(`MuAPI devolvio un formato no descargable (${contentType || "sin Content-Type"}).`);
}

async function persistRemoteOutputs(job, outputs) {
  const realOutputs = outputs.filter(isRealOutput);
  if (!realOutputs.length) throw new Error("MuAPI no devolvio ningun archivo multimedia real.");
  const studio = job.studio || "general";
  const dir = path.join(__dirname, "public", "uploads", "generations", studio);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  for (let index = 0; index < realOutputs.length; index += 1) {
    const output = realOutputs[index];
    const sourceUrl = output.url || output.video_url || output.image_url || output.audio_url;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(sourceUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`No se pudo descargar output MuAPI: HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type") || output.mimeType || "";
      const extension = outputExtension(sourceUrl, contentType);
      const filename = `${job.id}_${index + 1}${extension}`;
      const target = path.join(dir, filename);
      fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
      saved.push({ ...output, sourceUrl, url: `/uploads/generations/${studio}/${filename}`, mimeType: contentType.split(";")[0] || output.mimeType, bytes: fs.statSync(target).size });
    } finally {
      clearTimeout(timeout);
    }
  }
  return saved;
}

async function uploadFileToMuapi(file) {
  if (!providers.muapi.apiKey) return null;
  const formData = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  formData.append("file", blob, file.originalname);
  const response = await fetch(`${providers.muapi.baseUrl.replace(/\/$/, "")}/api/v1/upload_file`, {
    method: "POST",
    headers: { "x-api-key": providers.muapi.apiKey },
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `MuAPI upload HTTP ${response.status}`);
  return data.url || data.file_url || data.data?.url || data.data?.file_url || data.result?.url || null;
}

async function collectUploadedFileInputs(files = []) {
  const merged = {};
  const classified = classifyUploads(files);
  if (classified.length) merged.uploads = classified;
  for (const file of files) {
    const field = file.fieldname;
    const url = providers.muapi.apiKey ? await uploadFileToMuapi(file) : null;
    const value = url || `${file.originalname} (${file.size} bytes)`;
    if (field.toLowerCase().includes("audio")) merged.audio_url = value;
    else if (field.toLowerCase().includes("video") || field.toLowerCase().includes("clone")) merged.video_url = value;
    else if (field.toLowerCase().includes("avatar")) merged.avatar_url = value;
    else if (field.toLowerCase().includes("image")) merged.image_url = value;
    else if (file.mimetype === "application/pdf" || file.mimetype?.startsWith("text/")) merged.text_context = value;
    merged[field] = value;
  }
  return merged;
}

async function startMuapiPolling(jobId, requestIdValue) {
  if (!requestIdValue || !providers.muapi.apiKey) return;
  const endpoint = `${providers.muapi.baseUrl.replace(/\/$/, "")}/api/v1/predictions/${encodeURIComponent(requestIdValue)}/result`;
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts += 1;
    const job = jobs.get(jobId);
    if (!job || ["completed", "failed", "cancelled"].includes(job.status) || attempts > 120) {
      clearInterval(timer);
      return;
    }
    try {
      const response = await fetch(endpoint, { headers: { "x-api-key": providers.muapi.apiKey } });
      const remote = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(remote.message || `MuAPI polling HTTP ${response.status}`);
      const remoteStatus = String(remote.status || remote.data?.status || "").toLowerCase();
      const outputs = extractOutputs(remote);
      let updated = updateJobFromRemote(job, {
        status: remoteStatus,
        progress: remote.progress || remote.data?.progress || Math.min(95, 10 + attempts * 4),
        outputs
      });
      if (updated.status === "completed") {
        try {
          updated = markJobCompleted(updated, await persistRemoteOutputs(updated, updated.outputs));
        } catch (error) {
          updated = markJobFailed(updated, error);
        }
      }
      jobs.set(updated.id, updated);
      persistJob(updated);
      if (["completed", "failed"].includes(updated.status)) clearInterval(timer);
    } catch (error) {
      const updated = attempts >= 3 ? markJobFailed(job, error) : { ...job, status: "processing", error: error.message };
      jobs.set(updated.id, updated);
      persistJob(updated);
      if (attempts >= 3) clearInterval(timer);
    }
  }, 2500);
}

function createLocalJob(payload) {
  const id = `nf_${Date.now()}_${requestId()}`;
  const job = {
    id,
    status: "queued",
    progress: 0,
    provider: payload.provider || "local",
    model: payload.model || "nexframe-local-engine",
    studio: payload.studio,
    input: payload.input,
    outputs: [],
    stages: payload.stages || [],
    error: null,
    createdAt: new Date().toISOString()
  };
  jobs.set(id, job);
  persistJob(job);

  if (payload.autoComplete === false) return job;

  const timer = setInterval(() => {
    const current = jobs.get(id);
    if (!current || current.status === "completed" || current.status === "failed" || current.status === "cancelled") {
      clearInterval(timer);
      return;
    }
    current.status = "processing";
    current.progress = Math.min(100, current.progress + 20);
    if (Array.isArray(current.stages) && current.stages.length) {
      current.stages = current.stages.map((stage, index) => {
        const threshold = ((index + 1) / current.stages.length) * 100;
        return { ...stage, status: current.progress >= threshold ? "completed" : current.progress >= threshold - 25 ? "processing" : "queued" };
      });
    }
    if (current.progress >= 100) {
      current.status = "completed";
      current.outputs = [{
        type: ["sound", "narrative"].includes(current.studio) ? "audio" : ["image", "flyer"].includes(current.studio) ? "image" : "video",
        title: `${current.studio} output`,
        url: `/api/outputs/${id}`,
        mimeType: "application/json",
        duration: current.studio === "sound" ? 7 : current.studio === "image" ? null : 10
      }];
    }
    jobs.set(id, current);
    persistJob(current);
  }, 900);

  return job;
}

function normalizeJobStatus(status) {
  const value = String(status || "").toLowerCase();
  if (["completed", "complete", "succeeded", "success", "done"].includes(value)) return "done";
  if (["failed", "failure", "cancelled", "canceled", "error"].includes(value)) return "error";
  if (["processing", "running"].includes(value)) return "processing";
  return "queued";
}

function generationResultFromJob(job = {}) {
  if (Array.isArray(job.outputs) && job.outputs.length) {
    return { outputs: job.outputs, url: job.outputs[0]?.url || null, metadata: job.outputs[0] || null };
  }
  if (job.project) return { url: null, metadata: job.project };
  return null;
}

function generationErrorPayload(error, fallbackCode = "generation_error") {
  if (!error) return null;
  if (typeof error === "string") return { code: fallbackCode, message: error };
  return {
    code: error.code || fallbackCode,
    message: error.message || "Error de generacion.",
    status: error.status
  };
}

function universalGenerationPayload({ ok = true, job = {}, error = null, extra = {} } = {}) {
  return {
    ok,
    job_id: job?.id || extra.job_id || null,
    status: ok ? normalizeJobStatus(job?.status || extra.status) : "error",
    studio: job?.studio || extra.studio || null,
    model: job?.model || extra.model || null,
    result: ok ? generationResultFromJob(job) : null,
    error: ok ? null : generationErrorPayload(error || extra.error),
    ...extra,
    job
  };
}

function sendGeneration(res, { statusCode = 200, ok = true, job = {}, error = null, extra = {} } = {}) {
  return res.status(statusCode).json(universalGenerationPayload({ ok, job, error, extra }));
}

async function callMuapiAdapter({ endpoint, apiKey, modelId, payload, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = formatMuapiRemoteError(data, `MuAPI HTTP ${response.status}`);
      log("MUAPI_ADAPTER_FAILED", { model: modelId, status: response.status, message });
      return { ok: false, status: response.status, error: { code: "muapi_http_error", message }, data };
    }
    return { ok: true, data, status: response.status };
  } catch (error) {
    const networkDetail = error.cause?.message || error.cause?.code || "";
    const message = error.name === "AbortError" ? "Timeout creando job remoto MuAPI." : `${error.message}${networkDetail ? `: ${networkDetail}` : ""}`;
    log("MUAPI_ADAPTER_ERROR", { model: modelId, message, code: error.cause?.code });
    return { ok: false, status: 502, error: { code: "muapi_request_error", message } };
  } finally {
    clearTimeout(timeout);
  }
}

function modelForPipelineStage(job, stage) {
  const input = job.input || {};
  const requested = stage.capability === "image" || stage.capability === "image-edit" ? input.imageModel || input.model
    : stage.capability === "video" || stage.capability === "video-edit" ? input.videoModel || input.model
      : stage.capability === "audio" ? input.audioModel || input.voiceModel || "minimax-speech-2.6-hd"
        : stage.capability === "music" ? input.musicModel || input.audioModel
          : null;
  const selected = requested ? getMuapiModelById(requested) : null;
  if (selected) return selected;
  if (stage.capability === "image" || stage.capability === "image-edit") return getMuapiModelById("nano-banana");
  if (stage.capability === "audio") return getMuapiModelById("minimax-speech-2.6-hd");
  return null;
}

async function waitForMuapiResult(requestIdValue, attempts = 120) {
  const endpoint = `${providers.muapi.baseUrl.replace(/\/$/, "")}/api/v1/predictions/${encodeURIComponent(requestIdValue)}/result`;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(endpoint, { headers: { "x-api-key": providers.muapi.apiKey } });
    const remote = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(formatMuapiRemoteError(remote, `MuAPI polling HTTP ${response.status}`));
    const outputs = extractOutputs(remote);
    const status = String(remote.status || remote.data?.status || "").toLowerCase();
    if (outputs.some(isRealOutput) || ["completed", "success", "succeeded", "done"].includes(status)) return { remote, outputs };
    if (["failed", "error", "cancelled", "canceled"].includes(status)) throw new Error(formatMuapiRemoteError(remote, "MuAPI no pudo completar la etapa."));
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("Timeout esperando el resultado de MuAPI.");
}

function videoModelForProduction(input = {}) {
  const requested = String(input.videoModel || input.model || "").trim();
  if (requested && requested !== "auto" && getMuapiModelById(requested)) return getMuapiModelById(requested);
  return getMuapiModelById("seedance-lite-t2v") || getMuapiModelById("veo3.1-lite-text-to-video") || getMuapiModelsForStudio("video")[0];
}

function productionVideoInput(job = {}, stage = {}) {
  const input = job.input || {};
  const prompt = [
    input.prompt || input.topic || "Produccion audiovisual NEXFRAME",
    input.description && `Contexto: ${input.description}`,
    input.visualStyle && `Estilo visual: ${input.visualStyle}`,
    input.narrativeStyle && `Tono narrativo: ${input.narrativeStyle}`,
    input.musicGenre && `Genero musical: ${input.musicGenre}`,
    input.editStyle && `Edicion: ${input.editStyle}`,
    input.script && `Guion/direccion: ${input.script}`,
    job.studio === "musicvideo" ? "Videoclip cinematografico editado al beat, sin artista real visible, usando modelos ficticios, siluetas, b-roll, luces rojas y doradas, montaje musical profesional." : "",
    job.studio === "documentary" ? "Documental cinematografico con b-roll realista, escenas de investigacion, camara profesional, textura broadcast, sin texto gigante ni fondo blanco." : "",
    stage.label && `Etapa: ${stage.label}. Entregar clip final usable, no placeholder.`
  ].filter(Boolean).join("\n");
  return {
    ...input,
    prompt,
    aspect_ratio: targetAspectRatio(input) || "16:9",
    duration: Math.min(5, Math.max(3, parseDuration(input.testDuration || input.clipDuration || 5) || 5)),
    resolution: /720/.test(String(input.resolution || "")) ? "720p" : "480p"
  };
}

async function generateRealMuapiVideoForJob(job, stage = {}) {
  if (!providers.muapi.apiKey) throw new Error("MUAPI_API_KEY requerida para generar video real.");
  const modelInfo = videoModelForProduction(job.input);
  if (!modelInfo) throw new Error("No hay modelo de video MuAPI disponible para esta produccion.");
  const requestBody = validateMuapiPayload(productionVideoInput(job, stage), modelInfo, job.studio);
  const endpointPath = modelInfo.endpoint || modelInfo.id;
  const adapter = await callMuapiAdapter({
    endpoint: `${providers.muapi.baseUrl.replace(/\/$/, "")}/api/v1/${endpointPath.replace(/^\//, "")}`,
    apiKey: providers.muapi.apiKey,
    modelId: modelInfo.id,
    payload: requestBody,
    timeoutMs: 30000
  });
  if (!adapter.ok) throw new Error(adapter.error?.message || `Fallo la generacion real con ${modelInfo.id}.`);
  let outputs = extractOutputs(adapter.data);
  const remoteRequestId = extractRequestId(adapter.data);
  if (!outputs.some(isRealOutput) && remoteRequestId) outputs = (await waitForMuapiResult(remoteRequestId)).outputs;
  if (!outputs.some(isRealOutput)) throw new Error("MuAPI termino sin devolver MP4 real.");
  const saved = await persistRemoteOutputs({ ...job, model: modelInfo.id }, outputs);
  return { modelInfo, remoteRequestId, saved };
}

function narrationVoiceForInput(input = {}, studio = "") {
  const text = `${input.voiceModel || ""} ${input.voiceStyle || ""} ${input.narrativeStyle || ""}`.toLowerCase();
  if (/comercial|venta|vendedora|marketing|energetica|joven/.test(text) || studio === "marketing") return "Spanish_RationalMan";
  if (/oscuro|misterio|documental|codigo blanco|grave|cine/.test(text) || studio === "documentary") return "Spanish_Narrator";
  if (/story|historia|emocion|cinematic/.test(text)) return "Spanish_CaptivatingStoryteller";
  return "Spanish_Narrator";
}

function narrationWordTarget(seconds, pace = "dramatic") {
  const wordsPerMinute = pace === "fast" ? 155 : pace === "standard" ? 135 : 115;
  return Math.max(18, Math.ceil((Math.max(1, Number(seconds) || 1) / 60) * wordsPerMinute));
}

function countWords(text = "") {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function buildNarrationText(input = {}, targetSeconds = 10, studio = "narrative", blockIndex = 0) {
  const baseText = sanitizeTextForTTS(input.script || input.text || input.prompt || input.topic || "");
  const targetWords = narrationWordTarget(targetSeconds, /rapido|agil|fast/i.test(input.voiceStyle || input.narrativeStyle || "") ? "fast" : /estandar|standard/i.test(input.voiceStyle || input.narrativeStyle || "") ? "standard" : "dramatic");
  if (countWords(baseText) >= targetWords * 0.92) return baseText;
  const topic = baseText || "esta produccion audiovisual";
  const studioLine = studio === "marketing"
    ? `El mensaje se presenta con claridad comercial, una promesa directa y una voz segura que guia al espectador hacia la accion.`
    : studio === "documentary"
      ? `La narracion avanza con tono cinematografico, pausas naturales y tension informativa sin exagerar los hechos.`
      : `La locucion mantiene un ritmo natural, cercano y profesional, con diccion limpia en espanol latinoamericano.`;
  const blocks = [
    `${topic}. ${studioLine}`,
    `En este bloque se desarrolla la idea con contexto, intencion y una progresion clara para que la voz respire como una narracion humana.`,
    `La frase no se repite ni se rellena; se amplia con informacion util, atmosfera y continuidad para cubrir la duracion solicitada.`,
    `Cada segmento se puede unir al siguiente sin estirar audio, manteniendo volumen estable, cadencia natural y entrega final lista para montaje.`
  ];
  const words = baseText ? [baseText] : [];
  let guard = 0;
  while (countWords(words.join(" ")) < targetWords && guard < 200) {
    words.push(blocks[(blockIndex + guard) % blocks.length]);
    guard += 1;
  }
  return sanitizeTextForTTS(words.join(" "));
}

function splitNarrationIntoBlocks(input = {}, targetSeconds = 10, studio = "narrative") {
  const maxBlockSeconds = Math.max(10, Math.min(180, Number(input.maxAudioBlockSeconds || 180)));
  const totalSeconds = Math.max(1, Math.round(Number(targetSeconds) || 10));
  const blockCount = Math.max(1, Math.ceil(totalSeconds / maxBlockSeconds));
  const blocks = [];
  for (let index = 0; index < blockCount; index += 1) {
    const remaining = totalSeconds - (index * maxBlockSeconds);
    const blockSeconds = Math.min(maxBlockSeconds, remaining);
    blocks.push({
      index,
      targetSeconds: blockSeconds,
      text: buildNarrationText(input, blockSeconds, studio, index)
    });
  }
  return blocks;
}

async function generateMuapiSpeechBlock(job, text, index = 0) {
  const input = job.input || {};
  const modelInfo = getMuapiModelById(input.audioModel || input.voiceModel || "minimax-speech-2.6-hd");
  if (!providers.muapi.apiKey) throw new Error("MUAPI_API_KEY requerida para generar voz real.");
  if (!modelInfo) throw new Error("No hay modelo TTS MuAPI disponible para esta locucion.");
  const payload = validateMuapiPayload({
    prompt: text,
    voice_id: narrationVoiceForInput(input, job.studio),
    speed: Math.max(0.9, Math.min(1, Number(input.voiceSpeed || input.speed || 1))),
    volume: 1,
    pitch: 0,
    emotion: input.emotion || "neutral",
    sample_rate: 44100,
    bitrate: 128000,
    channel: 1,
    format: "mp3",
    language_boost: "Spanish"
  }, modelInfo, "narrative");
  const endpointPath = modelInfo.endpoint || modelInfo.id;
  const adapter = await callMuapiAdapter({
    endpoint: `${providers.muapi.baseUrl.replace(/\/$/, "")}/api/v1/${endpointPath.replace(/^\//, "")}`,
    apiKey: providers.muapi.apiKey,
    modelId: modelInfo.id,
    payload,
    timeoutMs: 30000
  });
  if (!adapter.ok) throw new Error(adapter.error?.message || `Fallo la sintesis de voz con ${modelInfo.id}.`);
  let outputs = extractOutputs(adapter.data);
  const remoteRequestId = extractRequestId(adapter.data);
  if (!outputs.some(isRealOutput) && remoteRequestId) outputs = (await waitForMuapiResult(remoteRequestId, 90)).outputs;
  if (!outputs.some(isRealOutput)) throw new Error("MuAPI termino la voz sin devolver audio real.");
  const saved = await persistRemoteOutputs({ ...job, model: modelInfo.id, id: `${job.id}_voice_${index + 1}` }, outputs);
  return { modelInfo, output: saved[0], text, requestId: remoteRequestId };
}

async function concatenateAudioOutputs(job, outputs = [], targetSeconds = 0) {
  const audioPaths = outputs.map((output) => uploadUrlToLocalPath(output.url)).filter((filePath) => filePath && fs.existsSync(filePath));
  if (!audioPaths.length) throw new Error("No hay bloques de audio reales para unir.");
  if (audioPaths.length === 1) return outputs[0];
  const studio = job.studio || "narrative";
  const outputDir = path.join(__dirname, "public", "uploads", "final-renders", studio);
  fs.mkdirSync(outputDir, { recursive: true });
  const listPath = path.join(outputDir, `${job.id}_voice_concat.txt`);
  const outputName = `${job.id}_voice_final.mp3`;
  const outputPath = path.join(outputDir, outputName);
  fs.writeFileSync(listPath, audioPaths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");
  await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:a", "libmp3lame", "-b:a", "160k", outputPath], { cwd: __dirname, timeout: 20 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });
  const duration = await probeMediaDuration(outputPath);
  const stats = fs.statSync(outputPath);
  return {
    id: `voice_${requestId()}`,
    type: "audio",
    title: "Locucion final por bloques",
    url: `/uploads/final-renders/${studio}/${outputName}`,
    mimeType: "audio/mpeg",
    duration,
    targetDuration: targetSeconds,
    blocks: outputs.length,
    bytes: stats.size,
    createdAt: new Date().toISOString()
  };
}

async function generateNarrationAudioForJob(job, stage = {}) {
  const input = job.input || {};
  const targetSeconds = Math.max(1, productionTargetSeconds(job.studio || "narrative", {
    ...input,
    duration: input.voiceDuration || input.testDuration || input.duration || input.targetDuration || "10s"
  }));
  const blocks = splitNarrationIntoBlocks(input, targetSeconds, job.studio || "narrative");
  const generated = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const result = await generateMuapiSpeechBlock(job, blocks[index].text, index);
    generated.push(result.output);
  }
  const finalAudio = await concatenateAudioOutputs(job, generated, targetSeconds);
  finalAudio.scriptBlocks = blocks.map((block) => ({ index: block.index + 1, targetSeconds: block.targetSeconds, words: countWords(block.text) }));
  finalAudio.stage = stage.id || stage.label || "voice";
  return finalAudio;
}

async function runProductionPipeline(jobId) {
  let job = jobs.get(jobId);
  if (!job) return;
  if (!providers.muapi.apiKey) {
    job = { ...job, status: "failed", error: "MUAPI_API_KEY no está configurada en el servidor.", stages: job.stages.map((stage, index) => index === 0 ? { ...stage, status: "failed", error: "Credencial MuAPI requerida." } : stage) };
    jobs.set(job.id, job); persistJob(job); return;
  }
  try {
    job.status = "processing";
    for (let index = 0; index < job.stages.length; index += 1) {
      const stage = job.stages[index];
      job.stages[index] = { ...stage, status: "processing", error: null };
      job.progress = Math.round(index / job.stages.length * 100);
      jobs.set(job.id, job); persistJob(job);
      const forceRealVideo = ["documentary", "musicvideo"].includes(job.studio) && stage.capability === "video";
      const forceRealAudio = stage.capability === "audio";
      const modelInfo = forceRealAudio ? null : forceRealVideo ? videoModelForProduction(job.input) : ["documentary", "musicvideo"].includes(job.studio) ? null : modelForPipelineStage(job, stage);
      if (modelInfo) {
        if (forceRealVideo) {
          const generated = await generateRealMuapiVideoForJob(job, stage);
          job.outputs = [...(job.outputs || []), ...generated.saved];
          job.stages[index] = { ...job.stages[index], model: generated.modelInfo.id, output: generated.saved[0] || null, status: "completed" };
        } else {
        const endpointPath = modelInfo.endpoint || modelInfo.id;
        const stagePrompt = `${job.input.prompt}\n\nEtapa: ${stage.label}. Mantén la dirección creativa, formato y assets del proyecto.`;
        const stageInput = { ...job.input, prompt: stagePrompt };
        if (stage.capability === "music") {
          stageInput.style = stageInput.style || stageInput.soundtrackStyle || stageInput.musicStyle || "cinematic commercial background, clean, modern, broadcast ready";
          stageInput.instrumental = stageInput.instrumental !== false;
          stageInput.title = stageInput.title || `${job.studio || "NEXFRAME"} audio bed`;
          if (modelInfo.inputs?.channel) stageInput.channel = 1;
        }
        const requestBody = validateMuapiPayload(stageInput, modelInfo, job.studio);
        const adapter = await callMuapiAdapter({ endpoint: `${providers.muapi.baseUrl.replace(/\/$/, "")}/api/v1/${endpointPath.replace(/^\//, "")}`, apiKey: providers.muapi.apiKey, modelId: modelInfo.id, payload: requestBody, timeoutMs: 30000 });
        if (!adapter.ok) throw new Error(adapter.error?.message || `Falló ${stage.label}.`);
        let outputs = extractOutputs(adapter.data);
        const remoteRequestId = extractRequestId(adapter.data);
        if (!outputs.some(isRealOutput) && remoteRequestId) outputs = (await waitForMuapiResult(remoteRequestId)).outputs;
        if (!outputs.some(isRealOutput)) throw new Error(`${stage.label} terminó sin archivo multimedia real.`);
        const persisted = await persistRemoteOutputs(job, outputs);
        job.outputs = [...(job.outputs || []), ...persisted];
        job.stages[index] = { ...job.stages[index], model: modelInfo.id, output: persisted[0] || null, status: "completed" };
        }
      } else if (forceRealAudio) {
        const audio = await generateNarrationAudioForJob(job, stage);
        job.outputs = [...(job.outputs || []), audio];
        job.stages[index] = { ...job.stages[index], model: job.input.audioModel || job.input.voiceModel || "minimax-speech-2.6-hd", output: audio, status: "completed" };
      } else {
        job.stages[index] = { ...job.stages[index], model: "NEXFRAME Orchestrator", status: "completed" };
      }
      job.progress = Math.round((index + 1) / job.stages.length * 100);
      jobs.set(job.id, job); persistJob(job);
    }
    job.status = "completed";
    job.progress = 100;
    if (["documentary", "musicvideo", "marketing"].includes(job.studio) && (job.outputs || []).some((output) => /video|mp4/i.test(`${output.type || ""} ${output.mimeType || ""} ${output.url || ""}`))) {
      const finalRender = await renderProductionFinal(job);
      job.finalRender = finalRender;
      job.outputs = [finalRender, ...(job.outputs || [])];
    }
    const previousProject = (db.productionProjects || []).find((item) => item.jobId === job.id || item.id === job.project?.id);
    job.project = {
      ...projectFromProduction(job),
      userId: job.userId || job.project?.userId || previousProject?.userId || null
    };
    const existingProjectIndex = (db.productionProjects || []).findIndex((item) => item.jobId === job.id || item.id === job.project.id);
    if (existingProjectIndex >= 0) db.productionProjects[existingProjectIndex] = job.project;
    else db.productionProjects.unshift(job.project);
    saveDb(db);
    jobs.set(job.id, job); persistJob(job);
  } catch (error) {
    const activeIndex = job.stages.findIndex((stage) => stage.status === "processing");
    if (activeIndex >= 0) job.stages[activeIndex] = { ...job.stages[activeIndex], status: "failed", error: error.message };
    job.status = "failed";
    job.error = error.message;
    jobs.set(job.id, job); persistJob(job);
  }
}

function validateRegistryAtStartup() {
  const studiosToCheck = ["image", "video", "sound", "effects", "lipsync", "documentary", "musicvideo", "flyer", "cinema"];
  const pipelineStudios = ["marketing", "narrative"];
  const errors = [];
  const warnings = [];
  for (const studio of studiosToCheck) {
    const modelsForStudio = getMuapiModelsForStudio(studio);
    if (!modelsForStudio.length) errors.push(`Studio "${studio}" no tiene modelos registrados.`);
    for (const model of modelsForStudio) {
      if (!getMuapiModelById(model.id)) errors.push(`Modelo "${model.id}" referenciado en studio "${studio}" no existe en muapiRegistry.`);
    }
  }
  for (const studio of pipelineStudios) {
    if (!getMuapiModelsForStudio(studio).length) warnings.push(`Studio "${studio}" usa pipeline/agente o seleccion dinamica; sin modelo directo dedicado en registry.`);
  }
  if (errors.length) {
    console.error("[NEXFRAME Registry] ERRORES DETECTADOS:");
    errors.forEach((error) => console.error(`  - ${error}`));
  } else {
    console.log("[NEXFRAME Registry] Registry validado correctamente.");
  }
  if (warnings.length) warnings.forEach((warning) => console.warn(`[NEXFRAME Registry] Aviso: ${warning}`));
  return { ok: errors.length === 0, errors, warnings };
}

const documentaryAgentProfile = {
  id: "nexframe-documentary-director",
  name: "NEXFRAME Documentary Director Agent",
  role: "Director documental, investigador, guionista, productor, editor y supervisor de exportacion.",
  rules: [
    "Mantener el tema exacto del usuario como prioridad creativa.",
    "Dividir proyectos largos en escenas y bloques editables.",
    "Calcular duracion, voz, musica, visuales, subtitulos y exportacion sin estirar audio.",
    "Usar estilo broadcast profesional, con opciones tipo National Geographic, investigativo o Codigo Blanco."
  ]
};

function documentaryMinutes(input = {}) {
  const match = String(input.duration || input.maxDuration || "30 minutos").match(/\d+/);
  return Math.min(90, Math.max(1, Number(match?.[0] || 30)));
}

function documentarySceneCount(input = {}) {
  const minutes = documentaryMinutes(input);
  return Math.max(6, Math.min(54, Math.ceil(minutes / 2)));
}

function buildDocumentaryScenes(input = {}) {
  const topic = String(input.topic || input.prompt || "Documental").trim();
  const minutes = documentaryMinutes(input);
  const count = documentarySceneCount(input);
  const sceneDuration = Math.max(60, Math.round((minutes * 60) / count));
  return Array.from({ length: count }).map((_, index) => {
    const start = index * sceneDuration;
    const end = Math.min(minutes * 60, start + sceneDuration);
    return {
      id: `scene_${String(index + 1).padStart(2, "0")}`,
      number: index + 1,
      title: [
        "Apertura cinematografica",
        "Contexto y origen",
        "Pistas principales",
        "Conflicto central",
        "Evidencia visual",
        "Conclusion y cierre"
      ][index % 6],
      prompt: `${topic}. Escena ${index + 1}. Estilo ${input.visualStyle || "ultra realista cinematografico"}, formato ${input.format || "YouTube 16:9"}, tono ${input.narrativeStyle || "documental profesional"}.`,
      timecode: `${formatSeconds(start)} - ${formatSeconds(end)}`,
      voiceover: `Bloque narrativo ${index + 1} sobre ${topic}, con ritmo documental y tension progresiva.`,
      visualModel: input.imageModel || "nano-banana",
      videoModel: input.videoModel || "veo3.1-text-to-video"
    };
  });
}

function formatSeconds(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(value / 60);
  const sec = String(Math.floor(value % 60)).padStart(2, "0");
  return `${min}:${sec}`;
}

function musicVideoPipelineStages(input = {}) {
  return [
    { id: "audio_analysis", label: "Analisis de cancion", model: input.audioAnalysisModel || "auto-audio-analysis", status: "queued" },
    { id: "script_sync", label: "Sincronizacion de guion", model: "NEXFRAME Script Sync", status: "queued" },
    { id: "artist_identity", label: "Identidad del artista", model: input.imageModel || "nano-banana", status: "queued" },
    { id: "storyboard", label: "Storyboard", model: input.imageModel || "nano-banana", status: "queued" },
    { id: "scene_prompts", label: "Prompts por escena", model: "NEXFRAME Scene Agent", status: "queued" },
    { id: "images", label: "Imagenes IA", model: input.imageModel || "nano-banana", status: "queued" },
    { id: "clips", label: "Clips IA/locales", model: input.videoModel || "veo3.1-text-to-video", status: "queued" },
    { id: "lip_sync", label: "Lip Sync", model: input.lipSyncModel || "infinitetalk-image-to-video", status: "queued" },
    { id: "effects", label: "Efectos y color", model: input.vfxModel || "ai-video-effects", status: "queued" },
    { id: "edit", label: "Montaje automatico", model: input.editModel || "ffmpeg-beat-edit", status: "queued" },
    { id: "export", label: "Exportacion final", model: input.renderModel || "ffmpeg", status: "queued" }
  ];
}

function musicVideoTimeline(input = {}) {
  const style = input.visualStyle || "Hollywood Music Video";
  return [
    ["00:00", "00:12", "Intro", "Presentacion visual", "Plano abierto, atmosfera, logo/sello si aplica", "Light leaks, film grain"],
    ["00:12", "00:38", "Verso 1", "Performance / narrativa", "Modelo o personaje ficticio en locacion principal; artista real fuera de camara", "Cortes suaves al beat"],
    ["00:38", "00:52", "Pre-coro", "Construccion", "Movimiento de camara y tension visual", "Speed ramp controlado"],
    ["00:52", "01:20", "Coro", "Impacto", "Escena principal con maxima energia", "VFX, luces, transiciones fuertes"],
    ["01:20", "01:48", "Verso 2", "B-roll / historia", "Clips locales o escenas generadas", "Color matching"],
    ["01:48", "02:10", "Puente", "Cambio emocional", "Slow motion, close ups, siluetas", "Glow, humo, sombras"],
    ["02:10", "02:40", "Coro final", "Cierre fuerte", `Look ${style}`, "Montaje rapido al beat"],
    ["02:40", "03:00", "Outro", "Salida", "Plano final y cierre editorial", "Fade cinematico"]
  ].map(([start, end, section, role, scene, effects], index) => ({
    id: `mv_scene_${index + 1}`,
    start,
    end,
    section,
    role,
    scene,
    effects,
    lipSync: Boolean(input.allowVisibleArtist === true) && ["Verso 1", "Coro", "Verso 2", "Coro final"].includes(section),
    visibilityRule: "El artista real nunca aparece en pantalla; usar modelos, personajes ficticios, siluetas, manos, objetos, escenarios y b-roll.",
    status: "pending"
  }));
}

function buildMusicVideoProject(input = {}, stages = []) {
  return {
    studio: "music_video",
    project_id: `mv_${requestId()}`,
    status: "processing",
    song: {
      audio_url: input.audio_url || null,
      duration: input.duration || null,
      bpm: null,
      genre: input.musicGenre || "auto",
      sections: musicVideoTimeline(input).map((item) => ({ start: item.start, end: item.end, name: item.section }))
    },
    artist: {
      reference_images: [input.artistImage, input.referenceImages].filter(Boolean),
      reference_videos: [input.video_url, input.localClips].filter(Boolean),
      identity_profile: input.artistName || null,
      screen_policy: "no_visible_artist"
    },
    settings: {
      aspect_ratio: input.aspectRatio || input.target || "16:9",
      resolution: input.resolution || "1080p",
      fps: input.fps || 30,
      visual_style: input.visualStyle || "Hollywood Music Video",
      music_genre: input.musicGenre || "auto",
      edit_style: input.editStyle || "beat synced cinematic",
      lyrics_enabled: Boolean(input.lyricsEnabled || input.subtitles),
      artist_visibility: "El artista real no aparece en pantalla salvo instruccion explicita del usuario."
    },
    models: {
      video: input.videoModel || "auto",
      image: input.imageModel || "auto",
      lip_sync: input.lipSyncModel || "auto",
      audio_analysis: input.audioAnalysisModel || "auto",
      vfx: input.vfxModel || "auto",
      render: input.renderModel || "ffmpeg"
    },
    inputs: {
      prompt: input.prompt || "",
      script: input.script || "",
      lyrics: input.lyrics || "",
      files: input.uploads || []
    },
    stages: stages.map((stage) => ({ id: stage.id, name: stage.label, status: "pending", model: stage.model })),
    timeline: musicVideoTimeline(input),
    outputs: {
      analysis: null,
      storyboard: null,
      scenes: [],
      clips: [],
      lip_sync_clips: [],
      subtitles: null,
      final_video_url: null,
      thumbnail_url: null,
      project_pack_url: null
    }
  };
}

function buildDocumentaryArtifact(stage, input = {}) {
  const topic = String(input.topic || input.prompt || "").trim();
  const scenes = buildDocumentaryScenes(input);
  const minutes = documentaryMinutes(input);
  const base = {
    stage,
    topic,
    agent: documentaryAgentProfile,
    duration: `${minutes} minutos`,
    format: input.format || input.target || "YouTube 16:9",
    resolution: input.resolution || "1080p Full HD",
    language: input.language || "Espanol",
    createdAt: new Date().toISOString()
  };
  const artifacts = {
    research: {
      ...base,
      researchBrief: {
        objective: `Investigar y estructurar un documental sobre ${topic}.`,
        angle: input.narrativeStyle || "Codigo Blanco broadcast",
        sourcePlan: ["contexto historico", "linea temporal", "personajes clave", "evidencia visual", "preguntas abiertas"],
        riskChecks: ["verificar afirmaciones", "separar hechos de hipotesis", "evitar datos no confirmados"]
      }
    },
    narrative: {
      ...base,
      narrative: {
        logline: `${topic}: una investigacion cinematografica con tension progresiva y cierre fuerte.`,
        acts: ["Anclaje visual", "Contexto", "Investigacion", "Revelacion", "Cierre"],
        tone: input.narrativeStyle || "Misterio oscuro"
      }
    },
    script: {
      ...base,
      script: {
        wordTarget: Math.round(minutes * 135),
        estimatedVoiceMinutes: minutes,
        opening: `En este documental investigamos ${topic} con una mirada cinematografica, precisa y profesional.`,
        structure: scenes.map((scene) => ({ id: scene.id, title: scene.title, voiceover: scene.voiceover }))
      }
    },
    scenes: {
      ...base,
      scenes
    },
    voiceover: {
      ...base,
      voiceover: {
        provider: input.voiceProvider || "Level Up",
        voice: input.voiceModel || input.voiceStyle || "Narrador grave documental",
        speed: 1,
        format: "mp3",
        scriptBlocks: scenes.map((scene) => ({ sceneId: scene.id, text: scene.voiceover }))
      }
    },
    music: {
      ...base,
      music: {
        model: input.audioModel || "suno-create-music",
        style: input.soundtrackStyle || "Tension oscura",
        cueSheet: scenes.map((scene, index) => ({ sceneId: scene.id, cue: index % 3 === 0 ? "tension baja" : index % 3 === 1 ? "ambiente investigativo" : "crescendo cinematico" }))
      }
    },
    visuals: {
      ...base,
      visuals: scenes.map((scene) => ({ sceneId: scene.id, imagePrompt: scene.prompt, videoPrompt: `${scene.prompt} Camara documental, movimiento suave, luz cinematografica.` }))
    },
    subtitles: {
      ...base,
      subtitles: {
        format: "srt",
        style: input.subtitles || "Subtitulos cinematicos",
        sample: scenes.slice(0, 3).map((scene, index) => `${index + 1}\n00:0${index}:00,000 --> 00:0${index}:05,000\n${scene.voiceover}`).join("\n\n")
      }
    },
    render: {
      ...base,
      renderPlan: {
        editModel: "NEXFRAME Assembly",
        timelineScenes: scenes.length,
        output: input.exportFormat || "MP4 H.264",
        audioRule: "No se estira audio; si falta duracion se amplia guion narrativo."
      }
    },
    export: {
      ...base,
      export: {
        fileName: `nexframe-documentary-${requestId()}.mp4`,
        projectPack: `nexframe-documentary-${requestId()}.zip`,
        status: "ready_for_render_queue",
        scenes: scenes.length
      }
    },
    "export-pack": {
      ...base,
      projectPack: {
        fileName: `nexframe-documentary-pack-${requestId()}.json`,
        includes: ["brief", "research", "script", "scene_prompts", "voice_plan", "music_plan", "subtitles", "render_plan"],
        scenes
      }
    },
    save: {
      ...base,
      savedVersion: {
        id: `doc_${Date.now()}_${requestId()}`,
        input,
        scenes
      }
    },
    preview: {
      ...base,
      preview: {
        title: topic || "Documental sin titulo",
        description: input.description || "Vista previa de produccion documental.",
        scenes: scenes.slice(0, 5),
        estimatedDuration: `${minutes} minutos`
      }
    }
  };
  return artifacts[stage] || artifacts.preview;
}

function documentaryPipelineStages(input = {}) {
  return [
    { id: "research", label: "Investigacion profunda", model: input.researchModel || "o3-documentary-research", status: "queued" },
    { id: "narrative", label: "Narrativa documental", model: input.scriptModel || "gpt-4.1-documentary-script", status: "queued" },
    { id: "script", label: "Guion completo", model: input.scriptModel || "gpt-4.1-documentary-script", status: "queued" },
    { id: "scenes", label: "Extraccion de escenas", model: input.imageModel || "nano-banana", status: "queued" },
    { id: "voiceover", label: "Voz narrativa", model: input.voiceModel || input.voiceProvider || "Level Up", status: "queued" },
    { id: "music", label: "Musica y SFX", model: input.audioModel || "suno-create-music", status: "queued" },
    { id: "visuals", label: "Visuales IA", model: input.videoModel || "veo3.1-text-to-video", status: "queued" },
    { id: "subtitles", label: "Subtitulos sincronizados", model: "NEXFRAME Subtitles", status: "queued" },
    { id: "edit", label: "Montaje final", model: "NEXFRAME Assembly", status: "queued" },
    { id: "export", label: "Exportacion MP4", model: input.exportFormat || "MP4 H.264", status: "queued" }
  ];
}

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function srtTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  const millis = Math.floor((value % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function buildSrtFromText(text, targetSeconds = 180) {
  const sentences = splitSentences(text);
  const chunkCount = Math.max(1, sentences.length);
  const chunkDuration = Math.max(3.2, targetSeconds / chunkCount);
  return sentences.map((sentence, index) => {
    const start = index * chunkDuration;
    const end = Math.min(targetSeconds, start + chunkDuration);
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${sentence}`;
  }).join("\n\n");
}

function buildPedroSanchezReelScript() {
  return [
    "Pedro Sanchez entro en 2026 como quien entra a una sala con todas las luces encendidas y aun asi pregunta quien ha tocado el interruptor.",
    "Espana miraba a La Moncloa con una mezcla de cansancio, curiosidad y ese deporte nacional que nunca falla: opinar antes de que termine el titular.",
    "El ano comenzo con presion politica, encuestas tensas y una oposicion pidiendo adelanto electoral cada vez que encontraba un microfono libre.",
    "Sanchez, por su parte, repetia que queria agotar la legislatura hasta 2027. Traducido al castellano de barra de cafe: de aqui no me mueve nadie, salvo que me muevan los numeros.",
    "En enero, el Gobierno impulso la regularizacion de cientos de miles de personas migrantes. Para unos, una medida necesaria; para otros, una decision explosiva. Y para las tertulias, combustible de alto octanaje.",
    "En febrero, la politica exterior volvio a ponerlo en primera linea. Su discurso contra la guerra y contra ataques considerados ilegales le dio perfil internacional, pero tambien abrio la pregunta incomoda: una cosa es decir no a la guerra y otra vivir en un continente lleno de bases, alianzas y contradicciones.",
    "Mientras tanto, el calendario judicial se fue cargando. El caso de Begona Gomez, esposa del presidente, siguio avanzando con acusaciones que Sanchez y su entorno rechazan, pero que politicamente pesan. Porque en politica una imputacion no siempre tumba un gobierno, pero le cambia la musica de fondo.",
    "Y aparecio el asunto de Jose Luis Rodriguez Zapatero y unas joyas valoradas en mas de un millon de euros. Regalos, patrimonio, explicaciones y silencios. En Espana hasta una caja fuerte puede robarle plano a un debate parlamentario.",
    "El problema para Sanchez no era solo cada caso por separado. Era la acumulacion. Corrupcion, promesas anticorrupcion sin desplegar por completo, ruido interno, desgaste externo y una pregunta flotando sobre todo el tablero: cuanto aguanta un gobierno cuando cada semana parece temporada final.",
    "El Partido Popular insistia en dimision y elecciones. Vox apretaba desde la derecha. Sus socios miraban cada votacion con calculadora. Y el PSOE intentaba sostener el relato de estabilidad mientras apagaba incendios.",
    "Pero Sanchez ha construido su carrera sobre sobrevivir a escenarios que otros daban por cerrados. Lo dieron por muerto politicamente en el pasado y volvio. Lo dieron por bloqueado y pacto. Lo dieron por terminado y siguio caminando.",
    "La pregunta de 2026 no es si Pedro Sanchez esta bajo presion. Eso ya no es noticia. La pregunta es si esta presion lo desgasta hasta romperlo o si, una vez mas, convierte el incendio en decorado.",
    "Porque en la politica espanola hay una regla no escrita: cuando todos anuncian el final, a veces empieza otro capitulo. Y Sanchez parece dispuesto a firmarlo con una sonrisa que no sabes si es confianza o cambio de guion."
  ].join(" ");
}

async function synthesizeNarration(scriptPath, wavPath) {
  const psScript = [
    "Add-Type -AssemblyName System.Speech",
    `$text = [System.IO.File]::ReadAllText('${scriptPath.replace(/'/g, "''")}')`,
    "$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$voice = $speaker.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'es-*' -or $_.VoiceInfo.Name -match 'Spanish|Helena|Pablo|Sabina' } | Select-Object -First 1",
    "if ($voice) { $speaker.SelectVoice($voice.VoiceInfo.Name) }",
    "$speaker.Rate = 0",
    "$speaker.Volume = 100",
    `$speaker.SetOutputToWaveFile('${wavPath.replace(/'/g, "''")}')`,
    "$speaker.Speak($text)",
    "$speaker.Dispose()"
  ].join("; ");
  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript], { cwd: __dirname, timeout: 120000 });
}

async function probeMediaDuration(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", filePath], { cwd: __dirname, timeout: 30000 });
    return Number(JSON.parse(stdout || "{}")?.format?.duration || 0);
  } catch {
    return 0;
  }
}

function uploadUrlToLocalPath(url = "") {
  const cleanUrl = String(url || "").split("?")[0];
  if (!cleanUrl.startsWith("/uploads/")) return "";
  return path.join(__dirname, "public", cleanUrl.replace(/^\/+/, ""));
}

function productionTargetSeconds(studio, input = {}) {
  const raw = input.targetDuration || input.duration || input.maxDuration || input.length || "";
  const text = String(raw).toLowerCase();
  const number = parseDuration(raw);
  if (!number) return studio === "marketing" ? 30 : studio === "musicvideo" ? 60 : 180;
  if (/hora|hour/.test(text)) return number * 3600;
  if (/min|minuto/.test(text)) return number * 60;
  return number;
}

function productionRenderSize(input = {}) {
  const aspect = targetAspectRatio(input) || "16:9";
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  if (aspect === "21:9") return { width: 1920, height: 820 };
  return { width: 1920, height: 1080 };
}

async function renderProductionFinal(job = {}) {
  const videoOutputs = (job.outputs || []).filter((output) => /video/i.test(output.mimeType || output.type || "") || /\.mp4($|\?)/i.test(output.url || ""));
  const audioOutput = (job.outputs || []).find((output) => /audio/i.test(output.mimeType || output.type || "") || /\.(mp3|wav|m4a|aac)($|\?)/i.test(output.url || ""));
  const sourcePaths = videoOutputs.map((output) => uploadUrlToLocalPath(output.url)).filter((filePath) => filePath && fs.existsSync(filePath));
  const audioPath = audioOutput ? uploadUrlToLocalPath(audioOutput.url) : "";
  if (!sourcePaths.length) throw new Error("No hay clips de video reales para montar el MP4 final.");

  const studio = job.studio || "production";
  const input = job.input || {};
  const targetSeconds = Math.max(1, productionTargetSeconds(studio, input));
  const { width, height } = productionRenderSize(input);
  const outputDir = path.join(__dirname, "public", "uploads", "final-renders", studio);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputName = `${job.id}_final.mp4`;
  const outputPath = path.join(outputDir, outputName);
  const listPath = path.join(outputDir, `${job.id}_concat.txt`);

  const durations = [];
  for (const sourcePath of sourcePaths) durations.push(await probeMediaDuration(sourcePath));
  const hasAudio = Boolean(audioPath && fs.existsSync(audioPath));
  const audioDuration = hasAudio ? await probeMediaDuration(audioPath) : 0;
  const renderSeconds = hasAudio ? Math.max(targetSeconds, Math.ceil(audioDuration || 0)) : targetSeconds;
  const cycleDuration = Math.max(0.1, durations.reduce((total, value) => total + Math.max(0.1, value || 0), 0));
  const repeatCount = Math.max(1, Math.ceil(renderSeconds / cycleDuration) + 1);
  const lines = [];
  for (let index = 0; index < repeatCount; index += 1) {
    for (const sourcePath of sourcePaths) lines.push(`file '${sourcePath.replace(/'/g, "'\\''")}'`);
  }
  fs.writeFileSync(listPath, lines.join("\n"), "utf8");

  const filters = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;
  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
  ];
  if (hasAudio) args.push("-i", audioPath);
  args.push(
    "-t", String(renderSeconds),
    "-vf", filters,
    "-r", "30",
    ...(hasAudio ? ["-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-shortest"] : ["-an"]),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath
  );
  await execFileAsync("ffmpeg", args, { cwd: __dirname, timeout: 30 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });

  const stats = fs.statSync(outputPath);
  const duration = await probeMediaDuration(outputPath);
  return {
    id: `final_${requestId()}`,
    type: "video",
    title: "MP4 final montado",
    url: `/uploads/final-renders/${studio}/${outputName}`,
    mimeType: "video/mp4",
    duration,
    targetDuration: targetSeconds,
    bytes: stats.size,
    sourceClips: sourcePaths.length,
    hasAudio,
    createdAt: new Date().toISOString()
  };
}

async function renderLocalDocumentaryVideo(input = {}, jobId = requestId()) {
  const uploadDir = path.join(__dirname, "public", "uploads", "documentary");
  fs.mkdirSync(uploadDir, { recursive: true });
  const baseName = `documentary-${jobId}`;
  const script = sanitizeTextForTTS(input.script || (/pedro\s+s[aá]nchez/i.test(input.prompt || input.topic || "") ? buildPedroSanchezReelScript() : input.prompt || input.topic || "Documental NEXFRAME"));
  const scriptPath = path.join(uploadDir, `${baseName}.txt`);
  const srtPath = path.join(uploadDir, `${baseName}.srt`);
  const wavPath = path.join(uploadDir, `${baseName}.wav`);
  const mp4Path = path.join(uploadDir, `${baseName}.mp4`);
  const vertical = /9:16|shorts|tiktok|reel/i.test(input.format || input.target || "");
  const frameSize = vertical ? "1080x1920" : "1920x1080";
  const subtitleFontSize = vertical ? 42 : 26;
  const subtitleMargin = vertical ? 145 : 72;
  fs.writeFileSync(scriptPath, script, "utf8");
  await synthesizeNarration(scriptPath, wavPath);
  const audioDuration = Math.max(1, probeMediaDuration ? await probeMediaDuration(wavPath) : 180);
  fs.writeFileSync(srtPath, buildSrtFromText(script, audioDuration), "utf8");
  const subtitlePath = `public/uploads/documentary/${baseName}.srt`;
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x070303:s=${frameSize}:r=30:d=240`,
    "-i", wavPath,
    "-vf", `subtitles=${subtitlePath}:force_style='FontName=Arial,FontSize=${subtitleFontSize},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginL=90,MarginR=90,MarginV=${subtitleMargin}'`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-shortest",
    mp4Path
  ], { cwd: __dirname, timeout: 180000 });
  const stats = fs.statSync(mp4Path);
  const duration = await probeMediaDuration(mp4Path);
  return {
    type: "video",
    title: "Documental vertical generado",
    url: `/uploads/documentary/${baseName}.mp4`,
    mimeType: "video/mp4",
    duration: Math.round(duration || audioDuration),
    sizeBytes: stats.size,
    scriptUrl: `/uploads/documentary/${baseName}.txt`,
    subtitlesUrl: `/uploads/documentary/${baseName}.srt`
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "NEXFRAME AI Engine", providers: publicProviderStatus(), time: new Date().toISOString() });
});

app.get("/api/providers", (_req, res) => {
  res.json({ ok: true, providers: publicProviderStatus() });
});

app.get("/api/muapi/providers", (_req, res) => {
  res.json({ ok: true, gateway: "MuAPI Gateway", providers: publicProviderStatus() });
});

app.get("/api/documentary/agent", (_req, res) => {
  res.json({ ok: true, agent: documentaryAgentProfile, maxDurationMinutes: 90, stages: documentaryPipelineStages({}) });
});

app.get("/api/documentary/voices", (_req, res) => {
  res.json({
    ok: true,
    providers: [
      { id: "level-up", name: "Level Up", voices: ["narrador-grave-documental", "voz-broadcast-latina", "voz-cine-profunda"] },
      { id: "openai-tts", name: "OpenAI TTS", voices: ["onyx", "alloy", "verse"] },
      { id: "elevenlabs", name: "ElevenLabs", voices: ["documentary-deep", "latam-neutral", "cinematic-male"] }
    ]
  });
});

function documentaryProjectForUser(projectId, user) {
  return (db.documentaryProjects || []).find((project) => project.id === projectId && (user.role === "admin" || project.userId === user.id)) || null;
}

function documentaryJobForUser(jobId, user) {
  const job = jobs.get(jobId);
  if (!job || job.studio !== "documentary" || (user.role !== "admin" && job.userId !== user.id)) return null;
  return job;
}

function documentaryStepProgress(job, stepIndex, status, message, output = null) {
  const now = new Date().toISOString();
  job.status = status === "failed" ? "failed" : status === "completed" && stepIndex === job.stages.length - 1 ? "completed" : "processing";
  job.currentStep = job.stages[stepIndex]?.id || "export";
  job.progress = status === "completed" ? Math.round(((stepIndex + 1) / job.stages.length) * 100) : Math.round((stepIndex / job.stages.length) * 100);
  job.etaSeconds = Math.max(0, (job.stages.length - stepIndex - (status === "completed" ? 1 : 0)) * 12);
  job.stages = job.stages.map((step, index) => index === stepIndex ? {
    ...step,
    status,
    progress: status === "completed" ? 100 : status === "failed" ? 0 : 35,
    startedAt: step.startedAt || now,
    completedAt: status === "completed" ? now : null,
    message,
    outputReference: output || step.outputReference || null
  } : step);
  if (status === "failed") job.error = message;
  jobs.set(job.id, job);
  persistJob(job);
  const project = (db.documentaryProjects || []).find((item) => item.id === job.projectId);
  if (project) {
    project.status = job.status;
    project.progress = job.progress;
    project.currentStep = job.currentStep;
    project.etaSeconds = job.etaSeconds;
    project.updatedAt = now;
    project.jobId = job.id;
    if (output) project.artifacts = { ...(project.artifacts || {}), [job.currentStep]: output };
    if (job.status === "completed") project.completedAt = now;
    saveDb(db);
  }
}

async function runPersistedDocumentaryJob(jobId, startIndex = 0) {
  const job = jobs.get(jobId);
  if (!job) return;
  for (let index = startIndex; index < job.stages.length; index += 1) {
    if (jobs.get(jobId)?.status === "cancelled") return;
    const stage = job.stages[index];
    documentaryStepProgress(job, index, "processing", `${stage.label} en proceso.`);
    try {
      let output;
      if (stage.id === "voiceover" || stage.id === "voice") {
        output = await generateNarrationAudioForJob(job, stage);
        job.outputs = [...(job.outputs || []), output];
      } else if (stage.id === "export") {
        const media = providers.muapi.apiKey
          ? (await generateRealMuapiVideoForJob(job, stage)).saved[0]
          : await renderLocalDocumentaryVideo(job.input, job.id);
        job.outputs = [...(job.outputs || []), media];
        const finalRender = await renderProductionFinal(job);
        job.finalRender = finalRender;
        job.outputs = [finalRender, ...(job.outputs || [])];
        output = finalRender;
      } else {
        output = buildDocumentaryArtifact(stage.id === "edit" ? "render" : stage.id, job.input);
      }
      documentaryStepProgress(job, index, "completed", `${stage.label} completado.`, output);
    } catch (error) {
      documentaryStepProgress(job, index, "failed", error.message);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

app.get("/api/documentary/projects", requireAuth, (req, res) => {
  const projects = (db.documentaryProjects || []).filter((project) => req.user.role === "admin" || project.userId === req.user.id);
  res.json({ ok: true, projects });
});

app.get("/api/documentary/projects/:id", requireAuth, (req, res) => {
  const project = documentaryProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto documental no encontrado." });
  res.json({ ok: true, project, job: project.jobId ? jobs.get(project.jobId) : null });
});

app.post("/api/documentary/jobs", requireAuth, upload.any(), async (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, message: "Configuracion documental invalida." });
  }
  let input = payload.input || {};
  if (!String(input.prompt || "").trim()) return res.status(400).json({ ok: false, message: "Escribe el tema principal del documental." });
  try { input = { ...input, ...(await collectUploadedFileInputs(req.files || [])) }; }
  catch (error) { return res.status(502).json({ ok: false, message: `No se pudo preparar el archivo: ${error.message}` }); }
  const now = new Date().toISOString();
  const project = {
    id: `doc_${requestId()}`,
    userId: req.user.id,
    workspaceId: req.user.workspaceId || "default",
    title: String(input.prompt).trim().slice(0, 120),
    description: String(input.description || "").trim(),
    status: "queued",
    progress: 0,
    duration: input.duration || "30 minutos",
    format: input.format || "YouTube 16:9",
    resolution: input.resolution || "1080p Full HD",
    creditsUsed: 0,
    input,
    artifacts: {},
    createdAt: now,
    updatedAt: now
  };
  const stages = documentaryPipelineStages(input).map((step) => ({ ...step, progress: 0, startedAt: null, completedAt: null, message: "Pendiente", outputReference: null }));
  const job = {
    id: `nf_${Date.now()}_${requestId()}`,
    provider: "nexframe-documentary",
    model: input.videoModel || "documentary-pipeline",
    studio: "documentary",
    input,
    stages,
    outputs: [],
    error: null,
    progress: 0,
    createdAt: now
  };
  job.userId = req.user.id;
  job.workspaceId = project.workspaceId;
  job.projectId = project.id;
  job.currentStep = "research";
  job.etaSeconds = stages.length * 12;
  job.status = "queued";
  project.jobId = job.id;
  jobs.set(job.id, job);
  db.documentaryProjects.unshift(project);
  persistJob(job);
  saveDb(db);
  res.status(202).json({ ok: true, project, job, message: "Documental creado. La produccion continua en segundo plano." });
  setImmediate(() => runPersistedDocumentaryJob(job.id));
});

app.get("/api/documentary/jobs/active", requireAuth, (req, res) => {
  const activeJobs = [...jobs.values()].filter((job) => job.studio === "documentary" && ["queued", "processing"].includes(job.status) && (req.user.role === "admin" || job.userId === req.user.id));
  res.json({ ok: true, jobs: activeJobs });
});

app.get("/api/documentary/jobs/:id", requireAuth, (req, res) => {
  const job = documentaryJobForUser(req.params.id, req.user);
  if (!job) return res.status(404).json({ ok: false, message: "Proceso documental no encontrado." });
  res.json({ ok: true, job });
});

app.post("/api/documentary/jobs/:id/cancel", requireAuth, (req, res) => {
  const job = documentaryJobForUser(req.params.id, req.user);
  if (!job) return res.status(404).json({ ok: false, message: "Proceso documental no encontrado." });
  if (!["queued", "processing"].includes(job.status)) return res.status(409).json({ ok: false, message: "Este proceso ya no se puede cancelar." });
  job.status = "cancelled";
  job.etaSeconds = 0;
  persistJob(job);
  const project = documentaryProjectForUser(job.projectId, req.user);
  if (project) { project.status = "cancelled"; project.updatedAt = new Date().toISOString(); saveDb(db); }
  res.json({ ok: true, job, message: "Produccion cancelada." });
});

app.post("/api/documentary/jobs/:id/retry-step", requireAuth, (req, res) => {
  const job = documentaryJobForUser(req.params.id, req.user);
  if (!job) return res.status(404).json({ ok: false, message: "Proceso documental no encontrado." });
  const stepIndex = job.stages.findIndex((step) => step.id === req.body?.stepKey && step.status === "failed");
  if (stepIndex < 0) return res.status(400).json({ ok: false, message: "No existe una etapa fallida para reintentar." });
  job.error = null;
  job.status = "queued";
  persistJob(job);
  res.json({ ok: true, job, message: "Etapa enviada nuevamente a produccion." });
  setImmediate(() => runPersistedDocumentaryJob(job.id, stepIndex));
});

app.post("/api/documentary/projects/:id/send-to-video-editor", requireAuth, (req, res) => {
  const documentary = documentaryProjectForUser(req.params.id, req.user);
  if (!documentary) return res.status(404).json({ ok: false, message: "Proyecto documental no encontrado." });
  const job = jobs.get(documentary.jobId);
  const video = job?.outputs?.find((output) => output.type === "video");
  if (!video) return res.status(409).json({ ok: false, message: "El documental todavia no tiene un video o timeline listo para editar." });
  ensureEditorStore();
  const now = new Date().toISOString();
  const duration = Number(video.duration || 0);
  const editorProject = {
    id: `edit_${requestId()}`,
    userId: req.user.id,
    name: documentary.title,
    sourceDocumentaryId: documentary.id,
    settings: { width: documentary.format.includes("9:16") ? 1080 : 1920, height: documentary.format.includes("9:16") ? 1920 : 1080, fps: 30, aspectRatio: documentary.format.includes("9:16") ? "9:16" : "16:9" },
    media: [{ id: `media_${requestId()}`, name: `${documentary.title}.mp4`, type: "video/mp4", url: video.url, duration }],
    timeline: { duration, tracks: [{ id: "video", name: "Documental", type: "video", clips: [{ id: `clip_${requestId()}`, mediaId: video.url, name: documentary.title, start: 0, end: duration }] }] },
    documentary: { scriptUrl: video.scriptUrl, subtitlesUrl: video.subtitlesUrl, artifacts: documentary.artifacts },
    operationHistory: [],
    createdAt: now,
    updatedAt: now
  };
  db.editorProjects.unshift(editorProject);
  documentary.editorProjectId = editorProject.id;
  documentary.updatedAt = now;
  saveDb(db);
  res.status(201).json({ ok: true, editorProjectId: editorProject.id, redirectUrl: "/app/editor", message: "Proyecto enviado al Video Editor Studio." });
});

app.post("/api/documentary/projects/:id/actions/:stage", requireAuth, async (req, res) => {
  const project = documentaryProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto documental no encontrado." });
  const allowed = ["research", "narrative", "script", "scenes", "voiceover", "music", "visuals", "subtitles", "preview", "render", "export"];
  const stage = req.params.stage;
  if (!allowed.includes(stage)) return res.status(400).json({ ok: false, message: "Accion documental no valida." });
  const job = jobs.get(project.jobId);
  if (!job) return res.status(409).json({ ok: false, message: "El proyecto no tiene un proceso asociado." });
  try {
    let artifact;
    if (stage === "voiceover") {
      artifact = await generateNarrationAudioForJob(job, { id: stage, label: "Voz narrativa" });
      job.outputs = [...(job.outputs || []), artifact];
    } else if (["render", "export"].includes(stage)) {
      const media = providers.muapi.apiKey
        ? (await generateRealMuapiVideoForJob(job, { id: stage, label: stage })).saved[0]
        : await renderLocalDocumentaryVideo(project.input, job.id);
      job.outputs = [...(job.outputs || []), media];
      artifact = providers.muapi.apiKey ? await renderProductionFinal(job) : media;
      if (providers.muapi.apiKey) job.outputs = [artifact, ...(job.outputs || [])];
    } else {
      artifact = buildDocumentaryArtifact(stage, project.input);
    }
    project.artifacts = { ...(project.artifacts || {}), [stage]: artifact };
    project.updatedAt = new Date().toISOString();
    persistJob(job);
    saveDb(db);
    res.json({ ok: true, artifact, project, message: `Accion completada: ${stage}.` });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo completar ${stage}: ${error.message}` });
  }
});

app.post("/api/documentary/create", upload.any(), async (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, message: "Payload documental invalido." });
  }
  let input = payload.input || {};
  try {
    input = { ...input, ...(await collectUploadedFileInputs(req.files || [])) };
  } catch (error) {
    return res.status(502).json({ ok: false, gateway: "MuAPI Gateway", message: `No se pudo preparar el archivo: ${error.message}` });
  }
  if (!input.prompt?.trim() && !input.topic?.trim()) {
    return res.status(400).json({ ok: false, message: "Falta el tema principal del documental." });
  }
  const stages = documentaryPipelineStages(input);
  const project = buildDocumentaryArtifact("preview", input);
  const job = createLocalJob({
    provider: providers.muapi.apiKey ? "muapi-documentary-agent" : "documentary-local-agent",
    model: input.videoModel || "documentary-pipeline",
    studio: "documentary",
    input,
    stages
  });
  job.pipeline = true;
  job.agent = documentaryAgentProfile;
  job.project = project;
  jobs.set(job.id, job);
  persistJob(job);
  res.json({ ok: true, mode: providers.muapi.apiKey ? "pipeline_ready_remote" : "local_functional", job, project, message: "Documental completo creado en la cola de produccion." });
});

["research", "narrative", "script", "scenes", "voiceover", "music", "visuals", "subtitles", "preview", "render", "export", "export-pack", "save"].forEach((stage) => {
  app.post(`/api/documentary/${stage}`, (req, res) => {
    const input = req.body?.input || {};
    if (!input.prompt?.trim() && !input.topic?.trim() && !["preview", "save"].includes(stage)) {
      return res.status(400).json({ ok: false, message: "Falta el tema principal del documental." });
    }
    const artifact = buildDocumentaryArtifact(stage, input);
    audit.push({ type: "DOCUMENTARY_STAGE", stage, topic: artifact.topic, time: new Date().toISOString() });
    res.json({ ok: true, stage, artifact, message: `Etapa documental completada: ${stage}.` });
  });
});

app.get("/api/auth/session", (req, res) => {
  const user = currentUser(req);
  res.json({ ok: true, signedIn: Boolean(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const remember = Boolean(req.body?.remember);
  const user = db.users.find((item) => item.email.toLowerCase() === email && item.active);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    log("AUTH_LOGIN_FAILED", { email });
    return res.status(401).json({ ok: false, message: "Credenciales incorrectas." });
  }
  const maxAgeSeconds = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const token = signSession(user, maxAgeSeconds * 1000);
  res.setHeader("Set-Cookie", sessionCookieHeader(token, maxAgeSeconds));
  log("AUTH_LOGIN_SUCCESS", { userId: user.id, role: user.role });
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/register", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "Usuario").trim();
  const password = String(req.body?.password || "");
  const acceptedTerms = Boolean(req.body?.acceptedTerms);
  if (!acceptedTerms) return res.status(400).json({ ok: false, message: "Debes aceptar terminos y privacidad." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, message: "Correo electronico invalido." });
  if (!password || password.length < 8) return res.status(400).json({ ok: false, message: "La contrasena debe tener 8 caracteres o mas." });
  if (db.users.some((user) => user.email.toLowerCase() === email)) return res.status(409).json({ ok: false, message: "Ya existe una cuenta con este correo." });
  const user = {
    id: `usr_${requestId()}`,
    name,
    email,
    role: "user",
    passwordHash: hashPassword(password),
    active: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  try {
    activatePlanForUser({ userId: user.id, planId: "creator", cycleId: "monthly", provider: "free-trial", paymentId: "free_trial" });
  } catch {
    saveDb(db);
  }
  const token = signSession(user);
  res.setHeader("Set-Cookie", sessionCookieHeader(token, 60 * 60 * 12));
  log("AUTH_REGISTER_SUCCESS", { userId: user.id });
  res.json({ ok: true, user: publicUser(user) });
});

app.get("/api/auth/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  if (!clientId) return res.status(503).json({ ok: false, message: "GOOGLE_CLIENT_ID no esta configurado en el servidor." });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent"
  });
  res.json({ ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  if (!code || !clientId || !clientSecret) return res.redirect("/login?error=google_oauth_not_configured");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || tokenData.error || "Google token error");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email) throw new Error("No se pudo leer el perfil de Google.");
    let user = db.users.find((item) => item.email.toLowerCase() === String(profile.email).toLowerCase());
    if (!user) {
      user = {
        id: `usr_${requestId()}`,
        name: profile.name || profile.email,
        email: String(profile.email).toLowerCase(),
        role: "user",
        googleSub: profile.sub,
        passwordHash: hashPassword(crypto.randomBytes(24).toString("hex")),
        active: true,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      activatePlanForUser({ userId: user.id, planId: "creator", cycleId: "monthly", provider: "google-free-trial", paymentId: "free_trial" });
    }
    const token = signSession(user);
    res.setHeader("Set-Cookie", sessionCookieHeader(token, 60 * 60 * 12));
    res.redirect("/dashboard");
  } catch (error) {
    log("GOOGLE_LOGIN_FAILED", { message: error.message });
    res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
});

function createPasswordReset(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  const response = { ok: true, message: "Si el correo existe, recibiras instrucciones para recuperar tu cuenta." };
  if (user) {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    db.passwordResets = (db.passwordResets || []).filter((item) => item.email !== email || item.used);
    db.passwordResets.push({
      id: `reset_${requestId()}`,
      userId: user.id,
      email,
      tokenHash,
      used: false,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      createdAt: new Date().toISOString()
    });
    saveDb(db);
    if (process.env.NODE_ENV !== "production" || process.env.NEXFRAME_DEV_RESET_LINKS === "true") {
      response.resetUrl = `/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
      response.devResetUrl = `${publicBaseUrl(req)}${response.resetUrl}`;
    }
  }
  log("PASSWORD_RESET_REQUESTED", { email, resetCreated: Boolean(user) });
  res.json(response);
}

app.post("/api/auth/password-reset", createPasswordReset);
app.post("/api/auth/forgot-password", createPasswordReset);

app.post("/api/auth/reset-password", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, message: "Correo electronico invalido." });
  if (!token) return res.status(400).json({ ok: false, message: "Token de recuperacion requerido." });
  if (!password || password.length < 8) return res.status(400).json({ ok: false, message: "La nueva contrasena debe tener 8 caracteres o mas." });
  if (confirmPassword && password !== confirmPassword) return res.status(400).json({ ok: false, message: "Las contrasenas no coinciden." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const reset = (db.passwordResets || []).find((item) => item.email === email && item.tokenHash === tokenHash && !item.used);
  if (!reset || new Date(reset.expiresAt).getTime() < Date.now()) return res.status(400).json({ ok: false, message: "El enlace de recuperacion no es valido o expiro." });
  const user = db.users.find((item) => item.id === reset.userId && item.email.toLowerCase() === email && item.active);
  if (!user) return res.status(400).json({ ok: false, message: "El enlace de recuperacion no es valido o expiro." });
  user.passwordHash = hashPassword(password);
  reset.used = true;
  reset.usedAt = new Date().toISOString();
  saveDb(db);
  log("PASSWORD_RESET_COMPLETED", { userId: user.id });
  res.json({ ok: true, message: "Contrasena actualizada correctamente. Ya puedes iniciar sesion." });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookieHeader());
  res.json({ ok: true });
});

app.get("/api/users", requireAdmin, (_req, res) => {
  res.json({ ok: true, users: db.users.map(publicUser) });
});

app.post("/api/users", requireAdmin, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "Usuario").trim();
  const role = req.body?.role === "admin" ? "admin" : "user";
  const password = String(req.body?.password || "");
  if (!email || !password || password.length < 8) return res.status(400).json({ ok: false, message: "Email y password de 8+ caracteres son obligatorios." });
  if (db.users.some((user) => user.email.toLowerCase() === email)) return res.status(409).json({ ok: false, message: "El usuario ya existe." });
  const user = { id: `usr_${requestId()}`, name, email, role, passwordHash: hashPassword(password), active: true, createdAt: new Date().toISOString() };
  db.users.push(user);
  saveDb(db);
  log("USER_CREATED", { userId: user.id, role });
  res.json({ ok: true, user: publicUser(user) });
});

app.get("/api/usage", requireAuth, (_req, res) => {
  res.json({ ok: true, usage: db.usage || { creditsTotal: 0, creditsUsed: 0, byStudio: {}, byModel: {} } });
});

app.get("/api/security/status", requireAdmin, (_req, res) => {
  res.json({
    ok: true,
    controls: [
      { id: "server_keys", label: "API keys solo servidor", ok: true },
      { id: "http_only_cookie", label: "Sesion HttpOnly", ok: true },
      { id: "rate_limit", label: "Rate limit + bloqueo IP", ok: true },
      { id: "csp", label: "Content Security Policy", ok: true },
      { id: "cors", label: "CORS restringido", ok: true },
      { id: "upload_limits", label: "Limites y MIME de uploads", ok: true },
      { id: "secret_ignore", label: "Archivos de claves en gitignore", ok: fs.readFileSync(path.join(__dirname, ".gitignore"), "utf8").includes("API Key MUAPI") },
      { id: "audit_log", label: "Auditoria de eventos", ok: true }
    ],
    blockedIps: blockedIps.size,
    auditCount: audit.length
  });
});

app.get("/api/muapi/registry", (_req, res) => {
  res.json({
    ok: true,
    gateway: "MuAPI Gateway",
    muapiModelRegistry: {
      source: muapiRegistry.generatedFrom,
      counts: muapiRegistry.counts,
      studios: Object.fromEntries(Object.entries(muapiRegistry.byStudio || {}).map(([key, value]) => [key, value.length])),
      sampleContract: getModelContract("nano-banana")
    },
    providerRegistry: v6ProviderRegistry,
    buttonActionMap: v6ButtonActionMap,
    providers: publicProviderStatus()
  });
});

app.post("/api/providers/:id/test", async (req, res) => {
  const result = await testProvider(req.params.id);
  log("PROVIDER_TEST", { provider: req.params.id, result });
  res.json({ ok: result.ok, ...result });
});

app.post("/api/muapi/providers/:id/test", async (req, res) => {
  const result = await testProvider(req.params.id);
  log("MUAPI_PROVIDER_TEST", { provider: req.params.id, result });
  res.json({ ok: result.ok, gateway: "MuAPI Gateway", ...result });
});

const studioSmokeTests = [
  { panel: "video", studio: "video", model: "veo3.1-text-to-video", input: { prompt: "Prueba de conexion de Video Studio.", duration: 8, aspect_ratio: "16:9" } },
  { panel: "image", studio: "image", model: "nano-banana", input: { prompt: "Prueba de conexion de Image Studio.", aspect_ratio: "1:1", num_images: 1 } },
  { panel: "sound", studio: "sound", model: "suno-create-music", input: { prompt: "Prueba breve de Sound Studio.", style: "cinematic instrumental", instrumental: true } },
  { panel: "effects", studio: "effects", model: "ai-video-effects", input: { prompt: "Prueba de Effects Studio.", video_url: "https://example.invalid/smoke.mp4" } },
  { panel: "lipsync", studio: "lipsync", model: "infinitetalk-image-to-video", input: { prompt: "Prueba de Lip Sync Studio.", image_url: "https://example.invalid/avatar.png", audio_url: "https://example.invalid/voice.wav" } },
  { panel: "documentary", studio: "documentary", model: "veo3.1-text-to-video", input: { prompt: "Prueba de Documentary Studio.", duration: 8, aspect_ratio: "16:9" } },
  { panel: "musicvideo", studio: "musicvideo", model: "veo3.1-text-to-video", input: { prompt: "Prueba de Music Video Studio.", duration: 8, aspect_ratio: "16:9" } },
  { panel: "flyer", studio: "flyer", model: "nano-banana", input: { prompt: "Prueba de Flyer Studio.", aspect_ratio: "1:1", num_images: 1 } },
  { panel: "cinema", studio: "cinema", model: "veo3.1-text-to-video", input: { prompt: "Prueba de Cinema Studio.", duration: 8, aspect_ratio: "16:9" } },
  { panel: "narrative", studio: "narrative", model: "minimax-speech-2.6-hd", input: { prompt: "Prueba breve de Narrativa y Voz." } }
];

app.post("/api/muapi/smoke-test", requireAdmin, (req, res) => {
  const results = studioSmokeTests.map((test) => {
    try {
      const model = getMuapiModelById(test.model);
      if (!model) throw new Error(`Modelo no registrado: ${test.model}`);
      const requestPayload = validateMuapiPayload(test.input, model, test.studio);
      const job = createLocalJob({ provider: "smoke-test", model: model.id, studio: test.studio, input: requestPayload });
      Object.assign(job, { status: "cancelled", progress: 0, smokeTest: true });
      jobs.set(job.id, job);
      persistJob(job);
      return { panel: test.panel, ok: true, model: model.id, endpoint: model.endpoint, jobId: job.id, status: job.status };
    } catch (error) {
      return { panel: test.panel, ok: false, model: test.model, error: error.message };
    }
  });

  const specialPanels = ["marketing", "script", "youtube", "editor"].map((panel) => {
    const job = createLocalJob({ provider: "smoke-test", model: `nexframe-${panel}`, studio: panel, input: { prompt: `Prueba de ${panel}.` } });
    Object.assign(job, { status: "cancelled", progress: 0, smokeTest: true });
    jobs.set(job.id, job);
    persistJob(job);
    return { panel, ok: true, model: job.model, endpoint: "motor-local", jobId: job.id, status: job.status };
  });

  const allResults = [...results, ...specialPanels];
  const ok = allResults.every((result) => result.ok && result.status === "cancelled");
  log("ALL_STUDIOS_SMOKE_TEST", { ok, results: allResults });
  res.status(ok ? 200 : 500).json({ ok, remoteGenerationExecuted: false, results: allResults });
});

app.post("/api/muapi/action", upload.any(), (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body;
  } catch {
    return res.status(400).json({ ok: false, message: "Payload invalido." });
  }
  const panel = payload?.panel || "global";
  const action = payload?.action || "";
  const musicVideoActions = [
    "Upload Song", "Upload Artist Photo", "Upload Video Clips", "Upload Script/PDF/TXT",
    "Analyze Song", "Detect Lyrics", "Sync Script to Song", "Create Artist Profile",
    "Create Storyboard", "Generate Scene Prompts", "Generate Images", "Generate Clips",
    "Generate Lip Sync", "Apply VFX", "Auto Edit to Beat", "Preview Music Video",
    "Render Final Video", "Export MP4", "Export Project Pack", "Save Version", "Send to Campaign"
  ];
  const allowed = new Set([...(v6ButtonActionMap.global || []), ...(v6ButtonActionMap[panel] || []), ...musicVideoActions, "Generate Campaign Package", "Validate Public Website", "Audit Logs", "Consent Vault"]);
  if (!allowed.has(action)) {
    return res.status(400).json({ ok: false, state: "failed", message: "Accion no registrada en el mapa v6." });
  }

  const fileSummary = (req.files || []).map((file) => ({ name: file.originalname, type: file.mimetype, size: file.size }));
  const job = createLocalJob({
    provider: "muapi",
    model: `v6-${panel}`,
    studio: panel,
    input: {
      prompt: `${action} - ${panel}`,
      action,
      payload: payload.payload || {},
      files: fileSummary
    }
  });
  job.state = action.toLowerCase().includes("fallback") ? "fallback_running" : action.toLowerCase().includes("upload") ? "uploading" : "queued";
  job.action = action;
  jobs.set(job.id, job);
  log("V6_ACTION_EXECUTED", { panel, action, jobId: job.id, files: fileSummary });
  res.json({ ok: true, gateway: "MuAPI Gateway", state: job.state, job, message: `${action} ejecutado por MuAPI Gateway.` });
});

app.get("/api/muapi/workflow/:panel", (req, res) => {
  const panel = v6ProviderRegistry.panels?.[req.params.panel];
  if (!panel) return res.status(404).json({ ok: false, message: "Workflow v6 no registrado." });
  res.json({ ok: true, gateway: "MuAPI Gateway", panel: req.params.panel, workflow: panel.workflow || [], config: panel });
});

app.get("/api/plans", (_req, res) => {
  res.json({ ok: true, plans: (db.plans || []).filter((plan) => plan.active !== false) });
});

app.get("/api/billing/plans", (_req, res) => {
  res.json({ ok: true, plans: (db.plans || []).filter((plan) => plan.active !== false) });
});

function publicWebsite() {
  db.publicWebsite = db.publicWebsite || defaultPublicData();
  return db.publicWebsite;
}

function orderedVisible(items = []) {
  return [...items].filter((item) => item.isVisible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function publicLandingPayload() {
  const publicData = publicWebsite();
  return {
    ok: true,
    site: publicData.site,
    landing: publicData.landing,
    heroVideo: publicData.heroVideo,
    benefits: orderedVisible(publicData.benefits),
    howItWorks: [...(publicData.howItWorks || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
    studios: orderedVisible(publicData.studios),
    testimonials: orderedVisible(publicData.testimonials),
    metrics: orderedVisible(publicData.metrics),
    faq: orderedVisible(publicData.faq),
    examples: publicData.examples || [],
    seo: publicData.seo || {},
    legal: publicData.legal || {}
  };
}

function publicUploadUrl(file) {
  const uploadDir = path.join(__dirname, "public", "uploads", "public");
  fs.mkdirSync(uploadDir, { recursive: true });
  const safeName = String(file.originalname || "asset").replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  const filename = `${Date.now()}-${requestId()}-${safeName}`;
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
  return `/uploads/public/${filename}`;
}

app.get("/api/public/site", (_req, res) => res.json({ ok: true, site: publicWebsite().site }));
app.get("/api/public/landing", (_req, res) => res.json(publicLandingPayload()));
app.get("/api/public/studios", (_req, res) => res.json({ ok: true, studios: orderedVisible(publicWebsite().studios) }));
app.get("/api/public/testimonials", (_req, res) => res.json({ ok: true, testimonials: orderedVisible(publicWebsite().testimonials) }));
app.get("/api/public/metrics", (_req, res) => res.json({ ok: true, metrics: orderedVisible(publicWebsite().metrics) }));
app.get("/api/public/faq", (_req, res) => res.json({ ok: true, faq: orderedVisible(publicWebsite().faq) }));
app.get("/api/public/hero-video", (_req, res) => res.json({ ok: true, heroVideo: publicWebsite().heroVideo }));

app.patch("/api/admin/public/site", requireAdmin, (req, res) => {
  const publicData = publicWebsite();
  db.publicWebsite.site = { ...publicData.site, ...(req.body || {}), updatedAt: new Date().toISOString() };
  saveDb(db);
  res.json({ ok: true, site: db.publicWebsite.site });
});

app.patch("/api/admin/public/landing", requireAdmin, (req, res) => {
  const publicData = publicWebsite();
  db.publicWebsite.landing = { ...publicData.landing, ...(req.body || {}), updatedAt: new Date().toISOString() };
  if (Array.isArray(req.body?.benefits)) db.publicWebsite.benefits = req.body.benefits;
  if (Array.isArray(req.body?.howItWorks)) db.publicWebsite.howItWorks = req.body.howItWorks;
  if (Array.isArray(req.body?.testimonials)) db.publicWebsite.testimonials = req.body.testimonials;
  if (Array.isArray(req.body?.faq)) db.publicWebsite.faq = req.body.faq;
  if (req.body?.seo) db.publicWebsite.seo = { ...publicData.seo, ...req.body.seo };
  if (req.body?.legal) db.publicWebsite.legal = { ...publicData.legal, ...req.body.legal };
  saveDb(db);
  res.json(publicLandingPayload());
});

app.patch("/api/admin/public/studios", requireAdmin, (req, res) => {
  if (!Array.isArray(req.body?.studios)) return res.status(400).json({ ok: false, message: "Lista de estudios requerida." });
  db.publicWebsite = publicWebsite();
  db.publicWebsite.studios = req.body.studios;
  saveDb(db);
  res.json({ ok: true, studios: db.publicWebsite.studios });
});

app.post("/api/admin/public/testimonials", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  const item = { id: `testimonial_${requestId()}`, stars: 5, isVisible: true, order: (db.publicWebsite.testimonials || []).length + 1, ...(req.body || {}) };
  db.publicWebsite.testimonials = [...(db.publicWebsite.testimonials || []), item];
  saveDb(db);
  res.json({ ok: true, testimonial: item });
});

app.patch("/api/admin/public/testimonials/:id", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  db.publicWebsite.testimonials = (db.publicWebsite.testimonials || []).map((item) => item.id === req.params.id ? { ...item, ...(req.body || {}) } : item);
  saveDb(db);
  res.json({ ok: true, testimonials: db.publicWebsite.testimonials });
});

app.delete("/api/admin/public/testimonials/:id", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  db.publicWebsite.testimonials = (db.publicWebsite.testimonials || []).filter((item) => item.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true, testimonials: db.publicWebsite.testimonials });
});

app.patch("/api/admin/public/metrics", requireAdmin, (req, res) => {
  if (!Array.isArray(req.body?.metrics)) return res.status(400).json({ ok: false, message: "Lista de metricas requerida." });
  db.publicWebsite = publicWebsite();
  db.publicWebsite.metrics = req.body.metrics;
  saveDb(db);
  res.json({ ok: true, metrics: db.publicWebsite.metrics });
});

app.post("/api/admin/public/faq", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  const item = { id: `faq_${requestId()}`, isVisible: true, order: (db.publicWebsite.faq || []).length + 1, ...(req.body || {}) };
  db.publicWebsite.faq = [...(db.publicWebsite.faq || []), item];
  saveDb(db);
  res.json({ ok: true, faq: item });
});

app.patch("/api/admin/public/faq/:id", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  db.publicWebsite.faq = (db.publicWebsite.faq || []).map((item) => item.id === req.params.id ? { ...item, ...(req.body || {}) } : item);
  saveDb(db);
  res.json({ ok: true, faq: db.publicWebsite.faq });
});

app.delete("/api/admin/public/faq/:id", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  db.publicWebsite.faq = (db.publicWebsite.faq || []).filter((item) => item.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true, faq: db.publicWebsite.faq });
});

app.patch("/api/admin/public/hero-video", requireAdmin, (req, res) => {
  db.publicWebsite = publicWebsite();
  db.publicWebsite.heroVideo = { ...db.publicWebsite.heroVideo, ...(req.body || {}), updatedAt: new Date().toISOString() };
  saveDb(db);
  res.json({ ok: true, heroVideo: db.publicWebsite.heroVideo });
});

app.post("/api/admin/public/hero-video/upload", requireAdmin, upload.fields([{ name: "video", maxCount: 1 }, { name: "thumbnail", maxCount: 1 }, { name: "fallback", maxCount: 1 }]), (req, res) => {
  const files = req.files || {};
  const video = files.video?.[0];
  const thumbnail = files.thumbnail?.[0];
  const fallback = files.fallback?.[0];
  if (video && !["video/mp4", "video/webm"].includes(video.mimetype)) return res.status(400).json({ ok: false, message: "El video debe ser MP4 o WebM." });
  db.publicWebsite = publicWebsite();
  const patch = {};
  if (video) patch.videoUrl = publicUploadUrl(video);
  if (thumbnail) patch.thumbnailUrl = publicUploadUrl(thumbnail);
  if (fallback) patch.fallbackImageUrl = publicUploadUrl(fallback);
  db.publicWebsite.heroVideo = { ...db.publicWebsite.heroVideo, ...patch, updatedAt: new Date().toISOString() };
  saveDb(db);
  res.json({ ok: true, heroVideo: db.publicWebsite.heroVideo });
});

app.post("/api/admin/public/asset/upload", requireAdmin, upload.single("asset"), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "Archivo requerido." });
  res.json({ ok: true, url: publicUploadUrl(req.file) });
});

app.put("/api/admin/plans/:planId", requireAdmin, (req, res) => {
  const planIndex = (db.plans || []).findIndex((plan) => plan.id === req.params.planId);
  if (planIndex < 0) return res.status(404).json({ ok: false, message: "Plan no encontrado." });
  const current = db.plans[planIndex];
  const next = {
    ...current,
    ...req.body,
    id: current.id,
    cycles: {
      ...current.cycles,
      ...(req.body?.cycles || {})
    }
  };
  db.plans[planIndex] = next;
  saveDb(db);
  log("PLAN_UPDATED", { planId: next.id, adminId: req.user.id });
  res.json({ ok: true, plan: next });
});

app.get("/api/admin/site", requireAdmin, (_req, res) => {
  res.json({ ok: true, siteContent: db.siteContent || {}, publicWebsite: publicWebsite(), plans: db.plans || [], users: db.users.map(publicUser), payments: db.payments || [] });
});

app.put("/api/admin/site", requireAdmin, (req, res) => {
  db.siteContent = { ...(db.siteContent || {}), ...(req.body || {}) };
  saveDb(db);
  log("PUBLIC_SITE_UPDATED", { adminId: req.user.id });
  res.json({ ok: true, siteContent: db.siteContent });
});

app.get("/api/billing/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    subscription: activeSubscriptionFor(req.user.id),
    payments: (db.payments || []).filter((item) => item.userId === req.user.id).slice(0, 20),
    usage: db.usage || {}
  });
});

app.post("/api/billing/checkout", requireAuth, async (req, res) => {
  const planId = String(req.body?.planId || req.body?.plan || "professional");
  const cycleId = String(req.body?.cycleId || "monthly");
  const found = findPlan(planId, cycleId);
  if (!found) return res.status(400).json({ ok: false, message: "Plan o ciclo no valido." });
  const { plan, cycle } = found;

  if (!stripe) {
    const subscription = activatePlanForUser({
      userId: req.user.id,
      planId,
      cycleId,
      provider: "local-ledger",
      paymentId: `local_${requestId()}`,
      invoiceId: `local_invoice_${requestId()}`
    });
    log("CHECKOUT_LOCAL_ACTIVATED", { userId: req.user.id, planId, cycleId });
    return res.json({
      ok: true,
      mode: "local-ledger",
      subscription,
      message: "Stripe no esta configurado; plan activado en ledger local para pruebas sin cobro real."
    });
  }

  const origin = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
  const priceData = cycle.stripePriceId
    ? { price: cycle.stripePriceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(Number(cycle.price) * 100),
          recurring: { interval: cycle.months === 12 ? "year" : "month", interval_count: cycle.months === 12 ? 1 : cycle.months },
          product_data: { name: `NEXFRAME ${plan.name} - ${cycle.label}` }
        }
      };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: req.user.email,
    line_items: [priceData],
    success_url: `${origin}/planes?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/planes?checkout=cancelled`,
    metadata: {
      userId: req.user.id,
      planId,
      cycleId
    }
  });
  log("STRIPE_CHECKOUT_CREATED", { userId: req.user.id, planId, cycleId, sessionId: session.id });
  res.json({ ok: true, mode: "stripe", sessionId: session.id, url: session.url, message: "Sesion Stripe creada." });
});

app.post("/api/billing/confirm-session", requireAuth, async (req, res) => {
  const sessionId = String(req.body?.sessionId || "");
  if (!stripe || !sessionId) return res.status(400).json({ ok: false, message: "Stripe no configurado o session_id faltante." });
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return res.status(409).json({ ok: false, message: "El pago aun no esta confirmado por Stripe." });
  }
  const subscription = activatePlanForUser({
    userId: req.user.id,
    planId: session.metadata?.planId,
    cycleId: session.metadata?.cycleId,
    provider: "stripe",
    paymentId: session.payment_intent || session.id,
    invoiceId: session.invoice || ""
  });
  res.json({ ok: true, subscription, message: "Plan activado con Stripe." });
});

app.get("/api/deployment/validate", (_req, res) => {
  const checks = [
    { id: "api", label: "API server", ok: true, required: true },
    { id: "static", label: "Static build folder", ok: true, required: true },
    { id: "providers", label: "AI providers", ok: publicProviderStatus().some((provider) => provider.configured), required: true },
    { id: "billing", label: "Billing provider", ok: Boolean(process.env.STRIPE_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET), required: false, warning: "Configura Stripe o PayPal antes de vender planes reales." }
  ];
  const requiredChecks = checks.filter((check) => check.required !== false);
  const warnings = checks.filter((check) => check.required === false && !check.ok);
  log("DEPLOYMENT_VALIDATION", { checks });
  res.json({ ok: requiredChecks.every((check) => check.ok), checks, warnings, time: new Date().toISOString() });
});

app.get("/api/openmontage/status", requireAuth, async (_req, res) => {
  try {
    const status = await openMontageStatus();
    res.json({ ok: true, status });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo leer OpenMontage: ${error.message}` });
  }
});

app.get("/api/openmontage/pipelines/:id", requireAuth, async (req, res) => {
  try {
    const status = await openMontageStatus();
    const pipeline = status.pipelines.find((item) => item.id === req.params.id || item.name === req.params.id);
    if (!pipeline) return res.status(404).json({ ok: false, message: "Pipeline OpenMontage no encontrado." });
    res.json({ ok: true, pipeline });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo leer el pipeline: ${error.message}` });
  }
});

app.get("/api/production/projects", requireAuth, (req, res) => {
  const projects = (db.productionProjects || []).filter((project) => req.user.role === "admin" || project.userId === req.user.id);
  res.json({ ok: true, projects });
});

app.get("/api/production/projects/:id", requireAuth, (req, res) => {
  const project = (db.productionProjects || []).find((item) => item.id === req.params.id && (req.user.role === "admin" || item.userId === req.user.id));
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de producción no encontrado." });
  res.json({ ok: true, project });
});

app.post("/api/production/projects/:id/send-to-editor", requireAuth, async (req, res) => {
  ensureEditorStore();
  const production = (db.productionProjects || []).find((item) => item.id === req.params.id && (req.user.role === "admin" || item.userId === req.user.id));
  if (!production) return res.status(404).json({ ok: false, message: "Proyecto de producción no encontrado." });
  const outputs = (production.assets || []).filter((item) => item?.url && /^\/uploads\//.test(item.url));
  if (!outputs.length) return res.status(409).json({ ok: false, message: "El proyecto todavía no tiene archivos reales para editar." });
  const now = new Date().toISOString();
  const editorProject = {
    id: `edit_${requestId()}`,
    userId: req.user.id,
    productionProjectId: production.id,
    name: production.title,
    settings: { width: 1920, height: 1080, fps: 30, aspectRatio: "16:9" },
    media: [],
    timeline: { duration: 0, tracks: [] },
    operationHistory: [],
    createdAt: now,
    updatedAt: now
  };
  let cursor = 0;
  for (const output of outputs) {
    const sourcePath = path.join(__dirname, "public", output.url.replace(/^\/uploads\//, "uploads/"));
    if (!fs.existsSync(sourcePath)) continue;
    const probe = await probeEditorMedia(sourcePath);
    const type = probe.hasVideo ? "video" : probe.hasAudio ? "audio" : "image";
    const media = { id: `media_${requestId()}`, name: output.title || path.basename(sourcePath), mimeType: output.mimeType || (type === "video" ? "video/mp4" : type === "audio" ? "audio/mpeg" : "image/png"), sourcePath, url: output.url, thumbnailUrl: type === "image" ? output.url : null, ...probe, createdAt: now };
    editorProject.media.push(media);
    let track = editorProject.timeline.tracks.find((item) => item.type === type);
    if (!track) {
      track = { id: `track_${requestId()}`, type, name: type === "video" ? "Video principal" : type === "audio" ? "Audio principal" : "Imágenes", clips: [] };
      editorProject.timeline.tracks.push(track);
    }
    const duration = Math.max(.1, Number(media.duration || (type === "image" ? 5 : 1)));
    const start = type === "audio" ? 0 : cursor;
    track.clips.push({ id: `clip_${requestId()}`, mediaId: media.id, type, name: media.name, start, end: start + duration, in: 0, url: media.url, thumbnailUrl: media.thumbnailUrl });
    if (type !== "audio") cursor += duration;
    editorProject.timeline.duration = Math.max(editorProject.timeline.duration, start + duration);
  }
  if (!editorProject.media.length) return res.status(409).json({ ok: false, message: "Los archivos del proyecto ya no están disponibles en almacenamiento." });
  db.editorProjects.unshift(editorProject);
  production.editorProjectId = editorProject.id;
  production.updatedAt = now;
  saveDb(db);
  res.status(201).json({ ok: true, project: editorProject, redirectUrl: `/editor/${editorProject.id}` });
});

app.get("/api/editor/projects", requireAuth, (req, res) => {
  ensureEditorStore();
  res.json({ ok: true, projects: db.editorProjects.filter((project) => project.userId === req.user.id) });
});

app.post("/api/editor/projects", requireAuth, (req, res) => {
  ensureEditorStore();
  const now = new Date().toISOString();
  const project = {
    id: `edit_${requestId()}`,
    userId: req.user.id,
    name: String(req.body?.name || "Proyecto de video").trim().slice(0, 120),
    settings: { width: 1920, height: 1080, fps: 30, aspectRatio: "16:9", ...(req.body?.settings || {}) },
    media: [],
    timeline: { duration: 0, tracks: [] },
    operationHistory: [],
    createdAt: now,
    updatedAt: now
  };
  db.editorProjects.unshift(project);
  saveDb(db);
  res.status(201).json({ ok: true, project });
});

app.get("/api/editor/projects/:id", requireAuth, (req, res) => {
  const project = editorProjectForUser(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de editor no encontrado." });
  res.json({ ok: true, project });
});

app.put("/api/editor/projects/:id", requireAuth, (req, res) => {
  const project = editorProjectForUser(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de editor no encontrado." });
  const snapshot = JSON.parse(JSON.stringify(project));
  db.editorVersions.unshift({ id: `ver_${requestId()}`, projectId: project.id, userId: req.user.id, name: req.body?.versionName || "Guardado manual", snapshot, createdAt: new Date().toISOString() });
  if (req.body?.name) project.name = String(req.body.name).trim().slice(0, 120);
  if (req.body?.settings) project.settings = { ...project.settings, ...req.body.settings };
  if (req.body?.timeline) project.timeline = req.body.timeline;
  project.updatedAt = new Date().toISOString();
  saveDb(db);
  res.json({ ok: true, project, versionId: db.editorVersions[0].id });
});

app.post("/api/editor/projects/:id/media", requireAuth, upload.array("media", 12), async (req, res) => {
  const project = editorProjectForUser(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de editor no encontrado." });
  if (!req.files?.length) return res.status(400).json({ ok: false, message: "Selecciona al menos un archivo multimedia." });
  try {
    const directory = editorMediaDir(project.id);
    const added = [];
    for (const file of req.files) {
      const mediaId = `media_${requestId()}`;
      const extension = path.extname(file.originalname).toLowerCase() || ".bin";
      const filename = `${mediaId}${extension}`;
      const filePath = path.join(directory, filename);
      fs.writeFileSync(filePath, file.buffer);
      const probe = await probeEditorMedia(filePath);
      if (!probe.hasVideo && !probe.hasAudio && !file.mimetype.startsWith("image/") && !/subrip|text/.test(file.mimetype)) {
        fs.unlinkSync(filePath);
        throw new Error(`${file.originalname}: formato sin stream multimedia compatible.`);
      }
      let thumbnailUrl = null;
      if (probe.hasVideo) {
        const thumbnailName = `${mediaId}.jpg`;
        await execFileAsync("ffmpeg", ["-y", "-ss", "0", "-i", filePath, "-frames:v", "1", "-vf", "scale=480:-2", path.join(directory, thumbnailName)], { timeout: 30000 });
        thumbnailUrl = `/uploads/editor/${project.id}/${thumbnailName}`;
      }
      const media = { id: mediaId, name: file.originalname, mimeType: file.mimetype, size: file.size, sourcePath: filePath, url: `/uploads/editor/${project.id}/${filename}`, thumbnailUrl, ...probe, createdAt: new Date().toISOString() };
      project.media.push(media);
      added.push(media);
    }
    project.updatedAt = new Date().toISOString();
    saveDb(db);
    res.status(201).json({ ok: true, media: added, project });
  } catch (error) {
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.post("/api/editor/projects/:id/operations", requireAuth, (req, res) => {
  const project = editorProjectForUser(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de editor no encontrado." });
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
  if (!operations.length) return res.status(400).json({ ok: false, message: "No se recibieron operaciones." });
  const snapshot = JSON.parse(JSON.stringify(project.timeline));
  try {
    operations.forEach((operation) => applyEditorOperation(project, operation));
    project.operationHistory.push({ id: `op_${requestId()}`, operations, before: snapshot, createdAt: new Date().toISOString() });
    project.operationHistory = project.operationHistory.slice(-100);
    saveDb(db);
    res.json({ ok: true, project, operations });
  } catch (error) {
    project.timeline = snapshot;
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.post("/api/editor/projects/:id/agent", requireAuth, (req, res) => {
  const project = editorProjectForUser(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de editor no encontrado." });
  const instruction = String(req.body?.instruction || "").trim();
  const selection = req.body?.selection || {};
  if (!instruction) return res.status(400).json({ ok: false, message: "Escribe una instruccion para el agente." });
  const lower = instruction.toLowerCase();
  let operations = [];
  if (/borra|elimina este clip/.test(lower) && selection.clipId) operations = [{ type: "delete_clip", clipId: selection.clipId }];
  else if (/divide|corta aqui|split/.test(lower) && selection.clipId) operations = [{ type: "split_clip", clipId: selection.clipId, time: Number(req.body?.playhead || 0) }];
  else if (/duplica/.test(lower) && selection.clipId) operations = [{ type: "duplicate_clip", clipId: selection.clipId }];
  else if (/subtitulo/.test(lower)) operations = [{ type: "add_subtitles", projectId: project.id, language: "es", style: "nexframe-default" }];
  else {
    const match = lower.match(/(?:segundo|minuto)\s*(\d+(?::\d+)?)\s*(?:al|a|hasta)\s*(\d+(?::\d+)?)/);
    const parseTime = (value) => value.includes(":") ? value.split(":").reduce((total, part) => total * 60 + Number(part), 0) : Number(value);
    if (match && selection.trackId) operations = [{ type: "delete_range", trackId: selection.trackId, start: parseTime(match[1]), end: parseTime(match[2]) }];
  }
  if (!operations.length) return res.status(422).json({ ok: false, message: "No pude convertir esa instruccion en una operacion segura. Selecciona un clip o indica un rango exacto." });
  const snapshot = JSON.parse(JSON.stringify(project.timeline));
  try {
    operations.forEach((operation) => applyEditorOperation(project, operation));
    project.operationHistory.push({ id: `op_${requestId()}`, instruction, operations, before: snapshot, createdAt: new Date().toISOString() });
    saveDb(db);
    res.json({ ok: true, project, operations, message: "Operacion ejecutada y guardada en el proyecto." });
  } catch (error) {
    project.timeline = snapshot;
    res.status(400).json({ ok: false, message: error.message });
  }
});

app.post("/api/editor/projects/:id/render", requireAuth, async (req, res) => {
  const project = editorProjectForUser(req.params.id, req.user.id);
  if (!project) return res.status(404).json({ ok: false, message: "Proyecto de editor no encontrado." });
  const videoTrack = project.timeline.tracks.find((track) => track.type === "video" && track.clips.length);
  if (!videoTrack) return res.status(400).json({ ok: false, message: "La timeline necesita al menos un clip de video." });
  const clips = [...videoTrack.clips].sort((a, b) => a.start - b.start);
  const audioTrack = project.timeline.tracks.find((track) => track.type === "audio" && track.clips.length);
  const audioClip = audioTrack ? [...audioTrack.clips].sort((a, b) => a.start - b.start)[0] : null;
  const outputName = `render_${Date.now()}_${requestId()}.mp4`;
  const outputPath = path.join(editorMediaDir(project.id), outputName);
  try {
    const args = ["-y"];
    clips.forEach((clip) => {
      const media = project.media.find((item) => item.id === clip.mediaId);
      if (!media?.sourcePath) throw new Error(`Archivo del clip ${clip.name || clip.id} no encontrado.`);
      args.push("-i", media.sourcePath);
    });
    let audioInputIndex = -1;
    if (audioClip) {
      const audioMedia = project.media.find((item) => item.id === audioClip.mediaId);
      if (!audioMedia?.sourcePath) throw new Error(`Archivo de audio ${audioClip.name || audioClip.id} no encontrado.`);
      audioInputIndex = clips.length;
      args.push("-i", audioMedia.sourcePath);
    }
    const filters = clips.map((clip, index) => `[${index}:v]trim=start=${Number(clip.in || 0)}:duration=${Math.max(.05, clip.end - clip.start)},setpts=PTS-STARTPTS,scale=${project.settings.width}:${project.settings.height}:force_original_aspect_ratio=decrease,pad=${project.settings.width}:${project.settings.height}:(ow-iw)/2:(oh-ih)/2:black[v${index}]`);
    filters.push(`${clips.map((_, index) => `[v${index}]`).join("")}concat=n=${clips.length}:v=1:a=0[outv]`);
    if (audioInputIndex >= 0) filters.push(`[${audioInputIndex}:a]atrim=start=${Number(audioClip.in || 0)}:duration=${project.timeline.duration},asetpts=PTS-STARTPTS[outa]`);
    args.push("-filter_complex", filters.join(";"), "-map", "[outv]");
    if (audioInputIndex >= 0) args.push("-map", "[outa]", "-c:a", "aac", "-b:a", "192k");
    args.push("-r", String(project.settings.fps || 30), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest", outputPath);
    await execFileAsync("ffmpeg", args, { timeout: 30 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 });
    const probe = await probeEditorMedia(outputPath);
    const output = { id: `output_${requestId()}`, url: `/uploads/editor/${project.id}/${outputName}`, ...probe, createdAt: new Date().toISOString() };
    project.outputs = [output, ...(project.outputs || [])];
    project.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ ok: true, output, project });
  } catch (error) {
    res.status(500).json({ ok: false, message: `Render FFmpeg fallido: ${error.message}` });
  }
});

app.post("/api/generate", upload.any(), async (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body;
  } catch {
    return res.status(400).json({ ok: false, message: "Payload inválido. Revisa el formato JSON enviado." });
  }
  if (!payload?.studio || !payload?.input?.prompt) {
    return res.status(400).json({ ok: false, message: "Falta studio o prompt para crear la generación." });
  }
  const provider = providers[payload.provider || "muapi"];
  const canUseExternal = provider?.baseUrl && provider?.apiKey && payload.useExternal === true;

  if (!canUseExternal) {
    const job = createLocalJob(payload);
    log("JOB_CREATED_LOCAL", { jobId: job.id, studio: job.studio, model: job.model });
    return sendGeneration(res, { job, extra: { mode: "local" } });
  }

  const job = createLocalJob({ ...payload, provider: payload.provider });
  log("JOB_CREATED_EXTERNAL_PROXY_READY", { jobId: job.id, provider: payload.provider });
  return sendGeneration(res, { job, extra: { mode: "external_proxy_ready", message: "Proveedor configurado. Conecta el endpoint exacto del modelo en el catalogo para ejecutar generacion remota." } });
  res.json({ ok: true, mode: "external_proxy_ready", job, message: "Proveedor configurado. Conecta el endpoint exacto del modelo en el catálogo para ejecutar generación remota." });
});

app.post("/api/muapi/generate", upload.any(), async (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body;
  } catch {
    return res.status(400).json({ ok: false, message: "Payload invalido." });
  }
  if (!payload?.studio) {
    return res.status(400).json({ ok: false, message: "Falta el studio para crear la generacion." });
  }
  if (!String(payload?.input?.prompt || "").trim()) {
    return res.status(400).json({ ok: false, message: "Falta el prompt. El texto del usuario debe enviarse completo y no puede estar vacio." });
  }

  const muapi = providers.muapi;
  let uploadedInputs = {};
  try {
    uploadedInputs = await collectUploadedFileInputs(req.files || []);
  } catch (error) {
    return res.status(502).json({ ok: false, gateway: "MuAPI Gateway", message: `No se pudo subir el archivo a MuAPI: ${error.message}` });
  }
  payload.input = { ...(payload.input || {}), ...uploadedInputs };
  const agentDecision = selectAgentForStudio(payload.studio, payload.input.prompt, {
    ...payload.input,
    model: payload.model || payload.input?.model
  });
  if (!payload.model && agentDecision.model) payload.model = agentDecision.model;
  payload.input = { ...(agentDecision.params || {}), ...(payload.input || {}) };
  const modelInfo = getMuapiModelById(payload.model) || getMuapiModelById(payload.input?.model) || null;
  const endpointPath = modelInfo?.endpoint || payload.model || payload.input?.model || "";
  try {
    assertRemoteGenerationReady({ apiKey: muapi.apiKey, endpoint: endpointPath, prompt: payload.input?.prompt });
  } catch (error) {
    return sendGeneration(res, { statusCode: error.status || 503, ok: false, error, extra: { gateway: "MuAPI Gateway", studio: payload.studio, model: payload.model || null } });
  }

  const endpoint = `${muapi.baseUrl.replace(/\/$/, "")}/api/v1/${endpointPath.replace(/^\//, "")}`;
  let requestBody;
  try {
    requestBody = validateMuapiPayload(payload.input, modelInfo, payload.studio);
  } catch (error) {
    return res.status(error.status || 400).json({ ok: false, gateway: "MuAPI Gateway", message: error.message });
  }
  if (process.env.NODE_ENV !== "production") {
    log("MUAPI_PAYLOAD_VALIDATED", {
      studio: payload.studio,
      model: modelInfo?.id || payload.model,
      prompt: requestBody.prompt,
      keys: Object.keys(requestBody)
    });
    console.log("[NEXFRAME MuAPI payload]", JSON.stringify({
      studio: payload.studio,
      model: modelInfo?.id || payload.model,
      endpoint: endpointPath,
      payload: requestBody
    }, null, 2));
  }
  const adapterResult = await callMuapiAdapter({ endpoint, apiKey: muapi.apiKey, modelId: modelInfo?.id || payload.model, payload: requestBody, timeoutMs: 30000 });
  if (!adapterResult.ok) {
    return sendGeneration(res, {
      statusCode: adapterResult.status || 502,
      ok: false,
      error: adapterResult.error,
      extra: {
        gateway: "MuAPI Gateway",
        message: adapterResult.error.message,
        remote: adapterResult.data,
        studio: payload.studio,
        model: modelInfo?.id || payload.model
      }
    });
  }
  {
    const remote = adapterResult.data;
    const remoteRequestId = extractRequestId(remote);
    const outputs = extractOutputs(remote);
    const outputCheck = validateAgentOutput(agentDecision, { ...remote, outputs }, Number(payload.input?.num_images || payload.input?.amount || 1));
    const remoteCost = remote.cost || remote.data?.cost || null;
    const remoteCredits = Number(remoteCost?.amount_credits || remoteCost?.credits || 0);
    const remoteUsd = Number(remoteCost?.amount_usd || remoteCost?.usd || 0);
    let job = createGenerationJob({
      studio: payload.studio,
      model: modelInfo?.id || payload.model || remote.model || "muapi-model",
      endpoint: endpointPath,
      input: payload.input,
      stages: [
        { id: "validation", label: "Validacion de inputs", progress: 20 },
        { id: "generation", label: "Generacion IA remota", progress: 85 },
        { id: "delivery", label: "Archivo guardado", progress: 100 }
      ]
    });
    job.remoteRequestId = remoteRequestId;
    job.agent = agentDecision;
    job.validation = outputCheck;
    job.remoteCost = remoteCost;
    if (outputs.some(isRealOutput)) {
      try {
        job = markJobCompleted(job, await persistRemoteOutputs(job, outputs));
      } catch (error) {
        job = markJobFailed(job, error);
      }
    }
    else job = { ...job, status: "processing", progress: Math.max(10, Number(remote.progress || 10)) };
    jobs.set(job.id, job);
    persistJob(job);
    if (remoteCredits || remoteUsd) {
      recordUsage({ studio: job.studio, model: job.model, credits: remoteCredits, cost: remoteUsd });
    }
    startMuapiPolling(job.id, remoteRequestId);
    log("MUAPI_REMOTE_JOB_CREATED", { jobId: job.id, requestId: remoteRequestId, studio: job.studio, model: job.model, endpoint: endpointPath, agent: agentDecision.agent });
    return sendGeneration(res, { job, extra: { gateway: "MuAPI Gateway", mode: "remote", remote, requestPayload: process.env.NODE_ENV !== "production" ? requestBody : undefined } });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "x-api-key": muapi.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const remote = await response.json().catch(() => ({}));
    if (!response.ok) {
      log("MUAPI_REMOTE_JOB_FAILED", { status: response.status, remote });
      return res.status(response.status).json({ ok: false, gateway: "MuAPI Gateway", message: formatMuapiRemoteError(remote, `MuAPI HTTP ${response.status}`), remote });
    }
    const remoteRequestId = extractRequestId(remote);
    const outputs = extractOutputs(remote);
    const outputCheck = validateAgentOutput(agentDecision, { ...remote, outputs }, Number(payload.input?.num_images || payload.input?.amount || 1));
    const remoteCost = remote.cost || remote.data?.cost || null;
    const remoteCredits = Number(remoteCost?.amount_credits || remoteCost?.credits || 0);
    const remoteUsd = Number(remoteCost?.amount_usd || remoteCost?.usd || 0);
    const job = {
      id: `nf_${Date.now()}_${requestId()}`,
      remoteRequestId,
      status: outputs.length ? "completed" : remote.status || "queued",
      progress: outputs.length ? 100 : Number(remote.progress || 10),
      provider: "muapi",
      model: modelInfo?.id || payload.model || remote.model || "muapi-model",
      endpoint: endpointPath,
      studio: payload.studio,
      input: payload.input,
      outputs,
      agent: agentDecision,
      validation: outputCheck,
      remoteCost,
      error: null,
      createdAt: new Date().toISOString()
    };
    jobs.set(job.id, job);
    if (remoteCredits || remoteUsd) {
      recordUsage({ studio: job.studio, model: job.model, credits: remoteCredits, cost: remoteUsd });
    }
    startMuapiPolling(job.id, remoteRequestId);
    log("MUAPI_REMOTE_JOB_CREATED", { jobId: job.id, requestId: remoteRequestId, studio: job.studio, model: job.model, endpoint: endpointPath, agent: agentDecision.agent });
    return sendGeneration(res, { job, extra: { gateway: "MuAPI Gateway", mode: "remote", remote, requestPayload: process.env.NODE_ENV !== "production" ? requestBody : undefined } });
    res.json({
      ok: true,
      gateway: "MuAPI Gateway",
      mode: "remote",
      job,
      remote,
      requestPayload: process.env.NODE_ENV !== "production" ? requestBody : undefined
    });
  } catch (error) {
    const message = error.name === "AbortError" ? "Timeout creando job remoto MuAPI." : error.message;
    log("MUAPI_REMOTE_REQUEST_ERROR", { message });
    res.status(502).json({ ok: false, gateway: "MuAPI Gateway", message });
  } finally {
    clearTimeout(timeout);
  }
});

app.post("/api/muapi/pipeline", requireAuth, upload.any(), async (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ ok: false, message: "Payload invalido." });
  }
  const studio = payload.studio;
  let input = payload.input || {};
  try {
    input = { ...input, ...(await collectUploadedFileInputs(req.files || [])) };
  } catch (error) {
    return res.status(502).json({ ok: false, gateway: "MuAPI Gateway", message: `No se pudo subir el archivo a MuAPI: ${error.message}` });
  }
  if (!["documentary", "musicvideo", "marketing", "flyer", "image", "video", "sound", "narrative"].includes(studio)) {
    return res.status(400).json({ ok: false, message: "Este estudio no dispone de pipeline de producción." });
  }
  const validation = validateProductionRequest(studio, input);
  if (!validation.ok) {
    return res.status(400).json({ ok: false, message: validation.errors.join(" "), errors: validation.errors });
  }
  const pipelineAgent = selectAgentForStudio(studio, input.prompt, {
    ...input,
    model: input.videoModel || input.imageModel || "muapi-pipeline"
  });
  input = { ...(pipelineAgent.params || {}), ...input };

  const stages = productionManifest(studio, input);

  const job = createLocalJob({
    provider: providers.muapi.apiKey ? "muapi-pipeline" : "muapi-local-pipeline",
    model: input.videoModel || input.imageModel || input.audioModel || "muapi-pipeline",
    studio,
    input,
    stages,
    autoComplete: false
  });
  job.pipeline = true;
  job.target = input.target;
  job.stages = stages;
  job.agent = pipelineAgent;
  if (studio === "documentary") {
    job.project = buildDocumentaryArtifact("preview", input);
    job.outputs = [];
  }
  if (studio === "musicvideo") {
    const musicVideoProject = buildMusicVideoProject(input, stages);
    job.timeline = musicVideoProject.timeline;
    job.outputs = [];
  }
  if (!job.project) job.project = projectFromProduction(job);
  const owner = currentUser(req);
  job.userId = owner?.id || null;
  job.project.userId = owner?.id || null;
  job.project.assets = job.outputs || [];
  const existingProjectIndex = (db.productionProjects || []).findIndex((item) => item.id === job.project.id);
  if (existingProjectIndex >= 0) db.productionProjects[existingProjectIndex] = job.project;
  else db.productionProjects.unshift(job.project);
  jobs.set(job.id, job);
  persistJob(job);
  saveDb(db);
  setTimeout(() => runProductionPipeline(job.id), 0);
  log("MUAPI_PIPELINE_CREATED", { jobId: job.id, studio, target: input.target, stages: stages.map((stage) => stage.id), agent: pipelineAgent.agent });
  return sendGeneration(res, {
    job,
    extra: {
      gateway: "MuAPI Gateway",
      mode: providers.muapi.apiKey ? "pipeline_ready_remote" : "local_functional",
      message: studio === "documentary" ? "Documental completo creado en cola de produccion." : studio === "musicvideo" ? "Videoclip completo creado en cola de produccion." : "Campana de marketing creada en cola de produccion."
    }
  });
  res.json({
    ok: true,
    gateway: "MuAPI Gateway",
    mode: providers.muapi.apiKey ? "pipeline_ready_remote" : "local_functional",
    job,
    message: studio === "documentary" ? "Documental completo creado en cola de produccion." : studio === "musicvideo" ? "Videoclip completo creado en cola de produccion." : "Campana de marketing creada en cola de produccion."
  });
});

function ensureYoutubeStore() {
  if (!Array.isArray(db.youtubeDownloads)) db.youtubeDownloads = [];
  if (!Array.isArray(db.youtubeClips)) db.youtubeClips = [];
  if (!Array.isArray(db.youtubeAnalyses)) db.youtubeAnalyses = [];
}

function validatePublicYoutubeUrl(value) {
  const raw = String(value || "").trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Pega una URL valida de YouTube.");
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    throw new Error("Solo se aceptan URLs publicas de YouTube.");
  }
  return parsed.toString();
}

function youtubeMediaDir() {
  const directory = path.join(__dirname, "public", "uploads", "youtube");
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function youtubePublicUploadUrl(filePath) {
  return `/uploads/${path.relative(path.join(__dirname, "public", "uploads"), filePath).replace(/\\/g, "/")}`;
}

async function runJsonTool(command, args, timeoutMs = 120000) {
  const { stdout } = await execFileAsync(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 * 12 });
  return JSON.parse(stdout);
}

async function probeVideo(filePath) {
  const probe = await runJsonTool(process.env.FFPROBE_BIN || "ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    filePath
  ], 60000);
  const video = (probe.streams || []).find((stream) => stream.codec_type === "video");
  const audio = (probe.streams || []).find((stream) => stream.codec_type === "audio");
  if (!video || !Number(probe.format?.duration)) throw new Error("El archivo descargado no es un video valido segun ffprobe.");
  return {
    duration: Number(probe.format.duration),
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    videoCodec: video.codec_name || "",
    audioCodec: audio?.codec_name || "",
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio)
  };
}

async function downloadYoutubeJob(job) {
  const directory = youtubeMediaDir();
  const outputTemplate = path.join(directory, `${job.id}.%(ext)s`);
  try {
    job.status = "downloading";
    job.progress = 20;
    jobs.set(job.id, job);
    const info = await runJsonTool(process.env.YTDLP_BIN || "yt-dlp", [
      "--dump-single-json",
      "--no-playlist",
      job.url
    ], 120000);
    job.title = info.title || "Video YouTube";
    job.videoId = info.id || "";
    job.duration = Number(info.duration || 0);
    job.progress = 45;
    jobs.set(job.id, job);
    await execFileAsync(process.env.YTDLP_BIN || "yt-dlp", [
      "--no-playlist",
      "-f", job.format === "audio" ? "bestaudio/best" : "bv*[height<=720]+ba/b[height<=720]/best",
      "--merge-output-format", "mp4",
      "-o", outputTemplate,
      job.url
    ], { timeout: 1000 * 60 * 20, windowsHide: true, maxBuffer: 1024 * 1024 * 20 });
    const filePath = fs.readdirSync(directory).map((name) => path.join(directory, name)).find((candidate) => path.basename(candidate).startsWith(`${job.id}.`));
    if (!filePath || !fs.existsSync(filePath)) throw new Error("yt-dlp termino sin crear archivo en disco.");
    const probe = await probeVideo(filePath);
    Object.assign(job, {
      status: "completed",
      progress: 100,
      filePath,
      url: youtubePublicUploadUrl(filePath),
      probe,
      completedAt: new Date().toISOString()
    });
    ensureYoutubeStore();
    db.youtubeDownloads = [job, ...db.youtubeDownloads.filter((item) => item.id !== job.id)].slice(0, 100);
    recordUsage({ studio: "youtube", model: "yt-dlp", credits: 5, cost: 0 });
    saveDb(db);
    log("YOUTUBE_DOWNLOAD_COMPLETED", { jobId: job.id, videoId: job.videoId, file: job.url });
  } catch (error) {
    Object.assign(job, { status: "failed", progress: 100, error: error.message, failedAt: new Date().toISOString() });
    log("YOUTUBE_DOWNLOAD_FAILED", { jobId: job.id, error: error.message });
  } finally {
    jobs.set(job.id, job);
  }
}

function parseTimestampSeconds(value) {
  if (typeof value === "number") return value;
  const text = String(value || "").trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) throw new Error("Timestamp no valido. Usa segundos o MM:SS.");
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function pdfEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createSimplePdf(title, lines) {
  const safeLines = [title, "", ...lines].flatMap((line) => String(line).match(/.{1,86}/g) || [""]);
  const content = ["BT", "/F1 11 Tf", "50 790 Td", "14 TL", ...safeLines.map((line, index) => `${index === 0 ? "" : "T*"} (${pdfEscape(line)}) Tj`), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

app.post("/api/youtube/analyze", (req, res) => {
  let channelUrl;
  try {
    channelUrl = validatePublicYoutubeUrl(req.body?.channelUrl || req.body?.url);
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
  const objective = String(req.body?.objective || "Detectar nicho documental rentable").trim().slice(0, 240);
  const duration = String(req.body?.duration || "35-40 min").trim().slice(0, 80);
  const tone = String(req.body?.tone || "Codigo Blanco broadcast").trim().slice(0, 120);
  const target = String(req.body?.target || "YouTube documental 16:9").trim().slice(0, 120);
  const parsed = new URL(channelUrl);
  const channel = parsed.pathname.replace(/^\/+/, "") || parsed.hostname;
  const niche = objective.toLowerCase().includes("short") ? "shorts faceless de misterio" : "documental cinematografico de largo aliento";
  const ideas = [
    ["El caso que cambio la version oficial", "Abrir con una contradiccion documentada y sostener la tension hasta la revelacion final."],
    ["La cronologia que nadie ordeno", "Reconstruir minuto a minuto el evento para que la audiencia descubra el patron."],
    ["El archivo perdido", "Presentar documentos, testimonios y vacios narrativos como una investigacion premium."],
    ["La pista que parecia menor", "Usar un detalle pequeno como hilo conductor hasta convertirlo en la clave del episodio."],
    ["Lo que queda fuera de camara", "Contrastar lo que se sabe, lo que falta y lo que no puede afirmarse sin evidencia real."]
  ].map(([title, hook], index) => ({
    title,
    hook,
    script: `Guion ${index + 1} para ${target}, duracion ${duration}, tono ${tone}. Estructura: apertura con ancla fuerte, contexto verificable, desarrollo por bloques, giro narrativo y cierre con pregunta para retencion. Usar el canal ${channel} como referencia de direccion editorial, sin afirmar metricas reales no conectadas.`,
    source: "local_structural_no_metrics"
  }));
  const analysis = {
    channel,
    channelUrl,
    niche,
    names: ["Codigo Blanco Investigacion", "Archivo Cero", "Cronica Oculta", "Caso Abierto", "Linea de Tiempo"],
    summary: `Analisis estructural local completado para ${channel}. No incluye outliers, competidores, transcripts ni metricas reales porque NexLev no esta conectado.`,
    objective,
    duration,
    tone,
    target,
    source: "local_structural_no_metrics",
    warnings: [
      "NexLev no esta conectado; no se inventaron metricas, outliers, competidores ni transcripciones.",
      "Conecta NexLev para enriquecer este resultado con datos reales de canal y nicho."
    ],
    ideas
  };
  ensureYoutubeStore();
  db.youtubeAnalyses = [analysis, ...db.youtubeAnalyses].slice(0, 100);
  saveDb(db);
  log("YOUTUBE_LOCAL_ANALYSIS_CREATED", { channel, source: analysis.source });
  res.json({ ok: true, analysis });
});

app.post("/api/youtube/download", requireAuth, (req, res) => {
  let url;
  try {
    url = validatePublicYoutubeUrl(req.body?.url);
  } catch (error) {
    return res.status(400).json({ ok: false, message: error.message });
  }
  const job = {
    id: `yt_${requestId()}`,
    type: "youtube_download",
    userId: req.user.id,
    url,
    format: req.body?.format || "720p",
    status: "queued",
    progress: 5,
    credits: 5,
    createdAt: new Date().toISOString()
  };
  jobs.set(job.id, job);
  downloadYoutubeJob(job);
  res.status(202).json({ ok: true, job, message: "Descarga real en cola. No se descontaran creditos hasta que ffprobe valide el archivo." });
});

app.get("/api/youtube/downloads", requireAuth, (req, res) => {
  ensureYoutubeStore();
  const items = db.youtubeDownloads.filter((item) => item.userId === req.user.id);
  res.json({ ok: true, downloads: items });
});

app.post("/api/youtube/clip", requireAuth, async (req, res) => {
  ensureYoutubeStore();
  const download = db.youtubeDownloads.find((item) => item.id === req.body?.downloadId && item.userId === req.user.id && item.status === "completed");
  if (!download) return res.status(404).json({ ok: false, message: "Primero descarga y valida un video publico de YouTube." });
  if (!req.body?.start || !req.body?.end) {
    return res.status(424).json({
      ok: false,
      code: "VIRAL_DETECTION_REQUIRES_TRANSCRIPT_PROVIDER",
      message: "Recorte por IA bloqueado: falta proveedor real de transcripcion/NexLev. Para no inventar momentos virales, envia start y end verificables o conecta get_video_transcript/get_bulk_video_transcripts."
    });
  }
  try {
    const start = parseTimestampSeconds(req.body.start);
    const end = parseTimestampSeconds(req.body.end);
    if (end <= start) return res.status(400).json({ ok: false, message: "El final del clip debe ser mayor que el inicio." });
    if (end - start > 180) return res.status(400).json({ ok: false, message: "El clip no puede superar 180 segundos en esta accion." });
    const outputPath = path.join(youtubeMediaDir(), `clip_${download.id}_${Math.round(start)}_${Math.round(end)}.mp4`);
    await execFileAsync(process.env.FFMPEG_BIN || "ffmpeg", [
      "-y",
      "-ss", String(start),
      "-to", String(end),
      "-i", download.filePath,
      "-c", "copy",
      outputPath
    ], { timeout: 1000 * 60 * 5, windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
    const probe = await probeVideo(outputPath);
    const clip = {
      id: `ytclip_${requestId()}`,
      userId: req.user.id,
      downloadId: download.id,
      start,
      end,
      url: youtubePublicUploadUrl(outputPath),
      filePath: outputPath,
      probe,
      createdAt: new Date().toISOString(),
      source: "ffmpeg_verified_range"
    };
    db.youtubeClips = [clip, ...db.youtubeClips].slice(0, 200);
    saveDb(db);
    log("YOUTUBE_CLIP_CREATED", { clipId: clip.id, downloadId: download.id, start, end });
    res.json({ ok: true, clip });
  } catch (error) {
    res.status(500).json({ ok: false, message: `No se pudo cortar el clip real: ${error.message}` });
  }
});

app.post("/api/youtube/agent", requireAuth, (req, res) => {
  const mode = String(req.body?.mode || "analyze");
  const text = String(req.body?.message || "").trim();
  if (!text) return res.status(400).json({ ok: false, message: "Escribe una instruccion para el agente." });
  const replies = {
    analyze: "Para analizar canal necesito NexLev conectado al backend. No entregare nichos, outliers ni competidores simulados.",
    download: "Pega una URL publica en Descargar video y ejecutare yt-dlp en background; solo marco completado si ffprobe valida el archivo.",
    clip: "Para recorte viral necesito transcripcion real. Si ya conoces el rango, indica inicio y final para cortar con FFmpeg sin inventar timestamps."
  };
  res.json({ ok: true, reply: replies[mode] || replies.analyze, mode });
});

app.post("/api/youtube/export-pdf", (req, res) => {
  const analysis = req.body?.analysis;
  if (!analysis) return res.status(400).json({ ok: false, message: "Falta analisis para exportar." });
  const lines = [
    `Canal: ${analysis.channel || ""}`,
    `Nicho: ${analysis.niche || ""}`,
    `Nombres: ${(analysis.names || []).join(", ")}`,
    "",
    ...(analysis.ideas || []).flatMap((idea, index) => [`Idea ${index + 1}: ${idea.title}`, `Hook: ${idea.hook}`, `Guion: ${idea.script}`, ""])
  ];
  const pdf = createSimplePdf("NEXFRAME FILMS - Analisis YouTube", lines);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"analisis-youtube-nexframe.pdf\"");
  res.send(pdf);
});

app.get("/api/task/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Job no encontrado." });
  return sendGeneration(res, { job });
});

app.get("/api/muapi/task/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Job no encontrado." });
  return sendGeneration(res, { job, extra: { gateway: "MuAPI Gateway" } });
});

app.post("/api/task/:id/cancel", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Job no encontrado." });
  job.status = "cancelled";
  job.progress = Math.min(job.progress, 99);
  jobs.set(job.id, job);
  log("JOB_CANCELLED", { jobId: job.id });
  res.json({ ok: true, job });
});

app.post("/api/muapi/task/:id/cancel", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Job no encontrado." });
  job.status = "cancelled";
  job.progress = Math.min(job.progress, 99);
  jobs.set(job.id, job);
  log("MUAPI_JOB_CANCELLED", { jobId: job.id });
  res.json({ ok: true, gateway: "MuAPI Gateway", job });
});

app.get("/api/audit", (_req, res) => {
  res.json({ ok: true, audit });
});

app.get("/api/outputs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Output no encontrado." });
  res.json({ ok: true, job, outputs: job.outputs });
});

app.use((error, _req, res, _next) => {
  const message = error?.message || "Solicitud no valida.";
  const status = message.includes("CORS") || message.includes("Origen no autorizado") ? 403 : 400;
  res.status(status).json({ ok: false, message });
});

app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "dist")));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = Number(process.env.PORT || 8787);
validateRegistryAtStartup();
app.listen(port, () => {
  console.log(`NEXFRAME server ready on http://localhost:${port}`);
});
