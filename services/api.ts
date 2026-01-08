
import { Driver, Vehicle, Trip, Checklist, ScheduledTrip, VehicleStatus, MaintenanceRecord, Fine, AppNotification } from '../types';

/**
 * BASE_URL configurada para o domínio de produção.
 */
const BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000/api' 
  : 'https://fleetflowpro.net.br/api'; 

const headers = {
  'Content-Type': 'application/json',
};

// Helper to handle local storage fallback
const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(`fleet_cache_${key}`);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(`fleet_cache_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }
};

async function handleResponse(response: Response, cacheKey?: string) {
  const contentType = response.headers.get("content-type");
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Usuário ou senha inválidos.");
    }

    let errorMessage = `Erro ${response.status}`;
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const errorData = await response.json();
      errorMessage += `: ${errorData.message || response.statusText}`;
    } else {
      errorMessage += `: Resposta inesperada do servidor.`;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) return null;
  
  const data = await response.json();
  if (cacheKey) {
    storage.set(cacheKey, data);
  }
  return data;
}

/**
 * Custom fetcher that tries the API first, then falls back to local storage on network errors.
 */
async function fetchWithFallback<T>(url: string, options: RequestInit, cacheKey: string, defaultValue: T): Promise<T> {
  try {
    const response = await fetch(url, options);
    return await handleResponse(response, cacheKey);
  } catch (error: any) {
    // If it's a network error (Failed to fetch), use cache
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      console.warn(`Network error for ${url}. Using local fallback.`);
      return storage.get(cacheKey, defaultValue);
    }
    throw error;
  }
}

export const apiService = {
  // --- AUTH ---
  async login(username: string, pass: string): Promise<Driver | null> {
    try {
      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, pass })
      });
      const user = await handleResponse(response);
      if (user) {
        return { ...user, password: pass };
      }
      return user;
    } catch (error: any) {
      // Fallback: Verificar primeiro se o admin atualizado existe no cache
      if (username === 'admin') {
        const cachedDrivers = storage.get<Driver[]>('drivers', []);
        const cachedAdmin = cachedDrivers.find(d => d.username === 'admin');
        
        if (cachedAdmin && cachedAdmin.password === pass) {
          return cachedAdmin;
        }

        // Se não houver admin no cache ou senha não bater, tenta o padrão hardcoded de emergência
        if (pass === 'admin' && !cachedAdmin) {
          return {
            id: 'admin-id',
            name: 'Administrador (Offline)',
            username: 'admin',
            password: 'admin',
            license: '000000',
            category: 'E',
            passwordChanged: false // Força troca no primeiro acesso offline
          };
        }
      }
      throw error;
    }
  },

  // --- DRIVERS ---
  async getDrivers(): Promise<Driver[]> {
    return fetchWithFallback(`${BASE_URL}/drivers`, { method: 'GET' }, 'drivers', []);
  },

  async saveDriver(driver: Driver): Promise<void> {
    const current = storage.get<Driver[]>('drivers', []);
    storage.set('drivers', [...current, driver]);
    return fetch(`${BASE_URL}/drivers`, { method: 'POST', headers, body: JSON.stringify(driver) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async updateDriver(id: string, updates: Partial<Driver>): Promise<void> {
    const current = storage.get<Driver[]>('drivers', []);
    let found = false;
    const next = current.map(d => {
      if (d.id === id) {
        found = true;
        return { ...d, ...updates };
      }
      return d;
    });

    // Se for o admin e não estiver na lista de motoristas comum, injeta ele no cache
    if (!found && updates.username === 'admin') {
      const mockAdmin: Driver = {
        id: id,
        name: 'Administrador (Offline)',
        username: 'admin',
        license: '000000',
        category: 'E',
        ...updates
      };
      storage.set('drivers', [...current, mockAdmin]);
    } else {
      storage.set('drivers', next);
    }
    
    return fetch(`${BASE_URL}/drivers/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async deleteDriver(id: string): Promise<void> {
    const current = storage.get<Driver[]>('drivers', []);
    storage.set('drivers', current.filter(d => d.id !== id));
    return fetch(`${BASE_URL}/drivers/${id}`, { method: 'DELETE', headers }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  // --- VEHICLES ---
  async getVehicles(): Promise<Vehicle[]> {
    return fetchWithFallback(`${BASE_URL}/vehicles`, { method: 'GET' }, 'vehicles', []);
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<void> {
    const current = storage.get<Vehicle[]>('vehicles', []);
    storage.set('vehicles', current.map(v => v.id === id ? { ...v, ...updates } : v));
    return fetch(`${BASE_URL}/vehicles/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async saveVehicle(vehicle: Vehicle): Promise<void> {
    const current = storage.get<Vehicle[]>('vehicles', []);
    storage.set('vehicles', [...current, vehicle]);
    return fetch(`${BASE_URL}/vehicles`, { method: 'POST', headers, body: JSON.stringify(vehicle) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  // --- TRIPS ---
  async getActiveTrips(): Promise<Trip[]> {
    return fetchWithFallback(`${BASE_URL}/trips/active`, { method: 'GET' }, 'trips_active', []);
  },

  async getScheduledTrips(): Promise<ScheduledTrip[]> {
    return fetchWithFallback(`${BASE_URL}/trips/scheduled`, { method: 'GET' }, 'trips_scheduled', []);
  },

  async getCompletedTrips(): Promise<Trip[]> {
    return fetchWithFallback(`${BASE_URL}/trips/completed`, { method: 'GET' }, 'trips_completed', []);
  },

  async startTrip(trip: Trip, checklist: Checklist): Promise<void> {
    const active = storage.get<Trip[]>('trips_active', []);
    storage.set('trips_active', [...active, trip]);
    return fetch(`${BASE_URL}/trips/start`, { method: 'POST', headers, body: JSON.stringify({ trip, checklist }) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async endTrip(tripId: string, endKm: number, endTime: string, expenses: any): Promise<void> {
    const active = storage.get<Trip[]>('trips_active', []);
    const completed = storage.get<Trip[]>('trips_completed', []);
    const trip = active.find(t => t.id === tripId);
    if (trip) {
      const finished = { ...trip, endTime, distance: endKm - trip.startKm, ...expenses };
      storage.set('trips_active', active.filter(t => t.id !== tripId));
      storage.set('trips_completed', [finished, ...completed]);
    }
    return fetch(`${BASE_URL}/trips/end`, { method: 'POST', headers, body: JSON.stringify({ tripId, endKm, endTime, expenses }) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async saveScheduledTrip(trip: ScheduledTrip): Promise<void> {
    const current = storage.get<ScheduledTrip[]>('trips_scheduled', []);
    storage.set('trips_scheduled', [trip, ...current]);
    return fetch(`${BASE_URL}/trips/schedule`, { method: 'POST', headers, body: JSON.stringify(trip) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async updateScheduledTrip(id: string, updates: Partial<ScheduledTrip>): Promise<void> {
    const current = storage.get<ScheduledTrip[]>('trips_scheduled', []);
    storage.set('trips_scheduled', current.map(s => s.id === id ? { ...s, ...updates } : s));
    return fetch(`${BASE_URL}/trips/schedule/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async deleteScheduledTrip(id: string): Promise<void> {
    const current = storage.get<ScheduledTrip[]>('trips_scheduled', []);
    storage.set('trips_scheduled', current.filter(s => s.id !== id));
    return fetch(`${BASE_URL}/trips/schedule/${id}`, { method: 'DELETE', headers }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  // --- MAINTENANCE ---
  async getMaintenance(): Promise<MaintenanceRecord[]> {
    return fetchWithFallback(`${BASE_URL}/maintenance`, { method: 'GET' }, 'maintenance', []);
  },

  async saveMaintenance(record: MaintenanceRecord): Promise<void> {
    const current = storage.get<MaintenanceRecord[]>('maintenance', []);
    storage.set('maintenance', [...current, record]);
    return fetch(`${BASE_URL}/maintenance`, { method: 'POST', headers, body: JSON.stringify(record) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async updateMaintenanceRecord(id: string, updates: Partial<MaintenanceRecord>): Promise<void> {
    const current = storage.get<MaintenanceRecord[]>('maintenance', []);
    storage.set('maintenance', current.map(r => r.id === id ? { ...r, ...updates } : r));
    return fetch(`${BASE_URL}/maintenance/${id}`, { method: 'PATCH', headers, body: JSON.stringify(updates) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async resolveMaintenance(vehicleId: string, recordId: string, km: number, date: string, cost?: number): Promise<void> {
    const current = storage.get<MaintenanceRecord[]>('maintenance', []);
    storage.set('maintenance', current.map(r => r.id === recordId ? { ...r, returnDate: date, cost: cost ?? r.cost } : r));
    return fetch(`${BASE_URL}/maintenance/resolve`, { method: 'POST', headers, body: JSON.stringify({ vehicleId, recordId, km, date, cost }) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  // --- FINES ---
  async getFines(): Promise<Fine[]> {
    return fetchWithFallback(`${BASE_URL}/fines`, { method: 'GET' }, 'fines', []);
  },

  async saveFine(fine: Fine): Promise<void> {
    const current = storage.get<Fine[]>('fines', []);
    storage.set('fines', [fine, ...current]);
    return fetch(`${BASE_URL}/fines`, { method: 'POST', headers, body: JSON.stringify(fine) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async deleteFine(id: string): Promise<void> {
    const current = storage.get<Fine[]>('fines', []);
    storage.set('fines', current.filter(f => f.id !== id));
    return fetch(`${BASE_URL}/fines/${id}`, { method: 'DELETE', headers }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  // --- NOTIFICATIONS ---
  async getNotifications(): Promise<AppNotification[]> {
    return fetchWithFallback(`${BASE_URL}/notifications`, { method: 'GET' }, 'notifications', []);
  },

  async saveNotification(notification: AppNotification): Promise<void> {
    const current = storage.get<AppNotification[]>('notifications', []);
    storage.set('notifications', [notification, ...current]);
    return fetch(`${BASE_URL}/notifications`, { method: 'POST', headers, body: JSON.stringify(notification) }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async markNotificationRead(id: string): Promise<void> {
    const current = storage.get<AppNotification[]>('notifications', []);
    storage.set('notifications', current.map(n => n.id === id ? { ...n, isRead: true } : n));
    return fetch(`${BASE_URL}/notifications/${id}/read`, { method: 'POST', headers }).then(r => handleResponse(r)).catch(e => console.warn('Sync failed, saved locally.'));
  },

  async getChecklists(): Promise<Checklist[]> {
    return fetchWithFallback(`${BASE_URL}/checklists`, { method: 'GET' }, 'checklists', []);
  }
};
