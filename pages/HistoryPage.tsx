
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';

const HistoryPage: React.FC = () => {
  const { completedTrips, vehicles, drivers, currentUser } = useFleet();
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = currentUser?.username === 'admin';
  
  const myTrips = completedTrips.filter(t => 
    isAdmin ? true : t.driverId === currentUser?.id
  );

  const filteredHistory = myTrips.filter(t => {
    const vehicle = vehicles.find(v => v.id === t.vehicleId);
    const driver = drivers.find(d => d.id === t.driverId);
    const searchString = `${vehicle?.plate} ${driver?.name} ${t.destination} ${t.origin} ${t.city}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

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
          <h2 className="text-2xl font-bold text-slate-800">Histórico de Viagens</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Registro Geral da Frota' : 'Minhas Jornadas Concluídas'}
          </p>
        </div>
        
        <div className="relative flex-1 max-w-md">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            type="text" 
            placeholder="Buscar por placa, destino ou cidade..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredHistory.length > 0 ? (
          filteredHistory.map(trip => {
            const vehicle = vehicles.find(v => v.id === trip.vehicleId);
            const driver = drivers.find(d => d.id === trip.driverId);
            const dateObj = new Date(trip.startTime);
            const totalExpenses = (trip.fuelExpense || 0) + (trip.otherExpense || 0);

            return (
              <div key={trip.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col items-stretch gap-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-full md:w-32 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
                    <span className="text-2xl font-write text-slate-800">{dateObj.getDate()}</span>
                    <span className="text-[10px] font-write text-slate-400 uppercase tracking-widest">{dateObj.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    <span className="text-[9px] font-bold text-slate-300 mt-1">{dateObj.getFullYear()}</span>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
                    <div>
                      <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">Veículo</p>
                      <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono">{vehicle?.plate}</span>
                        {vehicle?.model}
                      </div>
                    </div>
                    
                    {isAdmin && (
                      <div>
                        <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">Condutor</p>
                        <p className="text-sm font-bold text-slate-800">{driver?.name}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">Trajeto (Partida → Destino)</p>
                      <p className="text-xs text-slate-500 truncate mb-1">De: {trip.origin || 'Não informado'}</p>
                      <p className="text-sm font-bold text-slate-800 truncate">Para: {trip.destination}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{trip.city}, {trip.state}</p>
                    </div>

                    <div className="text-right md:text-left">
                      <p className="text-[9px] font-write text-slate-400 uppercase mb-1 tracking-widest">Distância / Tempo</p>
                      <p className="text-sm font-write text-blue-600">{trip.distance?.toFixed(1) || '0.0'} KM</p>
                      <p className="text-[10px] text-slate-400 font-medium">{new Date(trip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} até {trip.endTime ? new Date(trip.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => handleOpenMap(trip)}
                      className="flex-1 md:w-12 md:h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-all border border-indigo-100"
                      title="Ver Rota no Google Maps"
                    >
                      <i className="fas fa-map-location-dot"></i>
                    </button>
                    <button className="flex-1 md:w-12 md:h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all">
                      <i className="fas fa-file-invoice"></i>
                    </button>
                  </div>
                </div>

                {/* Expenses Details */}
                {(totalExpenses > 0 || trip.expenseNotes) && (
                  <div className="mt-2 pt-4 border-t border-slate-50 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                         <i className="fas fa-gas-pump"></i>
                       </div>
                       <div>
                         <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest">Combustível</p>
                         <p className="text-xs font-bold text-slate-700">R$ {trip.fuelExpense?.toFixed(2) || '0.00'}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                         <i className="fas fa-receipt"></i>
                       </div>
                       <div>
                         <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest">Outras Despesas</p>
                         <p className="text-xs font-bold text-slate-700">R$ {trip.otherExpense?.toFixed(2) || '0.00'}</p>
                       </div>
                    </div>
                    {trip.expenseNotes && (
                      <div className="flex-1 min-w-[200px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic text-[10px] text-slate-500">
                        <span className="font-write uppercase text-[8px] text-slate-400 block mb-0.5">Notas de Despesa</span>
                        {trip.expenseNotes}
                      </div>
                    )}
                    <div className="ml-auto text-right">
                       <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest">Total Gasto</p>
                       <p className="text-sm font-write text-slate-900">R$ {totalExpenses.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
              <i className="fas fa-box-open text-3xl"></i>
            </div>
            <p className="text-slate-400 font-write uppercase text-[10px] tracking-[0.2em]">Nenhum registro encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
