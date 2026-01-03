
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip, VehicleStatus } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, addScheduledTrip, currentUser } = useFleet();
  const [showForm, setShowForm] = useState(false);
  
  const [newSchedule, setNewSchedule] = useState({
    driverId: '',
    vehicleId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    city: '',
    state: '',
    notes: ''
  });

  const isAdmin = currentUser?.username === 'admin';

  // Memoizar se o destino atual é São Paulo
  const isDestSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(newSchedule.city, newSchedule.state, newSchedule.destination);
  }, [newSchedule.city, newSchedule.state, newSchedule.destination]);

  // Função auxiliar para gerar a data de validação
  const getValidationDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  // Cálculo de impedimentos (Manutenção e Rodízio)
  const restrictionInfo = useMemo(() => {
    if (!newSchedule.vehicleId) return null;
    
    const vehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
    if (!vehicle) return null;

    // 1. BLOQUEIO CRÍTICO: MANUTENÇÃO
    if (vehicle.status === VehicleStatus.MAINTENANCE) {
      return { 
        type: 'MAINTENANCE', 
        message: `OPERAÇÃO NEGADA: O veículo ${vehicle.plate} está em MANUTENÇÃO e não pode ser escalado para novas viagens até sua liberação técnica.` 
      };
    }

    // 2. BLOQUEIO OPERACIONAL: RODÍZIO SP
    if (isDestSaoPaulo && newSchedule.scheduledDate) {
      const dateObj = getValidationDate(newSchedule.scheduledDate);
      if (checkSPRodizio(vehicle.plate, dateObj)) {
        return { 
          type: 'RODIZIO', 
          message: `RESTRIÇÃO DE CIRCULAÇÃO: Este veículo possui rodízio em SP na ${getRodizioDayLabel(vehicle.plate)} para a data selecionada.` 
        };
      }
    }

    return null;
  }, [isDestSaoPaulo, newSchedule.vehicleId, newSchedule.scheduledDate, vehicles]);

  const isBlocked = !!restrictionInfo;

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination) return;

    if (isBlocked) {
      alert(`ERRO DE AGENDAMENTO:\n\n${restrictionInfo.message}`);
      return;
    }

    const trip: ScheduledTrip = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: newSchedule.driverId,
      vehicleId: newSchedule.vehicleId,
      scheduledDate: newSchedule.scheduledDate,
      origin: newSchedule.origin,
      destination: newSchedule.destination,
      city: newSchedule.city,
      state: newSchedule.state,
      notes: newSchedule.notes
    };
    
    addScheduledTrip(trip);
    alert('Viagem agendada e salva com sucesso.');

    setNewSchedule({ driverId: '', vehicleId: '', scheduledDate: new Date().toISOString().split('T')[0], origin: '', destination: '', city: '', state: '', notes: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda de Viagens</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Planejamento e Escala de Rotas</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
            <i className={`fas ${showForm ? 'fa-times' : 'fa-calendar-plus'}`}></i>
            {showForm ? 'Fechar' : 'Novo Agendamento'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Informações do Novo Agendamento</h3>
          <form onSubmit={handleAddSchedule} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Motorista Escolhido</label>
                <select required value={newSchedule.driverId} onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecione...</option>
                  {drivers.filter(d => d.username !== 'admin').map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Operação</label>
                <input required type="date" value={newSchedule.scheduledDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo Ativo</label>
                <select required value={newSchedule.vehicleId} onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Selecione...</option>
                  {vehicles.map(v => {
                    const isInMaintenance = v.status === VehicleStatus.MAINTENANCE;
                    const dateObj = getValidationDate(newSchedule.scheduledDate);
                    const isRestricted = isDestSaoPaulo && checkSPRodizio(v.plate, dateObj);
                    
                    return (
                      <option key={v.id} value={v.id} disabled={isInMaintenance || isRestricted} className={isInMaintenance ? 'text-slate-300' : ''}>
                        {v.plate} - {v.model} 
                        {isInMaintenance ? ' [BLOQUEADO: EM MANUTENÇÃO]' : ''}
                        {isRestricted ? ' [BLOQUEADO: RODÍZIO]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Cidade de Destino</label>
                <input placeholder="Ex: São Paulo" value={newSchedule.city} onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Estado (UF)</label>
                <input placeholder="SP" maxLength={2} value={newSchedule.state} onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            {/* Banner de Impedimento Dinâmico */}
            {isBlocked && (
              <div className={`border-2 p-6 rounded-2xl flex items-center gap-4 animate-in shake duration-300 ${restrictionInfo.type === 'MAINTENANCE' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-lg text-white ${restrictionInfo.type === 'MAINTENANCE' ? 'bg-amber-600' : 'bg-red-600'}`}>
                    <i className={`fas ${restrictionInfo.type === 'MAINTENANCE' ? 'fa-tools' : 'fa-ban'}`}></i>
                 </div>
                 <div>
                    <h4 className="text-xs font-write uppercase tracking-widest">Alerta de Bloqueio</h4>
                    <p className="text-[11px] font-bold">{restrictionInfo.message}</p>
                 </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Endereço de Entrega / Parada</label>
              <input required placeholder="Logradouro completo..." value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex justify-end pt-4">
              <button 
                type="submit" 
                disabled={isBlocked || !newSchedule.vehicleId || !newSchedule.driverId} 
                className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                Gravar no Sistema
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {scheduledTrips.length > 0 ? scheduledTrips.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          const [y, m, d] = trip.scheduledDate.split('-').map(Number);
          const tripDate = new Date(y, m-1, d, 12, 0, 0);

          return (
            <div key={trip.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6">
              <div className="w-24 text-center p-3 bg-slate-50 rounded-2xl font-write border border-slate-100 shrink-0">
                <span className="block text-2xl text-slate-800">{tripDate.getDate()}</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono tracking-widest">{vehicle?.plate}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicle?.model}</p>
                </div>
                <h4 className="text-lg font-bold text-slate-800 truncate">{trip.destination}</h4>
              </div>
              {!isAdmin && (
                <button onClick={() => window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }))} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Iniciar</button>
              )}
            </div>
          );
        }) : (
          <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
             <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.3em]">Agenda Limpa</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
