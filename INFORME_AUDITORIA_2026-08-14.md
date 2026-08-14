# Auditoría del CRM — 14 de agosto de 2026

Motivo: *"me escriben por WhatsApp y no me avisa, me toca estar actualizando la página"*.

Método: 6 auditores en paralelo (tiempo real, webhooks, seguridad, datos, UX móvil, IA),
60 hallazgos brutos, cada uno pasado por un verificador adversarial cuyo trabajo era
refutarlo leyendo el código. Sobrevivieron 23.

---

## 1. Por qué no te avisaba

No era un problema, eran tres encadenados.

### Capa 1 — Ningún celular estaba suscrito a las notificaciones (la causa principal)

El sistema de push existía y funcionaba, pero en la base había **una sola suscripción**:
Chrome de Windows, del 28 de mayo, con una dirección de entrega (`fcm.googleapis.com/fcm/send/…`)
que Google retiró. **Tu celular nunca se suscribió.** Cada mensaje entrante disparaba un
aviso que no salía a ninguna parte.

La razón de fondo: el interruptor para activarlas estaba enterrado en `/settings`, a tres
toques de profundidad, sin nada que llevara hasta él.

### Capa 2 — El aviso de respaldo llegaba en blanco justo con los mensajes que importan

- Cuando el cliente mandaba **nota de voz, foto o video**, la alerta salía con el cuerpo
  vacío: `👤 Juan 📝 ""`. La transcripción de la nota de voz ya estaba calculada y guardada
  40 líneas antes en el mismo archivo, pero la alerta nunca la usaba.
- Peor: el detector de "lead caliente" recibía ese mismo texto vacío, así que **nunca se
  disparó ni una vez para un mensaje con media**. En producción hay 180 mensajes con media
  y cuerpo vacío. Una nota de voz diciendo *"quiero separar la Orbea"* no producía 🔥.
- Y los leads calientes eran los únicos que **no** generaban push: `sendHotAlert` solo
  mandaba WhatsApp, y de paso suprimía el aviso genérico (`skip: hotPingFired`).

### Capa 3 — Al refrescar, el CRM te escondía el mensaje nuevo

El hilo cargaba **los 100 mensajes MÁS VIEJOS**, no los últimos
(`.order("occurred_at", { ascending: true }).limit(100)` devuelve los más antiguos).
Mientras la pestaña estaba abierta parecía funcionar porque el realtime iba agregando
al final; al recargar —que es justo lo que estabas haciendo— el mensaje nuevo desaparecía.

Y el canal de tiempo real no manejaba errores ni reconectaba: cuando el socket se caía
(pantalla del celular apagada, wifi a datos, laptop suspendida) moría en silencio y **nada
volvía a sincronizar**. Refrescar la página era literalmente el único camino.

---

## 2. Qué quedó corregido

### Avisos

| Qué | Dónde |
|---|---|
| Banner de activación de notificaciones en todas las pantallas del CRM, con instrucciones reales para iPhone (requiere "Agregar a inicio") | `components/push/EnablePushBanner.tsx` |
| Los leads calientes ahora mandan push **y** WhatsApp, en paralelo | `lib/ai/hot-detector.ts` |
| El push dejó de heredar el silencio de 15 min del ping de WhatsApp: reloj propio de 60 s | `lib/ai/notify-admin.ts` |
| Las alertas se construyen con la transcripción y el caption de visión, no con el campo de texto vacío | `lib/ai/build-ai-input.ts` (`describeInbound`) + los 3 webhooks |
| El detector de leads calientes recibe ese mismo texto: ya funciona con notas de voz y fotos | los 3 webhooks |
| Las alertas dejaron de ser fire-and-forget: se lanzan en paralelo con la IA pero se esperan antes de responder (Vercel congela la función al responder y las mataba a medias) | los 3 webhooks |
| Push con `urgency: high` y TTL, suscripciones FCM legacy detectadas y purgadas con log explícito | `lib/push/send.ts` |
| `/api/health` ahora reporta claves VAPID y **cuántos dispositivos** recibirían un aviso | `app/api/health/route.ts` |
| La prueba de push distingue "enviada" de "no había ningún dispositivo suscrito" | `components/push/PushNotificationSetting.tsx` |

### Tiempo real

| Qué | Dónde |
|---|---|
| Hook de suscripción con manejo de estado, reconexión con backoff exponencial, re-sincronización al recuperar foco / red, y poll de respaldo | `lib/realtime/useLiveTable.ts` |
| Avisos activos en **todo** el CRM, no solo en `/inbox`: sonido, notificación del sistema, toast y contador | `components/notifications/InboxAlerts.tsx` montado en `app/(crm)/layout.tsx` |
| Badge rojo de no leídos en el sidebar y en la barra inferior del celular | `components/layout/Sidebar.tsx`, `MobileNav.tsx` |
| Indicador "En vivo / Reconectando / Sin conexión" en la bandeja, tocable para forzar actualización | `components/inbox/InboxView.tsx` |
| El hilo carga los **200 más recientes** (antes: los 100 más viejos) | `components/inbox/ConversationThread.tsx` |
| La bandeja escanea 2000 interacciones en vez de 200 (antes se perdían conversaciones viejas) | `lib/inbox/conversations.ts` |
| Sonido con un solo AudioContext desbloqueado al primer toque (antes creaba uno por mensaje y quedaba suspendido) | `components/notifications/InboxAlerts.tsx` |

### No leídos de verdad

"No leído" significaba *"nadie ha respondido"*, y como el bot responde a casi todo, el
contador vivía en cero mientras clientes reales esperaban. Ahora significa **"ningún humano
ha abierto esta conversación"**: nueva columna `crm_contacts.inbox_read_at`, que se sella al
abrir el chat y persiste entre dispositivos y recargas.
Migración: `supabase/migrations/005_inbox_read_state.sql` (ya aplicada en producción).

### Seguridad

- **22 rutas de API** solo verificaban "hay sesión", no "es del equipo". Con `/signup`
  abierto y un pool de auth compartido con la app de atletas (**38 cuentas, 1 del equipo**),
  cualquiera podía suscribirse a las notificaciones y recibir el nombre y los primeros 180
  caracteres de los mensajes de tus clientes. Cerrado en un solo punto: `middleware.ts` ahora
  exige miembro activo del equipo en todo `/api/`, con lista blanca explícita para webhooks,
  cron, el formulario público y `/api/health`.
- Verificación de firma de Meta **fail-closed** en WhatsApp y Facebook (antes, si faltaba la
  variable de entorno, el webhook aceptaba POSTs anónimos sin avisar).
- De paso, los webhooks ya no pagan una consulta de sesión que nunca usaban.

### La pausa del bot ahora expira

`ai_paused_at` se escribía en cada respuesta manual y nunca se volvía a leer: contestar a un
cliente a mano dejaba al bot mudo con él **para siempre**. Había 14 contactos así, el más
antiguo desde el 10 de junio. Ahora el takeover caduca a los **7 días sin actividad humana**
en esa conversación, y el reloj se reinicia con cada mensaje que escribes tú — así que una
conversación que estés atendiendo hoy nunca se la quita el bot a mitad de camino.

De los 14 mudos, 10 llevan más de 7 días y volverán a responder la próxima vez que ese
cliente escriba; los otros 4 son recientes y siguen en pausa. No se envía nada ahora mismo:
la reactivación ocurre cuando llega el siguiente mensaje.

De paso, `shouldAIReply` dejó de **fallar abierto**: un error de base de datos anulaba los dos
kill-switches y el bot respondía igual. Ahora un error deja al bot callado.

### Pérdida silenciosa de mensajes

Cualquier error al guardar se registraba como *"duplicado suprimido"* —una mentira— y el
mensaje se perdía sin rastro. Ahora solo el código `23505` (violación de índice único) cuenta
como duplicado; cualquier otro error grita en los logs y te manda una alerta de sistema.

---

## 3. Lo que tienes que hacer tú (5 minutos, y sin esto nada de lo anterior te llega)

1. Abre el CRM **en el celular**.
2. En iPhone: Compartir → **Agregar a inicio**, y ábrelo desde ese ícono.
   (iOS solo permite notificaciones a apps instaladas. En Android no hace falta.)
3. Toca **Activar** en el banner verde que ahora aparece arriba.
4. Ve a Ajustes → **Probar**. Debe decir "Enviada", no "ningún dispositivo suscrito".

Verificación opcional: `GET /api/health` desde el CRM ya logueado debe mostrar
`NEXT_PUBLIC_VAPID_PUBLIC_KEY: OK`, `VAPID_PRIVATE_KEY: OK` y `PUSH_DEVICES: OK (1)` o más.

---

## 4. Pendiente, en orden de impacto

| # | Qué | Esfuerzo | Por qué importa |
|---|---|---|---|
| 1 | **Plantilla aprobada de WhatsApp como respaldo.** El aviso que te llega a ti es texto libre, y WhatsApp solo lo entrega dentro de las 24 h desde la última vez que TÚ le escribiste al número del negocio. Un fin de semana sin contestar ese hilo y te quedas ciego, sin registro de que los avisos se cayeron. | Medio (la aprobación en Meta tarda días) | Con el push activo deja de ser el único canal, pero sigue siendo un punto ciego. |
| 2 | **Deep-link en la notificación**: que te lleve a ESA conversación, no al inbox genérico. El `contactId` ya está disponible. | Medio | |
| 3 | **El bot descarta los turnos de audio e imagen del historial.** Si el cliente dijo su talla y presupuesto por nota de voz, en el siguiente mensaje el bot ya no lo sabe y vuelve a preguntar. | Bajo | ~10 veces por semana. |
| 4 | **Las migraciones del repo no reproducen producción**: faltan 6+ tablas y las columnas de media/IA, aplicadas a mano en el dashboard. | Medio | Si hay que recrear la base, no se puede. |
| 5 | **Dashboard: ~40 consultas secuenciales por carga**, y el KPI de tareas por vendedor siempre da 0 (filtra por un valor que no existe en el enum). | Medio | |
| 6 | **Enter manda el mensaje**: desde el celular es imposible escribir una respuesta de más de una línea sin mandarla a medias. Y los inputs a 14 px hacen que iOS haga zoom en cada toque. | Bajo | Fricción diaria. |
| 7 | **Cerrar `/signup`.** Hoy cualquiera se registra en segundos sin confirmar correo. Ya no puede tocar nada del CRM, pero no debería poder registrarse. | Bajo | |
| 8 | **La campana del TopBar** es un botón muerto con un punto rojo permanentemente encendido. | Bajo | |

---

## 5. Qué quedó verificado y qué no

**Verificado de verdad:**
- `tsc --noEmit` y `next build` limpios; ningún error de lint nuevo.
- El service worker reescrito instala y activa (`state: activated`) en el navegador.
- El middleware, probado en caliente contra el servidor de desarrollo:
  `/api/contacts/search`, `/api/push/test`, `/api/media/upload` → **401** en el edge;
  webhooks de WhatsApp/Facebook/Instagram → llegan a su ruta y **rechazan payloads sin
  firma (401)**; `/api/lead-form/submit`, `/sw.js`, `/login`, `/api/health` → siguen accesibles.
- El esquema en producción: migración aplicada, índices creados.

**No verificado:** la interfaz autenticada del CRM (bandeja, badges, sonido, notificación
del sistema). Requiere iniciar sesión con tu cuenta y no lo hice. Es la parte que conviene
mirar primero después de desplegar.
