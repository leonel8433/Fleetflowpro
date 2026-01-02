
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, Trip, MaintenanceRecord, AppNotification } from '../types';

interface DashboardOverviewProps {
  onStartSchedule?: (id: string) => void;
  onNavigate?: (tab: string) => void; 
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartSchedule, onNavigate }) => {
  const { vehicles, drivers, activeTrips, scheduledTrips, maintenanceRecords, currentUser, endTrip, notifications, markNotificationAsRead } = useFleet();
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  
  // Alertas de Multa ao Logar
  const [fineAlert, setFineAlert] = useState<AppNotification | null>(null);

  const isAdmin = currentUser?.username === 'admin';
  const myActiveTrip = useMemo(() => activeTrips.find(t => t.driverId === currentUser?.id), [activeTrips, currentUser]);
  
  const myScheduledTrips = useMemo(() => {
    return scheduledTrips
      .filter(t => t.driverId === currentUser?.id)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [scheduledTrips, currentUser]);

  // Efeito para detectar multas não lidas ao logar
  useEffect(() => {
    if (currentUser && !isAdmin) {
      const unreadFine = notifications.find(n => n.type === 'new_fine' && n.driverId === currentUser.id && !n.isRead);
      if (unreadFine) {
        setFineAlert(unreadFine);
      }
    }
  }, [notifications, currentUser, isAdmin]);

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

  const [resolvingMaint, setResolvingMaint] = useState<{recordId: string, vehicleId: string, plate: string} | null>(null);
  const [resKm, setResKm] = useState<number>(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<string>('0');
  const [otherExpense, setOtherExpense] = useState<string>('0');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

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
    return { available, inUse, total: vehicles.length };
  }, [vehicles]);

  const handleOpenGPS = () => {
    if (myActiveTrip) {
      const origin = encodeURIComponent(myActiveTrip.origin);
      const dest = encodeURIComponent(`${myActiveTrip.destination}, ${myActiveTrip.city} - ${myActiveTrip.state}`);
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`, '_blank');
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

  const confirmFinish = () => {
    if (myActiveTrip) {
      if (endKm <= myActiveTrip.startKm) {
        alert("O KM final deve ser maior que o KM inicial.");
        return;
      }
      endTrip(myActiveTrip.id, endKm, new Date().toISOString(), {
        fuel: parseFloat(fuelExpense) || 0,
        other: parseFloat(otherExpense) || 0,
        notes: expenseNotes
      });
      setShowFinishModal(false);
      alert('Viagem encerrada com sucesso! Histórico salvo.');
    }
  };

  const acknowledgeFine = () => {
    if (fineAlert) {
      markNotificationAsRead(fineAlert.id);
      setFineAlert(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-400 font-medium">Bem-vindo, {currentUser?.name}.</p>
        </div>
      </div>

      {/* Alerta de Multa Crítico ao Motorista */}
      {fineAlert && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-red-950/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border-4 border-red-500 overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-8 bg-red-600 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <i className="fas fa-triangle-exclamation text-4xl"></i>
              </div>
              <h3 className="text-2xl font-write uppercase tracking-tight">{fineAlert.title}</h3>
            </div>
            <div className="p-10 space-y-6 text-center">
              <p className="text-slate-600 font-medium leading-relaxed">
                {fineAlert.message}
              </p>
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-2">Atenção</p>
                 <p className="text-xs text-slate-500 italic">As infrações de trânsito afetam sua pontuação na CNH corporativa. Favor dirigir com prudência.</p>
              </div>
              <button 
                onClick={acknowledgeFine}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-write uppercase text-xs tracking-widest hover:bg-red-600 transition-all shadow-xl active:scale-95"
              >
                Estou Ciente e Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card de Viagem Ativa */}
      {!isAdmin && myActiveTrip && (
        <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl border border-slate-800 overflow-hidden relative animate-in fade-in zoom-in duration-500">
          <div className="absolute top-6 right-8 flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[9px] font-write text-blue-400 uppercase tracking-widest">Cronômetro</span>
                <span className="text-3xl font-mono font-bold text-white tabular-nums tracking-wider leading-none">{elapsedTime}</span>
             </div>
             <span className="bg-emerald-500 text-white text-[10px] font-write px-3 py-1.5 rounded-full animate-pulse flex items-center gap-2">
              <i className="fas fa-satellite-dish"></i> EM ROTA
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-10 mt-6">
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-lg border border-white/10">
                  <i className="fas fa-truck-moving"></i>
                </div>
                <div>
                  <h3 className="text-xl font-write uppercase tracking-tight">Viagem Ativa</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-mono">{vehicles.find(v => v.id === myActiveTrip.vehicleId)?.plate}</span>
                    <p className="text-blue-400 text-xs font-bold uppercase">{vehicles.find(v => v.id === myActiveTrip.vehicleId)?.model}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-write mb-1">Ponto de Partida</p>
                  <p className="text-sm font-bold truncate opacity-80">{myActiveTrip.origin}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-write mb-1">Destino Final</p>
                  <p className="text-sm font-bold truncate">{myActiveTrip.destination}</p>
                  <span className="text-[10px] text-blue-400 font-bold uppercase">{myActiveTrip.city} - {myActiveTrip.state}</span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-72 flex flex-col gap-4 justify-center">
              <button 
                onClick={handleOpenGPS}
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-write text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 border border-blue-400/20 active:scale-95"
              >
                <i className="fas fa-map-location-dot text-xl"></i> Reabrir GPS
              </button>
              <button 
                onClick={handleFinalArrival}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-write text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 border border-emerald-400/20 active:scale-95 animate-bounce-subtle"
              >
                <i className="fas fa-flag-checkered text-xl"></i> Cheguei ao Destino
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Próximas Viagens Agendadas */}
      {!isAdmin && !myActiveTrip && myScheduledTrips.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-indigo-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-write text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-3">
              <i className="fas fa-calendar-check text-indigo-600"></i> Sua Agenda Hoje
            </h3>
          </div>
          <div className="space-y-4">
            {myScheduledTrips.map(trip => {
              const vehicle = vehicles.find(v => v.id === trip.vehicleId);
              const tripDate = new Date(trip.scheduledDate + 'T00:00:00');
              return (
                <div key={trip.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row items-center gap-6 hover:border-indigo-200 transition-all">
                  <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center shadow-sm shrink-0">
                    <span className="text-xl font-write text-indigo-600 leading-none">{tripDate.getDate()}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {tripDate.toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono bg-slate-900 text-white px-2 py-0.5 rounded">{vehicle?.plate}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{vehicle?.model}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 truncate mb-1">{trip.destination}</h4>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">{trip.city} / {trip.state}</p>
                  </div>
                  <button onClick={() => onStartSchedule?.(trip.id)} className="w-full md:w-auto bg-indigo-600 text-white px-10 py-5 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                    <i className="fas fa-play text-[8px]"></i> Iniciar Viagem
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dashboard Admin */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-xl flex flex-col justify-between">
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg">
                   <i className="fas fa-users-gear"></i>
                 </div>
                 <div>
                   <h3 className="text-lg font-write text-slate-800 uppercase tracking-tight">Gestão de Condutores</h3>
                   <p className="text-xs text-slate-400 font-medium">Cadastros e Multas</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => onNavigate?.('drivers')} className="bg-slate-900 text-white py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all">Novo Motorista</button>
                 <button onClick={() => onNavigate?.('drivers')} className="bg-blue-50 text-blue-600 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest border border-blue-100 hover:bg-blue-100 transition-all">Ver Multas</button>
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-write uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <i className="fas fa-wrench"></i> Veículos em Oficina
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {vehiclesInMaintenance.length > 0 ? vehiclesInMaintenance.map(v => (
                  <button key={v.id} className="bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl text-[10px] font-write uppercase tracking-widest border border-amber-100">Liberar {v.plate}</button>
                )) : (
                  <p className="text-xs text-slate-300 italic">Frota 100% operacional.</p>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Stats Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Veículos Livres</p>
           <div className="flex items-center justify-between">
             <span className="text-4xl font-write text-slate-800">{fleetStats.available}</span>
             <i className="fas fa-check-circle text-emerald-500 text-2xl opacity-10"></i>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Viagens Ativas</p>
           <div className="flex items-center justify-between">
             <span className="text-4xl font-write text-slate-800">{activeTrips.length}</span>
             <i className="fas fa-truck-fast text-blue-500 text-2xl opacity-10"></i>
           </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Condutores Disponíveis</p>
           <div className="flex items-center justify-between">
             <span className="text-4xl font-write text-slate-800">{drivers.length - activeTrips.length}</span>
             <i className="fas fa-users text-indigo-500 text-2xl opacity-10"></i>
           </div>
        </div>
      </div>

      {/* Modal Finalizar Viagem */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-emerald-600 text-white flex flex-col gap-2">
              <h3 className="text-2xl font-write uppercase tracking-tight">Ponto de Chegada</h3>
              <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest">Registre o KM e custos finais da rota</p>
            </div>
            <div className="p-10 space-y-8">
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 text-center tracking-widest">KM Atual no Painel</label>
                <input type="number" value={endKm} onChange={(e) => setEndKm(parseInt(e.target.value))} className="w-full bg-transparent outline-none font-write text-5xl text-slate-900 text-center" autoFocus />
                <p className="text-[9px] text-center text-slate-400 mt-2 uppercase">Inicial: {myActiveTrip?.startKm} KM</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-write text-slate-400 uppercase mb-2">Combustível (R$)</label>
                  <input type="number" step="0.01" value={fuelExpense} onChange={(e) => setFuelExpense(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800" />
                </div>
                <div>
                  <label className="block text-[9px] font-write text-slate-400 uppercase mb-2">Pedágios/Outros (R$)</label>
                  <input type="number" step="0.01" value={otherExpense} onChange={(e) => setOtherExpense(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-write text-slate-400 uppercase mb-2">Observações do Trajeto</label>
                <textarea value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} placeholder="Ex: Trânsito intenso na marginal..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 text-xs min-h-[80px]" />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowFinishModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Voltar</button>
                <button onClick={confirmFinish} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-[0.2em] shadow-xl shadow-emerald-100 active:scale-95 transition-all">Finalizar Rota</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
