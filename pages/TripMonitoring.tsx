
import React, { useState, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { Trip, Vehicle } from '../types';

// Componente de Cronômetro Individual
const TripTimer: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, new Date().getTime() - new Date(startTime).getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="font-mono text-xs text-blue-400 font-bold tabular-nums tracking-widest">{elapsed}</span>;
};

// Componente de Barra de Progresso Simulada
const SimulatedProgress: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const elapsedMs = now - start;
      const estimatedDuration = 14400000; 
      const calculated = Math.min(98, (elapsedMs / estimatedDuration) * 100);
      setProgress(calculated);
    };
    calculate();
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden border border-white/5">
      <div 
        className="h-full bg-blue-600 transition-all duration-1000 ease-in-out relative"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 animate-pulse"></div>
      </div>
    </div>
  );
};

const TripMonitoring: React.FC = () => {
  const { activeTrips, vehicles, drivers, updateTrip, endTrip, cancelTrip } = useFleet();
  const [finishingTripId, setFinishingTripId] = useState<string | null>(null);
  const [cancellingTripId, setCancellingTripId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<number>(0);
  const [otherExpense, setOtherExpense] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  
  const [editingRouteTrip, setEditingRouteTrip] = useState<Trip | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({ destination: '', waypoints: [] as string[] });
  const [visibleMaps, setVisibleMaps] = useState<Record<string, boolean>>({});

  const toggleMapVisibility = (tripId: string) => {
    setVisibleMaps(prev => ({ ...prev, [tripId]: !prev[tripId] }));
  };

  const handleOpenEditRoute = (trip: Trip) => {
    setEditingRouteTrip(trip);
    setEditRouteForm({ destination: trip.destination, waypoints: trip.waypoints || [] });
  };

  const handleOpenExternalMap = (trip: Trip) => {
    const origin = encodeURIComponent(trip.origin || '');
    const dest = encodeURIComponent(`${trip.destination}${trip.city ? ', ' + trip.city : ''}`);
    const wps = trip.waypoints && trip.waypoints.length > 0 
      ? `&waypoints=${trip.waypoints.map((w: string) => encodeURIComponent(w)).join('|')}` 
      : '';
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps}&travelmode=driving`, '_blank');
  };

  const handleUpdateActiveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRouteTrip) {
      updateTrip(editingRouteTrip.id, {
        destination: editRouteForm.destination,
        waypoints: editRouteForm.waypoints.filter(w => w.trim() !== '')
      });
      setEditingRouteTrip(null);
      alert('Rota atualizada!');
    }
  };

  const confirmFinish = () => {
    if (finishingTripId) {
      endTrip(finishingTripId, endKm, new Date().toISOString(), {
        fuel: fuelExpense,
        other: otherExpense,
        notes: expenseNotes
      });
      setFinishingTripId(null);
      alert('Operação encerrada!');
    }
  };

  const handleConfirmRemoteCancel = () => {
    if (!cancellingTripId || !cancelReason.trim()) {
      alert("O motivo do cancelamento é obrigatório para fins de auditoria.");
      return;
    }

    cancelTrip(cancellingTripId, cancelReason.trim());
    setCancellingTripId(null);
    setCancelReason('');
    alert('Operação cancelada remotamente. O evento foi registrado no log de auditoria.');
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-write text-slate-800 uppercase tracking-tight">Monitoramento em Tempo Real</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Status Geográfico da Frota Ativa</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-write uppercase tracking-widest">{activeTrips.length} Online</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {activeTrips.length > 0 ? activeTrips.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          const driver = drivers.find(d => d.id === trip.driverId);
          const isMapVisible = visibleMaps[trip.id] ?? false;
          
          return (
            <div key={trip.id} className="bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-blue-400/30 overflow-hidden flex flex-col transition-all duration-500 animate-in zoom-in-95">
              
              <div className="flex flex-col">
                {/* Informações da Viagem */}
                <div className="p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/5 rounded-full flex flex-col items-center justify-center border border-white/10 text-white font-mono text-[10px] font-bold shadow-inner uppercase">
                        <span className="opacity-60 text-[8px] mb-0.5">Placa</span>
                        {vehicle?.plate}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-write text-base uppercase tracking-tight truncate">{vehicle?.model}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">{driver?.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleOpenExternalMap(trip)} className="w-10 h-10 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/5"><i className="fas fa-external-link-alt text-xs"></i></button>
                      <button onClick={() => toggleMapVisibility(trip.id)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isMapVisible ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'}`}><i className="fas fa-map text-xs"></i></button>
                      <button onClick={() => handleOpenEditRoute(trip)} className="w-10 h-10 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/5"><i className="fas fa-route text-xs"></i></button>
                    </div>
                  </div>

                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-write text-slate-400 uppercase tracking-widest">Tempo Decorrido</span>
                      <TripTimer startTime={trip.startTime} />
                    </div>
                    <SimulatedProgress startTime={trip.startTime} />
                  </div>

                  {isMapVisible && (
                    <div className="w-full h-64 bg-slate-800 rounded-3xl overflow-hidden relative group animate-in slide-in-from-top duration-500 border border-white/10">
                      <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.9)' }}
                        src={`https://www.google.com/maps?saddr=${encodeURIComponent(trip.origin || '')}&daddr=${encodeURIComponent(trip.destination + ', ' + (trip.city || ''))}&output=embed`}
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Próxima Parada</p>
                      <p className="text-xs text-white font-bold truncate uppercase">{trip.destination}</p>
                      <p className="text-[10px] text-blue-400 font-bold uppercase">{trip.city} / {trip.state}</p>
                    </div>

                    {trip.observations && (
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-right-2">
                        <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">
                          <i className="fas fa-clipboard-list text-[10px]"></i> Diário de Bordo
                        </p>
                        <div className="max-h-24 overflow-y-auto custom-scrollbar pr-1">
                          <p className="text-[10px] text-slate-300 font-medium leading-relaxed italic line-clamp-3">
                            {trip.observations}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => { setFinishingTripId(trip.id); setEndKm(vehicle?.currentKm || 0); }} 
                      className="flex-[3] py-5 bg-emerald-500/90 hover:bg-emerald-400 text-white rounded-2xl font-write text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-950/20 active:scale-95"
                    >
                      Encerrar
                    </button>
                    <button 
                      onClick={() => setCancellingTripId(trip.id)}
                      className="flex-1 py-5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl font-write text-sm uppercase transition-all border border-red-600/20 flex items-center justify-center shadow-lg"
                    >
                      <i className="fas fa-ban"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="xl:col-span-2 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center text-3xl"><i className="fas fa-satellite"></i></div>
            <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.3em]">Nenhum ativo rastreado no momento</p>
          </div>
        )}
      </div>

      {/* Modal de Cancelamento Remoto (Admin) */}
      {cancellingTripId && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="text-center">
               <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                 <i className="fas fa-user-shield"></i>
               </div>
               <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight">Interrupção Remota</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">O motivo do cancelamento é mandatório para o registro de auditoria.</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-red-100">
               <textarea 
                 autoFocus
                 value={cancelReason} 
                 onChange={(e) => setCancelReason(e.target.value)} 
                 className="w-full bg-transparent outline-none font-write text-sm text-slate-950 min-h-[100px]" 
                 placeholder="Descreva o motivo administrativo do cancelamento..." 
               />
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setCancellingTripId(null); setCancelReason(''); }} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button 
                onClick={handleConfirmRemoteCancel} 
                disabled={!cancelReason.trim()}
                className="flex-[2] py-5 bg-red-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-red-100 transition-all disabled:opacity-20"
              >
                Confirmar Interrupção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalizar Remoto */}
      {finishingTripId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden custom-scrollbar overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-emerald-600 text-white">
              <h3 className="text-xl font-write uppercase tracking-tight">Encerrar Operação</h3>
              <p className="text-[10px] text-emerald-100 font-bold uppercase mt-1 tracking-widest">Ação Administrativa Remota</p>
            </div>
            <div className="p-10 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 text-center font-bold tracking-widest">KM Final Registrado (Painel)</label>
                <input type="number" value={endKm} onChange={(e) => setEndKm(parseInt(e.target.value) || 0)} className="w-full px-5 py-5 bg-transparent outline-none font-write text-3xl text-slate-900 text-center" />
              </div>
              <div className="flex gap-4 pt-6">
                <button onClick={() => setFinishingTripId(null)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Voltar</button>
                <button onClick={confirmFinish} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-100">Finalizar Rota</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMonitoring;
