// seed_estimated_budgets.js
const http = require('https');

const API_BASE = "https://backend-production-fdf3.up.railway.app";
const ADMIN_PIN = "1234";

const categoriesToEnsure = [
  "Fase 1: Obra Civil y Estructuras",
  "Fase 2: Insonorización, Pisos y Climatización",
  "Fase 3: Equipamiento de Frío y Cocina",
  "Fase 4: Tecnología, Audio, Luces y POS",
  "Fase 5: Mobiliario, Ambientación y Apertura"
];

const estimatedBudgets = [
  // FASE 1
  { concept: "Proyecto, Planos y Trámites Municipales/H&S", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 2800, date: "2026-08-04", provider: "Arquitecta / Ingeniero H&S" },
  { concept: "Reparación Techo de chapa + Membrana impermeabilizante", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 4500, date: "2026-08-04", provider: "Techista" },
  { concept: "Reforma Ventanal Salida de Emergencia Vidriada con Marco y Antipánico", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 1800, date: "2026-08-04", provider: "Herrería / Vidriería" },
  { concept: "Instalación Eléctrica Trifásica Nueva Completa desde cero", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 8500, date: "2026-08-04", provider: "Electricista Matriculado" },
  { concept: "Construcción 100% de cero de Batería de Baños (Damas, Caballeros, PMR)", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 11200, date: "2026-08-04", provider: "Plomero / Albañil" },
  { concept: "Albañilería Cocina Industrial (azulejos, trampa grasa, tiraje a 4 vientos)", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 6800, date: "2026-08-04", provider: "Albañil / Zinguería" },
  { concept: "Estructura y Mampostería de Barra en L (6x5m)", phase: "Fase 1: Obra Civil y Estructuras", currency: "USD", amount: 4200, date: "2026-08-04", provider: "Albañil / Carpintero" },

  // FASE 2
  { concept: "Aislamiento Acústico y Fonoabsorción (Cielorraso suspendido y lana de roca)", phase: "Fase 2: Insonorización, Pisos y Climatización", currency: "USD", amount: 14500, date: "2026-08-04", provider: "Especialista Acústico / Durlock" },
  { concept: "Piso de Alto Tránsito 360m² (Microcemento/Hormigón pulido/Epoxi)", phase: "Fase 2: Insonorización, Pisos y Climatización", currency: "USD", amount: 9800, date: "2026-08-04", provider: "Empresa de Pisos Alisados" },
  { concept: "2 Equipos Comerciales Aire Acondicionado Frío/Calor 15k Frigorías", phase: "Fase 2: Insonorización, Pisos y Climatización", currency: "USD", amount: 11500, date: "2026-08-04", provider: "Climatización Comercial" },

  // FASE 3
  { concept: "Cámara de Frío Barriles + Línea de 6-9 Choperas y Pilones Inox", phase: "Fase 3: Equipamiento de Frío y Cocina", currency: "USD", amount: 7800, date: "2026-08-04", provider: "Equipamiento Cervecero" },
  { concept: "Heladeras Bajobarra 3P + Freezers Gastronómicos + Exhibidora", phase: "Fase 3: Equipamiento de Frío y Cocina", currency: "USD", amount: 6200, date: "2026-08-04", provider: "Distribuidor Frío Comercial" },
  { concept: "Equipamiento Cocina (Freidoras 20L, Plancha 1m, Horno convector, Anafes, Mesadas Inox)", phase: "Fase 3: Equipamiento de Frío y Cocina", currency: "USD", amount: 8500, date: "2026-08-04", provider: "Gastronomía Industrial" },

  // FASE 4
  { concept: "Sistema Audio Profesional Recitales/Bailable (Bafles 15in, Subs 18in, Potencias, Consola)", phase: "Fase 4: Tecnología, Audio, Luces y POS", currency: "USD", amount: 6500, date: "2026-08-04", provider: "Sonido Profesional" },
  { concept: "Iluminación DMX (Tachos LED, Robóticas, Máquina Humo) + CCTV 8 Cámaras", phase: "Fase 4: Tecnología, Audio, Luces y POS", currency: "USD", amount: 2800, date: "2026-08-04", provider: "Iluminación / Seguridad" },
  { concept: "Red POS IT (2 PCs All-in-One Caja, 4 Comanderas Térmicas, Red Ubiquiti MESH)", phase: "Fase 4: Tecnología, Audio, Luces y POS", currency: "USD", amount: 3200, date: "2026-08-04", provider: "Proveedor POS Gastronómico" },
  { concept: "5 Smart TVs 55in 4K + Proyector 4000 lúmenes con Pantalla Gigante 120in", phase: "Fase 4: Tecnología, Audio, Luces y POS", currency: "USD", amount: 3800, date: "2026-08-04", provider: "Casa de Electrónica / Audio" },

  // FASE 5
  { concept: "Mobiliario Salón (45 Mesas 2p, 10 Mesas 4p, Sillones VIP, 18 Banquetas Barra)", phase: "Fase 5: Mobiliario, Ambientación y Apertura", currency: "USD", amount: 8200, date: "2026-08-04", provider: "Fábrica Muebles Gastronómicos" },
  { concept: "Bazar y Cristalería (500 Pintas, 400 Vasos Tragos, 300 Platos/Cazuelas, Cubiertos)", phase: "Fase 5: Mobiliario, Ambientación y Apertura", currency: "USD", amount: 3800, date: "2026-08-04", provider: "Bazar Mayorista" },
  { concept: "Cartel Frente LED + 3 Neones LED Interiores + Vegetación Decorativa", phase: "Fase 5: Mobiliario, Ambientación y Apertura", currency: "USD", amount: 3500, date: "2026-08-04", provider: "Cartelería Neón / Ambientador" },
  { concept: "Matafuegos ABC/K + Luces Emergencia + Señalética H&S", phase: "Fase 5: Mobiliario, Ambientación y Apertura", currency: "USD", amount: 1200, date: "2026-08-04", provider: "Matafuegos / Seguridad" },
  { concept: "Uniformes Personal, Branding, Marketing Apertura + Stock Inicial Bebidas/Barriles", phase: "Fase 5: Mobiliario, Ambientación y Apertura", currency: "USD", amount: 4500, date: "2026-08-04", provider: "Agencia Marketing / Proveedores Bebidas" }
];

async function postJSON(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${endpoint}`);
    const body = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-admin-pin': ADMIN_PIN
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(respData) }); }
        catch (e) { resolve({ status: res.statusCode, data: respData }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log("Creando categorías de fases...");
  for (const catName of categoriesToEnsure) {
    const res = await postJSON('/api/categories', { name: catName });
    console.log(`Cat '${catName}':`, res.status, res.data.success ? 'OK' : res.data);
  }

  console.log("\nCargando presupuestos estimados...");
  for (const b of estimatedBudgets) {
    b.id = `est-${Math.random().toString(36).substring(2, 9)}`;
    const res = await postJSON('/api/budgets', b);
    console.log(`Presupuesto '${b.concept}':`, res.status, res.data.success ? 'OK' : res.data);
  }
  console.log("\n¡Sembrado de presupuestos estimados finalizado!");
}

run();
