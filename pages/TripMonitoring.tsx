
import React, { useState, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { Trip, Vehicle, Occurrence, OccurrenceSeverity } from '../types';
import { getOptimizedRoute } from '../services/geminiService';

const TripMonitoring: React.FC = () => {
  const { activeTrips, vehicles, drivers, occurrences, updateTrip, endTrip, cancelTrip, addOccurrence } = useFleet();
  const [finishingTripId, setFinishingTripId] = useState<string | null>(null);
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<string>('0');
  const [otherExpense, setOtherExpense] = useState<string>('0');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [now, setNow] = useState(new Date());

  // Route Editing State
  const [editingRouteTrip, setEditingRouteTrip] = useState<Trip | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({
    destination: '',
    waypoints: [] as string[]
  });

  // Optimization State
  const [optimizingTripId, setOptimizingTripId] = useState<string | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<{text: string, grounding: any[]} | null>(null);
  const [loadingOptimization, setLoadingOptimization] = useState(false);

  // Occurrence Modal State
  const [reportingTrip, setReportingTrip] = useState<Trip | null>(null);
  const [newOccurrence, setNewOccurrence] = useState({
    type: '',
    description: '',
    severity: OccurrenceSeverity.LOW
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getTripStatus = (trip: Trip) => {
    if (!trip.plannedArrival) return { label: 'Em Rota', color: 'bg-blue-100 text-blue-700', icon: 'fa-truck-moving' };
    const arrivalTime = new Date(trip.plannedArrival).getTime();
    const currentTime = now.getTime();
    if (currentTime > arrivalTime) return { label: 'Atrasado', color: 'bg-red-100 text-red-700 animate-pulse', icon: 'fa-clock' };
    return { label: 'Em Rota', color: 'bg-blue-100 text-blue-700', icon: 'fa-truck-moving' };
  };

  const handleOpenEditRoute = (trip: Trip) => {
    setEditingRouteTrip(trip);
    setEditRouteForm({
      destination: trip.destination,
      waypoints: trip.waypoints || []
    });
  };

  const handleUpdateActiveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRouteTrip) {
      updateTrip(editingRouteTrip.id, {
        destination: editRouteForm.destination,
        waypoints: editRouteForm.waypoints.filter(w => w.trim() !== '')
      });
      setEditingRouteTrip(null);
      alert('Rota atualizada! O motorista receberá os novos dados.');
    }
  };

  const handleAddWaypointEdit = () => {
    setEditRouteForm(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  };

  const handleUpdateWaypointEdit = (idx: number, val: string) => {
    const wps = [...editRouteForm.waypoints];
    wps[idx] = val;
    setEditRouteForm(prev => ({ ...prev, waypoints: wps }));
  };

  const handleRemoveWaypointEdit = (idx: number) => {
    setEditRouteForm(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== idx) }));
  };

  const handleFinish = (trip: Trip) => {
    const vehicle = vehicles.find(v => v.id === trip.vehicleId);
    setFinishingTripId(trip.id);
    setEndKm(vehicle?.currentKm || 0);
    setFuelExpense('0');
    setOtherExpense('0');
    setExpenseNotes('');
  };

  const confirmFinish = () => {
    if (finishingTripId) {
      const deviceTime = new Date().toISOString();
      endTrip(finishingTripId, endKm, deviceTime, {
        fuel: parseFloat(fuelExpense) || 0,
        other: parseFloat(otherExpense) || 0,
        notes: expenseNotes
      });
      setFinishingTripId(null);
      alert('Viagem encerrada com sucesso!');
    }
  };

  const handleOptimize = async (trip: Trip) => {
    setOptimizingTripId(trip.id);
    setLoadingOptimization(true);
    try {
      const result = await getOptimizedRoute(trip.origin, trip.destination, trip.waypoints);
      setOptimizationResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingOptimization(false);
    }
  };

  const handleReportOccurrence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingTrip || !newOccurrence.type || !newOccurrence.description) return;
    const occ: Occurrence = {
      id: Math.random().toString(36).substr(2, 9),
      tripId: reportingTrip.id,
      vehicleId: reportingTrip.vehicleId,
      driverId: reportingTrip.driverId,
      type: newOccurrence.type,
      description: newOccurrence.description,
      severity: newOccurrence.severity,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    addOccurrence(occ);
    setReportingTrip(null);
    setNewOccurrence({ type: '', description: '', severity: OccurrenceSeverity.LOW });
    alert('Ocorrência registrada.');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Monitoramento de Viagens</h2>
        <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
          {activeTrips.length} Ativas
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeTrips.length > 0 ? (
          activeTrips.map(trip => {
            const vehicle = vehicles.find(v => v.id === trip.vehicleId);
            const driver = drivers.find(d => d.id === trip.driverId);
            const status = getTripStatus(trip);
            const tripOccurrences = occurrences.filter(o => o.tripId === trip.id);
            
            return (
              <div key={trip.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-lg transition-all relative">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-mono text-xs">
                      {vehicle?.plate}
                    </div>
                    <p className="text-sm font-bold truncate leading-tight">{vehicle?.model}</p>
                  </div>
                  <button onClick={() => handleOpenEditRoute(trip)} className="text-[9px] font-write uppercase tracking-widest text-blue-400 hover:text-white transition-colors">
                    Alterar Rota
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${status.color}`}>
                      <i className={`fas ${status.icon}`}></i>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 border-b border-slate-50 pb-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border overflow-hidden">
                      {driver?.avatar ? <img src={driver.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">{driver?.name.charAt(0)}</div>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{driver?.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase">CNH: {driver?.license}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleOptimize(trip)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100" title="Otimizar">
                        <i className="fas fa-wand-magic-sparkles"></i>
                      </button>
                      <button onClick={() => setReportingTrip(trip)} className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100" title="Ocorrência">
                        <i className="fas fa-triangle-exclamation"></i>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Origem</p>
                      <p className="text-sm text-slate-700 font-medium truncate">{trip.origin}</p>
                    </div>
                    
                    {trip.waypoints && trip.waypoints.length > 0 && (
                      <div className="pl-2 border-l-2 border-slate-100 space-y-1">
                        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Paradas ({trip.waypoints.length})</p>
                        {trip.waypoints.map((wp, i) => (
                          <p key={i} className="text-[10px] text-slate-500 font-medium truncate">• {wp}</p>
                        ))}
                      </div>
                    )}

                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Destino</p>
                      <p className="text-sm text-slate-800 font-bold truncate">{trip.destination}</p>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button onClick={() => handleFinish(trip)} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-700 shadow-md">
                      Encerrar Viagem
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
            <p className="text-slate-400 text-sm mt-2">Nenhuma viagem em andamento.</p>
          </div>
        )}
      </div>

      {/* Modal Alterar Rota */}
      {editingRouteTrip && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="text-lg font-write uppercase">Alterar Rota Ativa</h3>
              <button onClick={() => setEditingRouteTrip(null)} className="text-slate-400 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleUpdateActiveRoute} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 tracking-widest">Novo Destino Final</label>
                <input 
                  required
                  value={editRouteForm.destination}
                  onChange={(e) => setEditRouteForm(prev => ({ ...prev, destination: e.target.value }))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Paradas Intermediárias</label>
                  <button type="button" onClick={handleAddWaypointEdit} className="text-[10px] font-write text-blue-600 uppercase tracking-widest"><i className="fas fa-plus"></i> Adicionar</button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
                  {editRouteForm.waypoints.map((wp, i) => (
                    <div key={i} className="flex gap-2">
                      <input 
                        value={wp}
                        onChange={(e) => handleUpdateWaypointEdit(i, e.target.value)}
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
                        placeholder={`Parada ${i+1}`}
                      />
                      <button type="button" onClick={() => handleRemoveWaypointEdit(i)} className="text-red-300 hover:text-red-500"><i className="fas fa-trash-alt"></i></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-50">
                <button type="button" onClick={() => setEditingRouteTrip(null)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-blue-100">Atualizar Rota</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Finishing Modal */}
      {finishingTripId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white">
              <h3 className="text-lg font-bold">Encerrar Viagem</h3>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-write text-slate-400 uppercase mb-3">KM Atual (Hodômetro)</label>
                <input 
                  type="number"
                  value={endKm}
                  onChange={(e) => setEndKm(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-write text-lg text-slate-800 text-center"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Combustível (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={fuelExpense}
                    onChange={(e) => setFuelExpense(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Outras (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={otherExpense}
                    onChange={(e) => setOtherExpense(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Anotações Despesas</label>
                <textarea 
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                  placeholder="Descrição opcional..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setFinishingTripId(null)} className="flex-1 py-3 text-slate-400 font-write uppercase text-[10px]">Voltar</button>
                <button onClick={confirmFinish} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs">Finalizar Agora</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripMonitoring;
