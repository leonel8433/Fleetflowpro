
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

  return <span className="font-mono text-sm text-blue-400 font-bold tabular-nums tracking-widest">{elapsed}</span>;
};

// Componente de Barra de Progresso Simulada
const SimulatedProgress: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const elapsedMs = now - start;
      // Simulamos que uma viagem média dura 4 horas (14.400.000 ms)
      const estimatedDuration = 14400000; 
      const calculated = Math.min(98, (elapsedMs / estimatedDuration) * 100);
      setProgress(calculated);
    };
    calculate();
    const interval = setInterval(calculate, 30000); // Atualiza a cada 30s
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-1000 ease-in-out relative"
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
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<number>(0);
  const [otherExpense, setOtherExpense] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  
  const [editingRouteTrip, setEditingRouteTrip] = useState<Trip | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({ destination: '', waypoints: [] as string[] });

  const handleOpenEditRoute = (trip: Trip) => {
    setEditingRouteTrip(trip);
    setEditRouteForm({ destination: trip.destination, waypoints: trip.waypoints || [] });
  };

  const handleUpdateActiveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRouteTrip) {
      updateTrip(editingRouteTrip.id, {
        destination: editRouteForm.destination,
        waypoints: editRouteForm.waypoints.filter(w => w.trim() !== '')
      });
      setEditingRouteTrip(null);
      alert('Rota do condutor atualizada remotamente!');
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
      setFuelExpense(0);
      setOtherExpense(0);
      setExpenseNotes('');
      alert('Operação encerrada com sucesso!');
    }
  };

  const handleAdminCancelTrip = (tripId: string) => {
    if (window.confirm('Como administrador, deseja CANCELAR esta viagem? O veículo e motorista ficarão disponíveis imediatamente e nenhum registro histórico de conclusão será salvo.')) {
      cancelTrip(tripId);
      alert('Viagem cancelada pelo administrador.');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monitoramento em Tempo Real</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status Geográfico da Frota Ativa</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
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
          
          return (
            <div key={trip.id} className="bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden flex flex-col md:flex-row h-full animate-in zoom-in-95 duration-500">
              {/* Mapa Embarcado (Lado Esquerdo) */}
              <div className="w-full md:w-1/2 h-64 md:h-auto bg-slate-800 relative group">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.9) contrast(1.2)' }}
                  src={`https://www.google.com/maps?saddr=${encodeURIComponent(trip.origin)}&daddr=${encodeURIComponent(trip.destination + ', ' + trip.city)}&output=embed`}
                  allowFullScreen
                ></iframe>
                <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 pointer-events-none">
                   <i className="fas fa-location-arrow text-blue-500 text-xs"></i>
                   <span className="text-[9px] text-white font-write uppercase tracking-widest">Tracking Ativo</span>
                </div>
              </div>

              {/* Informações da Viagem (Lado Direito) */}
              <div className="flex-1 p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 text-white font-mono text-sm shadow-inner">
                        {vehicle?.plate}
                      </div>
                      <div>
                        <h4 className="text-white font-write text-sm uppercase tracking-tight truncate max-w-[150px]">{vehicle?.model}</h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase">{driver?.name.split(' ')[0]}</p>
                      </div>
                    </div>
                    <button onClick={() => handleOpenEditRoute(trip)} className="w-10 h-10 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
                      <i className="fas fa-route"></i>
                    </button>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[8px] font-write text-slate-400 uppercase tracking-widest">Tempo Decorrido</span>
                      <TripTimer startTime={trip.startTime} />
                    </div>
                    <SimulatedProgress startTime={trip.startTime} />
                  </div>

                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Próxima Parada</p>
                    <p className="text-xs text-white font-bold truncate">{trip.destination}</p>
                    <p className="text-[10px] text-blue-400 font-medium uppercase">{trip.city} / {trip.state}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => { setFinishingTripId(trip.id); setEndKm(vehicle?.currentKm || 0); }} 
                    className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-write text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-900/20"
                  >
                    Encerrar
                  </button>
                  <button 
                    onClick={() => handleAdminCancelTrip(trip.id)}
                    className="flex-1 py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl font-write text-[10px] uppercase tracking-[0.2em] transition-all border border-red-600/20 flex items-center justify-center"
                    title="Cancelar Viagem"
                  >
                    <i className="fas fa-ban"></i>
                  </button>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="xl:col-span-2 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center text-3xl">
              <i className="fas fa-satellite"></i>
            </div>
            <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.3em]">Nenhum ativo rastreado no momento</p>
          </div>
        )}
      </div>

      {/* Modal Alterar Rota Remotamente */}
      {editingRouteTrip && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-write uppercase tracking-tight">Intervenção de Rota</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Alterar destino do condutor {drivers.find(d => d.id === editingRouteTrip.driverId)?.name}</p>
              </div>
              <button onClick={() => setEditingRouteTrip(null)} className="w-10 h-10 flex items-center justify-center"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleUpdateActiveRoute} className="p-10 space-y-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3">Novo Local de Desembarque</label>
                <input 
                  required 
                  value={editRouteForm.destination} 
                  onChange={(e) => setEditRouteForm({ ...editRouteForm, destination: e.target.value })} 
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 text-lg" 
                />
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setEditingRouteTrip(null)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-write uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200">Atualizar Rota</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Finalizar Remoto */}
      {finishingTripId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden custom-scrollbar overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-emerald-600 text-white">
              <h3 className="text-xl font-write uppercase tracking-tight">Encerrar Operação Remotamente</h3>
              <p className="text-[10px] text-emerald-100 font-bold uppercase mt-1 tracking-widest">Ação de Gestão Administrativa</p>
            </div>
            <div className="p-10 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 text-center font-bold tracking-widest">Odômetro Final no Painel (KM)</label>
                <input 
                  type="number" 
                  value={endKm} 
                  onChange={(e) => setEndKm(parseInt(e.target.value) || 0)} 
                  className="w-full px-5 py-5 bg-transparent outline-none font-write text-2xl text-slate-900 text-center" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-[9px] font-write text-slate-400 uppercase mb-2 tracking-widest font-bold">Combustível (R$)</label>
                  <input type="number" step="0.01" value={fuelExpense} onChange={(e) => setFuelExpense(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none font-write text-xl text-slate-950" placeholder="0,00" />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-[9px] font-write text-slate-400 uppercase mb-2 tracking-widest font-bold">Outros Custos (R$)</label>
                  <input type="number" step="0.01" value={otherExpense} onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)} className="w-full bg-transparent outline-none font-write text-xl text-slate-950" placeholder="0,00" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-[9px] font-write text-slate-400 uppercase mb-2 tracking-widest font-bold">Relato de Ocorrência</label>
                <textarea value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} className="w-full bg-transparent outline-none font-write text-xs text-slate-950 min-h-[80px]" placeholder="Informações adicionais sobre o trajeto..." />
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
