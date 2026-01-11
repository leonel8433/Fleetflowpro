
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip, VehicleStatus, Vehicle } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, activeTrips, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, currentUser } = useFleet();
  const [showForm, setShowForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  // Carrega a lista de estados brasileiros do IBGE
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados do IBGE:", err));
  }, []);

  // Carrega a lista de cidades sempre que o estado é alterado
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
          console.error("Erro ao carregar cidades do IBGE:", err);
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

  // Função auxiliar para checar todos os conflitos de um veículo para a data selecionada
  const getVehicleConflictStatus = useCallback((vehicle: Vehicle) => {
    if (!newSchedule.scheduledDate) return null;
    
    const today = new Date().toISOString().split('T')[0];
    const isToday = newSchedule.scheduledDate === today;

    // 1. Checa Manutenção
    if (vehicle.status === VehicleStatus.MAINTENANCE) return 'MAINTENANCE';

    // 2. Checa se já está em uma viagem ativa (apenas se a data for hoje)
    if (isToday) {
      const isActive = activeTrips.some(t => t.vehicleId === vehicle.id);
      if (isActive) return 'ACTIVE_TRIP';
    }

    // 3. Checa agendamentos existentes para esta mesma data
    const isScheduled = scheduledTrips.some(trip => 
      trip.vehicleId === vehicle.id && 
      trip.scheduledDate === newSchedule.scheduledDate && 
      trip.id !== editingTripId
    );
    if (isScheduled) return 'ALREADY_SCHEDULED';

    // 4. Checa Rodízio de SP
    if (isDestSaoPaulo) {
      const [year, month, day] = newSchedule.scheduledDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day, 12, 0, 0);
      if (checkSPRodizio(vehicle.plate, dateObj)) return 'RODIZIO';
    }

    return null;
  }, [newSchedule.scheduledDate, newSchedule.vehicleId, isDestSaoPaulo, scheduledTrips, activeTrips, editingTripId]);

  const restrictionInfo = useMemo(() => {
    if (!newSchedule.scheduledDate) return null;

    // Validação de Veículo
    if (newSchedule.vehicleId) {
      const vehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
      if (vehicle) {
        const status = getVehicleConflictStatus(vehicle);
        switch (status) {
          case 'MAINTENANCE':
            return { type: 'MAINTENANCE', message: `VEÍCULO INDISPONÍVEL: ${vehicle.plate} está em manutenção.` };
          case 'ACTIVE_TRIP':
            return { type: 'CONFLICT', message: `VEÍCULO EM USO: ${vehicle.plate} está realizando uma viagem agora. Aguarde o retorno ou escolha outro.` };
          case 'ALREADY_SCHEDULED':
            return { type: 'CONFLICT', message: `CONFLITO DE AGENDA: ${vehicle.plate} já foi escalado para outra viagem nesta mesma data.` };
          case 'RODIZIO':
            return { type: 'RODIZIO', message: `ATENÇÃO RODÍZIO SP: A placa "${vehicle.plate.slice(-1)}" proíbe a circulação na capital em ${getRodizioDayLabel(vehicle.plate)}.` };
          default:
            break;
        }
      }
    }

    // Validação de Motorista
    if (newSchedule.driverId) {
      const driver = drivers.find(d => d.id === newSchedule.driverId);
      if (driver) {
        const today = new Date().toISOString().split('T')[0];
        const isCurrentlyTraveling = newSchedule.scheduledDate === today && activeTrips.some(t => String(t.driverId) === String(newSchedule.driverId));
        if (isCurrentlyTraveling) {
          return { type: 'DRIVER_BUSY', message: `MOTORISTA OCUPADO: ${driver.name} está em uma viagem ativa agora.` };
        }

        const driverConflict = scheduledTrips.find(trip => 
          String(trip.driverId) === String(newSchedule.driverId) && 
          trip.scheduledDate === newSchedule.scheduledDate && 
          trip.id !== editingTripId
        );
        if (driverConflict) {
          return { type: 'CONFLICT_DRIVER', message: `CONFLITO DE AGENDA: ${driver.name} já tem uma viagem para esta data.` };
        }
      }
    }

    return null;
  }, [getVehicleConflictStatus, newSchedule.vehicleId, newSchedule.driverId, newSchedule.scheduledDate, vehicles, drivers, scheduledTrips, activeTrips, editingTripId]);

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination || !newSchedule.origin) {
      alert("Por favor, preencha Origem, Destino, Motorista e Veículo.");
      return;
    }

    // Bloqueio rígido se não for admin OU se for conflito grave (manutenção/uso)
    if (restrictionInfo) {
      const isRodizioBypass = isAdmin && restrictionInfo.type === 'RODIZIO';
      if (!isRodizioBypass) {
        alert(`Impossível salvar agendamento: ${restrictionInfo.message}`);
        return;
      }
      if (isRodizioBypass && !adminJustification.trim()) {
        alert("Administrador, você deve justificar o agendamento de veículo sob rodízio.");
        return;
      }
    }

    const tripData = {
      driverId: newSchedule.driverId,
      vehicleId: newSchedule.vehicleId,
      scheduledDate: newSchedule.scheduledDate,
      origin: newSchedule.origin,
      destination: newSchedule.destination,
      city: newSchedule.city,
      state: newSchedule.state,
      notes: adminJustification ? `[JUSTIFICATIVA RODÍZIO]: ${adminJustification}\n${newSchedule.notes}` : newSchedule.notes,
      waypoints: newSchedule.waypoints
    };

    if (editingTripId) {
      updateScheduledTrip(editingTripId, tripData);
      alert('Agendamento de rota atualizado com sucesso!');
    } else {
      const trip: ScheduledTrip = { id: Math.random().toString(36).substr(2, 9), ...tripData };
      addScheduledTrip(trip);
      alert('Viagem agendada com sucesso!');
    }
    resetForm();
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
    setAdminJustification('');
    setShowForm(false);
  };

  // Define se o botão de enviar deve estar bloqueado
  const isSubmissionBlocked = useMemo(() => {
    if (!restrictionInfo) return false;
    if (restrictionInfo.type === 'RODIZIO' && isAdmin) return false; // Permite Admin
    return true; // Bloqueia outros casos
  }, [restrictionInfo, isAdmin]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Escala de Viagens</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Agenda Operacional</p>
        </div>
        <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }} className={`px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${showForm ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          <i className={`fas ${showForm ? 'fa-times' : (editingTripId ? 'fa-pen-to-square' : 'fa-calendar-plus')}`}></i>
          {showForm ? 'Cancelar' : (editingTripId ? 'Editar Escala' : 'Agendar Viagem')}
        </button>
      </div>

      {showForm && (
        <div className={`bg-white p-10 rounded-[2.5rem] shadow-2xl border transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${restrictionInfo ? (isAdmin && restrictionInfo.type === 'RODIZIO' ? 'border-amber-400' : 'border-red-500') : 'border-indigo-100'}`}>
          <div className="flex justify-between items-center mb-10 border-b border-slate-50 pb-4">
            <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">
              {editingTripId ? 'AJUSTE DE ESCALA' : 'PLANEJAMENTO DE ROTA'}
            </h3>
            {isDestSaoPaulo && (
               <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[8px] font-write uppercase tracking-widest border border-blue-100 animate-pulse">
                 Destino: São Paulo (Rodízio Ativo)
               </span>
            )}
          </div>
          
          {restrictionInfo && (
            <div className={`mb-8 p-6 rounded-2xl flex items-center gap-4 animate-in shake border-2 ${isAdmin && restrictionInfo.type === 'RODIZIO' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-600 text-white border-red-700'}`}>
              <i className={`fas ${isAdmin && restrictionInfo.type === 'RODIZIO' ? 'fa-triangle-exclamation' : 'fa-hand-paper'} text-2xl`}></i>
              <div>
                <p className="text-[11px] font-write uppercase tracking-wider leading-tight">{restrictionInfo.message}</p>
                <p className="text-[9px] opacity-80 mt-1 uppercase font-bold">
                  {isAdmin && restrictionInfo.type === 'RODIZIO' ? 'COMO GESTOR, VOCÊ PODE AUTORIZAR ESTA ESCALA MEDIANTE JUSTIFICATIVA.' : 'Respeite as escalas para evitar sobreposição de frota.'}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleAddSchedule} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Data da Viagem</label>
                <input type="date" required value={newSchedule.scheduledDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Motorista</label>
                <select required value={newSchedule.driverId} onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" disabled={!isAdmin}>
                   <option value="">Selecione...</option>
                   {drivers.filter(d => d.username !== 'admin').map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Veículo Escalado</label>
                <select required value={newSchedule.vehicleId} onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecione o Ativo...</option>
                  {vehicles.map(v => {
                    const conflictStatus = getVehicleConflictStatus(v);
                    const isMaint = conflictStatus === 'MAINTENANCE';
                    const hasSchedule = conflictStatus === 'ALREADY_SCHEDULED';
                    const isInUse = conflictStatus === 'ACTIVE_TRIP';
                    const hasRodizio = conflictStatus === 'RODIZIO';

                    // Bloqueio real apenas se for manutenção, já em uso ou agendado
                    const isHardBlocked = isMaint || hasSchedule || isInUse;
                    // Rodízio bloqueia se não for admin
                    const isRodizioBlocked = hasRodizio && !isAdmin;

                    let labelSuffix = '';
                    if (isMaint) labelSuffix = ' (EM MANUTENÇÃO)';
                    else if (isInUse) labelSuffix = ' (EM USO AGORA)';
                    else if (hasSchedule) labelSuffix = ' (AGENDADO NESTA DATA)';
                    else if (hasRodizio) labelSuffix = ' (RODÍZIO NESTA DATA)';

                    return (
                      <option 
                        key={v.id} 
                        value={v.id} 
                        disabled={isHardBlocked || isRodizioBlocked}
                        className={conflictStatus ? 'text-red-600 font-bold' : ''}
                      >
                        {v.plate} - {v.model}{labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {isAdmin && restrictionInfo?.type === 'RODIZIO' && (
              <div className="space-y-2 animate-in slide-in-from-left-2">
                <label className="block text-[10px] font-write text-amber-600 uppercase tracking-widest ml-1">Justificativa do Gestor (Obrigatória para Rodízio)</label>
                <textarea 
                  required
                  placeholder="Por que este veículo deve ser escalado mesmo em rodízio? Ex: Caráter de urgência, manutenção do outro ativo..." 
                  value={adminJustification}
                  onChange={(e) => setAdminJustification(e.target.value)}
                  className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 min-h-[80px]" 
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-50">
              <div className="space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Estado (UF)</label>
                <select value={newSchedule.state} onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value, city: '' })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">UF...</option>
                  {states.map(s => <option key={s.sigla} value={s.sigla}>{s.sigla} - {s.nome}</option>)}
                </select>
              </div>
              <div className="md:col-span-3 space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                  Cidade de Destino {isLoadingLocs && <i className="fas fa-spinner fa-spin ml-2"></i>}
                </label>
                <input 
                  list="city-options"
                  placeholder="Se for São Paulo, o sistema checará rodízio..." 
                  value={newSchedule.city} 
                  onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" 
                />
                <datalist id="city-options">
                  {cities.map((c, i) => <option key={i} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Endereço de Origem</label>
                <input required placeholder="Local de partida..." value={newSchedule.origin} onChange={(e) => setNewSchedule({ ...newSchedule, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Endereço de Destino</label>
                <input required placeholder="Local de chegada..." value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-50">
              <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Observações / Instruções Específicas para o Motorista</label>
              <textarea 
                placeholder="Ex: Pegar chave na guarita, levar documentos extras..." 
                value={newSchedule.notes} 
                onChange={(e) => setNewSchedule({ ...newSchedule, notes: e.target.value })} 
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]" 
              />
            </div>

            <div className="flex justify-end pt-8 gap-4 border-t border-slate-50">
              <button type="button" onClick={resetForm} className="px-8 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold hover:text-slate-600 transition-colors">Descartar</button>
              <button 
                type="submit" 
                disabled={isSubmissionBlocked || (isAdmin && restrictionInfo?.type === 'RODIZIO' && !adminJustification.trim())}
                className={`px-16 py-5 rounded-2xl font-write uppercase text-xs tracking-[0.2em] shadow-2xl transition-all ${isSubmissionBlocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
              >
                {editingTripId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleScheduledTrips.length > 0 ? visibleScheduledTrips.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          const [y, m, d] = trip.scheduledDate.split('-').map(Number);
          const tripDate = new Date(y, m-1, d, 12, 0, 0);
          const isOwnTrip = String(trip.driverId).trim() === String(currentUser?.id).trim();

          return (
            <div key={trip.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-6 group hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="w-24 text-center p-3 rounded-2xl font-write border border-slate-100 bg-slate-50 shrink-0">
                  <span className="block text-2xl text-slate-800 leading-none">{tripDate.getDate()}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-bold mt-1 block">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-widest bg-slate-900 text-white">{vehicle?.plate}</span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicle?.model}</p>
                  </div>
                  <h4 className="text-lg font-bold truncate text-slate-800">{trip.destination}</h4>
                  <p className="text-[10px] text-blue-600 font-bold uppercase">{trip.city} / {trip.state}</p>
                </div>
                <div className="flex items-center justify-end gap-3 shrink-0">
                  {(isAdmin || isOwnTrip) && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(trip)} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all border border-slate-100 shadow-sm"><i className="fas fa-edit"></i></button>
                      <button onClick={() => { if(window.confirm('Deseja realmente excluir este agendamento?')) deleteScheduledTrip(trip.id); }} className="w-12 h-12 rounded-xl bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all border border-slate-100 shadow-sm"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  )}
                  {isOwnTrip && (
                    <button onClick={() => window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }))} className="px-10 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all">Iniciar</button>
                  )}
                </div>
              </div>
              {trip.notes && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                  <i className={`fas ${trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'fa-shield-halved' : 'fa-info-circle'} text-amber-500 mt-0.5`}></i>
                  <div>
                    <p className="text-[9px] font-write text-amber-600 uppercase tracking-widest mb-1">
                      {trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'Autorização de Exceção' : 'Nota Administrativa'}
                    </p>
                    <p className="text-xs text-amber-800 font-medium italic">"{trip.notes}"</p>
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
             <i className="fas fa-calendar-xmark text-4xl text-slate-100 mb-4"></i>
             <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.2em]">Sua agenda operacional está vazia</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
