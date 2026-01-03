
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, Trip } from '../types';

interface DashboardOverviewProps {
  onStartSchedule?: (id: string) => void;
  onNavigate?: (tab: string) => void; 
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartSchedule, onNavigate }) => {
  const { vehicles, activeTrips, scheduledTrips, currentUser, endTrip } = useFleet();
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  
  const isAdmin = currentUser?.username === 'admin';
  const myActiveTrip = useMemo(() => activeTrips.find(t => t.driverId === currentUser?.id), [activeTrips, currentUser]);
  
  const myScheduledTrips = useMemo(() => {
    if (isAdmin) return [];
    return scheduledTrips
      .filter(t => t.driverId === currentUser?.id)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [scheduledTrips, currentUser, isAdmin]);

  useEffect(() => {
    let interval: any;
    if (myActiveTrip) {
      interval = setInterval(() => {
        const start = new Date(myActiveTrip.startTime).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setElapsedTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [myActiveTrip]);

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<number>(0);
  const [otherExpense, setOtherExpense] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  const confirmFinish = () => {
    if (myActiveTrip) {
      if (endKm <= myActiveTrip.startKm) {
        alert("O KM final deve ser maior que o KM inicial.");
        return;
      }
      endTrip(myActiveTrip.id, endKm, new Date().toISOString(), {
        fuel: fuelExpense,
        other: otherExpense,
        notes: expenseNotes
      });
      
      // Reset states
      setShowFinishModal(false);
      setFuelExpense(0);
      setOtherExpense(0);
      setExpenseNotes('');
      
      alert('Viagem encerrada com sucesso! Histórico profissional atualizado.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-400 font-medium">Logado como: {currentUser?.name}</p>
        </div>
      </div>

      {!isAdmin && myActiveTrip && (
        <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative animate-in fade-in zoom-in duration-500 overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <i className="fas fa-truck-moving text-8xl"></i>
          </div>
          <div className="flex justify-between items-center mb-10 relative z-10">
            <span className="bg-emerald-500 text-white text-[10px] font-write px-4 py-1.5 rounded-full animate-pulse tracking-widest">EM OPERAÇÃO</span>
            <div className="flex flex-col items-end">
               <span className="text-[9px] font-write text-blue-400 uppercase tracking-widest mb-1">Cronômetro</span>
               <span className="text-4xl font-mono font-bold tracking-wider leading-none">{elapsedTime}</span>
            </div>
          </div>
          <div className="space-y-4 relative z-10">
             <div className="flex items-center gap-3">
                <span className="bg-white/10 px-3 py-1 rounded-lg font-mono text-xs">{vehicles.find(v => v.id === myActiveTrip.vehicleId)?.plate}</span>
                <h3 className="text-xl font-write uppercase tracking-tight">{vehicles.find(v => v.id === myActiveTrip.vehicleId)?.model}</h3>
             </div>
             <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Destino Final</p>
                <p className="text-sm font-bold truncate">{myActiveTrip.destination}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase mt-1">{myActiveTrip.city} - {myActiveTrip.state}</p>
             </div>
          </div>
          <div className="mt-8 flex gap-4 relative z-10">
             <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(myActiveTrip.destination)}`, '_blank')} className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <i className="fas fa-location-arrow"></i> Ver no GPS
             </button>
             <button onClick={() => { setEndKm(vehicles.find(v => v.id === myActiveTrip.vehicleId)?.currentKm || 0); setShowFinishModal(true); }} className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <i className="fas fa-flag-checkered"></i> Encerrar Rota
             </button>
          </div>
        </div>
      )}

      {!isAdmin && !myActiveTrip && myScheduledTrips.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-indigo-100">
          <h3 className="text-xs font-write text-indigo-900 uppercase tracking-widest mb-8 flex items-center gap-2">
            <i className="fas fa-calendar-check text-indigo-500"></i> Sua Agenda Hoje
          </h3>
          <div className="space-y-4">
            {myScheduledTrips.map(trip => (
              <div key={trip.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xl font-write text-indigo-600 leading-none">{new Date(trip.scheduledDate + 'T00:00:00').getDate()}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Viagem</span>
                   </div>
                   <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicles.find(v => v.id === trip.vehicleId)?.plate}</p>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicles.find(v => v.id === trip.vehicleId)?.model}</p>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 truncate">{trip.destination}</h4>
                   </div>
                </div>
                <button onClick={() => onStartSchedule?.(trip.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2">
                   <i className="fas fa-play text-[8px]"></i> Iniciar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-write text-slate-800 uppercase tracking-tight mb-2">Painel de Controle Admin</h3>
                <p className="text-xs text-slate-400 font-medium mb-8">Acesse as ferramentas de gestão de frota e RH.</p>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => onNavigate?.('drivers')} className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all shadow-lg">Motoristas</button>
                 <button onClick={() => onNavigate?.('fleet')} className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg">Frota Ativa</button>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center justify-between group overflow-hidden relative">
              <div className="relative z-10">
                 <p className="text-[10px] text-slate-400 uppercase font-write tracking-widest mb-1">Disponibilidade</p>
                 <span className="text-5xl font-write text-slate-800">{vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length}</span>
                 <p className="text-[10px] text-emerald-500 font-bold uppercase mt-2">Veículos Livres Agora</p>
              </div>
              <i className="fas fa-truck text-7xl text-slate-50 absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform"></i>
           </div>
        </div>
      )}

      {showFinishModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 custom-scrollbar overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="text-center mb-8">
               <h3 className="text-2xl font-write uppercase text-slate-800 tracking-tight">Finalização de Rota</h3>
               <p className="text-xs text-slate-400 font-medium mt-1">Registre o fechamento e despesas da jornada</p>
            </div>
            
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase text-center mb-4 tracking-widest font-bold">Odômetro no Painel (KM)</label>
                <input type="number" value={endKm} onChange={(e) => setEndKm(parseInt(e.target.value) || 0)} className="w-full bg-transparent outline-none font-write text-5xl text-slate-950 text-center" autoFocus />
                <p className="text-[9px] text-slate-400 text-center mt-3 uppercase font-bold tracking-widest">KM Inicial: {myActiveTrip?.startKm}</p>
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
                <label className="block text-[9px] font-write text-slate-400 uppercase mb-2 tracking-widest font-bold">Ocorrências / Observações</label>
                <textarea value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} className="w-full bg-transparent outline-none font-write text-xs text-slate-950 min-h-[80px]" placeholder="Relate sinistros, atrasos ou problemas técnicos..." />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowFinishModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button onClick={confirmFinish} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all">Confirmar e Encerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
