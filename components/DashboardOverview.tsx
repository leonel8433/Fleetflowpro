
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
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [occurrenceText, setOccurrenceText] = useState('');
  
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<number>(0);
  const [otherExpense, setOtherExpense] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  const handleGenerateAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    const fleetSummary = {
      veiculos: {
        total: vehicles.length,
        disponiveis: vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length,
        em_uso: vehicles.filter(v => v.status === VehicleStatus.IN_USE).length,
        manutencao: vehicles.filter(v => v.status === VehicleStatus.MAINTENANCE).length
      },
      viagens: {
        concluidas_total: completedTrips.length,
        distancia_total: completedTrips.reduce((acc, t) => acc + (t.distance || 0), 0),
        gastos_combustivel: completedTrips.reduce((acc, t) => acc + (t.fuelExpense || 0), 0)
      },
      rh: {
        motoristas: drivers.length,
        total_multas: fines.length,
        pontos_totais: fines.reduce((acc, f) => acc + f.points, 0)
      }
    };

    try {
      const result = await getFleetStatsAnalysis(fleetSummary);
      setAiAnalysis(result);
    } catch (error) {
      setAiAnalysis("Erro ao processar análise. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddOccurrence = () => {
    if (!myActiveTrip || !occurrenceText.trim()) return;
    
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const newNote = `${timestamp}: ${occurrenceText.trim()}`;
    const updatedObservations = myActiveTrip.observations 
      ? `${myActiveTrip.observations}\n${newNote}`
      : newNote;
    
    updateTrip(myActiveTrip.id, { observations: updatedObservations });
    setOccurrenceText('');
    setShowOccurrenceModal(false);
    alert('Ocorrência registrada no diário de bordo.');
  };

  const handleConfirmCancelTrip = () => {
    if (!myActiveTrip || !cancelReason.trim()) {
      alert("O motivo do cancelamento é obrigatório.");
      return;
    }
    
    cancelTrip(myActiveTrip.id, cancelReason.trim());
    setShowCancelModal(false);
    setCancelReason('');
    alert('Operação cancelada com sucesso. O log foi registrado no sistema.');
  };

  const handleCancelScheduledTrip = useCallback(async (id: string) => {
    if (window.confirm('Deseja realmente remover este agendamento da sua escala?')) {
      await deleteScheduledTrip(id);
      alert('Agendamento cancelado com sucesso.');
    }
  }, [deleteScheduledTrip]);

  const confirmFinish = () => {
    if (myActiveTrip) {
      if (endKm <= myActiveTrip.startKm) {
        alert("O KM final deve ser maior que o KM inicial.");
        return;
      }
      
      const finalNotes = expenseNotes.trim() 
        ? `NOTAS FINAIS: ${expenseNotes.trim()}\n\nDIÁRIO DE BORDO:\n${myActiveTrip.observations || 'Nenhuma ocorrência relatada.'}`
        : myActiveTrip.observations || 'Nenhuma ocorrência relatada.';

      endTrip(myActiveTrip.id, endKm, new Date().toISOString(), {
        fuel: fuelExpense,
        other: otherExpense,
        notes: finalNotes
      });
      
      setShowFinishModal(false);
      setFuelExpense(0);
      setOtherExpense(0);
      setExpenseNotes('');
      
      alert('Viagem encerrada com sucesso! Histórico profissional atualizado.');
    }
  };

  const calculatedDistance = useMemo(() => {
    if (!myActiveTrip) return 0;
    const dist = endKm - myActiveTrip.startKm;
    return dist > 0 ? dist : 0;
  }, [endKm, myActiveTrip]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
          <p className="text-xs text-slate-400 font-medium">Logado como: {currentUser?.name}</p>
        </div>
        {isAdmin && (
          <button 
            onClick={handleGenerateAIAnalysis}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-write uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95`}
          >
            <i className={`fas ${isAnalyzing ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
            {isAnalyzing ? 'Analisando Dados...' : 'Gerar Relatório Estratégico IA'}
          </button>
        )}
      </div>

      {/* AI Analysis Result Card */}
      {isAdmin && (aiAnalysis || isAnalyzing) && (
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-500 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <i className="fas fa-brain text-8xl text-white"></i>
          </div>
          
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-400/30">
              <i className="fas fa-robot text-indigo-400 text-xl"></i>
            </div>
            <div>
              <h3 className="text-white font-write text-lg uppercase tracking-tight">Relatório de Inteligência FleetFlow</h3>
              <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest">Análise gerada via Gemini 3.0 Pro</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm p-8 rounded-3xl border border-white/10 relative z-10">
            {isAnalyzing ? (
              <div className="space-y-4">
                <div className="h-4 bg-white/10 rounded-full w-3/4 animate-pulse"></div>
                <div className="h-4 bg-white/10 rounded-full w-full animate-pulse"></div>
                <div className="h-4 bg-white/10 rounded-full w-2/3 animate-pulse"></div>
                <div className="flex gap-4 pt-6">
                   <div className="h-20 bg-white/5 rounded-2xl flex-1 animate-pulse"></div>
                   <div className="h-20 bg-white/5 rounded-2xl flex-1 animate-pulse"></div>
                   <div className="h-20 bg-white/5 rounded-2xl flex-1 animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none text-slate-300 font-medium leading-relaxed">
                {aiAnalysis?.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('#') || line.startsWith('**') ? 'text-white font-write uppercase text-[11px] tracking-wider mb-2 mt-4' : 'mb-2'}>
                    {line.replace(/\*|#/g, '')}
                  </p>
                ))}
                <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Esta análise é baseada em dados estatísticos e não substitui a supervisão humana.</p>
                  <button onClick={() => setAiAnalysis(null)} className="text-[10px] text-indigo-400 hover:text-white font-bold uppercase">Limpar Análise</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

             {myActiveTrip.observations && (
               <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                  <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mb-2">Notas do Diário de Bordo</p>
                  <p className="text-[10px] text-slate-300 whitespace-pre-line line-clamp-3">{myActiveTrip.observations}</p>
               </div>
             )}
          </div>
          
          <div className="mt-8 grid grid-cols-2 gap-4 relative z-10">
             <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(myActiveTrip.destination)}`, '_blank')} className="py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <i className="fas fa-location-arrow"></i> Ver no GPS
             </button>
             <button onClick={() => setShowOccurrenceModal(true)} className="py-5 bg-slate-700 hover:bg-slate-600 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <i className="fas fa-exclamation-triangle"></i> Relatar Evento
             </button>
             <button onClick={() => setShowCancelModal(true)} className="py-5 bg-amber-600/10 hover:bg-amber-600 text-amber-500 hover:text-white rounded-2xl font-write text-[10px] uppercase tracking-widest transition-all border border-amber-600/20 flex items-center justify-center gap-2">
                <i className="fas fa-trash-can"></i> Cancelar Viagem
             </button>
             <button onClick={() => { setEndKm(vehicles.find(v => v.id === myActiveTrip.vehicleId)?.currentKm || 0); setShowFinishModal(true); }} className="py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-write text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                <i className="fas fa-flag-checkered"></i> Encerrar Rota
             </button>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento de Viagem */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="text-center">
               <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                 <i className="fas fa-triangle-exclamation"></i>
               </div>
               <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight">Motivo do Cancelamento</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Esta ação é irreversível e será registrada para auditoria.</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-red-100">
               <label className="block text-[9px] font-write text-red-600 uppercase mb-3 tracking-widest font-bold">Declare obrigatoriamente o motivo:</label>
               <textarea 
                 autoFocus
                 value={cancelReason} 
                 onChange={(e) => setCancelReason(e.target.value)} 
                 className="w-full bg-transparent outline-none font-write text-sm text-slate-950 min-h-[100px]" 
                 placeholder="Ex: Veículo quebrou, Erro no agendamento, Problemas pessoais..." 
               />
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setShowCancelModal(false); setCancelReason(''); }} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button 
                onClick={handleConfirmCancelTrip} 
                disabled={!cancelReason.trim()}
                className="flex-[2] py-5 bg-red-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-red-100 active:scale-95 transition-all disabled:opacity-20"
              >
                Confirmar Cancelamento
              </button>
            </div>
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
                <div className="flex gap-2">
                  <button onClick={() => handleCancelScheduledTrip(trip.id)} className="bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 px-4 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-sm">
                    <i className="fas fa-trash-can"></i>
                  </button>
                  <button onClick={() => onStartSchedule?.(trip.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2">
                    <i className="fas fa-play text-[8px]"></i> Iniciar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center justify-between group overflow-hidden relative">
              <div className="relative z-10">
                 <p className="text-[10px] text-slate-400 uppercase font-write tracking-widest mb-1">Rotas em Andamento</p>
                 <span className="text-5xl font-write text-blue-600">{activeTrips.length}</span>
                 <p className="text-[10px] text-blue-400 font-bold uppercase mt-2">Monitoramento Ativo</p>
              </div>
              <i className="fas fa-location-dot text-7xl text-slate-50 absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform"></i>
           </div>
        </div>
      )}

      {/* Modal Relatar Ocorrência Durante Trajeto */}
      {showOccurrenceModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="text-center">
               <h3 className="text-xl font-write uppercase text-slate-800 tracking-tight">Novo Registro de Trajeto</h3>
               <p className="text-xs text-slate-400 font-medium mt-1">Relate qualquer evento relevante agora</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <label className="block text-[9px] font-write text-slate-400 uppercase mb-3 tracking-widest font-bold">O que aconteceu?</label>
               <textarea 
                 autoFocus
                 value={occurrenceText} 
                 onChange={(e) => setOccurrenceText(e.target.value)} 
                 className="w-full bg-transparent outline-none font-write text-sm text-slate-950 min-h-[120px]" 
                 placeholder="Ex: Pneu furado na BR-101, parando para trocar..." 
               />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowOccurrenceModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Cancelar</button>
              <button onClick={handleAddOccurrence} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Salvar no Diário</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalização de Rota (End of Trip) */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 custom-scrollbar overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="text-center mb-8">
               <h3 className="text-2xl font-write uppercase text-slate-800 tracking-tight">Finalização de Rota</h3>
               <p className="text-xs text-slate-400 font-medium mt-1">Registre o fechamento e despesas da jornada</p>
            </div>
            
            <div className="space-y-6">
              <div className={`p-6 rounded-3xl border transition-all ${calculatedDistance > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                <label className="block text-[10px] font-write text-slate-400 uppercase text-center mb-4 tracking-widest font-bold">Odômetro no Painel (KM)</label>
                <input 
                  type="number" 
                  value={endKm} 
                  onChange={(e) => setEndKm(parseInt(e.target.value) || 0)} 
                  onFocus={(e) => e.target.select()}
                  className={`w-full bg-transparent outline-none font-write text-5xl text-center ${calculatedDistance > 0 ? 'text-emerald-600' : 'text-slate-950'}`} 
                  autoFocus 
                />
                <div className="flex justify-between mt-4 px-2">
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Início: {myActiveTrip?.startKm} KM</p>
                  <p className={`text-[9px] uppercase font-bold tracking-widest ${calculatedDistance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    Distância: {calculatedDistance} KM
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <label className="flex items-center gap-2 text-[9px] font-write text-slate-400 uppercase mb-3 tracking-widest font-bold">
                    <i className="fas fa-gas-pump text-blue-500"></i> Combustível (R$)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={fuelExpense} 
                    onChange={(e) => setFuelExpense(parseFloat(e.target.value) || 0)} 
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent outline-none font-write text-xl text-slate-950" 
                    placeholder="0,00" 
                  />
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <label className="flex items-center gap-2 text-[9px] font-write text-slate-400 uppercase mb-3 tracking-widest font-bold">
                    <i className="fas fa-receipt text-indigo-500"></i> Outros Custos (R$)
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={otherExpense} 
                    onChange={(e) => setOtherExpense(parseFloat(e.target.value) || 0)} 
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-transparent outline-none font-write text-xl text-slate-950" 
                    placeholder="0,00" 
                  />
                </div>
              </div>

              {myActiveTrip?.observations && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <p className="text-[9px] font-write text-amber-600 uppercase mb-2 tracking-widest font-bold">Resumo do Diário de Bordo</p>
                  <p className="text-[10px] text-amber-800 italic whitespace-pre-line leading-relaxed">{myActiveTrip.observations}</p>
                </div>
              )}

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <label className="block text-[9px] font-write text-slate-400 uppercase mb-3 tracking-widest font-bold">Observações Finais do Trajeto</label>
                <textarea 
                  value={expenseNotes} 
                  onChange={(e) => setExpenseNotes(e.target.value)} 
                  className="w-full bg-transparent outline-none font-write text-xs text-slate-950 min-h-[100px] leading-relaxed" 
                  placeholder="Relate aqui o status da carga, descarga ou qualquer detalhe final do veículo..." 
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowFinishModal(false)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button 
                onClick={confirmFinish} 
                disabled={calculatedDistance === 0}
                className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
              >
                Confirmar e Encerrar Rota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
