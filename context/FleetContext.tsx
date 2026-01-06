
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Vehicle, Driver, Trip, Checklist, VehicleStatus, MaintenanceRecord, AppNotification, Fine, ScheduledTrip } from '../types';
import { apiService } from '../services/api';

interface FleetContextType {
  vehicles: Vehicle[];
  drivers: Driver[];
  activeTrips: Trip[];
  completedTrips: Trip[];
  scheduledTrips: ScheduledTrip[];
  maintenanceRecords: MaintenanceRecord[];
  checklists: Checklist[];
  fines: Fine[];
  notifications: AppNotification[];
  isLoading: boolean;
  currentUser: Driver | null;
  addVehicle: (v: Vehicle) => Promise<void>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  addDriver: (d: Driver) => Promise<void>;
  updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;
  startTrip: (trip: Trip, checklist: Checklist) => Promise<void>;
  updateTrip: (tripId: string, updates: Partial<Trip>) => Promise<void>;
  addScheduledTrip: (trip: ScheduledTrip) => Promise<void>;
  updateScheduledTrip: (id: string, updates: Partial<ScheduledTrip>) => Promise<void>;
  deleteScheduledTrip: (id: string) => Promise<void>;
  endTrip: (tripId: string, currentKm: number, endTime: string, expenses?: any) => Promise<void>;
  cancelTrip: (tripId: string) => Promise<void>;
  addFine: (fine: Fine) => Promise<void>;
  deleteFine: (id: string) => Promise<void>;
  addMaintenanceRecord: (m: MaintenanceRecord) => Promise<void>;
  updateMaintenanceRecord: (id: string, updates: Partial<MaintenanceRecord>) => Promise<void>;
  resolveMaintenance: (vId: string, rId: string, km: number, date: string, cost?: number) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  changePassword: (newPass: string) => Promise<void>;
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  resetDatabase: () => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTrip[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Driver | null>(null);

  const init = async () => {
    setIsLoading(true);
    try {
      const [v, d, a, s, c, m, f, n, ch] = await Promise.all([
        apiService.getVehicles(),
        apiService.getDrivers(),
        apiService.getActiveTrips(),
        apiService.getScheduledTrips(),
        apiService.getCompletedTrips(),
        apiService.getMaintenance(),
        apiService.getFines(),
        apiService.getNotifications(),
        apiService.getChecklists()
      ]);
      
      setVehicles(v || []);
      setDrivers(d || []);
      setActiveTrips(a || []);
      setScheduledTrips(s || []);
      setCompletedTrips(c || []);
      setMaintenanceRecords(m || []);
      setFines(f || []);
      setNotifications(n || []);
      setChecklists(ch || []);

      const savedUser = sessionStorage.getItem('fleet_current_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch(e) {
          sessionStorage.removeItem('fleet_current_user');
        }
      }
    } catch (error) {
      console.error("Erro na carga inicial de dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const login = async (user: string, pass: string) => {
    setIsLoading(true);
    try {
      const driver = await apiService.login(user, pass);
      if (driver) {
        setCurrentUser(driver);
        sessionStorage.setItem('fleet_current_user', JSON.stringify(driver));
        setIsLoading(false);
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
    return false;
  };

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('fleet_current_user');
  }, []);

  const changePassword = async (newPass: string) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await apiService.updateDriver(currentUser.id, { password: newPass, passwordChanged: true });
      const updated = { ...currentUser, passwordChanged: true };
      setCurrentUser(updated);
      setDrivers(prev => prev.map(d => d.id === currentUser.id ? updated : d));
      sessionStorage.setItem('fleet_current_user', JSON.stringify(updated));
    } finally {
      setIsLoading(false);
    }
  };

  const addDriver = async (d: Driver) => {
    setIsLoading(true);
    try {
      await apiService.saveDriver(d);
      setDrivers(prev => [...prev, d]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDriver = async (id: string, updates: Partial<Driver>) => {
    setIsLoading(true);
    try {
      await apiService.updateDriver(id, updates);
      setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      if (currentUser?.id === id) {
        const updated = { ...currentUser, ...updates };
        setCurrentUser(updated);
        sessionStorage.setItem('fleet_current_user', JSON.stringify(updated));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDriver = async (id: string) => {
    setIsLoading(true);
    try {
      await apiService.deleteDriver(id);
      setDrivers(prev => prev.filter(d => d.id !== id));
    } finally {
      setIsLoading(false);
    }
  };

  const addVehicle = async (v: Vehicle) => {
    setIsLoading(true);
    try {
      await apiService.saveVehicle(v);
      setVehicles(prev => [...prev, v]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    setIsLoading(true);
    try {
      await apiService.updateVehicle(id, updates);
      setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    } finally {
      setIsLoading(false);
    }
  };

  const startTrip = async (trip: Trip, checklist: Checklist) => {
    setIsLoading(true);
    try {
      await apiService.startTrip(trip, checklist);
      setActiveTrips(prev => [...prev, trip]);
      setChecklists(prev => [...prev, checklist]);
      setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.IN_USE, lastChecklist: checklist } : v));
    } finally {
      setIsLoading(false);
    }
  };

  const endTrip = async (tripId: string, currentKm: number, endTime: string, expenses: any) => {
    setIsLoading(true);
    try {
      await apiService.endTrip(tripId, currentKm, endTime, expenses);
      const trip = activeTrips.find(t => t.id === tripId);
      if (trip) {
        const finishedTrip: Trip = { 
          ...trip, 
          endTime, 
          distance: currentKm - trip.startKm,
          fuelExpense: expenses?.fuel || 0,
          otherExpense: expenses?.other || 0,
          expenseNotes: expenses?.notes || ''
        };
        setCompletedTrips(prev => [finishedTrip, ...prev]);
        setActiveTrips(prev => prev.filter(t => t.id !== tripId));
        setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE, currentKm } : v));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const addScheduledTrip = async (t: ScheduledTrip) => {
    setIsLoading(true);
    try {
      await apiService.saveScheduledTrip(t);
      setScheduledTrips(prev => [t, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateScheduledTrip = async (id: string, updates: Partial<ScheduledTrip>) => {
    setIsLoading(true);
    try {
      await apiService.updateScheduledTrip(id, updates);
      setScheduledTrips(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteScheduledTrip = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      await apiService.deleteScheduledTrip(id);
      setScheduledTrips(prev => prev.filter(s => s.id !== id));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelTrip = async (id: string) => {
    setIsLoading(true);
    try {
      const trip = activeTrips.find(t => t.id === id);
      if (trip) {
        await apiService.updateVehicle(trip.vehicleId, { status: VehicleStatus.AVAILABLE });
        setActiveTrips(prev => prev.filter(t => t.id !== id));
        setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE } : v));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateTrip = async (id: string, updates: Partial<Trip>) => {
    // Para simplificar, assumindo atualização local e depois sincronização se necessário
    setActiveTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addFine = async (f: Fine) => {
    await apiService.saveFine(f);
    setFines(prev => [f, ...prev]);
    
    const vehicle = vehicles.find(v => v.id === f.vehicleId);
    const notification: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'new_fine',
      title: 'Nova Multa Atribuída',
      message: `Data: ${new Date(f.date).toLocaleDateString()}. Valor: R$ ${f.value.toFixed(2)}. Veículo: ${vehicle?.plate}. Descrição: ${f.description}`,
      vehicleId: f.vehicleId,
      driverId: f.driverId,
      timestamp: new Date().toISOString(),
      isRead: false
    };
    await apiService.saveNotification(notification);
    setNotifications(prev => [notification, ...prev]);
  };

  const deleteFine = async (id: string) => {
    await apiService.deleteFine(id);
    setFines(prev => prev.filter(f => f.id !== id));
  };

  const addMaintenanceRecord = async (m: MaintenanceRecord) => {
    await apiService.saveMaintenance(m);
    setMaintenanceRecords(prev => [...prev, m]);
    setVehicles(prev => prev.map(v => v.id === m.vehicleId ? { ...v, status: VehicleStatus.MAINTENANCE } : v));
  };

  const updateMaintenanceRecord = async (id: string, updates: Partial<MaintenanceRecord>) => {
    setIsLoading(true);
    try {
      await apiService.updateMaintenanceRecord(id, updates);
      setMaintenanceRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    } finally {
      setIsLoading(false);
    }
  };

  const resolveMaintenance = async (vId: string, rId: string, km: number, date: string, cost?: number) => {
    setIsLoading(true);
    try {
      await apiService.resolveMaintenance(vId, rId, km, date, cost);
      setMaintenanceRecords(prev => prev.map(r => r.id === rId ? { ...r, returnDate: date, cost: cost ?? r.cost } : r));
      setVehicles(prev => prev.map(v => v.id === vId ? { ...v, status: VehicleStatus.AVAILABLE, currentKm: km } : v));
    } finally {
      setIsLoading(false);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    await apiService.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const resetDatabase = useCallback(() => {
    alert("Para resetar o banco de dados em produção, utilize o painel de controle do seu servidor MySQL.");
  }, []);

  const contextValue = useMemo(() => ({
    vehicles, drivers, activeTrips, completedTrips, scheduledTrips, maintenanceRecords, checklists, fines, notifications, isLoading,
    currentUser, addVehicle, updateVehicle, addDriver, updateDriver, deleteDriver, startTrip, updateTrip, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, endTrip, cancelTrip,
    addFine, deleteFine, addMaintenanceRecord, updateMaintenanceRecord, resolveMaintenance, markNotificationAsRead, changePassword,
    login, logout, resetDatabase
  }), [
    vehicles, drivers, activeTrips, completedTrips, scheduledTrips, maintenanceRecords, checklists, fines, notifications, isLoading,
    currentUser, deleteScheduledTrip, logout, resetDatabase
  ]);

  return (
    <FleetContext.Provider value={contextValue}>
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (!context) throw new Error('useFleet must be used within a FleetProvider');
  return context;
};
