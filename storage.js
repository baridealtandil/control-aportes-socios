// storage.js
// Adaptador de comunicación con el Backend de Railway para el Control de Aportes, Presupuestos y Categorías

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

  // ================= CATEGORÍAS (CATEGORIES) =================

  // Obtiene todas las categorías desde Railway
  async getCategories() {
    try {
      const response = await fetch(`${API_BASE}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        return data.categories || [];
      }
      throw new Error(`Error en servidor: ${response.statusText}`);
    } catch (e) {
      console.error("Fallo al obtener categorías:", e);
      throw new Error("No se pudieron cargar las categorías desde el servidor.");
    }
  }

  // Crea una nueva categoría
  async addCategory(name) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify({ name: name.trim() })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al crear la categoría.");
    }

    return await response.json();
  }

  // Elimina una categoría
  async deleteCategory(id) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/categories/${id}`, {
      method: 'DELETE',
      headers: {
        'x-admin-pin': this.adminPin
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al eliminar la categoría.");
    }

    return true;
  }

  // ================= CONFIGURACIÓN / META GLOBAL =================

  // Obtiene la meta global del proyecto
  async getTargetBudget() {
    try {
      const response = await fetch(`${API_BASE}/api/config/target-budget`);
      if (response.ok) {
        const data = await response.json();
        return data.targetBudget || 300000000;
      }
      return 300000000;
    } catch (e) {
      console.error("Fallo al obtener la meta global:", e);
      return 300000000;
    }
  }

  // Modifica la meta global del proyecto en Railway
  async updateTargetBudget(value) {
    if (!this.isAdmin()) throw new Error("No autorizado.");

    const response = await fetch(`${API_BASE}/api/config/target-budget`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': this.adminPin
      },
      body: JSON.stringify({ targetBudget: parseFloat(value) })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Error al actualizar la meta global.");
    }

    return true;
  }
  // ================= TAREAS Y AVANCE FÍSICO DEL PROYECTO =================

  getProjectTasks() {
    try {
      const stored = localStorage.getItem("paca_project_tasks_v1");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Error al leer tareas del proyecto de localStorage:", e);
    }
    
    // Tareas maestras iniciales por omisión
    const defaultTasks = [
      // FASE 1: OBRA CIVIL Y ESTRUCTURAS
      { id: 'task-1', phase: 'Fase 1: Obra Civil y Estructuras', name: 'Planos, proyecto trifásico, estudio acústico y habilitaciones', progress: 0 },
      { id: 'task-2', phase: 'Fase 1: Obra Civil y Estructuras', name: 'Reparación de techo de chapa + colocación de membrana impermeabilizante', progress: 0 },
      { id: 'task-3', phase: 'Fase 1: Obra Civil y Estructuras', name: 'Restauración de fachada y reforma de ventanal para salida de emergenciavidriada con marco y antipánico', progress: 0 },
      { id: 'task-4', phase: 'Fase 1: Obra Civil y Estructuras', name: 'Instalación eléctrica trifásica nueva completa desde cero (tableros, llaves y potencia)', progress: 0 },
      { id: 'task-5', phase: 'Fase 1: Obra Civil y Estructuras', name: 'Plomería, cloacas y construcción 100% de cero de batería de baños (Damas, Caballeros, PMR)', progress: 0 },
      { id: 'task-6', phase: 'Fase 1: Obra Civil y Estructuras', name: 'Albañilería de cocina industrial (azulejos, trampa de grasa, tiraje a 4 vientos) y Barra en L (6x5m)', progress: 0 },

      // FASE 2: INSONORIZACIÓN, PISOS Y CLIMATIZACIÓN
      { id: 'task-7', phase: 'Fase 2: Insonorización, Pisos y Climatización', name: 'Aislamiento acústico y fonoabsorción (cielorraso suspendido y lana de roca para recitales/bailable)', progress: 0 },
      { id: 'task-8', phase: 'Fase 2: Insonorización, Pisos y Climatización', name: 'Retiro de piso flotante viejo, carpeta y colocación de piso nuevo (Microcemento/Hormigón pulido/Epoxi)', progress: 0 },
      { id: 'task-9', phase: 'Fase 2: Insonorización, Pisos y Climatización', name: 'Montaje e instalación de 2 equipos comerciales de Aire Acondicionado Frío/Calor de gran tonelaje', progress: 0 },

      // FASE 3: EQUIPAMIENTO DE FRÍO Y COCINA INDUSTRIAL
      { id: 'task-10', phase: 'Fase 3: Equipamiento de Frío y Cocina', name: 'Montaje de cámara de frío para barriles + línea de 6 a 9 choperas + heladeras bajobarra y freezers', progress: 0 },
      { id: 'task-11', phase: 'Fase 3: Equipamiento de Frío y Cocina', name: 'Instalación de equipamiento de cocina (freidoras 20L, plancha, horno convector, anafes, mesadas inox)', progress: 0 },

      // FASE 4: TECNOLOGÍA, AUDIO, LUCES Y RED POS
      { id: 'task-12', phase: 'Fase 4: Tecnología, Audio, Luces y POS', name: 'Instalación de sonido pesado (potencias, bafles, consola), luces robóticas DMX y cámaras de seguridad', progress: 0 },
      { id: 'task-13', phase: 'Fase 4: Tecnología, Audio, Luces y POS', name: 'Red de datos, 2 computadoras de caja POS, 4 comanderas e instalación de 4-5 Smart TVs + Pantalla proyector', progress: 0 },

      // FASE 5: MOBILIARIO, CRISTALERÍA, AMBIENTACIÓN Y APERTURA
      { id: 'task-14', phase: 'Fase 5: Mobiliario, Ambientación y Apertura', name: 'Colocación de mesas de 2 y 4 personas, sillones/mesas living para VIP y banquetas altas de barra', progress: 0 },
      { id: 'task-15', phase: 'Fase 5: Mobiliario, Ambientación y Apertura', name: 'Carteles Neón LED (fachada e interiores), vegetación temática, bazar (500 pintas, 400 vasos) y matafuegos', progress: 0 },
      { id: 'task-16', phase: 'Fase 5: Mobiliario, Ambientación y Apertura', name: 'Uniformes del personal, branding, campaña de marketing de apertura y stock inicial de bebidas y barriles', progress: 0 }
    ];

    localStorage.setItem("paca_project_tasks_v1", JSON.stringify(defaultTasks));
    return defaultTasks;
  }

  saveProjectTasks(tasks) {
    localStorage.setItem("paca_project_tasks_v1", JSON.stringify(tasks));
  }

  addProjectTask(taskData) {
    if (!this.isAdmin()) throw new Error("No autorizado.");
    const tasks = this.getProjectTasks();
    const newTask = {
      id: `task-${Date.now()}`,
      phase: taskData.phase,
      name: taskData.name.trim(),
      progress: parseInt(taskData.progress || 0, 10)
    };
    tasks.push(newTask);
    this.saveProjectTasks(tasks);
    return newTask;
  }

  updateProjectTaskProgress(id, progress) {
    if (!this.isAdmin()) throw new Error("No autorizado.");
    const tasks = this.getProjectTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.progress = Math.min(Math.max(parseInt(progress, 10), 0), 100);
      this.saveProjectTasks(tasks);
    }
  }

  deleteProjectTask(id) {
    if (!this.isAdmin()) throw new Error("No autorizado.");
    let tasks = this.getProjectTasks();
    tasks = tasks.filter(t => t.id !== id);
    this.saveProjectTasks(tasks);
  }
}

// Exportar de forma global
window.AppStorage = new StorageAdapter();
