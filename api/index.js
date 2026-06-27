import { getOmnivoiceVoiceById, omnivoiceVoices } from "../src/data/omnivoice-voices.js";

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function omnivoiceBaseUrl() {
  return String(process.env.OMNIVOICE_BASE_URL || "").replace(/\/+$/, "");
}

function omnivoiceHeaders(extra = {}) {
  const headers = { ...extra };
  if (process.env.OMNIVOICE_API_KEY) headers.Authorization = `Bearer ${process.env.OMNIVOICE_API_KEY}`;
  return headers;
}

export default async function handler(req, res) {
  const adminUser = {
    id: "usr_temp_admin",
    name: "YANKYFILMS",
    email: "yankyfilms@gmail.com",
    role: "admin",
    active: true
  };

  if (req.url.startsWith("/api/auth/session") || req.url.startsWith("/api/auth/login")) {
    res.status(200).json({ ok: true, signedIn: true, user: adminUser });
    return;
  }

  if (req.url.startsWith("/api/usage")) {
    res.status(200).json({ ok: true, usage: { creditsTotal: 12450, creditsUsed: 0, byStudio: {}, byModel: {}, totalCost: 0 } });
    return;
  }

  if (req.url.startsWith("/api/deployment/validate")) {
    res.status(200).json({ ok: true, checks: [{ id: "admin-access", label: "Acceso admin temporal", ok: true, required: true }], warnings: [], time: new Date().toISOString() });
    return;
  }

  if (req.url.startsWith("/api/muapi/providers")) {
    res.status(200).json({ ok: true, providers: [] });
    return;
  }

  if (req.url.startsWith("/api/omnivoice/voices")) {
    res.status(200).json({ ok: true, voices: omnivoiceVoices, remoteVoices: [], primaryVoiceId: omnivoiceVoices[0]?.id });
    return;
  }

  if (req.url.startsWith("/api/omnivoice/status")) {
    const baseUrl = omnivoiceBaseUrl();
    if (!baseUrl) {
      res.status(200).json({
        ok: true,
        connected: false,
        baseUrl: "",
        voices: omnivoiceVoices.length,
        message: "Voces OmniVoice cargadas. Para generar audio en Vercel configura OMNIVOICE_BASE_URL con un backend OmniVoice accesible por HTTPS."
      });
      return;
    }
    try {
      const response = await fetch(`${baseUrl}/v1/audio/voices`, {
        headers: process.env.OMNIVOICE_API_KEY ? { Authorization: `Bearer ${process.env.OMNIVOICE_API_KEY}` } : {}
      });
      res.status(200).json({
        ok: true,
        connected: response.ok,
        baseUrl,
        voices: omnivoiceVoices.length,
        message: response.ok ? "OmniVoice Studio conectado." : `OmniVoice respondio HTTP ${response.status}.`
      });
      return;
    } catch (error) {
      res.status(200).json({ ok: true, connected: false, baseUrl, voices: omnivoiceVoices.length, message: `OmniVoice no responde: ${error.message}` });
      return;
    }
  }

  if (req.url.startsWith("/api/omnivoice/speech")) {
    const baseUrl = omnivoiceBaseUrl();
    if (!baseUrl) {
      res.status(503).json({
        ok: false,
        message: "Falta conectar el motor de voz. Configura OMNIVOICE_BASE_URL en Vercel con la URL HTTPS de OmniVoice Studio."
      });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const text = String(body?.text || body?.input || "").trim();
      if (!text) {
        res.status(400).json({ ok: false, message: "Pega la narrativa antes de generar voz." });
        return;
      }
      if (text.length > 10000) {
        res.status(400).json({ ok: false, message: "Maximo 10.000 caracteres por audio." });
        return;
      }
      const voice = getOmnivoiceVoiceById(body?.voice_id || body?.voice || "");
      const format = ["mp3", "wav", "pcm"].includes(String(body?.format || "").toLowerCase()) ? String(body.format).toLowerCase() : "wav";
      const speedValue = Number(body?.speed || 1);
      const speed = Math.min(1, Math.max(0.9, Number.isFinite(speedValue) ? speedValue : 1));
      const response = await fetch(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: omnivoiceHeaders({ "Content-Type": "application/json", Accept: "audio/*" }),
        body: JSON.stringify({ model: voice.engine || "omnivoice", voice: voice.id, input: text, response_format: format, speed })
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        res.status(response.status).json({ ok: false, message: `OmniVoice no genero el audio: ${detail || `HTTP ${response.status}`}` });
        return;
      }
      const contentType = response.headers.get("content-type") || (format === "mp3" ? "audio/mpeg" : "audio/wav");
      const buffer = Buffer.from(await response.arrayBuffer());
      const filename = `omnivoice_${Date.now()}.${format === "pcm" ? "pcm" : format}`;
      res.status(200).json({
        ok: true,
        voice,
        audio: {
          url: `data:${contentType};base64,${buffer.toString("base64")}`,
          filename,
          mimeType: contentType,
          bytes: buffer.length
        }
      });
      return;
    } catch (error) {
      res.status(503).json({ ok: false, message: `No se pudo generar audio con OmniVoice: ${error.message}` });
      return;
    }
  }

  res.status(200).json({ ok: true, message: "Acceso admin temporal activo." });
}
