
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip, VehicleStatus, Vehicle, TripType } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, activeTrips, currentUser, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip } = useFleet();
  const [showForm, setShowForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showJustifyModal, setShowJustifyModal] = useState(false);
  const [justificationType, setJustificationType] = useState<'DELETE' | 'UPDATE' | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');

  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingLocs, setIsLoadingLocs] = useState(false);
  
  const [adminJustification, setAdminJustification] = useState('');

  const initialFormState = {
    type: 'STANDARD' as TripType,
    driverId: currentUser?.id || '',
    vehicleId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledEndDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    city: '',
    state: '',
    notes: '',
    waypoints: [] as string[]
  };

  const [newSchedule, setNewSchedule] = useState(initialFormState);

  // Busca de Estados do IBGE
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados:", err));
  }, []);

  // Busca de Cidades do IBGE baseada no Estado selecionado
  useEffect(() => {
    if (newSchedule.state) {
      setIsLoadingLocs(true);
      setCities([]); 
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${newSchedule.state}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => {
          setCities(data.map((c: any) => c.nome));
          setIsLoadingLocs(false);
        })
        .catch(err => {
          console.error("Erro ao carregar cidades:", err);
          setIsLoadingLocs(false);
        });
    } else {
      setCities([]);
    }
  }, [newSchedule.state]);

  const isAdmin = currentUser?.username === 'admin';

  const visibleScheduledTrips = useMemo(() => {
    let trips = [...scheduledTrips];
    if (!isAdmin) {
      const curId = String(currentUser?.id).trim();
      trips = trips.filter(trip => String(trip.driverId).trim() === curId);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      trips = trips.filter(trip => {
        const vehiclePlate = vehicles.find(v => v.id === trip.vehicleId)?.plate.toLowerCase() || '';
        return trip.destination.toLowerCase().includes(term) || vehiclePlate.includes(term);
      });
    }
    return trips.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [scheduledTrips, isAdmin, currentUser, searchTerm, vehicles]);

  const isDestSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(newSchedule.city, newSchedule.state, newSchedule.destination);
  }, [newSchedule.city, newSchedule.state, newSchedule.destination]);

  const getConflictStatus = useCallback((vehicleId: string, driverId: string) => {
    if (!newSchedule.scheduledDate || !vehicleId || !driverId) return null;
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle && vehicle.status === VehicleStatus.MAINTENANCE) return 'MAINTENANCE';
    
    const normalizeDate = (dStr: string) => new Date(dStr + 'T12:00:00').getTime();
    
    // CORREÇÃO CRÍTICA: Definir período de ocupação com base no tipo da viagem
    const effectiveStart = newSchedule.scheduledDate;
    const effectiveEnd = newSchedule.type === 'WEEKLY_ROUTINE' 
      ? (newSchedule.scheduledEndDate || newSchedule.scheduledDate) 
      : newSchedule.scheduledDate;

    const start = normalizeDate(effectiveStart);
    const end = normalizeDate(effectiveEnd);

    // 1. CONFLITO DE VEÍCULO NA AGENDA (Impede duplicidade de qualquer local/tipo)
    const hasVehicleOverlap = scheduledTrips.some(trip => {
      if (trip.id === editingTripId) return false;
      if (trip.vehicleId !== vehicleId) return false;

      const sStart = normalizeDate(trip.scheduledDate);
      const sEnd = normalizeDate(trip.scheduledEndDate || trip.scheduledDate);
      return (start <= sEnd && end >= sStart);
    });
    if (hasVehicleOverlap) return 'VEHICLE_OVERLAP';

    // 2. CONFLITO DE MOTORISTA NA AGENDA
    const hasDriverOverlap = scheduledTrips.some(trip => {
      if (trip.id === editingTripId) return false;
      if (trip.driverId !== driverId) return false;

      const sStart = normalizeDate(trip.scheduledDate);
      const sEnd = normalizeDate(trip.scheduledEndDate || trip.scheduledDate);
      return (start <= sEnd && end >= sStart);
    });
    if (hasDriverOverlap) return 'DRIVER_OVERLAP';

    // 3. CONFLITO COM OPERAÇÃO ATIVA
    const hasActiveConflict = activeTrips.some(trip => {
      const sameVehicle = trip.vehicleId === vehicleId;
      const sameDriver = trip.driverId === driverId;
      if (!sameVehicle && !sameDriver) return false;

      const aStart = normalizeDate(trip.startTime.split('T')[0]);
      const aEnd = trip.endDate ? normalizeDate(trip.endDate) : aStart; 
      return (start <= aEnd && end >= aStart);
    });
    if (hasActiveConflict) return 'ACTIVE_CONFLICT';

    // 4. RODÍZIO SP
    if (isDestSaoPaulo && vehicle) {
      const dateObj = new Date(newSchedule.scheduledDate + 'T12:00:00');
      if (checkSPRodizio(vehicle.plate, dateObj)) return 'RODIZIO';
    }
    
    return null;
  }, [newSchedule.scheduledDate, newSchedule.scheduledEndDate, newSchedule.type, editingTripId, isDestSaoPaulo, scheduledTrips, activeTrips, vehicles]);

  const restrictionInfo = useMemo(() => {
    if (!newSchedule.scheduledDate || !newSchedule.vehicleId || !newSchedule.driverId) return null;
    const status = getConflictStatus(newSchedule.vehicleId, newSchedule.driverId);
    const vehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
    const driver = drivers.find(d => d.id === newSchedule.driverId);

    switch (status) {
      case 'MAINTENANCE': return { type: 'BLOCK', message: `BLOQUEIO: O veículo ${vehicle?.plate} está em MANUTENÇÃO.` };
      case 'VEHICLE_OVERLAP': return { type: 'BLOCK', message: `CONFLITO: O veículo ${vehicle?.plate} já está reservado para outro local neste período.` };
      case 'DRIVER_OVERLAP': return { type: 'BLOCK', message: `CONFLITO: O motorista ${driver?.name} já possui outro agendamento neste período.` };
      case 'RODIZIO': return { type: 'RODIZIO', message: `RESTRIÇÃO DE RODÍZIO SP: ${getRodizioDayLabel(vehicle?.plate || '')} na data inicial.` };
      case 'ACTIVE_CONFLICT': return { type: 'BLOCK', message: `BLOQUEIO: Veículo ou Motorista em trânsito no período selecionado.` };
      default: return null;
    }
  }, [getConflictStatus, newSchedule.vehicleId, newSchedule.driverId, newSchedule.scheduledDate, vehicles, drivers]);

  const handleAttemptSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination || !newSchedule.origin || !newSchedule.city || !newSchedule.state) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (restrictionInfo?.type === 'BLOCK') {
      alert(restrictionInfo.message);
      return;
    }

    if (editingTripId) {
      setJustificationType('UPDATE');
      setActionTargetId(editingTripId);
      setShowJustifyModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = (auditReason?: string) => {
    const finalNotes = [
      restrictionInfo?.type === 'RODIZIO' ? `[JUSTIFICATIVA RODÍZIO SP]: ${adminJustification}` : null,
      auditReason ? `[AUDITORIA ALTERAÇÃO]: ${auditReason}` : null,
      newSchedule.notes
    ].filter(Boolean).join('\n');

    const tripData = { 
      ...newSchedule, 
      notes: finalNotes,
      scheduledEndDate: newSchedule.type === 'WEEKLY_ROUTINE' ? newSchedule.scheduledEndDate : newSchedule.scheduledDate
    };

    if (editingTripId) {
      updateScheduledTrip(editingTripId, tripData);
    } else {
      const trip: ScheduledTrip = { id: Math.random().toString(36).substr(2, 9), ...tripData };
      addScheduledTrip(trip);
    }
    resetForm();
  };

  const handleAttemptDelete = (id: string) => {
    setJustificationType('DELETE');
    setActionTargetId(id);
    setReasonText('');
    setShowJustifyModal(true);
  };

  const confirmJustifiedAction = () => {
    if (!reasonText.trim()) return;
    if (justificationType === 'DELETE' && actionTargetId) {
      deleteScheduledTrip(actionTargetId);
    } else if (justificationType === 'UPDATE') {
      executeSave(reasonText);
    }
    setShowJustifyModal(false);
    setReasonText('');
  };

  const handleEditClick = (trip: ScheduledTrip) => {
    setNewSchedule({ 
      type: trip.type || 'STANDARD',
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      scheduledDate: trip.scheduledDate,
      scheduledEndDate: trip.scheduledEndDate || trip.scheduledDate,
      origin: trip.origin,
      destination: trip.destination,
      city: trip.city || '',
      state: trip.state || '',
      notes: trip.notes || '',
      waypoints: trip.waypoints || []
    });
    setEditingTripId(trip.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setNewSchedule(initialFormState);
    setEditingTripId(null);
    setAdminJustification('');
    setShowForm(false);
  };

  const isSubmitDisabled = 
    restrictionInfo?.type === 'BLOCK' || 
    (restrictionInfo?.type === 'RODIZIO' && (!isAdmin || !adminJustification.trim()));

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Escala de Viagens</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Agenda Operacional</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white shadow-lg flex items-center gap-2">
            <i className="fas fa-calendar-plus"></i> Agendar Viagem
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAttemptSave} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Tipo de Viagem</label>
                <select value={newSchedule.type} onChange={(e) => setNewSchedule({ ...newSchedule, type: e.target.value as TripType })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  <option value="STANDARD">Viagem Avulsa</option>
                  <option value="WEEKLY_ROUTINE">Rotina Semanal</option>
                </select>
              </div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Início</label><input type="date" required value={newSchedule.scheduledDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" /></div>
              {newSchedule.type === 'WEEKLY_ROUTINE' && (
                <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Término</label><input type="date" min={newSchedule.scheduledDate} required value={newSchedule.scheduledEndDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledEndDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-emerald-100 rounded-2xl font-bold" /></div>
              )}
              <div className={newSchedule.type !== 'WEEKLY_ROUTINE' ? 'lg:col-span-2' : ''}>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Motorista</label>
                <select required value={newSchedule.driverId} onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" disabled={!isAdmin}>
                  <option value="">Selecione...</option>
                  {drivers.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Veículo</label>
                <select required value={newSchedule.vehicleId} onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  <option value="">Selecione...</option>
                  {vehicles.map(v => (
                    <option 
                      key={v.id} 
                      value={v.id} 
                      disabled={v.status === VehicleStatus.MAINTENANCE}
                      className={v.status === VehicleStatus.MAINTENANCE ? 'text-red-400 font-normal opacity-50' : ''}
                    >
                      {v.plate} - {v.model} {v.status === VehicleStatus.MAINTENANCE ? '(EM MANUTENÇÃO)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Estado</label>
                <select required value={newSchedule.state} onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value, city: '' })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  <option value="">Selecione...</option>
                  {states.map(s => <option key={s.sigla} value={s.sigla}>{s.nome}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Cidade</label>
                <select required value={newSchedule.city} onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" disabled={!newSchedule.state || isLoadingLocs}>
                  <option value="">{isLoadingLocs ? '...' : 'Selecione...'}</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Origem</label><input required placeholder="Local de Saída" value={newSchedule.origin} onChange={(e) => setNewSchedule({ ...newSchedule, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" /></div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Destino</label><input required placeholder="Endereço de Chegada" value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" /></div>
            </div>

            {restrictionInfo && (
              <div className={`p-6 border rounded-3xl ${restrictionInfo.type === 'RODIZIO' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[11px] font-bold uppercase mb-4 flex items-center gap-2">
                  <i className={`fas ${restrictionInfo.type === 'RODIZIO' ? 'fa-traffic-light' : 'fa-circle-exclamation'}`}></i> 
                  {restrictionInfo.message}
                </p>
                {restrictionInfo.type === 'RODIZIO' && (
                  isAdmin ? (
                    <div className="space-y-3">
                       <label className="block text-[10px] font-bold text-amber-700 uppercase">Justificativa Administrativa (Obrigatória)</label>
                       <textarea 
                        required
                        placeholder="Informe por que este veículo deve ser utilizado mesmo com restrição de rodízio..." 
                        value={adminJustification} 
                        onChange={(e) => setAdminJustification(e.target.value)} 
                        className="w-full p-4 bg-white border border-amber-200 rounded-2xl font-bold text-xs min-h-[80px]" 
                       />
                    </div>
                  ) : (
                    <div className="p-4 bg-red-100 rounded-2xl text-red-700 text-[10px] font-bold uppercase">
                       Apenas administradores podem agendar veículos com restrição de rodízio mediante justificativa.
                    </div>
                  )
                )}
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-[10px] text-slate-400 uppercase mb-2 tracking-widest font-bold">Instruções / Observações Gerais</label>
              <textarea placeholder="..." value={newSchedule.notes} onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm min-h-[100px]" />
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t">
              <button type="button" onClick={resetForm} className="px-8 py-4 text-slate-400 uppercase text-[10px] font-bold">DESCARTAR</button>
              <button 
                type="submit" 
                disabled={isSubmitDisabled} 
                className={`px-16 py-5 rounded-2xl font-bold text-xs shadow-xl transition-all ${isSubmitDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                SALVAR AGENDAMENTO
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleScheduledTrips.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          const isVehicleMaintenance = vehicle?.status === VehicleStatus.MAINTENANCE;
          const isWeekly = trip.type === 'WEEKLY_ROUTINE';
          
          return (
            <div key={trip.id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border flex flex-col md:flex-row md:items-center gap-6 group hover:shadow-md transition-all ${isVehicleMaintenance ? 'border-red-50 opacity-80' : 'border-slate-100'}`}>
              <div className={`w-24 text-center p-3 rounded-2xl border shrink-0 ${isWeekly ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50'}`}>
                <span className={`block text-2xl font-write ${isWeekly ? 'text-emerald-800' : 'text-slate-800'} leading-none`}>
                  {new Date(trip.scheduledDate + 'T12:00:00').getDate()}
                </span>
                <span className="text-[10px] uppercase text-slate-400 font-bold mt-1 block">
                  {new Date(trip.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono text-white ${isVehicleMaintenance ? 'bg-red-400' : isWeekly ? 'bg-emerald-600' : 'bg-slate-900'}`}>{vehicle?.plate}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {vehicle?.model} {isWeekly && '• SEMANAL'} {isVehicleMaintenance && '• EM MANUTENÇÃO'}
                  </p>
                </div>
                <h4 className="text-lg font-bold truncate text-slate-800">{trip.destination}</h4>
                <p className="text-[10px] text-slate-400 font-medium italic">
                  {trip.city}, {trip.state} {isWeekly && `(até ${new Date((trip.scheduledEndDate || trip.scheduledDate) + 'T12:00:00').toLocaleDateString()})`}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 shrink-0">
                <button onClick={() => handleEditClick(trip)} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center border transition-all"><i className="fas fa-edit"></i></button>
                <button onClick={() => handleAttemptDelete(trip.id)} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 hover:text-red-600 flex items-center justify-center border transition-all"><i className="fas fa-trash-alt"></i></button>
                <button 
                  onClick={() => !isVehicleMaintenance && window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }))} 
                  disabled={isVehicleMaintenance}
                  className={`px-10 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl transition-all ${isVehicleMaintenance ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white'}`}
                >
                  {isVehicleMaintenance ? 'Manutenção' : 'Iniciar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showJustifyModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6">
            <h3 className="text-lg font-bold uppercase text-slate-800">Justificativa de Auditoria</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Informe o motivo da alteração ou exclusão deste registro.</p>
            <textarea autoFocus value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Motivo..." className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm min-h-[120px]" />
            <div className="flex gap-4">
              <button onClick={() => setShowJustifyModal(false)} className="flex-1 py-5 text-slate-400 uppercase text-[10px] font-bold">Cancelar</button>
              <button onClick={confirmJustifiedAction} disabled={!reasonText.trim()} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl uppercase text-xs font-bold shadow-xl">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulingPage;
