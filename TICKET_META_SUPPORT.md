# 📧 Ticket para Meta Business Support

**Dónde reportar:**
1. https://business.facebook.com/business/help
2. **Get Started** → **Contact Support**
3. Producto: **WhatsApp Business Platform**
4. Issue: **"Messages not being delivered from Cloud API"**

---

## Texto del ticket (copiar/pegar)

```
Hello Meta Support,

We're experiencing a critical delivery issue with our WhatsApp 
Business Cloud API. Messages sent via the API are accepted 
(HTTP 200 with valid wamid and message_status "accepted") but 
never delivered to recipients. Incoming messages from users also 
do not reach our webhook.

ACCOUNT DETAILS:
- Business Name:         Veloce Cycling  
- Phone Number:          +57 315 018 8145
- Phone Number ID:       1109092955612767
- WABA ID:               1507492997664111
- Meta App ID:           26039835265698404
- Business Manager ID:   1100726984001605

STATUS (from Graph API):
- status:                CONNECTED
- quality_rating:        GREEN
- account_mode:          LIVE
- platform_type:         CLOUD_API
- code_verification:     VERIFIED
- business_verified:     YES
- can_send_message:      AVAILABLE (all entities)
- App subscribed to WABA: YES

CONTEXT:
Earlier today we deleted 2 duplicate WhatsApp Business Accounts 
that were associated with this same phone number (all named 
"Veloce Cycling"). The surviving WABA is the verified one 
(1507492997664111). After the cleanup:

- API still accepts outbound messages with wamid + "accepted" 
  status, but recipients never receive them (not even template 
  messages like "hello_world").
- Inbound messages from customers don't reach our webhook.

Sample message IDs that were accepted but not delivered:
- wamid.HBgMNTczMTc2MzU0ODkzFQIAERgSMDE2MEM2M0I0RDU5QkIyOUMyAA== (template hello_world)
- wamid.HBgMNTczMTc2MzU0ODkzFQIAERgSN0UxOEFBQTFGREIzQ0I2QUFDAA==
- wamid.HBgMNTczMTc2MzU0ODkzFQIAERgSRTE3NDNCMjM2MTIxREZCM0EzAA==

Test recipient: +57 317 635 4893 (confirmed active WhatsApp, 
receives messages from others normally).

WEBHOOK CONFIG:
- URL:              https://veloce-crm-ten.vercel.app/api/webhooks/whatsapp
- Verify token:     correctly configured
- App secret:       correctly configured (HMAC validates)
- Subscribed fields: messages

Please investigate why this phone number cannot send or receive 
messages despite all status indicators being green. It appears 
that residual routing from the deleted duplicate WABAs may be 
interfering with message delivery.

Thank you for your urgent attention — we've lost a business day 
already.

Best regards,
Veloce Cycling team
```

---

## Después del soporte

Cuando te respondan (24-48h) y el problema esté resuelto, el CRM 
debería funcionar INMEDIATAMENTE porque ya está todo configurado. 
No hay que cambiar nada más del código.

## Rotación de secrets pendiente (hacer cuando funcione)

Los siguientes secrets se expusieron en el chat y deben rotarse:

1. **App Secret Meta** → App Settings → Basic → Reset
2. **WhatsApp Access Token** → Business Settings → System Users → Regenerate
3. **Anthropic API Key** → console.anthropic.com → rotar
4. **Supabase Service Role Key** → Supabase → Settings → API → Reset

Después actualizar en Vercel + .env.local.
