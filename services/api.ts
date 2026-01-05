
import { Driver, Vehicle, Trip, Checklist, ScheduledTrip, VehicleStatus, MaintenanceRecord, Fine, AppNotification } from '../types';

/**
 * IMPORTANTE: Para sincronizar entre dispositivos, você deve hospedar uma API
 * no seu servidor (Hostinger). Altere a BASE_URL para o seu domínio.
 */
const BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000/api' 
  : '/api'; 

const headers = {
  'Content-Type': 'application/json',
};

async function handleResponse(response: Response) {
  if (!response.ok) {
    let errorMessage = `Erro ${response.status}: `;
    try {
      const errorData = await response.json();
      errorMessage += errorData.message || response.statusText;
    } catch (e) {
      errorMessage += "Não foi possível conectar ao banco de dados. Verifique o backend.";
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export const apiService = {
  // --- AUTH ---
  async login(username: string, pass: string): Promise<Driver | null> {
    try {
      return await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username, pass })
      }).then(handleResponse);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  // --- DRIVERS ---
  async getDrivers(): Promise<Driver[]> {
    return fetch(`${BASE_URL}/drivers`).then(handleResponse).catch(() => []);
  },

  async saveDriver(driver: Driver): Promise<void> {
    return fetch(`${BASE_URL}/drivers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(driver)
    }).then(handleResponse);
  },

  async deleteDriver(id: string): Promise<void> {
    return fetch(`${BASE_URL}/drivers/${id}`, {
      method: 'DELETE',
      headers
    }).then(handleResponse);
  },

  // --- VEHICLES ---
  async getVehicles(): Promise<Vehicle[]> {
    return fetch(`${BASE_URL}/vehicles`).then(handleResponse).catch(() => []);
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<void> {
    return fetch(`${BASE_URL}/vehicles/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates)
    }).then(handleResponse);
  },

  async saveVehicle(vehicle: Vehicle): Promise<void> {
    return fetch(`${BASE_URL}/vehicles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(vehicle)
    }).then(handleResponse);
  },

  // --- TRIPS ---
  async getActiveTrips(): Promise<Trip[]> {
    return fetch(`${BASE_URL}/trips/active`).then(handleResponse).catch(() => []);
  },

  async getScheduledTrips(): Promise<ScheduledTrip[]> {
    return fetch(`${BASE_URL}/trips/scheduled`).then(handleResponse).catch(() => []);
  },

  async getCompletedTrips(): Promise<Trip[]> {
    return fetch(`${BASE_URL}/trips/completed`).then(handleResponse).catch(() => []);
  },

  async startTrip(trip: Trip, checklist: Checklist): Promise<void> {
    return fetch(`${BASE_URL}/trips/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ trip, checklist })
    }).then(handleResponse);
  },

  async endTrip(tripId: string, endKm: number, endTime: string, expenses: any): Promise<void> {
    return fetch(`${BASE_URL}/trips/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tripId, endKm, endTime, expenses })
    }).then(handleResponse);
  },

  async saveScheduledTrip(trip: ScheduledTrip): Promise<void> {
    return fetch(`${BASE_URL}/trips/schedule`, {
      method: 'POST',
      headers,
      body: JSON.stringify(trip)
    }).then(handleResponse);
  },

  async updateScheduledTrip(id: string, updates: Partial<ScheduledTrip>): Promise<void> {
    return fetch(`${BASE_URL}/trips/schedule/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates)
    }).then(handleResponse);
  },

  async deleteScheduledTrip(id: string): Promise<void> {
    return fetch(`${BASE_URL}/trips/schedule/${id}`, {
      method: 'DELETE',
      headers
    }).then(handleResponse);
  },

  // --- MAINTENANCE & FINES ---
  async getMaintenance(): Promise<MaintenanceRecord[]> {
    return fetch(`${BASE_URL}/maintenance`).then(handleResponse).catch(() => []);
  },

  async saveMaintenance(record: MaintenanceRecord): Promise<void> {
    return fetch(`${BASE_URL}/maintenance`, {
      method: 'POST',
      headers,
      body: JSON.stringify(record)
    }).then(handleResponse);
  },

  async updateMaintenanceRecord(id: string, updates: Partial<MaintenanceRecord>): Promise<void> {
    return fetch(`${BASE_URL}/maintenance/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates)
    }).then(handleResponse);
  },

  async resolveMaintenance(vehicleId: string, recordId: string, km: number, date: string, cost?: number): Promise<void> {
    return fetch(`${BASE_URL}/maintenance/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ vehicleId, recordId, km, date, cost })
    }).then(handleResponse);
  },

  async getFines(): Promise<Fine[]> {
    return fetch(`${BASE_URL}/fines`).then(handleResponse).catch(() => []);
  },

  async saveFine(fine: Fine): Promise<void> {
    return fetch(`${BASE_URL}/fines`, {
      method: 'POST',
      headers,
      body: JSON.stringify(fine)
    }).then(handleResponse);
  },

  async deleteFine(id: string): Promise<void> {
    return fetch(`${BASE_URL}/fines/${id}`, {
      method: 'DELETE',
      headers
    }).then(handleResponse);
  },

  async getNotifications(): Promise<AppNotification[]> {
    return fetch(`${BASE_URL}/notifications`).then(handleResponse).catch(() => []);
  },

  async saveNotification(notification: AppNotification): Promise<void> {
    return fetch(`${BASE_URL}/notifications`, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification)
    }).then(handleResponse);
  },

  async markNotificationRead(id: string): Promise<void> {
    return fetch(`${BASE_URL}/notifications/${id}/read`, {
      method: 'POST',
      headers
    }).then(handleResponse);
  },

  async getChecklists(): Promise<Checklist[]> {
    return fetch(`${BASE_URL}/checklists`).then(handleResponse).catch(() => []);
  }
};
