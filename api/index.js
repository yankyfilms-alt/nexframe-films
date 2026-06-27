import { omnivoiceVoices } from "../src/data/omnivoice-voices.js";

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
    const baseUrl = String(process.env.OMNIVOICE_BASE_URL || "").replace(/\/+$/, "");
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
    res.status(503).json({
      ok: false,
      message: "La web desplegada ya tiene el panel OmniVoice y las voces cargadas. Para generar audio desde Vercel configura OMNIVOICE_BASE_URL con el backend OmniVoice publicado; en local usa npm run dev:api con OmniVoice Studio activo."
    });
    return;
  }

  res.status(200).json({ ok: true, message: "Acceso admin temporal activo." });
}
