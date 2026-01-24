
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip, VehicleStatus, Vehicle, AuditLog } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, activeTrips, completedTrips, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, currentUser } = useFleet();
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
    driverId: currentUser?.id || '',
    vehicleId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    city: '',
    state: '',
    notes: '',
    waypoints: [] as string[]
  };

  const [newSchedule, setNewSchedule] = useState(initialFormState);

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados:", err));
  }, []);

  useEffect(() => {
    if (newSchedule.state) {
      setIsLoadingLocs(true);
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

  const getVehicleConflictStatus = useCallback((vehicle: Vehicle) => {
    if (!newSchedule.scheduledDate) return null;
    
    // 1. Manutenção - BLOQUEIO PRIORITÁRIO
    if (vehicle.status === VehicleStatus.MAINTENANCE) return 'MAINTENANCE';
    
    // 2. Conflito de Agenda (Verifica agendamentos existentes na mesma data)
    const isScheduled = scheduledTrips.some(trip => 
      trip.vehicleId === vehicle.id && 
      trip.scheduledDate === newSchedule.scheduledDate && 
      trip.id !== editingTripId
    );
    if (isScheduled) return 'ALREADY_SCHEDULED';

    // 3. Conflito de Operação (Verifica se já existe viagem ativa ou concluída hoje para este veículo)
    const selectedDay = newSchedule.scheduledDate;
    
    const hasActiveTrip = activeTrips.some(trip => 
      trip.vehicleId === vehicle.id && 
      trip.startTime.split('T')[0] === selectedDay
    );
    if (hasActiveTrip) return 'ACTIVE_TRIP';

    const hasCompletedTrip = completedTrips.some(trip => 
      trip.vehicleId === vehicle.id && 
      trip.startTime.split('T')[0] === selectedDay
    );
    if (hasCompletedTrip) return 'ALREADY_USED_TODAY';
    
    // 4. Rodízio São Paulo
    if (isDestSaoPaulo) {
      const [year, month, day] = newSchedule.scheduledDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day, 12, 0, 0);
      if (checkSPRodizio(vehicle.plate, dateObj)) return 'RODIZIO';
    }
    
    return null;
  }, [newSchedule.scheduledDate, editingTripId, isDestSaoPaulo, scheduledTrips, activeTrips, completedTrips]);

  const restrictionInfo = useMemo(() => {
    if (!newSchedule.scheduledDate || !newSchedule.vehicleId) return null;
    const vehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
    if (vehicle) {
      const status = getVehicleConflictStatus(vehicle);
      switch (status) {
        case 'MAINTENANCE': return { type: 'MAINTENANCE', message: `BLOQUEADO: O veículo ${vehicle.plate} está em MANUTENÇÃO.` };
        case 'ACTIVE_TRIP': return { type: 'CONFLICT', message: `CONFLITO: Este veículo já está em uso operacional neste dia.` };
        case 'ALREADY_SCHEDULED': return { type: 'CONFLICT', message: `CONFLITO: Já existe um agendamento para este veículo nesta data.` };
        case 'ALREADY_USED_TODAY': return { type: 'CONFLICT', message: `CONFLITO: Este veículo já realizou uma jornada hoje e não pode ser reatribuído para novo local.` };
        case 'RODIZIO': return { type: 'RODIZIO', message: `RODÍZIO SP: ${getRodizioDayLabel(vehicle.plate)}.` };
        default: break;
      }
    }
    return null;
  }, [getVehicleConflictStatus, newSchedule.vehicleId, newSchedule.scheduledDate, vehicles]);

  const handleAttemptSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination || !newSchedule.origin || !newSchedule.city || !newSchedule.state) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (restrictionInfo?.type === 'MAINTENANCE') {
      alert("ERRO: Não é possível agendar viagens com veículos em manutenção.");
      return;
    }

    if (restrictionInfo?.type === 'CONFLICT') {
      alert(`ERRO DE AGENDA: ${restrictionInfo.message}`);
      return;
    }

    if (restrictionInfo?.type === 'RODIZIO') {
      if (!isAdmin) {
        alert("Agendamento em dia de rodízio restrito a gestores.");
        return;
      }
      if (!adminJustification.trim()) {
        alert("Justificativa de rodízio é obrigatória.");
        return;
      }
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
      restrictionInfo?.type === 'RODIZIO' ? `[JUSTIFICATIVA RODÍZIO]: ${adminJustification}` : null,
      auditReason ? `[AUDITORIA ALTERAÇÃO]: ${auditReason}` : null,
      newSchedule.notes
    ].filter(Boolean).join('\n');

    const tripData = { ...newSchedule, notes: finalNotes };

    if (editingTripId) {
      updateScheduledTrip(editingTripId, tripData);
      alert('Agendamento atualizado.');
    } else {
      const trip: ScheduledTrip = { id: Math.random().toString(36).substr(2, 9), ...tripData };
      addScheduledTrip(trip);
      alert('Viagem agendada.');
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
    setActionTargetId(null);
    setJustificationType(null);
  };

  const handleEditClick = (trip: ScheduledTrip) => {
    setNewSchedule({
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      scheduledDate: trip.scheduledDate,
      origin: trip.origin || '',
      destination: trip.destination,
      city: trip.city || '',
      state: trip.state || '',
      notes: trip.notes || '',
      waypoints: trip.waypoints || []
    });
    setEditingTripId(trip.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setNewSchedule(initialFormState);
    setEditingTripId(null);
    setShowForm(false);
    setAdminJustification('');
  };

  const isSubmitDisabled = 
    (restrictionInfo && (restrictionInfo.type === 'MAINTENANCE' || restrictionInfo.type === 'CONFLICT')) || 
    (restrictionInfo?.type === 'RODIZIO' && !isAdmin);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Escala de Viagens</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Agenda Operacional</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
            <i className="fas fa-calendar-plus"></i> Agendar Viagem
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-10 border-b pb-4">
            <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">
              {editingTripId ? 'AJUSTE DE ESCALA' : 'PLANEJAMENTO DE ROTA'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-red-500 transition-colors">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
          
          <form onSubmit={handleAttemptSave} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Data</label><input type="date" required value={newSchedule.scheduledDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" /></div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Motorista</label><select required value={newSchedule.driverId} onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" disabled={!isAdmin}><option value="">Selecione...</option>{drivers.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}</select></div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Veículo</label>
                <select required value={newSchedule.vehicleId} onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  <option value="">Selecione...</option>
                  {vehicles.map(v => {
                    const conflictStatus = getVehicleConflictStatus(v);
                    const isDisabled = !!conflictStatus && conflictStatus !== 'RODIZIO';
                    return (
                      <option key={v.id} value={v.id} disabled={isDisabled}>
                        {v.plate} - {v.model} 
                        {conflictStatus === 'MAINTENANCE' ? ' (MANUTENÇÃO)' : ''}
                        {conflictStatus === 'ALREADY_SCHEDULED' ? ' (INDISPONÍVEL NESTA DATA)' : ''}
                        {conflictStatus === 'ACTIVE_TRIP' || conflictStatus === 'ALREADY_USED_TODAY' ? ' (EM USO NESTE DIA)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Estado</label>
                <select required value={newSchedule.state} onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value, city: '' })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  <option value="">Selecione...</option>
                  {states.map(s => <option key={s.sigla} value={s.sigla}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Cidade</label>
                <select required value={newSchedule.city} onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" disabled={!newSchedule.state || isLoadingLocs}>
                  <option value="">{isLoadingLocs ? '...' : 'Selecione...'}</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Origem</label><input required placeholder="Local de Saída" value={newSchedule.origin} onChange={(e) => setNewSchedule({ ...newSchedule, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" /></div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Destino</label><input required placeholder="Endereço de Chegada" value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" /></div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] text-slate-400 uppercase mb-2 tracking-widest font-bold">Instruções / Observações do Agendamento</label>
              <textarea 
                placeholder="Descreva detalhes importantes para o motorista, pontos de referência ou avisos sobre a carga/viagem..." 
                value={newSchedule.notes} 
                onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })} 
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]"
              />
            </div>

            {restrictionInfo && (
              <div className={`p-6 rounded-3xl border animate-in shake duration-500 ${restrictionInfo.type === 'RODIZIO' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${restrictionInfo.type === 'RODIZIO' ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'}`}>
                    <i className={`fas ${restrictionInfo.type === 'RODIZIO' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'} text-lg`}></i>
                  </div>
                  <p className={`font-write uppercase text-xs tracking-tight ${restrictionInfo.type === 'RODIZIO' ? 'text-amber-800' : 'text-red-800'}`}>
                    {restrictionInfo.message}
                  </p>
                </div>
                
                {restrictionInfo.type === 'RODIZIO' && isAdmin && (
                  <textarea 
                    required
                    value={adminJustification}
                    onChange={(e) => setAdminJustification(e.target.value)}
                    placeholder="Justificativa administrativa para o rodízio..."
                    className="w-full p-4 bg-white border border-amber-200 rounded-2xl font-bold text-sm outline-none"
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-8 border-t">
              <button type="button" onClick={resetForm} className="px-8 py-4 text-slate-400 font-write uppercase text-[10px] font-bold">DESCARTAR</button>
              <button 
                type="submit" 
                disabled={isSubmitDisabled} 
                className={`px-16 py-5 rounded-2xl font-write uppercase text-xs tracking-widest text-white shadow-xl transition-all ${isSubmitDisabled ? 'bg-slate-300 opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
              >
                {editingTripId ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR AGENDAMENTO'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleScheduledTrips.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          const driver = drivers.find(d => d.id === trip.driverId);
          const [y, m, d] = trip.scheduledDate.split('-').map(Number);
          const tripDate = new Date(y, m-1, d, 12, 0, 0);

          return (
            <div key={trip.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center gap-6 group hover:shadow-md transition-all">
              <div className="w-24 text-center p-3 rounded-2xl font-write border border-slate-100 bg-slate-50 shrink-0">
                <span className="block text-2xl text-slate-800 leading-none">{tripDate.getDate()}</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold mt-1 block">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-white">{vehicle?.plate}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicle?.model}</p>
                  {trip.notes?.includes('[JUSTIFICATIVA RODÍZIO]') && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-write uppercase">Autorizada</span>}
                </div>
                <h4 className="text-lg font-bold truncate text-slate-800">{trip.destination}</h4>
                <p className="text-[10px] text-slate-400 font-medium italic">{trip.city}, {trip.state}</p>
                {trip.notes && !trip.notes.includes('[') && (
                  <p className="text-[10px] text-indigo-500 font-medium mt-1 truncate">
                    <i className="fas fa-clipboard-list mr-1"></i> {trip.notes}
                  </p>
                )}
              </div>

              <div className="hidden lg:block min-w-[200px] px-6 border-l border-slate-50">
                <p className="text-[8px] font-write text-slate-300 uppercase tracking-widest mb-1">Motorista Escalado</p>
                <p className="text-xs font-bold text-slate-600 truncate">{driver?.name || 'Não identificado'}</p>
              </div>

              <div className="flex items-center justify-end gap-3 shrink-0">
                <button onClick={() => handleEditClick(trip)} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all border shadow-sm"><i className="fas fa-edit"></i></button>
                <button onClick={() => handleAttemptDelete(trip.id)} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all border shadow-sm"><i className="fas fa-trash-alt"></i></button>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }))} 
                  disabled={vehicle?.status === VehicleStatus.MAINTENANCE}
                  className={`px-10 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl transition-all ${vehicle?.status === VehicleStatus.MAINTENANCE ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                  {vehicle?.status === VehicleStatus.MAINTENANCE ? 'Em Reparo' : 'Iniciar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showJustifyModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`p-8 ${justificationType === 'DELETE' ? 'bg-red-600' : 'bg-amber-500'} text-white`}>
              <h3 className="text-lg font-write uppercase tracking-tight">Justificativa Necessária</h3>
            </div>
            <div className="p-10 space-y-6">
              <textarea 
                autoFocus
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Motivo da alteração..."
                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px]"
              />
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowJustifyModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
                <button onClick={confirmJustifiedAction} disabled={!reasonText.trim()} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-write uppercase text-xs">Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulingPage;
