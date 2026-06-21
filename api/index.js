export default function handler(req, res) {
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

  res.status(200).json({ ok: true, message: "Acceso admin temporal activo." });
}
