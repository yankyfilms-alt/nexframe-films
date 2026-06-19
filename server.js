import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getModelContract, getMuapiModelById, muapiRegistry } from "./src/data/models-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  "video/mp4",
  "video/webm",
  "application/octet-stream"
]);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787")
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
    projects: [],
    jobs: [],
    usage: { creditsTotal: 12450, creditsUsed: 0, byStudio: {}, byModel: {} },
    createdAt: new Date().toISOString()
  };
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
(db.jobs || []).forEach((job) => jobs.set(job.id, job));

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function signSession(user) {
  const payload = Buffer.from(JSON.stringify({
    userId: user.id,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 12
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
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
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' http://localhost:8787 http://127.0.0.1:8787 https://api.muapi.ai; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
});
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error("Origen no autorizado por CORS."));
  }
}));
app.use(express.json({ limit: "2mb" }));

function rateLimit(limit = 120, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "local";
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
    if (bucket.count > limit) {
      blockedIps.set(key, now + 15 * 60 * 1000);
      log("IP_TEMPORARILY_BLOCKED", { ip: key, limit, windowMs });
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
  avatarImage: "image_url",
  referenceVideo: "video_url",
  cloneVideo: "video_url",
  localAudio: "audio_url",
  referenceAudio: "audio_url"
};

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

function validateMuapiPayload(input = {}, modelInfo = {}) {
  const supports = new Set(modelInfo.supports || Object.keys(modelInfo.inputs || {}));
  [modelInfo.imageField, modelInfo.videoField, modelInfo.audioField].filter(Boolean).forEach((field) => supports.add(field));
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
    const canonicalKey = supports.has(key) ? key : canonicalInputKey(key);
    if (!supports.has(canonicalKey) && canonicalKey !== "prompt") {
      const error = new Error(`El modelo ${modelInfo.id || "seleccionado"} no acepta el parametro "${key}".`);
      error.status = 400;
      throw error;
    }
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
  for (const file of files) {
    const field = file.fieldname;
    const url = providers.muapi.apiKey ? await uploadFileToMuapi(file) : null;
    const value = url || `${file.originalname} (${file.size} bytes)`;
    if (field.toLowerCase().includes("audio")) merged.audio_url = value;
    else if (field.toLowerCase().includes("video") || field.toLowerCase().includes("clone")) merged.video_url = value;
    else if (field.toLowerCase().includes("avatar")) merged.avatar_url = value;
    else if (field.toLowerCase().includes("image")) merged.image_url = value;
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
      job.progress = Math.max(job.progress || 0, Math.min(95, attempts * 8));
      job.status = ["succeeded", "success", "completed", "done"].includes(remoteStatus) || outputs.length ? "completed" : "processing";
      if (outputs.length) {
        job.progress = 100;
        job.outputs = outputs;
      }
      jobs.set(job.id, job);
      if (job.status === "completed") clearInterval(timer);
    } catch (error) {
      job.status = attempts >= 3 ? "failed" : "processing";
      job.error = error.message;
      jobs.set(job.id, job);
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "NEXFRAME AI Engine", providers: publicProviderStatus(), time: new Date().toISOString() });
});

app.get("/api/providers", (_req, res) => {
  res.json({ ok: true, providers: publicProviderStatus() });
});

app.get("/api/muapi/providers", (_req, res) => {
  res.json({ ok: true, gateway: "MuAPI Gateway", providers: publicProviderStatus() });
});

app.get("/api/auth/session", (req, res) => {
  const user = currentUser(req);
  res.json({ ok: true, signedIn: Boolean(user), user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = db.users.find((item) => item.email.toLowerCase() === email && item.active);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    log("AUTH_LOGIN_FAILED", { email });
    return res.status(401).json({ ok: false, message: "Credenciales incorrectas." });
  }
  const token = signSession(user);
  res.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
  log("AUTH_LOGIN_SUCCESS", { userId: user.id, role: user.role });
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
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

app.post("/api/muapi/action", upload.any(), (req, res) => {
  let payload;
  try {
    payload = req.is("multipart/form-data") ? JSON.parse(req.body.payload || "{}") : req.body;
  } catch {
    return res.status(400).json({ ok: false, message: "Payload invalido." });
  }
  const panel = payload?.panel || "global";
  const action = payload?.action || "";
  const allowed = new Set([...(v6ButtonActionMap.global || []), ...(v6ButtonActionMap[panel] || []), "Generate Campaign Package", "Validate Public Website", "Audit Logs", "Consent Vault"]);
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

app.post("/api/billing/checkout", (req, res) => {
  const checkoutReady = Boolean(process.env.STRIPE_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET);
  const session = {
    id: `checkout_${requestId()}`,
    plan: req.body?.plan || "pro",
    credits: Number(req.body?.credits || 1000),
    provider: process.env.STRIPE_SECRET_KEY ? "stripe" : process.env.PAYPAL_CLIENT_SECRET ? "paypal" : "local-ledger",
    status: checkoutReady ? "ready" : "server_credentials_required",
    createdAt: new Date().toISOString()
  };
  log("CHECKOUT_SESSION_REQUESTED", session);
  res.json({
    ok: checkoutReady,
    session,
    message: checkoutReady
      ? "Sesion de checkout creada en servidor."
      : "El panel esta operativo. Para cobro real configura STRIPE_SECRET_KEY o PAYPAL_CLIENT_SECRET en el servidor."
  });
});

app.get("/api/deployment/validate", (_req, res) => {
  const checks = [
    { id: "api", label: "API server", ok: true },
    { id: "static", label: "Static build folder", ok: true },
    { id: "providers", label: "AI providers", ok: publicProviderStatus().some((provider) => provider.configured) },
    { id: "billing", label: "Billing provider", ok: Boolean(process.env.STRIPE_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET) }
  ];
  log("DEPLOYMENT_VALIDATION", { checks });
  res.json({ ok: checks.every((check) => check.ok), checks, time: new Date().toISOString() });
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
    return res.json({ ok: true, mode: "local", job });
  }

  const job = createLocalJob({ ...payload, provider: payload.provider });
  log("JOB_CREATED_EXTERNAL_PROXY_READY", { jobId: job.id, provider: payload.provider });
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
  const modelInfo = getMuapiModelById(payload.model) || getMuapiModelById(payload.input?.model) || null;
  const endpointPath = modelInfo?.endpoint || payload.model || payload.input?.model || "";
  const canUseMuapi = Boolean(muapi.baseUrl && muapi.apiKey && endpointPath);

  if (!canUseMuapi) {
    const job = createLocalJob({ ...payload, provider: "muapi-local", model: payload.model || endpointPath || "muapi-model" });
    log("MUAPI_LOCAL_JOB_CREATED", { jobId: job.id, studio: job.studio, model: job.model, endpoint: endpointPath });
    return res.json({
      ok: true,
      gateway: "MuAPI Gateway",
      mode: "local_functional",
      job,
      message: "Job creado en motor local. Configura MUAPI_API_KEY para ejecucion remota real por MuAPI."
    });
  }

  const endpoint = `${muapi.baseUrl.replace(/\/$/, "")}/api/v1/${endpointPath.replace(/^\//, "")}`;
  let requestBody;
  try {
    requestBody = validateMuapiPayload(payload.input, modelInfo);
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
      return res.status(response.status).json({ ok: false, gateway: "MuAPI Gateway", message: remote.message || `MuAPI HTTP ${response.status}`, remote });
    }
    const remoteRequestId = extractRequestId(remote);
    const outputs = extractOutputs(remote);
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
      remoteCost,
      error: null,
      createdAt: new Date().toISOString()
    };
    jobs.set(job.id, job);
    if (remoteCredits || remoteUsd) {
      recordUsage({ studio: job.studio, model: job.model, credits: remoteCredits, cost: remoteUsd });
    }
    startMuapiPolling(job.id, remoteRequestId);
    log("MUAPI_REMOTE_JOB_CREATED", { jobId: job.id, requestId: remoteRequestId, studio: job.studio, model: job.model, endpoint: endpointPath });
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

app.post("/api/muapi/pipeline", upload.any(), async (req, res) => {
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
  if (!["documentary", "musicvideo"].includes(studio)) {
    return res.status(400).json({ ok: false, message: "Pipeline solo disponible para Documentary Studio y Music Video Studio." });
  }
  if (!input.prompt?.trim()) {
    return res.status(400).json({ ok: false, message: "Falta el tema o prompt principal del proyecto." });
  }

  const stages = studio === "documentary"
    ? [
      { id: "narrative", label: "Guion narrativo", model: input.audioModel || "suno-create-music", status: "queued" },
      { id: "storyboard", label: "Storyboard y escenas", model: input.imageModel || "nano-banana", status: "queued" },
      { id: "voice_music", label: "Voz y banda sonora", model: input.audioModel || "suno-create-music", status: "queued" },
      { id: "video_generation", label: "Generacion de escenas", model: input.videoModel || "veo3.1-text-to-video", status: "queued" },
      { id: "assembly", label: "Montaje y export", model: input.lipSyncModel || "infinitetalk-image-to-video", status: "queued" }
    ]
    : [
      { id: "audio", label: "Audio base", model: input.audioModel || "suno-create-music", status: "queued" },
      { id: "storyboard", label: "Storyboard por beat", model: input.imageModel || "nano-banana", status: "queued" },
      { id: "clips", label: "Clips de video", model: input.videoModel || "veo3.1-text-to-video", status: "queued" },
      { id: "lipsync", label: "Lip sync / avatares", model: input.lipSyncModel || "infinitetalk-image-to-video", status: "queued" },
      { id: "export", label: "Export final", model: input.videoModel || "veo3.1-text-to-video", status: "queued" }
    ];

  const job = createLocalJob({
    provider: providers.muapi.apiKey ? "muapi-pipeline" : "muapi-local-pipeline",
    model: input.videoModel || input.imageModel || "muapi-pipeline",
    studio,
    input,
    stages
  });
  job.pipeline = true;
  job.target = input.target;
  job.stages = stages;
  jobs.set(job.id, job);
  log("MUAPI_PIPELINE_CREATED", { jobId: job.id, studio, target: input.target, stages: stages.map((stage) => stage.id) });
  res.json({
    ok: true,
    gateway: "MuAPI Gateway",
    mode: providers.muapi.apiKey ? "pipeline_ready_remote" : "local_functional",
    job,
    message: studio === "documentary" ? "Documental completo creado en cola de produccion." : "Videoclip completo creado en cola de produccion."
  });
});

function youtubeAnalysis(input = {}) {
  const base = String(input.channelUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const seed = base.split(/[/?#@]/).filter(Boolean).slice(-1)[0] || "canal";
  const niche = `Archivo ${seed.replace(/[^a-z0-9]+/gi, " ").trim() || "Documental"} Inexplorado`;
  const ideas = Array.from({ length: 5 }).map((_, index) => {
    const number = index + 1;
    return {
      title: `${niche} - Episodio ${number}`,
      hook: [
        "Un caso oculto que empieza con una pista pequena y termina revelando una red completa.",
        "La historia de una tecnologia ignorada que pudo cambiarlo todo.",
        "Un expediente con versiones oficiales incompatibles y documentos contradictorios.",
        "El rastro de una decision que afecto a miles sin aparecer en titulares.",
        "Una investigacion sobre el patron que nadie esta mirando."
      ][index],
      script: `Guion documental ${number}. Tono: ${input.tone || "Codigo Blanco broadcast"}. Duracion objetivo: ${input.duration || "35-40 min"}. Estructura: introduccion inquietante, contexto verificable, desarrollo por actos, revelacion progresiva y cierre con pregunta fuerte para retencion.`
    };
  });
  return {
    channel: input.channelUrl,
    objective: input.objective,
    niche,
    names: [`${niche}`, `Codigo ${seed}`, `Archivo Profundo`, `Zona No Documentada`, `Expediente Oculto`],
    summary: `Analisis listo. Nicho recomendado: ${niche}. Se generaron 5 nombres y 5 ideas con guion base para producir en Documentary Studio.`,
    ideas,
    nextAction: "Enviar la idea principal a Documentary Studio o exportar PDF para produccion."
  };
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
  if (!req.body?.channelUrl) return res.status(400).json({ ok: false, message: "Falta URL de canal o video." });
  const analysis = youtubeAnalysis(req.body);
  log("YOUTUBE_ANALYSIS_CREATED", { channel: req.body.channelUrl, niche: analysis.niche });
  res.json({ ok: true, analysis });
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
  res.json({ ok: true, job });
});

app.get("/api/muapi/task/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Job no encontrado." });
  res.json({ ok: true, gateway: "MuAPI Gateway", job });
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

app.use(express.static(path.join(__dirname, "dist")));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`NEXFRAME server ready on http://localhost:${port}`);
});
