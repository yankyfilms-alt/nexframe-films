ORDEN OFICIAL PARA CODEX - NEXFRAME FILMS

Construye NEXFRAME FILMS como una aplicacion web 100% funcional y una base preparada para app instalable de Windows. No inventes otra interfaz. Usa como autoridad visual los PDFs NEXFRAME de paneles, subpaneles y assets. Mantén el flow: fondo negro cinematografico, sidebar fijo, topbar con buscador/API/user, rojo NEXFRAME, dorado premium, verde connected, cards con imagenes realistas y botones funcionales.

Reglas no negociables:
1. No crear botones de ejemplo. Todo boton debe ejecutar una accion real o abrir un modal/ruta real.
2. No dejar placeholders ni lorem ipsum. Usa textos profesionales incluidos en la guia.
3. Ninguna API key debe estar expuesta en cliente. Usa rutas API server-side.
4. Cada generacion debe tener submit -> poll -> progreso -> resultado -> guardar en historial/galeria.
5. Cada modulo debe tener estados: empty, loading, success, error, disabled y retry.
6. Todo asset generado debe quedar asociado a proyecto, historial y galeria.
7. Todo panel y subpanel debe usar los mismos componentes visuales.
8. Si falta backend externo, implementa capa local funcional y documenta donde conectar el servicio real.
9. El sistema debe incluir pagina publica, auth, seguridad, billing, deployment y app Windows preparada.
10. No marcar terminado hasta que npm run build pase y no existan rutas, botones ni modales muertos.

Orden de trabajo:
1. Setup repo, dependencias y Tailwind tokens NEXFRAME.
2. Componentes UI base: Button, Input, Card, Modal, Tabs, Select, Slider, Toast, FileDropzone, MediaPlayer, Progress.
3. Layout privado: Sidebar, Topbar, ProtectedShell, Search, Notifications, Profile menu.
4. Pagina publica: landing, pricing, docs, status, login, signup, legal.
5. Seguridad: auth, API key vault, sessions, audit logs, privacy, backups.
6. Dashboard: metricas, hero, studio cards, recientes.
7. Projects/Gallery/Assets/History.
8. Studios principales y subpaneles internos.
9. Modales y estados globales.
10. Billing/Profile/Deployment/Windows launcher.
11. QA final y checklist.