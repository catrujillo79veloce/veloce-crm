# 📋 Estado del CRM Veloce — 14 Abril 2026

## ✅ Lo que SÍ funciona

| Componente | Estado |
|---|---|
| Deploy en Vercel | ✅ Vivo (`veloce-crm-ten.vercel.app`) |
| Webhook `/api/webhooks/whatsapp` | ✅ Recibe y valida firma HMAC |
| Supabase (13 tablas CRM) | ✅ Guarda contactos e interacciones |
| Agente Claude (Anthropic API) | ✅ Responde correctamente |
| Token permanente nuevo | ✅ Generado, System User, never expires |
| App suscrita a WABA | ✅ Hecho hoy |
| Webhook URL en Meta | ✅ Configurada |
| Business verification | ✅ Verified + Approved |

## ❌ El bloqueo actual — Número NO registrado en Cloud API

```
status:                 PENDING          ← el número no está activo
code_verification_status: VERIFIED       ← OK
name_status:            DECLINED         ← nombre rechazado
2FA PIN:                DESCONOCIDO      ← bloqueo crítico
```

**Consecuencia:** Meta NO está entregando mensajes al webhook. Los clientes que escriben al +57 315 018 8145 ven su mensaje como enviado, pero se pierde en Meta. No llega ni al CRM ni a un celular físico.

---

## 🎯 PLAN DE ACCIÓN — en orden de prioridad

### 🚨 ACCIÓN 1 (AHORA, 5 min) — Mitigar pérdida de clientes

Redirigir todo el tráfico al **305 245 1204** (el otro número de la tienda) mientras arreglamos el 315.

#### 1a. Instagram @veloce (bio)
**Cambiar bio a:**
```
🚴 Bicicletas premium desde 2007
📍 Mall Campestre Dive Inn, El Poblado, Medellín
💬 WhatsApp: wa.me/573052451204
🌐 Orbea | BMC | Cervelo | Chapter 2
```

#### 1b. Facebook página Veloce (CTA button)
- Ir a la página → botón azul "Send Message" → cambiar a "Call" → número: `305 245 1204`
- En la sección "About" agregar: *"WhatsApp principal: 305 245 1204"*

#### 1c. Shopify (tienda)
- Theme customizer → Header / Footer → editar el WhatsApp link a `https://wa.me/573052451204`
- Si hay chat widget configurado al 315, cambiarlo al 305

#### 1d. Historia en Instagram (ahora)
**Texto sugerido para historia:**
```
📣 Aviso: estamos teniendo intermitencias
en el WhatsApp 315 018 8145.

Escríbenos al ➡️ 305 245 1204
(clic en el sticker de WhatsApp 👇)

¡Pronto estaremos 100% de nuevo! 🚴
```

---

### 🔧 ACCIÓN 2 (prioridad MÁXIMA) — Desbloquear el PIN de 2FA

#### Opción A: La app móvil (la más rápida — 10 min)

**Pregunta clave:** ¿El número +57 315 018 8145 está activo en WhatsApp Business App en algún celular físico?

**Si SÍ:**
1. Abrir WhatsApp Business en ese celular
2. Menú ⋮ → Ajustes → Cuenta → Verificación en dos pasos
3. **Cambiar PIN** → introducir uno nuevo que puedas recordar
   - Sugerencia: `246810` o `701204` (últimos 6 del otro número) o algo memorable
4. Pasar el PIN a Claude aquí en el chat → registro el número en 30 segundos

**Si NO** (el número solo existe en Cloud API) → ir a Opción B.

#### Opción B: Soporte Meta (24–48h)

1. Entra a: **https://business.facebook.com/business/help**
2. Click **"Get Started"** → **"Contact Support"**
3. Selecciona: **WhatsApp Business Platform**
4. Tema: **"Can't reset two-step verification PIN"**

**Mensaje listo para pegar:**

```
Hi Meta Support,

We lost our two-step verification PIN for our WhatsApp Business 
Cloud API number. We need a PIN reset to complete registration.

Details:
- Business Name:      Veloce Cycling
- Phone Number:       +57 315 018 8145
- Phone Number ID:    1050094941523718
- WABA ID:            26260967810211341
- Meta App ID:        26039835265698404
- Verification:       VERIFIED
- Current Status:     PENDING (needs re-registration)
- Business Verified:  YES

The number was previously registered but we've lost access to 
the 2FA PIN. The reset option in Business Manager shows 
"Try again later or contact support".

Please help us reset the 2FA PIN so we can register the number 
on Cloud API.

Thank you,
Veloce Cycling team
```

#### Opción C: Reset automático (si Meta deja, puede tardar 7 días)

1. Meta Business Suite → **WhatsApp Accounts** → Veloce Cycling
2. **Phone Numbers** → `+57 315 018 8145`
3. **Two-step verification** → **"Forgot PIN"** / **"Reset"**
4. Si pide esperar → anotar fecha de desbloqueo (puede ser hasta 7 días)

---

### 🎨 ACCIÓN 3 (paralelo, 2 min) — Arreglar Display Name DECLINED

Meta rechazó el nombre "Veloce Cycling".

1. Meta Business Suite → **WhatsApp Accounts** → Veloce Cycling
2. Click en **Settings** o perfil de la cuenta
3. **Display Name** → cambiar por una opción que cumpla reglas:
   - ✅ `Veloce`
   - ✅ `Veloce Bikes`
   - ✅ `Veloce Medellín`
   - ❌ `Veloce Cycling` (aparentemente rechazado)
4. Enviar a revisión (tarda 1–3 días)

**Reglas de display name** que Meta aplica:
- No puede coincidir 100% con categorías genéricas (ej: "Cycling", "Bikes")
- Debe tener relación clara con la marca/empresa
- Sin caracteres especiales excesivos

---

### 🔐 ACCIÓN 4 (después de que funcione) — Rotar secrets expuestos

Los siguientes secrets se expusieron en el chat y DEBEN rotarse:

| Secret | Dónde rotar |
|---|---|
| `META_APP_SECRET` (= FB, IG, WhatsApp) | Meta → App Settings → Basic → **Reset** |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business → System Users → generar token nuevo |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys → Rotate |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → Reset |

Después: actualizar en **Vercel** (env vars) + `.env.local` + redeploy.

---

## 📞 Datos de contacto Meta

- **Status Cloud API:** https://www.facebook.com/wa/biz_platform_status/
- **Business Help:** https://business.facebook.com/business/help
- **Direct Support (si no sale):** https://www.facebook.com/business/help/support

---

## 🏁 Cuando el PIN esté listo

Una vez tengas el PIN nuevo (de Opción A o Meta te lo reseteó), **pásamelo aquí** y en segundos:

1. Registro el número con el PIN correcto
2. Envío mensaje de prueba al +573176354893
3. Confirmo que el webhook responde el "hola"
4. Verifico que el outbound se guarda en Supabase
5. Cierre ✅

---

*Documento generado: 14 Abril 2026*
*Última acción exitosa: suscripción de app a WABA + token permanente*
*Próximo bloqueo: 2FA PIN*
