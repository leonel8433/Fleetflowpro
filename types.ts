
export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE'
}

export enum OccurrenceSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface AuditLog {
  id: string;
  entityId: string; // ID da Viagem ou Veículo
  userId: string;
  userName: string;
  action: 'ROUTE_CHANGE' | 'CANCELLED' | 'KM_CORRECTION';
  description: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface Occurrence {
  id: string;
  tripId: string;
  vehicleId: string;
  driverId: string;
  type: string;
  description: string;
  severity: OccurrenceSeverity;
  timestamp: string;
  resolved: boolean;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  date: string;
  returnDate?: string; 
  serviceType: string;
  cost: number;
  km: number;
  notes: string;
}

export interface Fine {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  value: number;
  points: number;
  description: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  currentKm: number;
  fuelLevel: number;
  fuelType: 'Diesel' | 'Gasolina' | 'Flex' | 'Etanol' | 'Elétrico' | 'GNV';
  status: VehicleStatus;
  lastChecklist?: Checklist;
}

export interface Driver {
  id: string;
  name: string;
  license: string;
  category: string; 
  email?: string;
  phone?: string;
  company?: string; // Campo adicionado para vínculo corporativo
  notes?: string;   // Campo adicionado para observações administrativas
  username: string;
  password?: string;
  passwordChanged?: boolean; 
  activeVehicleId?: string;
  avatar?: string;
}

export interface Checklist {
  id: string;
  vehicleId: string;
  driverId: string;
  timestamp: string;
  km: number;
  fuelLevel: number;
  oilChecked: boolean;
  waterChecked: boolean;
  tiresChecked: boolean;
  comments: string;
}

export interface Trip {
  id: string;
  driverId: string;
  vehicleId: string;
  origin: string;
  destination: string;
  waypoints?: string[];
  city?: string;
  state?: string;
  zipCode?: string;
  plannedDeparture?: string;
  plannedArrival?: string;
  startTime: string;
  endTime?: string;
  startKm: number; 
  distance?: number; 
  observations?: string;
  fuelExpense?: number;
  otherExpense?: number;
  expenseNotes?: string;
  isCancelled?: boolean;
  cancellationReason?: string;
  cancelledBy?: string;
}

export interface ScheduledTrip extends Omit<Trip, 'startTime' | 'startKm'> {
  scheduledDate: string;
  notes?: string;
}

export interface AppNotification {
  id: string;
  type: 'maintenance_km' | 'maintenance_date' | 'low_fuel' | 'new_fine' | 'occurrence' | 'schedule';
  title: string;
  message: string;
  vehicleId: string;
  driverId?: string; // Campo adicionado para filtros por motorista
  timestamp: string;
  isRead: boolean;
}
