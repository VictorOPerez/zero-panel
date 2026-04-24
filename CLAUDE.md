@AGENTS.md

## Decisiones de implementación (apr 2026)

### Dirección visual
Se implementó la dirección **Console** (densa/pro) del diseño. Layout de 3 columnas fijas en desktop: sidebar 240px · lista de conversaciones 360px · panel de conversación flex. Mobile-first: sidebar colapsado en drawer lateral vía Sheet de shadcn.

### Stack
- Next.js 16.2.4 · React 19 · TypeScript estricto
- Tailwind v4 (CSS-first, sin tailwind.config.js)
- shadcn/ui: badge, separator, tooltip, scroll-area, sheet, avatar, dropdown-menu
- TanStack Query (instalado, sin hookear — pendiente de API real)
- socket.io-client (instalado, stub en /src/lib/socket/)
- Zustand: UI state global (sidebar, drawer mobile)
- Zod: tipado de todos los schemas de API

### Datos
Los datos usan mock estático en `/src/lib/mock-data.ts`. Al conectar el backend real, reemplazar los imports de `MOCK_*` en los componentes "view" con hooks de TanStack Query que llamen a `/src/lib/api/`.

### Endpoints de API (stubs tipados)
Todos en `/src/lib/api/`. **PAUSA antes de agregar endpoints no listados.**

| Archivo | Endpoints |
|---|---|
| conversations.ts | GET /conversations · GET /conversations/:id · GET /conversations/:id/messages · POST /conversations/:id/messages · POST /conversations/:id/take-control · POST /conversations/:id/return-to-ai · POST /conversations/:id/resolve |
| integrations.ts | GET /integrations · POST /integrations/whatsapp/qr · POST /integrations/whatsapp/api · DELETE /integrations/:key |
| analytics.ts | GET /analytics?period= |
| agent.ts | GET /agent/config · PUT /agent/config · POST /agent/publish · POST /agent/playground |

### Socket.io
Eventos tipados en `/src/lib/socket/events.ts`. Cliente singleton en `/src/lib/socket/client.ts`. Conectar desde el componente que necesite real-time con `connectSocket(tenantId)`.

### Variables de entorno necesarias
```
NEXT_PUBLIC_API_URL=https://api.zero.navapex.com
NEXT_PUBLIC_WS_URL=wss://ws.zero.navapex.com
```

### Auth
NextAuth v5 instalado pero no configurado. Stub pendiente. Actualmente sin protección de rutas (sin middleware). Al activar auth, agregar `/src/auth.ts` y `/src/middleware.ts`.
