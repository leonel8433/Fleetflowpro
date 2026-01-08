
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';

const HistoryPage: React.FC = () => {
  const { completedTrips, vehicles, drivers, currentUser, auditLogs } = useFleet();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'trips' | 'audit'>('trips');

  const isAdmin = currentUser?.username === 'admin';
  
  const myTrips = completedTrips.filter(t => 
    isAdmin ? true : t.driverId === currentUser?.id
  );

  const filteredHistory = myTrips.filter(t => {
    const vehicle = vehicles.find(v => v.id === t.vehicleId);
    const driver = drivers.find(d => d.id === t.driverId);
    const searchString = `${vehicle?.plate} ${driver?.name} ${t.destination} ${t.origin} ${t.city} ${t.cancellationReason || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const getDuration = (start: string, end?: string) => {
    if (!end) return 'N/A';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diff = Math.max(0, e - s);
    
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleOpenMap = (trip: any) => {
    const origin = encodeURIComponent(trip.origin || '');
    const dest = encodeURIComponent(`${trip.destination}${trip.city ? ', ' + trip.city : ''}`);
    const wps = trip.waypoints && trip.waypoints.length > 0 
      ? `&waypoints=${trip.waypoints.map((w: string) => encodeURIComponent(w)).join('|')}` 
      : '';
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps}&travelmode=driving`, '_blank');
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Relatório de Jornadas</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Registro Operacional Completo' : 'Suas Jornadas Finalizadas e Canceladas'}
          </p>
        </div>
        
        <div className="relative flex-1 max-w-md">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            type="text" 
            placeholder="Filtrar por placa, motorista ou local..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveView('trips')}
          className={`px-6 py-2.5 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all ${activeView === 'trips' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
        >
          Histórico de Viagens
        </button>
        {isAdmin && (
          <button 
            onClick={() => setActiveView('audit')}
            className={`px-6 py-2.5 rounded-xl font-write text-[10px] uppercase tracking-widest transition-all ${activeView === 'audit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
          >
            Log de Auditoria
          </button>
        )}
      </div>

      {activeView === 'trips' ? (
        <div className="space-y-4">
          {filteredHistory.length > 0 ? (
            filteredHistory.map(trip => {
              const vehicle = vehicles.find(v => v.id === trip.vehicleId);
              const driver = drivers.find(d => d.id === trip.driverId);
              const dateObj = new Date(trip.startTime);
              const totalExpenses = (trip.fuelExpense || 0) + (trip.otherExpense || 0);

              return (
                <div key={trip.id} className={`bg-white p-6 rounded-3xl shadow-sm border group hover:shadow-md transition-all flex flex-col gap-6 ${trip.isCancelled ? 'border-red-100 opacity-90' : 'border-slate-100'}`}>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className={`w-full md:w-32 flex flex-col items-center justify-center p-4 rounded-2xl border shrink-0 shadow-inner ${trip.isCancelled ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className={`text-2xl font-write ${trip.isCancelled ? 'text-red-700' : 'text-slate-800'}`}>{dateObj.getDate()}</span>
                      <span className="text-[10px] font-write text-slate-400 uppercase tracking-widest">{dateObj.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
                      <div>
                        <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">Ativo / Condutor</p>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-widest ${trip.isCancelled ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>{vehicle?.plate}</span>
                          <p className="text-xs font-bold text-slate-800 truncate">{driver?.name}</p>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">Rota {trip.isCancelled ? 'Cancelada' : 'Finalizada'}</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{trip.destination}</p>
                        <p className="text-[10px] text-slate-400 font-medium italic">{trip.city}, {trip.state}</p>
                      </div>

                      <div className="text-right md:text-left flex flex-col">
                        <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">
                          {trip.isCancelled ? 'Status Operacional' : 'Tempo Gasto'}
                        </p>
                        {trip.isCancelled ? (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-xl text-[10px] font-write uppercase w-fit border border-red-200">
                             Interrompida
                          </span>
                        ) : (
                          <span className="bg-blue-600 text-white px-3 py-1 rounded-xl text-xs font-bold w-fit flex items-center gap-2 shadow-sm">
                            <i className="fas fa-stopwatch"></i> {getDuration(trip.startTime, trip.endTime)}
                          </span>
                        )}
                        <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase">{trip.distance?.toFixed(1) || '0.0'} KM Percorridos</p>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleOpenMap(trip)} className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white border border-indigo-100 transition-all shadow-sm">
                        <i className="fas fa-map-location-dot"></i>
                      </button>
                    </div>
                  </div>

                  {trip.isCancelled && (
                    <div className="pt-4 border-t border-red-100 bg-red-50/30 p-5 rounded-2xl">
                       <div className="flex items-center gap-3 mb-2">
                          <i className="fas fa-ban text-red-500"></i>
                          <p className="text-[10px] font-write text-red-700 uppercase tracking-widest">Motivo do Cancelamento (Obrigatório)</p>
                       </div>
                       <p className="text-xs text-red-800 font-medium italic leading-relaxed">
                         "{trip.cancellationReason}"
                       </p>
                       <p className="text-[9px] text-red-400 font-bold uppercase mt-3">Cancelado por: {trip.cancelledBy} em {new Date(trip.endTime || '').toLocaleString()}</p>
                    </div>
                  )}

                  {!trip.isCancelled && (totalExpenses > 0 || trip.expenseNotes) && (
                    <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-4 items-center bg-slate-50/50 p-4 rounded-2xl">
                      <div className="flex items-center gap-2">
                         <i className="fas fa-gas-pump text-slate-300"></i>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Abastecimento: <b className="text-slate-700 ml-1">R$ {trip.fuelExpense?.toFixed(2)}</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                         <i className="fas fa-file-invoice-dollar text-slate-300"></i>
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Extras: <b className="text-slate-700 ml-1">R$ {trip.otherExpense?.toFixed(2)}</b></span>
                      </div>
                      {trip.expenseNotes && (
                        <div className="flex-1 bg-white p-2.5 rounded-xl border border-slate-100 italic text-[10px] text-slate-500">
                          Obs: {trip.expenseNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.2em]">Sem registros históricos disponíveis</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          {auditLogs.length > 0 ? auditLogs.map(log => (
            <div key={log.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-5">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm ${
                 log.action === 'CANCELLED' ? 'bg-red-50 text-red-600 border-red-100' : 
                 log.action === 'ROUTE_CHANGE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                 'bg-blue-50 text-blue-600 border-blue-100'
               }`}>
                 <i className={`fas ${log.action === 'CANCELLED' ? 'fa-ban' : 'fa-route'}`}></i>
               </div>
               <div className="flex-1">
                 <div className="flex justify-between items-start mb-2">
                   <h4 className="text-xs font-write text-slate-800 uppercase tracking-tight">{log.userName} executou {log.action}</h4>
                   <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString()}</span>
                 </div>
                 <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                   {log.description}
                 </p>
                 <div className="mt-3 flex items-center gap-2">
                    <span className="text-[8px] font-bold text-slate-300 uppercase">ID Operação:</span>
                    <span className="text-[8px] font-mono text-slate-400">{log.entityId}</span>
                 </div>
               </div>
            </div>
          )) : (
            <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.2em]">Log de auditoria vazio</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
