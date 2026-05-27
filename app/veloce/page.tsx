import Link from "next/link"
import {
  Bike,
  Wrench,
  Activity,
  MapPin,
  Clock,
  Phone,
  MessageCircle,
  AtSign,
  Share2,
  Star,
  ShieldCheck,
  Award,
  ChevronRight,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Veloce public landing page (/veloce)
//
// Server-rendered for SEO, fast load, and Google Ads landing-page approval.
// Designed to convert paid-ad traffic into WhatsApp conversations, visits to
// the store, or phone calls. The destination URL we point Google Ads at.
// ---------------------------------------------------------------------------

const WHATSAPP_NUMBER = "573176354893"
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola Veloce! Vengo de Google y me interesa..."
)}`
const PHONE_LINK = "tel:+573176354893"
const MAPS_LINK =
  "https://www.google.com/maps/search/?api=1&query=Veloce+Cycling+Medellin+El+Poblado"
const INSTAGRAM_LINK = "https://instagram.com/velocecycling"
const FACEBOOK_LINK = "https://facebook.com/VelocecyclingMDE"

const BRANDS = [
  "Orbea",
  "Colnago",
  "Pinarello",
  "Chapter 2",
  "BMC",
  "Kask",
  "Koo",
  "Oakley",
  "Shimano",
  "Sram",
  "Maurten",
  "Pirelli",
]

const SERVICES = [
  {
    icon: Award,
    title: "Bike Fit Retul 3D",
    description:
      "Análisis biomecánico con 16 sensores de movimiento en tiempo real. Más comodidad, menos lesiones, más eficiencia.",
    price: "$440.000",
  },
  {
    icon: Activity,
    title: "Indoor Cycling",
    description:
      "Clases grupales en nuestro estudio con instructor certificado y bicicletas Wattbike. Ideal para mejorar fondo y técnica.",
    price: "Desde $50.000",
  },
  {
    icon: Wrench,
    title: "Taller Especializado",
    description:
      "Mantenimiento, ajuste de transmisión, lavado profesional, sangrado de frenos. Mecánicos certificados Shimano y Sram.",
    price: "Consulta",
  },
]

const FEATURED_PRODUCTS = [
  {
    name: "Colnago V3 Shimano 105 Di2",
    category: "Bicicleta de Ruta",
    price: "$14.900.000",
    oldPrice: "$17.900.000",
    badge: "OFERTA",
  },
  {
    name: "Orbea Orca M30",
    category: "Bicicleta de Ruta",
    price: "$10.299.000",
    oldPrice: "$11.299.000",
    badge: "OFERTA",
  },
  {
    name: "Orbea Wild M-20",
    category: "E-MTB",
    price: "$34.499.000",
  },
  {
    name: "Orbea Alma H20",
    category: "MTB",
    price: "$5.999.000",
  },
  {
    name: "Casco Kask Protone Icon",
    category: "Accesorios",
    price: "$1.100.000",
  },
  {
    name: "Gafas Koo Alibi",
    category: "Accesorios",
    price: "$899.000",
  },
]

const HIGHLIGHTS = [
  { icon: ShieldCheck, label: "15+ años de experiencia" },
  { icon: Star, label: "4.3★ con 26 reseñas en Google" },
  { icon: Award, label: "Único Bike Fit Retul 3D en Medellín" },
]

export default function VeloceLanding() {
  return (
    <main className="min-h-screen bg-white">
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-veloce-700 via-veloce-600 to-veloce-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur">
              <Bike className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">VELOCE</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-4 max-w-3xl">
            La tienda de ciclismo
            <br />
            <span className="text-veloce-200">más completa</span> de Medellín
          </h1>

          <p className="text-lg sm:text-xl text-veloce-50 mb-8 max-w-2xl">
            Bicicletas premium Orbea, Colnago, Pinarello. Bike Fit Retul 3D,
            Indoor Cycling y taller especializado. Todo bajo un mismo techo
            en El Poblado.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-veloce-700 hover:bg-veloce-50 font-semibold px-6 py-4 rounded-xl shadow-lg transition"
            >
              <MessageCircle className="h-5 w-5" />
              Escríbenos por WhatsApp
            </a>
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-veloce-900/40 hover:bg-veloce-900/60 text-white border border-white/20 font-semibold px-6 py-4 rounded-xl backdrop-blur transition"
            >
              <MapPin className="h-5 w-5" />
              Cómo llegar
            </a>
            <a
              href={PHONE_LINK}
              className="sm:flex-none inline-flex items-center justify-center gap-2 bg-veloce-900/40 hover:bg-veloce-900/60 text-white border border-white/20 font-semibold px-6 py-4 rounded-xl backdrop-blur transition"
            >
              <Phone className="h-5 w-5" />
              Llamar
            </a>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-3xl">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon
              return (
                <div
                  key={h.label}
                  className="flex items-center gap-3 text-sm text-veloce-50"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 inline-flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span>{h.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============ BRANDS ============ */}
      <section className="border-y bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <p className="text-center text-sm uppercase tracking-widest text-gray-500 font-semibold mb-6">
            Marcas que manejamos
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {BRANDS.map((brand) => (
              <span
                key={brand}
                className="text-gray-700 font-bold text-lg tracking-tight"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ SERVICES ============ */}
      <section className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Más que una tienda
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Servicios que ningún otro centro de ciclismo en Medellín ofrece
            bajo un mismo techo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SERVICES.map((service) => {
            const Icon = service.icon
            return (
              <div
                key={service.title}
                className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-veloce-500 hover:shadow-lg transition"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-veloce-100 text-veloce-600 mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {service.title}
                </h3>
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                  {service.description}
                </p>
                <p className="text-veloce-600 font-bold">{service.price}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============ PRODUCTS ============ */}
      <section className="bg-gray-50 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Productos destacados
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Una muestra de nuestro catálogo. Tenemos mucho más en tienda.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURED_PRODUCTS.map((product) => (
              <div
                key={product.name}
                className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition relative"
              >
                {product.badge && (
                  <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                    {product.badge}
                  </span>
                )}
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center">
                  <Bike className="h-16 w-16 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  {product.category}
                </p>
                <h3 className="font-bold text-gray-900 mb-2">{product.name}</h3>
                <div className="flex items-baseline gap-2">
                  {product.oldPrice && (
                    <span className="text-sm text-gray-400 line-through">
                      {product.oldPrice}
                    </span>
                  )}
                  <span className="text-lg font-bold text-veloce-600">
                    {product.price}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-veloce-600 hover:bg-veloce-700 text-white font-semibold px-8 py-4 rounded-xl shadow-md transition"
            >
              Consulta disponibilidad por WhatsApp
              <ChevronRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ============ VISIT US ============ */}
      <section className="max-w-6xl mx-auto px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Visítanos en El Poblado
            </h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Estamos ubicados en una zona de fácil acceso con parqueadero. Ven
              a conocer las bicicletas, probártelas, o tomar un Bike Fit Retul.
            </p>

            <div className="space-y-5">
              <div className="flex gap-4">
                <MapPin className="h-6 w-6 text-veloce-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Dirección</p>
                  <p className="text-gray-600">
                    Calle 16A Sur # 32B-38, Local 101
                    <br />
                    El Poblado, Medellín
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Clock className="h-6 w-6 text-veloce-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Horario</p>
                  <p className="text-gray-600">
                    Lunes a Viernes: 9:00 AM – 7:00 PM
                    <br />
                    Sábados: 9:00 AM – 5:00 PM
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Phone className="h-6 w-6 text-veloce-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900">Contacto</p>
                  <p className="text-gray-600">
                    <a
                      href={WHATSAPP_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-veloce-600"
                    >
                      WhatsApp: +57 317 635 4893
                    </a>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-8">
              <a
                href={INSTAGRAM_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-veloce-600 text-sm font-medium"
              >
                <AtSign className="h-5 w-5" />
                Instagram @velocecycling
              </a>
              <a
                href={FACEBOOK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-veloce-600 text-sm font-medium"
              >
                <Share2 className="h-5 w-5" />
                Facebook VelocecyclingMDE
              </a>
            </div>
          </div>

          <div className="bg-veloce-50 border border-veloce-200 rounded-2xl p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              ¿Listo para rodar?
            </h3>
            <p className="text-gray-700 mb-6">
              Cuéntanos qué buscas: una bici, un servicio de taller, o una
              clase de Indoor Cycling. Te respondemos rápido por WhatsApp.
            </p>
            <div className="space-y-3">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-veloce-600 hover:bg-veloce-700 text-white font-semibold px-6 py-4 rounded-xl shadow-md transition"
              >
                <MessageCircle className="h-5 w-5" />
                Iniciar conversación
              </a>
              <a
                href={MAPS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-white border border-veloce-300 text-veloce-700 hover:bg-veloce-100 font-semibold px-6 py-4 rounded-xl transition"
              >
                <MapPin className="h-5 w-5" />
                Cómo llegar a Veloce
              </a>
              <a
                href={PHONE_LINK}
                className="w-full inline-flex items-center justify-center gap-2 bg-white border border-veloce-300 text-veloce-700 hover:bg-veloce-100 font-semibold px-6 py-4 rounded-xl transition"
              >
                <Phone className="h-5 w-5" />
                Llamar ahora
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-veloce-600">
                <Bike className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-white">VELOCE</p>
                <p className="text-xs text-gray-400">
                  Tienda de bicicletas · El Poblado, Medellín
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} Veloce Cycling Store. Todos los
              derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
