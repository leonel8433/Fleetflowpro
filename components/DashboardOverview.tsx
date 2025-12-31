
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getFleetStatsAnalysis } from '../services/geminiService';
import { VehicleStatus, OccurrenceSeverity, Trip, MaintenanceRecord } from '../types';

interface DashboardOverviewProps {
  onStartSchedule?: (id: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartSchedule }) => {
  const { vehicles, drivers, activeTrips, scheduledTrips, notifications, checklists, occurrences, maintenanceRecords, currentUser, updateTrip, endTrip, cancelTrip, resolveMaintenance } = useFleet();
  const [aiInsights, setAiInsights] = useState<string>("Analisando dados da frota...");
  
  const isAdmin = currentUser?.username === 'admin';
  const myActiveTrip = useMemo(() => activeTrips.find(t => t.driverId === currentUser?.id), [activeTrips, currentUser]);
  
  const myScheduledTrips = useMemo(() => {
    return scheduledTrips
      .filter(t => t.driverId === currentUser?.id)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [scheduledTrips, currentUser]);

  const [resolvingMaint, setResolvingMaint] = useState<{recordId: string, vehicleId: string, plate: string} | null>(null);
  const [resKm, setResKm] = useState<number>(0);
  
  // Finish Trip States
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<string>('0');
  const [otherExpense, setOtherExpense] = useState<string>('0');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  // Edit Trip States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    destination: '',
    waypoints: [] as string[]
  });

  // Cancel Trip States
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const vehiclesInMaintenance = useMemo(() => {
    return vehicles.filter(v => v.status === VehicleStatus.MAINTENANCE).map(v => {
      const activeM = maintenanceRecords.find(m => m.vehicleId === v.id && !m.returnDate);
      return { ...v, activeMaintenanceId: activeM?.id };
    });
  }, [vehicles, maintenanceRecords]);

  const fleetStats = useMemo(() => {
    const total = vehicles.length || 1;
    const available = vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length;
    const inUse = vehicles.filter(v => v.status === VehicleStatus.IN_USE).length;
    const maintenance = vehicles.filter(v => v.status === VehicleStatus.MAINTENANCE).length;

    return {
      available, inUse, maintenance, total: vehicles.length,
      pAvailable: (available / total * 100).toFixed(0),
      pInUse: (inUse / total * 100).toFixed(0),
      pMaintenance: (maintenance / total * 100).toFixed(0)
    };
  }, [vehicles]);

  const handleResolveMaintQuick = () => {
    if (resolvingMaint) {
      // No dashboard rápido, mantemos sem alteração de custo ou passamos undefined
      resolveMaintenance(resolvingMaint.vehicleId, resolvingMaint.recordId, resKm, new Date().toISOString());
      setResolvingMaint(null);
      alert(`Veículo ${resolvingMaint.plate} liberado para uso!`);
    }
  };

  const handleFinalArrival = () => {
    if (myActiveTrip) {
      const vehicle = vehicles.find(v => v.id === myActiveTrip.vehicleId);
      setEndKm(vehicle?.currentKm || 0);
      setFuelExpense('0');
      setOtherExpense('0');
      setExpenseNotes('');
      setShowFinishModal(true);
    }
  };

  const handleStartGPS = () => {
    if (!myActiveTrip) return;
    const origin = encodeURIComponent(myActiveTrip.origin);
    const dest = encodeURIComponent(`${myActiveTrip.destination}${myActiveTrip.city ? ', ' + myActiveTrip.city : ''}`);
    const wps = myActiveTrip.waypoints && myActiveTrip.waypoints.length > 0 
      ? `&waypoints=${myActiveTrip.waypoints.map(w => encodeURIComponent(w)).join('|')}` 
      : '';
    
    // Abre no Google Maps App (se houver) ou no browser com modo navegação
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps}&travelmode=driving`, '_blank');
  };

  const confirmFinish = () => {
    if (myActiveTrip) {
      const deviceTime = new Date().toISOString();
      endTrip(myActiveTrip.id, endKm, deviceTime, {
        fuel: parseFloat(fuelExpense) || 0,
        other: parseFloat(otherExpense) || 0,
        notes: expenseNotes
      });
      setShowFinishModal(false);
      alert('Viagem encerrada! Obrigado pela jornada.');
    }
  };

  // Edit Trip Functions
  const openEditModal = () => {
    if (myActiveTrip) {
      setEditForm({
        destination: myActiveTrip.destination,
        waypoints: myActiveTrip.waypoints || []
      });
      setShowEditModal(true);
    }
  };

  const handleAddWaypoint = () => {
    setEditForm(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  };

  const handleUpdateWaypoint = (idx: number, val: string) => {
    const newWps = [...editForm.waypoints];
    newWps[idx] = val;
    setEditForm(prev => ({ ...prev, waypoints: newWps }));
  };

  const handleRemoveWaypoint = (idx: number) => {
    setEditForm(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== idx) }));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (myActiveTrip) {
      updateTrip(myActiveTrip.id, {
        destination: editForm.destination,
        waypoints: editForm.waypoints.filter(w => w.trim() !== '')
      });
      setShowEditModal(false);
      alert('Rota atualizada com sucesso!');
    }
  };

  // Cancel Trip Functions
  const handleCancelTrip = () => {
    if (myActiveTrip) {
      cancelTrip(myActiveTrip.id);
      setShowCancelConfirm(false);
      alert('Viagem cancelada. O veículo está disponível novamente.');
    }
  };

  const getStatusConfig = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.AVAILABLE:
        return { icon: 'fa-check-circle', color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Disponível' };
      case VehicleStatus.IN_USE:
        return { icon: 'fa-truck-moving', color: 'text-blue-500', bg: 'bg-blue-50', label: 'Em Uso' };
      case VehicleStatus.MAINTENANCE:
        return { icon: 'fa-wrench', color: 'text-red-500', bg: 'bg-red-50', label: 'Manutenção' };
      default:
        return { icon: 'fa-question-circle', color: 'text-slate-400', bg: 'bg-slate-50', label: 'Desconhecido' };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Geral</h2>
          <p className="text-xs text-slate-400 font-medium">Bem-vindo, {currentUser?.name}.</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
            {isAdmin ? 'Gestão Master' : 'Painel do Condutor'}
          </span>
        </div>
      </div>

      {isAdmin && vehiclesInMaintenance.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-write text-amber-800 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-wrench animate-bounce"></i> Veículos em Oficina ({vehiclesInMaintenance.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehiclesInMaintenance.map(v => (
              <div key={v.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-write text-slate-800">{v.plate}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                </div>
                <button 
                  onClick={() => {
                    setResolvingMaint({ recordId: v.activeMaintenanceId || '', vehicleId: v.id, plate: v.plate });
                    setResKm(v.currentKm);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-write uppercase tracking-widest transition-all"
                >
                  Liberar Veículo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && myActiveTrip && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 overflow-hidden relative group">
          <div className="absolute top-4 right-4 flex gap-2">
            <span className="bg-emerald-500 text-white text-[10px] font-write px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
              <i className="fas fa-satellite-dish"></i> EM ROTA
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">
                  <i className="fas fa-truck-moving"></i>
                </div>
                <div>
                  <h3 className="text-lg font-write uppercase tracking-tight">Viagem Ativa</h3>
                  <p className="text-blue-400 text-xs font-bold">{vehicles.find(v => v.id === myActiveTrip.vehicleId)?.plate} • {vehicles.find(v => v.id === myActiveTrip.vehicleId)?.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-write mb-1">Destino</p>
                  <p className="text-sm font-bold truncate">{myActiveTrip.destination}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-write mb-1">Previsão</p>
                  <span className="text-sm font-bold">{myActiveTrip.plannedArrival ? new Date(myActiveTrip.plannedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                </div>
              </div>

              {/* Waypoints badge display */}
              {myActiveTrip.waypoints && myActiveTrip.waypoints.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[9px] text-blue-400 uppercase font-write flex items-center gap-1">
                    <i className="fas fa-map-signs"></i> {myActiveTrip.waypoints.length} Paradas planejadas
                  </span>
                </div>
              )}
            </div>

            <div className="w-full md:w-80 flex flex-col gap-3 justify-center">
              <button 
                onClick={handleStartGPS}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-write text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-3 border-2 border-indigo-400/30"
              >
                <i className="fas fa-compass text-xl animate-pulse"></i> Iniciar Navegação GPS
              </button>

              <button 
                onClick={handleFinalArrival}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-write text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/40"
              >
                <i className="fas fa-check-circle mr-2"></i> Cheguei ao Local
              </button>
              
              <div className="flex gap-2">
                <button 
                  onClick={openEditModal}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all"
                >
                  <i className="fas fa-route mr-1.5"></i> Alterar Rota
                </button>
                <button 
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all"
                >
                  <i className="fas fa-ban mr-1.5"></i> Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Rota (Condutor) */}
      {showEditModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="text-lg font-write uppercase">Atualizar Rota</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Novo Destino Final</label>
                <input 
                  required
                  value={editForm.destination}
                  onChange={(e) => setEditForm(prev => ({ ...prev, destination: e.target.value }))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Gerenciar Paradas</label>
                  <button type="button" onClick={handleAddWaypoint} className="text-[10px] font-write text-blue-600 uppercase tracking-widest flex items-center gap-1">
                    <i className="fas fa-plus"></i> Adicionar
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {editForm.waypoints.map((wp, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="w-8 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-[10px] font-bold text-slate-400">{i+1}</div>
                      <input 
                        value={wp}
                        onChange={(e) => handleUpdateWaypoint(i, e.target.value)}
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        placeholder={`Endereço da parada ${i+1}`}
                      />
                      <button type="button" onClick={() => handleRemoveWaypoint(i)} className="text-red-300 hover:text-red-500 transition-colors">
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  ))}
                  {editForm.waypoints.length === 0 && (
                    <p className="text-[10px] text-slate-300 italic text-center py-4">Nenhuma parada intermediária adicionada</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-50">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Descartar</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-blue-100">Salvar Mudanças</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação Cancelamento */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Cancelar Viagem?</h3>
                <p className="text-sm text-slate-500 mt-2">Esta ação interromperá o monitoramento e liberará o veículo imediatamente. Confirmar?</p>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <button 
                  onClick={handleCancelTrip}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-red-100"
                >
                  Confirmar Cancelamento
                </button>
                <button 
                  onClick={() => setShowCancelConfirm(false)}
                  className="w-full py-3 text-slate-400 font-write uppercase text-[10px] tracking-widest"
                >
                  Voltar para Viagem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && !myActiveTrip && myScheduledTrips.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6">
          <h3 className="text-sm font-write text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-calendar-check"></i> Meus Próximos Compromissos
          </h3>
          <div className="space-y-3">
            {myScheduledTrips.map(trip => {
              const vehicle = vehicles.find(v => v.id === trip.vehicleId);
              const tripDate = new Date(trip.scheduledDate + 'T00:00:00');
              return (
                <div key={trip.id} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between group gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex flex-col items-center justify-center font-write shrink-0">
                      <span className="text-xs">{tripDate.getDate()}</span>
                      <span className="text-[8px] uppercase">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{trip.destination}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{vehicle?.plate} • {vehicle?.model}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onStartSchedule?.(trip.id)}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-write uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-play"></i> Iniciar Jornada
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {resolvingMaint && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-amber-500 text-white">
              <h3 className="text-lg font-write uppercase">Liberar {resolvingMaint.plate}</h3>
              <p className="text-[10px] font-bold text-amber-100 uppercase mt-1">O veículo voltará a ficar disponível para motoristas</p>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-write text-slate-400 uppercase mb-2">KM Atual na Saída da Oficina</label>
                <input 
                  type="number" 
                  value={resKm}
                  onChange={(e) => setResKm(parseInt(e.target.value))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-write text-xl text-center focus:ring-2 focus:ring-amber-500 outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setResolvingMaint(null)} className="flex-1 py-3 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
                <button onClick={handleResolveMaintQuick} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-write uppercase text-[10px] shadow-lg shadow-emerald-100">Confirmar Retorno</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFinishModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-emerald-600 text-white">
              <h3 className="text-lg font-write uppercase">Finalizar Percurso</h3>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-write text-slate-400 uppercase mb-2 tracking-widest">Hodômetro Final (KM)</label>
                <input 
                  type="number"
                  value={endKm}
                  onChange={(e) => setEndKm(parseInt(e.target.value))}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-write text-2xl text-slate-800 text-center"
                  placeholder="0"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Despesa Combustível (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={fuelExpense}
                      onChange={(e) => setFuelExpense(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Outras Despesas (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                    <input 
                      type="number"
                      step="0.01"
                      value={otherExpense}
                      onChange={(e) => setOtherExpense(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Observações das Despesas</label>
                <textarea 
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Ex: Pedágio, Alimentação, Estacionamento..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFinishModal(false)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
                <button onClick={confirmFinish} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-emerald-100">Confirmar Chegada</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Veículos Livres</p>
           <div className="flex items-center justify-between">
             <span className="text-3xl font-write text-slate-800">{fleetStats.available}</span>
             <i className="fas fa-check-circle text-emerald-500 text-2xl opacity-20"></i>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Viagens Ativas</p>
           <div className="flex items-center justify-between">
             <span className="text-3xl font-write text-slate-800">{fleetStats.inUse}</span>
             <i className="fas fa-truck-fast text-blue-500 text-2xl opacity-20"></i>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Manutenção</p>
           <div className="flex items-center justify-between">
             <span className="text-3xl font-write text-slate-800">{fleetStats.maintenance}</span>
             <i className="fas fa-wrench text-red-500 text-2xl opacity-20"></i>
           </div>
        </div>
      </div>

      {/* Status da Frota em Tempo Real */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-satellite text-blue-500"></i> Status da Frota em Tempo Real
          </h3>
          <span className="text-[10px] font-bold text-slate-300 uppercase">Total: {vehicles.length} Veículos</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {vehicles.map(v => {
            const config = getStatusConfig(v.status);
            return (
              <div key={v.id} className={`${config.bg} p-4 rounded-2xl border border-white shadow-sm flex flex-col items-center text-center transition-all hover:scale-105 group`}>
                <div className={`${config.color} text-xl mb-2 transition-transform group-hover:rotate-12`}>
                  <i className={`fas ${config.icon}`}></i>
                </div>
                <p className="text-xs font-write text-slate-800 uppercase tracking-tighter truncate w-full">{v.plate}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase truncate w-full mb-1">{v.model}</p>
                <span className={`${config.color} text-[8px] font-write uppercase tracking-widest`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
            <i className="fas fa-brain text-blue-500"></i> Insights da IA
          </h3>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-slate-600 text-sm leading-relaxed">
            {aiInsights}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
