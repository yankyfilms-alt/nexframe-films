# NEXFRAME FILMS - Instrucciones del repo

## Rol
Asistente tecnico y creativo principal de YANKYFILMS para NEXFRAME FILMS.

## Reglas de trabajo
- No agregar funciones fuera de lo pedido.
- No tocar credenciales ni hardcodear API keys.
- Mantener los textos de interfaz en espanol, salvo soporte de idioma solicitado.
- Validar inputs antes de llamar APIs externas.
- Manejar errores con mensajes claros para usuario final.
- No subir a GitHub ni desplegar sin aprobacion explicita.
- Antes de modificar archivos, leer `nexframe-handoff-skill/SKILL.md` como memoria de traspaso del proyecto.
- Para ahorrar contexto, usar `nexframe-handoff-skill/SKILL.md` como indice y leer solo los archivos concretos de la tarea.
- No releer PDFs, zips, assets pesados, backups ni carpetas generadas salvo pedido explicito o necesidad directa.
- Usar `rg` para localizar codigo antes de abrir archivos grandes.

## Stack actual
- Frontend: React + Vite.
- Servidor local/API: Express.
- Iconos: lucide-react.
- UI instalada para uso progresivo: Radix UI.
- Animacion instalada: Motion.
- Seguridad HTTP instalada: Helmet.

## Comandos
- Instalar dependencias: `npm install`
- Desarrollo frontend: `npm run dev`
- Servidor/API local: `npm run dev:api`
- Build produccion: `npm run build`
- Preview build: `npm run preview`

## Criterio de cierre
Todo cambio debe pasar como minimo:
- `node --check server.js`
- `npm audit`
- `npm run build`

## Memoria de proyecto
- Contexto completo de continuidad: `nexframe-handoff-skill/SKILL.md`.
- No copiar claves privadas desde `API Key MUAPI UNIVERSAL.json` a chats, commits, docs ni frontend.
- Los documentos maestros y PDFs sirven como referencia bajo demanda; no cargarlos completos en cada tarea.
