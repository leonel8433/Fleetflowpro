
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, Trip } from '../types';
import { getFleetStatsAnalysis } from '../services/geminiService';

interface DashboardOverviewProps {
  onStartSchedule?: (id: string) => void;
  onNavigate?: (tab: string) => void; 
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartSchedule, onNavigate }) => {
  const { vehicles, activeTrips, scheduledTrips, completedTrips, drivers, maintenanceRecords, fines, currentUser, endTrip, updateTrip, cancelTrip, deleteScheduledTrip } = useFleet();
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  
  const isAdmin = currentUser?.username === 'admin';
  const myActiveTrip = useMemo(() => activeTrips.find(t => String(t.driverId) === String(currentUser?.id)), [activeTrips, currentUser]);
  const activeVehicle = useMemo(() => vehicles.find(v => v.id === myActiveTrip?.vehicleId), [vehicles, myActiveTrip]);
  
  const isWeekly = myActiveTrip?.type === 'WEEKLY_ROUTINE';

  const myScheduledTrips = useMemo(() => {
    if (isAdmin) return [];
    const curId = String(currentUser?.id).trim();
    return scheduledTrips
      .filter(t => String(t.driverId).trim() === curId)
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
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [occurrenceText, setOccurrenceText] = useState('');
  
  const [endKm, setEndKm] = useState<number>(0);
  const [endFuel, setEndFuel] = useState<number>(100);
  const [fuelExpense, setFuelExpense] = useState<number>(0);
  const [otherExpense, setOtherExpense] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  const handleGenerateAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    const fleetSummary = {
      veiculos: { total: vehicles.length, disponiveis: vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length },
      viagens: { concluidas_total: completedTrips.length }
    };

    try {
      const result = await getFleetStatsAnalysis(fleetSummary);
      setAiAnalysis(result);
    } catch (error) {
      setAiAnalysis("Erro ao processar análise.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddOccurrence = () => {
    if (!myActiveTrip || !occurrenceText.trim()) return;
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const newNote = `${timestamp}: ${occurrenceText.trim()}`;
    const updatedObservations = myActiveTrip.observations ? `${myActiveTrip.observations}\n${newNote}` : newNote;
    updateTrip(myActiveTrip.id, { observations: updatedObservations });
    setOccurrenceText('');
    setShowOccurrenceModal(false);
  };

  const handleConfirmCancelTrip = () => {
    if (!myActiveTrip || !cancelReason.trim()) {
      alert("O motivo do cancelamento é obrigatório.");
      return;
    }
    cancelTrip(myActiveTrip.id, cancelReason.trim());
    setShowCancelModal(false);
    setCancelReason('');
  };

  const handleCancelScheduledTrip = useCallback(async (id: string) => {
    if (window.confirm('Deseja realmente remover este agendamento da sua escala de hoje?')) {
      try {
        await deleteScheduledTrip(id);
        alert('Agendamento removido com sucesso.');
      } catch (err) {
        alert('Erro ao tentar cancelar o agendamento.');
      }
    }
  }, [deleteScheduledTrip]);

  const confirmFinish = () => {
    if (myActiveTrip) {
      if (endKm < myActiveTrip.startKm) {
        alert("O KM final não pode ser menor que o KM inicial.");
        return;
      }
      endTrip(myActiveTrip.id, endKm, new Date().toISOString(), endFuel, {
        fuel: fuelExpense,
        other: otherExpense,
        notes: expenseNotes.trim()
      });
      setShowFinishModal(false);
    }
  };

  const journeyEvents = useMemo(() => {
    if (!myActiveTrip?.observations) return [];
    return myActiveTrip.observations.split('\n').filter(line => line.includes(': '));
  }, [myActiveTrip]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-400 font-medium">Logado como: {currentUser?.name}</p>
        </div>
        {isAdmin && (
          <button onClick={handleGenerateAIAnalysis} disabled={isAnalyzing} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-write uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
            <i className={`fas ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            Gerar Análise IA
          </button>
        )}
      </div>

      {isAdmin && (aiAnalysis || isAnalyzing) && (
        <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-500 overflow-hidden relative">
          <div className="bg-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/10">
            {isAnalyzing ? (<div className="h-4 bg-white/10 rounded-full w-3/4 animate-pulse"></div>) : (<div className="prose prose-invert prose-sm max-w-none text-slate-300">{aiAnalysis}</div>)}
          </div>
        </div>
      )}

      {!isAdmin && myActiveTrip && (
        <div className={`rounded-[2.5rem] p-8 shadow-2xl relative animate-in fade-in zoom-in duration-500 border ${isWeekly ? 'bg-slate-800 border-indigo-400/20' : 'bg-slate-900 border-white/5'} text-white`}>
          <div className="flex justify-between items-center mb-10">
            <span className={`${isWeekly ? 'bg-indigo-600' : 'bg-emerald-500'} text-white text-[10px] font-write px-4 py-1.5 rounded-full animate-pulse tracking-widest uppercase`}>
              {isWeekly ? 'Rotina Semanal Ativa' : 'Em Operação / Viagem'}
            </span>
            <div className="flex flex-col items-end">
               <span className="text-[9px] font-write text-blue-400 uppercase tracking-widest">Tempo de Atividade</span>
               <span className="text-4xl font-mono font-bold tracking-wider leading-none">{elapsedTime}</span>
            </div>
          </div>

          {activeVehicle && activeVehicle.fuelLevel < 10 && (
            <div className="mb-6 p-4 bg-red-600/30 border border-red-500 rounded-2xl flex items-center gap-4 animate-pulse">
               <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                  <i className="fas fa-gas-pump"></i>
               </div>
               <div>
                  <p className="text-[10px] font-write uppercase tracking-widest text-red-100">Alerta de Combustível Crítico</p>
                  <p className="text-xs font-bold text-white uppercase">Nível atual: {activeVehicle.fuelLevel}%. Recomenda-se abastecimento imediato.</p>
               </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                  <span className="bg-white/10 px-3 py-1 rounded-lg font-mono text-xs">{activeVehicle?.plate}</span>
                  <h3 className="text-xl font-write uppercase tracking-tight">{activeVehicle?.model}</h3>
               </div>
               <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{isWeekly ? 'Abrangência de Trabalho' : 'Destino'}</p>
                  <p className="text-sm font-bold truncate">{myActiveTrip.destination}</p>
               </div>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
              <p className="text-[10px] text-blue-400 font-write uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-list-ul"></i> Log de Atividades {isWeekly ? 'da Semana' : 'da Viagem'}
              </p>
              <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-3">
                {journeyEvents.length > 0 ? journeyEvents.map((ev, i) => (
                  <div key={i} className="flex gap-3 items-start animate-in slide-in-from-right-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                    <p className="text-[11px] text-slate-300 font-medium italic">{ev}</p>
                  </div>
                )) : (
                  <p className="text-[10px] text-slate-500 italic">Nenhum evento registrado hoje.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
             {!isWeekly && (
               <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(myActiveTrip.destination)}`, '_blank')} className="py-5 bg-blue-600 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                 <i className="fas fa-location-arrow"></i> GPS
               </button>
             )}
             <button onClick={() => setShowOccurrenceModal(true)} className="py-5 bg-slate-700 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
               <i className="fas fa-comment-medical"></i> Registrar Fato
             </button>
             <button onClick={() => setShowCancelModal(true)} className="py-5 border border-red-600/30 text-red-500 rounded-2xl font-write text-[10px] uppercase tracking-widest hover:bg-red-500/10 transition-colors">Cancelar</button>
             <button onClick={() => { setEndKm(activeVehicle?.currentKm || 0); setEndFuel(activeVehicle?.fuelLevel || 100); setShowFinishModal(true); }} className="py-5 bg-emerald-600 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
               <i className="fas fa-flag-checkered"></i> Encerrar {isWeekly ? 'Semana' : 'Viagem'}
             </button>
          </div>
        </div>
      )}

      {!isAdmin && !myActiveTrip && myScheduledTrips.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-indigo-100">
          <h3 className="text-xs font-write text-indigo-900 uppercase tracking-widest mb-8 flex items-center gap-2">
            <i className="fas fa-calendar-check text-indigo-500"></i> Sua Agenda Hoje
          </h3>
          <div className="space-y-6">
            {myScheduledTrips.map(trip => (
              <div key={trip.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-4 group hover:border-indigo-200 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xl font-write text-indigo-600 leading-none">{new Date(trip.scheduledDate + 'T00:00:00').getDate()}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Viagem</span>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicles.find(v => v.id === trip.vehicleId)?.plate} • {vehicles.find(v => v.id === trip.vehicleId)?.model}</p>
                          {trip.notes?.includes('[JUSTIFICATIVA RODÍZIO]') && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[8px] font-write uppercase border border-amber-200">Autorizada</span>
                          )}
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 truncate">{trip.destination}</h4>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleCancelScheduledTrip(trip.id)} 
                      className="w-14 h-14 bg-white border border-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-sm"
                      title="Excluir Agendamento"
                    >
                      <i className="fas fa-trash-can text-lg"></i>
                    </button>
                    <button 
                      onClick={() => onStartSchedule?.(trip.id)} 
                      className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <i className="fas fa-play text-[8px]"></i> Iniciar
                    </button>
                  </div>
                </div>
                
                {trip.notes && (
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm animate-pulse-slow ${trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'bg-amber-50 border-amber-200' : 'bg-white border-indigo-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      <i className={`fas ${trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'fa-shield-halved' : 'fa-clipboard-list'} text-xs`}></i>
                    </div>
                    <div>
                      <p className={`text-[9px] font-write uppercase tracking-widest mb-0.5 ${trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'text-amber-500' : 'text-indigo-400'}`}>
                        {trip.notes.includes('[JUSTIFICATIVA RODÍZIO]') ? 'Autorização de Rodízio:' : 'Destaque Administrativo:'}
                      </p>
                      <p className="text-xs text-slate-700 font-bold leading-relaxed">"{trip.notes}"</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-xl flex items-center justify-between overflow-hidden relative">
              <div className="relative z-10">
                 <p className="text-[10px] text-slate-400 uppercase font-write tracking-widest mb-1">Disponibilidade</p>
                 <span className="text-5xl font-write text-slate-800">{vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length}</span>
              </div>
              <i className="fas fa-truck text-7xl text-slate-50 absolute -right-4 -bottom-4"></i>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center justify-between overflow-hidden relative">
              <div className="relative z-10">
                 <p className="text-[10px] text-slate-400 uppercase font-write tracking-widest mb-1">Em Rota</p>
                 <span className="text-5xl font-write text-blue-600">{activeTrips.length}</span>
              </div>
              <i className="fas fa-location-dot text-7xl text-slate-50 absolute -right-4 -bottom-4"></i>
           </div>
        </div>
      )}

      {/* Modal de Relato */}
      {showOccurrenceModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6">
            <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight text-center">Checkpoint</h3>
            <textarea autoFocus value={occurrenceText} onChange={(e) => setOccurrenceText(e.target.value)} className="w-full bg-slate-50 p-6 rounded-3xl outline-none font-write text-sm text-slate-950 min-h-[120px]" placeholder="O que aconteceu agora?" />
            <div className="flex gap-4">
              <button onClick={() => setShowOccurrenceModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px]">Voltar</button>
              <button onClick={handleAddOccurrence} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-write uppercase text-xs">Salvar Relato</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                <i className="fas fa-ban"></i>
              </div>
              <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight">Cancelar Viagem</h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">Informe o motivo para auditoria</p>
            </div>
            <textarea autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full bg-slate-50 p-6 rounded-3xl outline-none font-write text-sm text-slate-950 min-h-[120px]" placeholder="Ex: Problema mecânico, pneu furado, erro de destino..." />
            <div className="flex gap-4">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px]">Voltar</button>
              <button onClick={handleConfirmCancelTrip} disabled={!cancelReason.trim()} className="flex-[2] py-5 bg-red-600 text-white rounded-2xl font-write uppercase text-xs disabled:opacity-30">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Encerrar */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className={`${isWeekly ? 'bg-indigo-600' : 'bg-emerald-600'} p-8 text-white flex justify-between items-center`}>
               <h3 className="text-xl font-write uppercase tracking-tight">Finalizar {isWeekly ? 'Ciclo Semanal' : 'Viagem'}</h3>
               <i className="fas fa-flag-checkered text-2xl opacity-40"></i>
            </div>
            <div className="p-10 space-y-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 text-center font-bold tracking-widest">Odômetro Final no {isWeekly ? 'Sábado/Retorno' : 'Destino'}</label>
                <input type="number" autoFocus value={endKm} onChange={(e) => setEndKm(parseInt(e.target.value) || 0)} className="w-full px-5 py-5 bg-transparent outline-none font-write text-3xl text-slate-900 text-center" />
                <p className="text-[9px] text-center text-slate-400 mt-2">KM Inicial: {myActiveTrip?.startKm} km</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center font-bold tracking-widest">Nível de Combustível Final: {endFuel}%</label>
                <div className="flex items-center gap-4">
                  <i className="fas fa-gas-pump text-slate-400"></i>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5" 
                    value={endFuel} 
                    onChange={(e) => setEndFuel(parseInt(e.target.value))} 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <i className="fas fa-gas-pump text-blue-600"></i>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Despesas de Combustível (R$)</label>
                   <input type="number" value={fuelExpense} onChange={(e) => setFuelExpense(parseFloat(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Extras / Pedágios (R$)</label>
                   <input type="number" value={otherExpense} onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1">Relatório de Encerramento</label>
                 <textarea value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm min-h-[80px]" placeholder="Descreva como foi a semana ou os principais pontos da viagem..." />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowFinishModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px]">Voltar</button>
                <button onClick={confirmFinish} className={`flex-[2] py-5 ${isWeekly ? 'bg-indigo-600' : 'bg-emerald-600'} text-white rounded-2xl font-write uppercase text-xs shadow-xl active:scale-95 transition-all`}>
                   Encerrar Agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
