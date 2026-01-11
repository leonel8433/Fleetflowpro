
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Vehicle, Driver, Trip, Checklist, VehicleStatus, MaintenanceRecord, AppNotification, Fine, ScheduledTrip, AuditLog, TireChange } from '../types';
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
  tireChanges: TireChange[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
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
  endTrip: (tripId: string, currentKm: number, endTime: string, fuelLevel: number, expenses?: any) => Promise<void>;
  cancelTrip: (tripId: string, reason: string) => Promise<void>;
  addFine: (fine: Fine) => Promise<void>;
  deleteFine: (id: string) => Promise<void>;
  addTireChange: (tc: TireChange) => Promise<void>;
  deleteTireChange: (id: string) => Promise<void>;
  addMaintenanceRecord: (m: MaintenanceRecord) => Promise<void>;
  updateMaintenanceRecord: (id: string, updates: Partial<MaintenanceRecord>) => Promise<void>;
  resolveMaintenance: (vId: string, rId: string, km: number, date: string, cost?: number, returnNotes?: string) => Promise<void>;
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
  const [tireChanges, setTireChanges] = useState<TireChange[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Driver | null>(null);

  const init = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        apiService.getDrivers(),
        apiService.getVehicles(),
        apiService.getActiveTrips(),
        apiService.getScheduledTrips(),
        apiService.getCompletedTrips(),
        apiService.getMaintenance(),
        apiService.getFines(),
        apiService.getNotifications(),
        apiService.getChecklists(),
        apiService.getTireChanges(),
        Promise.resolve(JSON.parse(localStorage.getItem('fleet_audit_logs') || '[]'))
      ]);
      
      function getValue<T>(index: number, defaultValue: T): T {
        const res = results[index];
        return res && res.status === 'fulfilled' ? (res as PromiseFulfilledResult<T>).value : defaultValue;
      }

      setDrivers(getValue(0, []));
      setVehicles(getValue(1, []));
      setActiveTrips(getValue(2, []));
      setScheduledTrips(getValue(3, []));
      setCompletedTrips(getValue(4, []));
      setMaintenanceRecords(getValue(5, []));
      setFines(getValue(6, []));
      setNotifications(getValue(7, []));
      setChecklists(getValue(8, []));
      setTireChanges(getValue(9, []));
      setAuditLogs(getValue(10, []));

      const savedUser = sessionStorage.getItem('fleet_current_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch (error) {
          sessionStorage.removeItem('fleet_current_user');
        }
      }
    } catch (error) {
      console.error("Initialization error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  // Monitoramento Proativo de Pneus
  useEffect(() => {
    if (isLoading || vehicles.length === 0 || tireChanges.length === 0) return;

    const threshold = 2000;
    const newNotifications: AppNotification[] = [];

    tireChanges.forEach(tc => {
      if (!tc.nextChangeKm) return;
      
      const vehicle = vehicles.find(v => v.id === tc.vehicleId);
      if (vehicle) {
        const remaining = tc.nextChangeKm - vehicle.currentKm;
        const isCritical = remaining <= 0;
        const isWarning = remaining <= threshold;

        if (isWarning) {
          const type = isCritical ? 'critical' : 'warning';
          const notificationId = `tire-alert-${tc.id}-${type}`;
          const alreadyNotified = notifications.some(n => n.id === notificationId);

          if (!alreadyNotified) {
            newNotifications.push({
              id: notificationId,
              type: 'tire_alert',
              title: isCritical ? '⚠️ TROCA DE PNEU CRÍTICA' : '🛠️ MANUTENÇÃO PREVENTIVA: PNEU',
              message: `O pneu (${tc.position}) do veículo ${vehicle.plate} está ${isCritical ? 'VENCIDO' : `próximo ao limite. Restam ${remaining}km para a troca prevista.`}`,
              vehicleId: vehicle.id,
              timestamp: new Date().toISOString(),
              isRead: false
            });
          }
        }
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev]);
    }
  }, [vehicles, tireChanges, isLoading, notifications]);

  // Monitoramento de Combustível
  useEffect(() => {
    if (isLoading || vehicles.length === 0) return;
    const newNotifications: AppNotification[] = [];
    vehicles.forEach(vehicle => {
      if (vehicle.fuelLevel < 10) {
        const notificationId = `low-fuel-${vehicle.id}`;
        const alreadyNotified = notifications.some(n => n.id === notificationId);
        if (!alreadyNotified) {
          newNotifications.push({
            id: notificationId,
            type: 'low_fuel',
            title: '⛽ COMBUSTÍVEL CRÍTICO',
            message: `Veículo ${vehicle.plate} com nível de combustível em ${vehicle.fuelLevel}%.`,
            vehicleId: vehicle.id,
            timestamp: new Date().toISOString(),
            isRead: false
          });
        }
      }
    });
    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev]);
    }
  }, [vehicles, isLoading, notifications]);

  useEffect(() => {
    localStorage.setItem('fleet_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const login = async (user: string, pass: string) => {
    setIsLoading(true);
    const normalizedUser = user.toLowerCase().trim();
    try {
      const driver = await apiService.login(normalizedUser, pass);
      if (driver) {
        setCurrentUser(driver);
        sessionStorage.setItem('fleet_current_user', JSON.stringify(driver));
        setIsLoading(false);
        return true;
      }
    } catch (e) {
      console.warn("API Login failed, trying local fallback:", e);
    }
    const localDriver = drivers.find(d => d.username.toLowerCase() === normalizedUser);
    if (localDriver && localDriver.password === pass) {
      setCurrentUser(localDriver);
      sessionStorage.setItem('fleet_current_user', JSON.stringify(localDriver));
      setIsLoading(false);
      return true;
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
      const updates = { password: newPass, passwordChanged: true, username: currentUser.username };
      await apiService.updateDriver(currentUser.id, updates);
      const updated = { ...currentUser, ...updates };
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

  const addTireChange = async (tc: TireChange) => {
    setIsLoading(true);
    try {
      await apiService.saveTireChange(tc);
      setTireChanges(prev => [tc, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTireChange = async (id: string) => {
    setIsLoading(true);
    try {
      await apiService.deleteTireChange(id);
      setTireChanges(prev => prev.filter(t => t.id !== id));
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
      setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.IN_USE, lastChecklist: checklist, fuelLevel: checklist.fuelLevel } : v));
    } finally {
      setIsLoading(false);
    }
  };

  const endTrip = async (tripId: string, currentKm: number, endTime: string, fuelLevel: number, expenses: any) => {
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
        setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE, currentKm, fuelLevel } : v));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cancelTrip = async (id: string, reason: string) => {
    if (!reason.trim()) throw new Error("Motivo obrigatório.");
    setIsLoading(true);
    try {
      const trip = activeTrips.find(t => t.id === id);
      if (trip) {
        const cancelledTrip: Trip = {
          ...trip,
          isCancelled: true,
          cancellationReason: reason,
          cancelledBy: currentUser?.name || 'Sistema',
          endTime: new Date().toISOString()
        };
        const log: AuditLog = {
          id: Math.random().toString(36).substr(2, 9),
          entityId: id,
          userId: currentUser?.id || 'sys',
          userName: currentUser?.name || 'Sistema',
          action: 'CANCELLED',
          description: `Viagem cancelada: ${reason}`,
          timestamp: new Date().toISOString()
        };
        setCompletedTrips(prev => [cancelledTrip, ...prev]);
        setAuditLogs(prev => [log, ...prev]);
        setActiveTrips(prev => prev.filter(t => t.id !== id));
        setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE } : v));
        await apiService.updateDriver(currentUser?.id || '', { activeVehicleId: undefined });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateTrip = async (id: string, updates: Partial<Trip>) => {
    setActiveTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
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

  const addFine = async (f: Fine) => {
    await apiService.saveFine(f);
    setFines(prev => [f, ...prev]);
    const vehicle = vehicles.find(v => v.id === f.vehicleId);
    const notification: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'new_fine',
      title: 'Nova Multa Atribuída',
      message: `Veículo: ${vehicle?.plate}. Descrição: ${f.description}`,
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

  const resolveMaintenance = async (vId: string, rId: string, km: number, date: string, cost?: number, returnNotes?: string) => {
    setIsLoading(true);
    try {
      await apiService.resolveMaintenance(vId, rId, km, date, cost, returnNotes);
      setMaintenanceRecords(prev => prev.map(r => r.id === rId ? { ...r, returnDate: date, cost: cost ?? r.cost, returnNotes } : r));
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
    if (window.confirm("Isso apagará apenas seu cache local de dados. Deseja continuar?")) {
      Object.keys(localStorage).forEach(key => { if (key.startsWith('fleet_cache_')) localStorage.removeItem(key); });
      localStorage.removeItem('fleet_audit_logs');
      window.location.reload();
    }
  }, []);

  const contextValue = useMemo(() => ({
    vehicles, drivers, activeTrips, completedTrips, scheduledTrips, maintenanceRecords, checklists, fines, tireChanges, notifications, auditLogs, isLoading,
    currentUser, addVehicle, updateVehicle, addDriver, updateDriver, deleteDriver, startTrip, updateTrip, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, endTrip, cancelTrip,
    addFine, deleteFine, addTireChange, deleteTireChange, addMaintenanceRecord, updateMaintenanceRecord, resolveMaintenance, markNotificationAsRead, changePassword,
    login, logout, resetDatabase
  }), [
    vehicles, drivers, activeTrips, completedTrips, scheduledTrips, maintenanceRecords, checklists, fines, tireChanges, notifications, auditLogs, isLoading,
    currentUser, addVehicle, updateVehicle, addDriver, updateDriver, deleteDriver, startTrip, updateTrip, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, endTrip, cancelTrip,
    addFine, deleteFine, addTireChange, deleteTireChange, addMaintenanceRecord, updateMaintenanceRecord, resolveMaintenance, markNotificationAsRead, changePassword,
    login, logout, resetDatabase
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
