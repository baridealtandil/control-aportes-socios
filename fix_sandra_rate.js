// fix_sandra_rate.js
const http = require('https');

const API_BASE = "https://backend-production-fdf3.up.railway.app";
const ADMIN_PIN = "1234";

async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const postData = body ? JSON.stringify(body) : null;
    
    const req = http.request(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        'x-admin-pin': ADMIN_PIN
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("Actualizando transacciones de Sandra a TC = 1550...");

  // 1. Seña Alquiler de Local (Sandra): 833.300 ARS a TC 1550
  const tx1 = {
    partner: "Sandra",
    currency: "ARS",
    amount: 833300,
    rate: 1550,
    concept: "Seña Alquiler de Local",
    phase: "Fase 1: Obra Civil y Estructuras",
    date: "2026-08-12",
    budget_id: "712db808-c375-43f7-8e73-aec9c431cf5b",
    provider: "Propietarios"
  };
  const res1 = await request('/api/contributions/932937cd-ec16-40cf-ad8c-50aa23016904', 'PUT', tx1);
  console.log("Tx1 Sandra (Seña Alquiler):", res1.status, res1.data);

  // 2. Comisión Inmobiliaria (Sandra): 1.016.700 ARS a TC 1550 (Total 1.850.000 ARS)
  const tx2 = {
    partner: "Sandra",
    currency: "ARS",
    amount: 1016700,
    rate: 1550,
    concept: "Comisión Inmobiliaria",
    phase: "Fase 1: Obra Civil y Estructuras",
    date: "2026-08-12",
    budget_id: "86a22e1c-4f6f-431f-a251-e08e17205944",
    provider: "Eloisa Casado"
  };
  const res2 = await request('/api/contributions/c2de962e-026c-4a5e-992d-6940b748dd19', 'PUT', tx2);
  console.log("Tx2 Sandra (Comisión Inmobiliaria):", res2.status, res2.data);

  console.log("\n¡Actualización completada exitosamente!");
}

run();
