export const metadata = {
  title: "Política de Privacidad | Veloce",
  description: "Política de privacidad de Veloce Cycling",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-veloce-500">
              <span className="text-white font-bold">V</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Política de Privacidad
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Veloce Cycling · Última actualización: 17 de abril de 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              1. Quiénes somos
            </h2>
            <p>
              Veloce Cycling es una tienda de bicicletas premium ubicada en
              Medellín, Colombia, con más de 18 años de experiencia en el
              sector ciclístico. Nuestra dirección física es Calle 16A Sur
              #32B-38, Local 101, Mall Campestre Dive Inn, El Poblado,
              Medellín.
            </p>
            <p className="mt-2">
              Contacto: <strong>catrujillo79@gmail.com</strong> · WhatsApp:{" "}
              <strong>+57 318 996 3904</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              2. Información que recopilamos
            </h2>
            <p>
              Cuando nos contactas a través de WhatsApp, Instagram (@velocecycling)
              o Facebook Messenger, recopilamos la siguiente información:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Nombre y apellido (cuando lo proporcionas)</li>
              <li>Número de teléfono (para WhatsApp)</li>
              <li>Usuario de Instagram o Facebook (cuando escribes por esos canales)</li>
              <li>Contenido de tus mensajes</li>
              <li>Fecha y hora de tus interacciones</li>
              <li>Ciudad (cuando la proporcionas)</li>
              <li>
                Intereses relacionados con ciclismo (tipo de bicicleta,
                experiencia, preferencias)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              3. Cómo usamos tu información
            </h2>
            <p>Usamos tu información para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Responder tus preguntas sobre productos y servicios</li>
              <li>
                Brindarte asesoría personalizada sobre bicicletas, accesorios y
                mantenimiento
              </li>
              <li>
                Procesar tus consultas de compra y coordinar visitas a nuestra
                tienda
              </li>
              <li>Enviarte información sobre productos que te interesan</li>
              <li>Mejorar nuestro servicio al cliente</li>
              <li>
                Cumplir con nuestras obligaciones legales (facturación,
                garantías)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              4. Asistente virtual con IA
            </h2>
            <p>
              Utilizamos un asistente virtual impulsado por inteligencia
              artificial (Anthropic Claude) para responder de forma automática
              y rápida a tus mensajes. Esto nos permite brindarte atención
              inmediata incluso fuera de horario laboral. Las conversaciones
              pueden ser revisadas por nuestro equipo humano cuando sea
              necesario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              5. Con quién compartimos tu información
            </h2>
            <p>
              No vendemos ni compartimos tu información personal con terceros
              para fines comerciales. Compartimos información únicamente con:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Meta Platforms</strong> (WhatsApp, Instagram, Facebook) —
                para poder comunicarnos contigo a través de estos canales
              </li>
              <li>
                <strong>Supabase</strong> — proveedor de base de datos donde
                almacenamos de forma segura tus datos
              </li>
              <li>
                <strong>Anthropic</strong> — proveedor del modelo de IA que
                procesa tus mensajes para generar respuestas
              </li>
              <li>
                <strong>Autoridades</strong> — cuando sea requerido por ley
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              6. Tus derechos
            </h2>
            <p>
              De acuerdo con la Ley 1581 de 2012 de Colombia (Protección de
              Datos Personales), tienes derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>
                <strong>Acceder</strong> a los datos personales que tenemos
                sobre ti
              </li>
              <li>
                <strong>Rectificar</strong> datos incorrectos o incompletos
              </li>
              <li>
                <strong>Eliminar</strong> tus datos de nuestra base (derecho al
                olvido)
              </li>
              <li>
                <strong>Oponerte</strong> al tratamiento de tus datos
              </li>
              <li>
                <strong>Revocar</strong> el consentimiento en cualquier momento
              </li>
              <li>
                <strong>Exportar</strong> tus datos en un formato legible
              </li>
            </ul>
            <p className="mt-3">
              Para ejercer estos derechos, escríbenos a{" "}
              <strong>catrujillo79@gmail.com</strong> o por WhatsApp al{" "}
              <strong>+57 318 996 3904</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              7. Seguridad
            </h2>
            <p>
              Protegemos tu información con las siguientes medidas:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Cifrado HTTPS en todas las comunicaciones</li>
              <li>Base de datos con acceso restringido y autenticación</li>
              <li>
                Validación criptográfica (HMAC-SHA256) en webhooks entrantes
              </li>
              <li>
                Acceso al sistema solo para personal autorizado del equipo de
                Veloce
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              8. Retención de datos
            </h2>
            <p>
              Conservamos tu información mientras mantengas una relación
              comercial activa con Veloce o mientras lo requiera la ley. Puedes
              solicitar la eliminación en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              9. Cookies y tecnologías similares
            </h2>
            <p>
              Nuestro sitio web usa cookies esenciales para el funcionamiento
              del CRM interno. No utilizamos cookies de rastreo publicitario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              10. Cambios a esta política
            </h2>
            <p>
              Podemos actualizar esta política ocasionalmente. La fecha de
              última actualización aparece al inicio de este documento. Te
              recomendamos revisarla periódicamente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
              11. Contacto
            </h2>
            <p>
              Para cualquier pregunta sobre esta política de privacidad:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mt-3">
              <p>
                <strong>Veloce Cycling</strong>
                <br />
                Calle 16A Sur #32B-38, Local 101
                <br />
                Mall Campestre Dive Inn, El Poblado
                <br />
                Medellín, Colombia
                <br />
                <br />
                Email: catrujillo79@gmail.com
                <br />
                WhatsApp: +57 318 996 3904
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            © 2026 Veloce Cycling. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
