
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Vehicle, Driver, Trip, Checklist, VehicleStatus, MaintenanceRecord, AppNotification, Fine, Occurrence, ScheduledTrip } from '../types';

interface FleetContextType {
  vehicles: Vehicle[];
  drivers: Driver[];
  activeTrips: Trip[];
  completedTrips: Trip[];
  scheduledTrips: ScheduledTrip[];
  checklists: Checklist[];
  maintenanceRecords: MaintenanceRecord[];
  notifications: AppNotification[];
  fines: Fine[];
  occurrences: Occurrence[];
  addVehicle: (v: Vehicle) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  addDriver: (d: Driver) => void;
  updateDriver: (id: string, updates: Partial<Driver>) => void;
  deleteDriver: (id: string) => void;
  startTrip: (trip: Trip, checklist: Checklist) => void;
  updateTrip: (tripId: string, updates: Partial<Trip>) => void;
  addScheduledTrip: (trip: ScheduledTrip) => void;
  updateScheduledTrip: (id: string, updates: Partial<ScheduledTrip>) => void;
  deleteScheduledTrip: (id: string) => void;
  endTrip: (tripId: string, currentKm: number, endTime: string, expenses?: { fuel: number, other: number, notes: string }) => void;
  cancelTrip: (tripId: string) => void;
  addMaintenanceRecord: (record: MaintenanceRecord) => void;
  resolveMaintenance: (vehicleId: string, recordId: string | null | undefined, currentKm: number, returnDate: string, finalCost?: number) => void;
  addFine: (fine: Fine) => void;
  deleteFine: (id: string) => void;
  addOccurrence: (occ: Occurrence) => void;
  markNotificationAsRead: (id: string) => void;
  currentUser: Driver | null;
  login: (username: string, pass: string) => boolean;
  logout: () => void;
  changePassword: (newPass: string) => void;
  resetDatabase: () => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('fleet_vehicles');
    return saved ? JSON.parse(saved) : [
      { id: '1', plate: 'ABC-1234', model: 'Sprinter', brand: 'Mercedes', year: 2022, currentKm: 45000, fuelLevel: 75, fuelType: 'Diesel', status: VehicleStatus.AVAILABLE },
      { id: '2', plate: 'XYZ-5678', model: 'Hilux', brand: 'Toyota', year: 2023, currentKm: 12000, fuelLevel: 100, fuelType: 'Diesel', status: VehicleStatus.AVAILABLE },
      { id: '3', plate: 'DEF-9012', model: 'Daily', brand: 'Iveco', year: 2021, currentKm: 89000, fuelLevel: 40, fuelType: 'Diesel', status: VehicleStatus.MAINTENANCE },
    ];
  });

  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem('fleet_drivers');
    return saved ? JSON.parse(saved) : [
      { id: 'd1', name: 'João Silva', license: '12345678', username: 'joao', password: '123', passwordChanged: false },
      { id: 'd2', name: 'Maria Santos', license: '87654321', username: 'maria', password: '123', passwordChanged: false },
      { id: 'admin', name: 'Gestor de Frota', license: '0000', username: 'admin', password: 'admin', passwordChanged: true },
    ];
  });

  const [activeTrips, setActiveTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('fleet_active_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTrip[]>(() => {
    const saved = localStorage.getItem('fleet_scheduled_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [completedTrips, setCompletedTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('fleet_completed_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [checklists, setChecklists] = useState<Checklist[]>(() => {
    const saved = localStorage.getItem('fleet_checklists');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() => {
    const saved = localStorage.getItem('fleet_maintenance');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'm-initial-3', vehicleId: '3', date: '2023-12-01', serviceType: 'Revisão de Motor', cost: 1200, km: 88900, notes: 'Veículo enviado para oficina para revisão periódica.' }
    ];
  });

  const [fines, setFines] = useState<Fine[]>(() => {
    const saved = localStorage.getItem('fleet_fines');
    return saved ? JSON.parse(saved) : [];
  });

  const [occurrences, setOccurrences] = useState<Occurrence[]>(() => {
    const saved = localStorage.getItem('fleet_occurrences');
    return saved ? JSON.parse(saved) : [];
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<Driver | null>(() => {
    const saved = sessionStorage.getItem('fleet_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => { localStorage.setItem('fleet_vehicles', JSON.stringify(vehicles)); }, [vehicles]);
  useEffect(() => { localStorage.setItem('fleet_active_trips', JSON.stringify(activeTrips)); }, [activeTrips]);
  useEffect(() => { localStorage.setItem('fleet_completed_trips', JSON.stringify(completedTrips)); }, [completedTrips]);
  useEffect(() => { localStorage.setItem('fleet_drivers', JSON.stringify(drivers)); }, [drivers]);
  useEffect(() => { localStorage.setItem('fleet_checklists', JSON.stringify(checklists)); }, [checklists]);
  useEffect(() => { localStorage.setItem('fleet_maintenance', JSON.stringify(maintenanceRecords)); }, [maintenanceRecords]);
  useEffect(() => { localStorage.setItem('fleet_fines', JSON.stringify(fines)); }, [fines]);
  useEffect(() => { localStorage.setItem('fleet_occurrences', JSON.stringify(occurrences)); }, [occurrences]);
  useEffect(() => { localStorage.setItem('fleet_scheduled_trips', JSON.stringify(scheduledTrips)); }, [scheduledTrips]);

  const login = (user: string, pass: string) => {
    const driver = drivers.find(d => d.username === user && d.password === pass);
    if (driver) {
      setCurrentUser(driver);
      sessionStorage.setItem('fleet_current_user', JSON.stringify(driver));
      return true;
    }
    return false;
  };

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('fleet_current_user');
  }, []);

  const changePassword = (newPass: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, password: newPass, passwordChanged: true };
    setCurrentUser(updatedUser);
    sessionStorage.setItem('fleet_current_user', JSON.stringify(updatedUser));
    setDrivers(prev => prev.map(d => d.id === currentUser.id ? updatedUser : d));
  };

  const resetDatabase = () => {
    const keys = [
      'fleet_vehicles', 'fleet_active_trips', 'fleet_completed_trips',
      'fleet_drivers', 'fleet_checklists', 'fleet_maintenance',
      'fleet_fines', 'fleet_occurrences', 'fleet_scheduled_trips'
    ];
    keys.forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('fleet_current_user');
    window.location.reload();
  };

  const addVehicle = (v: Vehicle) => setVehicles(prev => [...prev, v]);
  const updateVehicle = (id: string, updates: Partial<Vehicle>) => setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  const startTrip = (trip: Trip, checklist: Checklist) => {
    setActiveTrips(prev => [...prev, trip]);
    setChecklists(prev => [...prev, checklist]);
    setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.IN_USE, currentKm: checklist.km, fuelLevel: checklist.fuelLevel, lastChecklist: checklist } : v));
    setDrivers(prev => prev.map(d => d.id === trip.driverId ? { ...d, activeVehicleId: trip.vehicleId } : d));
  };
  const endTrip = (tripId: string, currentKm: number, endTime: string, expenses?: { fuel: number, other: number, notes: string }) => {
    const trip = activeTrips.find(t => t.id === tripId);
    if (!trip) return;
    const distance = currentKm - trip.startKm;
    const finishedTrip: Trip = { ...trip, endTime, distance, fuelExpense: expenses?.fuel || 0, otherExpense: expenses?.other || 0, expenseNotes: expenses?.notes || '' }; 
    setActiveTrips(prev => prev.filter(t => t.id !== tripId));
    setCompletedTrips(prev => [finishedTrip, ...prev]);
    setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE, currentKm } : v));
    setDrivers(prev => prev.map(d => d.id === trip.driverId ? { ...d, activeVehicleId: undefined } : d));
  };
  const cancelTrip = (tripId: string) => {
    const trip = activeTrips.find(t => t.id === tripId);
    if (!trip) return;
    setActiveTrips(prev => prev.filter(t => t.id !== tripId));
    setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE } : v));
    setDrivers(prev => prev.map(d => d.id === trip.driverId ? { ...d, activeVehicleId: undefined } : d));
  };
  const addMaintenanceRecord = (record: MaintenanceRecord) => {
    setMaintenanceRecords(prev => [record, ...prev]);
    setVehicles(prev => prev.map(v => v.id === record.vehicleId ? { ...v, status: VehicleStatus.MAINTENANCE } : v));
  };
  const resolveMaintenance = useCallback((vehicleId: string, recordId: string | null | undefined, currentKm: number, returnDate: string, finalCost?: number) => {
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: VehicleStatus.AVAILABLE, currentKm } : v));
    setMaintenanceRecords(prev => {
      let targetId = recordId;
      if (!targetId) {
        const openRecord = prev.find(m => m.vehicleId === vehicleId && !m.returnDate);
        targetId = openRecord?.id;
      }
      if (targetId) {
        return prev.map(m => m.id === targetId ? { ...m, returnDate, cost: finalCost !== undefined ? finalCost : m.cost } : m);
      }
      return prev;
    });
  }, []);
  const addDriver = (d: Driver) => setDrivers(prev => [...prev, { ...d, passwordChanged: d.passwordChanged ?? false }]);
  const updateDriver = (id: string, updates: Partial<Driver>) => setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  const deleteDriver = (id: string) => setDrivers(prev => prev.filter(d => d.id !== id));
  const updateTrip = (tripId: string, updates: Partial<Trip>) => setActiveTrips(prev => prev.map(t => t.id === tripId ? { ...t, ...updates } : t));
  const addScheduledTrip = (trip: ScheduledTrip) => setScheduledTrips(prev => [trip, ...prev]);
  const updateScheduledTrip = (id: string, updates: Partial<ScheduledTrip>) => setScheduledTrips(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  const deleteScheduledTrip = (id: string) => setScheduledTrips(prev => prev.filter(t => t.id !== id));
  const addFine = (fine: Fine) => setFines(prev => [fine, ...prev]);
  const deleteFine = (id: string) => setFines(prev => prev.filter(f => f.id !== id));
  const addOccurrence = (occ: Occurrence) => setOccurrences(prev => [occ, ...prev]);
  const markNotificationAsRead = (id: string) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

  return (
    <FleetContext.Provider value={{
      vehicles, drivers, activeTrips, completedTrips, scheduledTrips, checklists, maintenanceRecords, notifications, fines, occurrences,
      addVehicle, updateVehicle, addDriver, updateDriver, deleteDriver, startTrip, updateTrip, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, endTrip, cancelTrip, addMaintenanceRecord, resolveMaintenance, addFine, deleteFine, addOccurrence, markNotificationAsRead,
      currentUser, login, logout, changePassword, resetDatabase
    }}>
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (!context) throw new Error('useFleet must be used within a FleetProvider');
  return context;
};
