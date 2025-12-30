
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getFleetStatsAnalysis } from '../services/geminiService';
import { VehicleStatus, OccurrenceSeverity, Trip, MaintenanceRecord } from '../types';

interface DashboardOverviewProps {
  onStartSchedule?: (id: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartSchedule }) => {
  const { vehicles, drivers, activeTrips, scheduledTrips, notifications, checklists, occurrences, maintenanceRecords, currentUser, updateTrip, endTrip, resolveMaintenance } = useFleet();
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
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [endKm, setEndKm] = useState<number>(0);

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
      resolveMaintenance(resolvingMaint.vehicleId, resolvingMaint.recordId, resKm, new Date().toISOString());
      setResolvingMaint(null);
      alert(`Veículo ${resolvingMaint.plate} liberado para uso!`);
    }
  };

  const handleFinalArrival = () => {
    if (myActiveTrip) {
      const vehicle = vehicles.find(v => v.id === myActiveTrip.vehicleId);
      setEndKm(vehicle?.currentKm || 0);
      setShowFinishModal(true);
    }
  };

  const confirmFinish = () => {
    if (myActiveTrip) {
      const deviceTime = new Date().toISOString();
      endTrip(myActiveTrip.id, endKm, deviceTime);
      setShowFinishModal(false);
      alert('Viagem encerrada! Obrigado pela jornada.');
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
            </div>

            <div className="w-full md:w-64 flex flex-col gap-3 justify-center">
              <button 
                onClick={handleFinalArrival}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-write text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40"
              >
                <i className="fas fa-check-circle mr-2"></i> Cheguei ao Local
              </button>
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
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-write text-slate-400 uppercase mb-3 tracking-widest">Hodômetro Final (KM)</label>
                <input 
                  type="number"
                  value={endKm}
                  onChange={(e) => setEndKm(parseInt(e.target.value))}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-write text-2xl text-slate-800 text-center"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowFinishModal(false)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
                {/* Fixed: Removed non-existent 'confirmFinish' prop from button element */}
                <button onClick={confirmFinish} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-emerald-100">Confirmar Chegada</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
