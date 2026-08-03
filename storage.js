// storage.js
// Adaptador de comunicación con el Backend de Railway para el Control de Aportes y Presupuestos

const API_BASE = "https://backend-production-fdf3.up.railway.app";
const ADMIN_PIN_KEY = "control_socios_admin_pin";

class StorageAdapter {
  constructor() {
    this.adminPin = localStorage.getItem(ADMIN_PIN_KEY) || "";
  }

  // Verifica si el navegador actual tiene un PIN de administrador guardado
  isAdmin() {
    return !!this.adminPin;
  }

  // Retorna el PIN actual
  getPin() {
    return this.adminPin;
  }

  // Intenta iniciar sesión consultando al backend
  async login(pin) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: pin.trim() })
      });

      if (response.ok) {
        this.adminPin = pin.trim();
        localStorage.setItem(ADMIN_PIN_KEY, this.adminPin);
        return true;
      }
    } catch (e) {
      console.error("Error al autenticar con el servidor:", e);
      alert("Error al conectar con el servidor. Revisa tu conexión.");
    }
    return false;
  }

  // Cierra sesión
  logout() {
    this.adminPin = "";
    localStorage.removeItem(ADMIN_PIN_KEY);
  }

  // Cambia el PIN de administrador en el backend
  async updatePin(newPin) {
    if (!this.isAdmin()) throw new Error("No autorizado");
    
    const response = await fetch(`${API_BASE}/api/auth/change-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify({ newPin: newPin.trim() })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "No se pudo cambiar el PIN.");
    }

    // Actualizar localmente el PIN guardado
    this.adminPin = newPin.trim();
    localStorage.setItem(ADMIN_PIN_KEY, this.adminPin);
  }

  // ================= TRANSACCIONES / APORTES =================

  // Obtiene todas las transacciones desde Railway
  async getData() {
    try {
      const response = await fetch(`${API_BASE}/api/contributions`);
      if (response.ok) {
        const data = await response.json();
        return data.transactions || [];
      }
      throw new Error(`Error en servidor: ${response.statusText}`);
    } catch (e) {
      console.error("Fallo al obtener transacciones:", e);
      throw new Error("No se pudieron cargar los datos de aportes desde el servidor.");
    }
  }

  // Envía un nuevo aporte a Railway
  async addTransaction(tx) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/contributions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify(tx)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al guardar el aporte.");
    }

    return true;
  }

  // Edita un aporte existente en Railway
  async updateTransaction(id, tx) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/contributions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify(tx)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al editar el aporte.");
    }

    return true;
  }

  // Elimina un aporte en Railway
  async deleteTransaction(id) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/contributions/${id}`, {
      method: 'DELETE',
      headers: {
        'x-admin-pin': this.adminPin
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al eliminar el aporte.");
    }

    return true;
  }

  // ================= PRESUPUESTOS (BUDGETS) =================

  // Obtiene todos los presupuestos desde Railway
  async getBudgets() {
    try {
      const response = await fetch(`${API_BASE}/api/budgets`);
      if (response.ok) {
        const data = await response.json();
        return data.budgets || [];
      }
      throw new Error(`Error en servidor: ${response.statusText}`);
    } catch (e) {
      console.error("Fallo al obtener presupuestos:", e);
      throw new Error("No se pudieron cargar los presupuestos desde el servidor.");
    }
  }

  // Crea un presupuesto en Railway
  async addBudget(budget) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/budgets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify(budget)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al guardar el presupuesto.");
    }

    return true;
  }

  // Edita un presupuesto en Railway
  async updateBudget(id, budget) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/budgets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify(budget)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al editar el presupuesto.");
    }

    return true;
  }

  // Elimina un presupuesto en Railway
  async deleteBudget(id) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/budgets/${id}`, {
      method: 'DELETE',
      headers: {
        'x-admin-pin': this.adminPin
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al eliminar el presupuesto.");
    }

    return true;
  }
}

// Exportar de forma global
window.AppStorage = new StorageAdapter();
