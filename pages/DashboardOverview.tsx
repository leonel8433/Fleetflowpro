
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, Trip } from '../types';

const DashboardOverview: React.FC<{ onStartSchedule?: (id: string) => void; onNavigate?: (tab: string) => void }> = ({ onStartSchedule, onNavigate }) => {
  const { vehicles, activeTrips, completedTrips, currentUser, endTrip, updateTrip, cancelTrip } = useFleet();
  
  const isAdmin = currentUser?.username === 'admin';
  const myActiveTrip = useMemo(() => activeTrips.find(t => String(t.driverId) === String(currentUser?.id)), [activeTrips, currentUser]);
  const activeVehicle = useMemo(() => vehicles.find(v => v.id === myActiveTrip?.vehicleId), [vehicles, myActiveTrip]);
  
  const isWeekly = myActiveTrip?.type === 'WEEKLY_ROUTINE';

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  
  // ESTADOS PARA FECHAMENTO
  const [endKm, setEndKm] = useState<number>(0);
  const [endFuelLevel, setEndFuelLevel] = useState<string>('Completo');
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);

  // ESTADOS PARA ABASTECIMENTO DURANTE A SEMANA
  const [refuelDate, setRefuelDate] = useState(new Date().toISOString().split('T')[0]);
  const [refuelKm, setRefuelKm] = useState<number>(0);
  const [refuelLiters, setRefuelLiters] = useState<number>(0);
  const [refuelValue, setRefuelValue] = useState<number>(0);

  useEffect(() => {
    if (activeVehicle) {
      setEndKm(activeVehicle.currentKm);
      setRefuelKm(activeVehicle.currentKm);
    }
  }, [activeVehicle, showFinishModal, showRefuelModal]);

  const totalKmRun = useMemo(() => {
    if (!myActiveTrip) return 0;
    return Math.max(0, (endKm || 0) - myActiveTrip.startKm);
  }, [endKm, myActiveTrip]);

  const handleRegisterRefuel = () => {
    if (!myActiveTrip) return;
    const refuelLog = `\n[ABASTECIMENTO]: Data: ${refuelDate} | KM: ${refuelKm} | Litros: ${refuelLiters} | R$: ${refuelValue.toFixed(2)}`;
    updateTrip(myActiveTrip.id, { observations: (myActiveTrip.observations || '') + refuelLog });
    
    // Atualiza o contexto global com o custo do abastecimento (acumulativo)
    const currentFuelExpense = (myActiveTrip.fuelExpense || 0) + refuelValue;
    updateTrip(myActiveTrip.id, { fuelExpense: currentFuelExpense });

    setShowRefuelModal(false);
    setRefuelKm(0); setRefuelLiters(0); setRefuelValue(0);
    alert('Abastecimento registrado com sucesso no diário semanal.');
  };

  const confirmFinish = async () => {
    if (myActiveTrip) {
      // VALIDAÇÃO DE KM: KM FINAL NÃO PODE SER MENOR QUE O INICIAL (IGUAL É PERMITIDO PARA TESTES OU PEQUENOS DESLOCAMENTOS)
      if (endKm < myActiveTrip.startKm) {
        alert(`⚠️ ERRO DE QUILOMETRAGEM: O KM final digitado (${endKm}) não pode ser inferior ao KM registrado na abertura desta viagem (${myActiveTrip.startKm}). Verifique o odômetro no painel.`);
        return;
      }
      
      setIsFinishing(true);
      try {
        const fuelPercentageMap: Record<string, number> = { 'Completo': 100, '3/4': 75, '1/2': 50, '1/4': 25, 'Reserva': 10 };
        const fuelLevel = fuelPercentageMap[endFuelLevel] || 100;

        await endTrip(myActiveTrip.id, endKm, new Date().toISOString(), fuelLevel, {
          fuel: myActiveTrip.fuelExpense || 0,
          other: otherExpenses,
          notes: `${isWeekly ? 'FECHAMENTO SEMANAL' : 'FECHAMENTO AVULSO'}: ${closingDate} | TOTAL KM: ${totalKmRun} | NÍVEL FINAL: ${endFuelLevel} | OBS: ${closingNotes}`.trim()
        });
        
        setShowFinishModal(false);
        setClosingNotes('');
        setOtherExpenses(0);
        alert('Viagem encerrada com sucesso!');
      } catch (err) {
        alert('Ocorreu um erro ao encerrar a viagem. Verifique sua conexão e tente novamente.');
      } finally {
        setIsFinishing(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Minha Operação</h2>
        <p className="text-xs text-slate-400 font-medium">{currentUser?.name}</p>
      </div>

      {!isAdmin && myActiveTrip && (
        <div className={`rounded-[2.5rem] p-8 shadow-2xl relative animate-in fade-in duration-500 border ${isWeekly ? 'bg-emerald-950 border-emerald-400/20 shadow-emerald-900/10' : 'bg-slate-900 border-white/5'} text-white`}>
          <div className="flex justify-between items-center mb-8">
            <span className={`${isWeekly ? 'bg-emerald-600' : 'bg-indigo-600'} text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2`}>
              <i className={`fas ${isWeekly ? 'fa-calendar-check' : 'fa-route'}`}></i>
              {isWeekly ? 'Rotina Semanal Ativa' : 'Viagem em Curso'}
            </span>
            {isWeekly && (
              <span className="text-[10px] font-bold text-emerald-400 uppercase">
                Acumulado: {((myActiveTrip.fuelExpense || 0) + (myActiveTrip.otherExpense || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center font-mono text-xs border border-white/5 shadow-inner">
                    {activeVehicle?.plate}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold uppercase leading-tight">{activeVehicle?.model}</h3>
                    <p className="text-xs font-medium text-slate-400">{isWeekly ? 'Rota Fixa: ' : 'Destino: '} {myActiveTrip.destination}</p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex-1">
                     <p className="text-[10px] text-emerald-400 uppercase font-bold mb-1 tracking-widest">Abertura KM</p>
                     <p className="text-xl font-bold tabular-nums">{myActiveTrip.startKm} km</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex-1">
                     <p className="text-[10px] text-blue-400 uppercase font-bold mb-1 tracking-widest">Início em</p>
                     <p className="text-xl font-bold tabular-nums">{new Date(myActiveTrip.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-3 justify-end">
               {isWeekly && (
                 <button onClick={() => setShowRefuelModal(true)} className="w-full py-4 bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl">
                   <i className="fas fa-gas-pump"></i> Registrar Abastecimento
                 </button>
               )}
               <div className="flex gap-3">
                 <button onClick={() => setShowCancelModal(true)} className="flex-1 py-4 bg-red-600/10 border border-red-600/30 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all">
                   Cancelar
                 </button>
                 <button onClick={() => setShowFinishModal(true)} className={`flex-[2] py-4 ${isWeekly ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'} text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl hover:scale-[1.02] transition-all`}>
                   {isWeekly ? 'Encerrar Ciclo Semanal' : 'Encerrar Operação'}
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO ABASTECIMENTO (DURANTE A SEMANA) */}
      {showRefuelModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6">
            <h3 className="text-xl font-bold uppercase text-slate-800 text-center tracking-tight">Registro de Abastecimento</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Data</label>
                <input type="date" value={refuelDate} onChange={(e) => setRefuelDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Quilometragem no Ato (KM)</label>
                <input type="number" value={refuelKm} onChange={(e) => setRefuelKm(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Litros</label>
                  <input type="number" step="0.01" value={refuelLiters} onChange={(e) => setRefuelLiters(parseFloat(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Valor Pago (R$)</label>
                  <input type="number" step="0.01" value={refuelValue} onChange={(e) => setRefuelValue(parseFloat(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setShowRefuelModal(false)} className="flex-1 py-4 text-slate-400 uppercase font-bold text-[10px] tracking-widest">Cancelar</button>
              <button onClick={handleRegisterRefuel} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase text-xs shadow-xl tracking-widest shadow-emerald-100">Registrar Diário</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FECHAMENTO */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className={`${isWeekly ? 'bg-emerald-600' : 'bg-[#6366f1]'} p-10 text-white flex justify-between items-center`}>
               <div>
                 <h3 className="text-2xl font-bold uppercase tracking-tight">{isWeekly ? 'Encerramento Semanal' : 'Encerrar Viagem'}</h3>
                 <p className="text-[10px] font-bold opacity-80 uppercase mt-1 tracking-widest">Revisão de Quilometragem e Custos</p>
               </div>
               <i className={`fas ${isWeekly ? 'fa-calendar-check' : 'fa-flag-checkered'} text-3xl`}></i>
            </div>
            <div className="p-10 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Data Encerramento</label><input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-indigo-500" /></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Quilometragem Final</label><input type="number" value={endKm} onChange={(e) => setEndKm(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              </div>

              {isWeekly && (
                <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex justify-between items-center animate-in slide-in-from-top duration-500">
                   <div>
                     <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest">Total Percorrido no Ciclo</p>
                     <p className="text-xs text-emerald-600 font-medium">Km Final - Km Abertura</p>
                   </div>
                   <p className="text-4xl font-black text-emerald-600">{totalKmRun} <span className="text-sm">KM</span></p>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest ml-1">Nível de Combustível ao Finalizar</label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {['Completo', '3/4', '1/2', '1/4', 'Reserva'].map(level => (
                    <button key={level} onClick={() => setEndFuelLevel(level)} className={`px-2 py-3 rounded-xl text-[9px] font-bold uppercase transition-all border ${endFuelLevel === level ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>{level}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest ml-1">Despesas de Outros Serviços</label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <label className="text-[8px] font-bold text-slate-500 uppercase block mb-1">Total Adicional (Lavagem, Estacionamento, etc)</label>
                     <input type="number" step="0.01" placeholder="R$ 0,00" value={otherExpenses || ''} onChange={(e) => setOtherExpenses(parseFloat(e.target.value) || 0)} className="w-full p-2 bg-transparent border-b border-slate-200 font-bold outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest ml-1">Observações de Encerramento</label>
                <textarea placeholder="Relate aqui qualquer ocorrência, avaria ou nota importante sobre a viagem..." value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-100 items-center">
                <button disabled={isFinishing} onClick={() => setShowFinishModal(false)} className="flex-1 py-5 text-slate-400 uppercase font-bold text-[10px] tracking-widest hover:text-slate-600 transition-colors">Voltar</button>
                <button 
                  disabled={isFinishing} 
                  onClick={confirmFinish} 
                  className={`flex-[2] py-5 ${isWeekly ? 'bg-emerald-600 shadow-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-[#6366f1] shadow-indigo-100 shadow-[0_0_25px_rgba(99,102,241,0.4)]'} text-white rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3`}
                >
                  {isFinishing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Confirmar Encerramento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAMENTO */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 space-y-6">
            <h3 className="text-xl font-bold uppercase text-slate-800 text-center">Cancelar Operação</h3>
            <p className="text-xs text-slate-500 text-center">Informe o motivo da interrupção do ciclo.</p>
            <textarea autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full bg-slate-50 p-6 rounded-[2rem] outline-none font-bold text-sm border border-slate-100" placeholder="Motivo do cancelamento..." />
            <div className="flex gap-4">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 py-4 text-slate-400 uppercase font-bold text-[10px] tracking-widest">Sair</button>
              <button onClick={() => { cancelTrip(myActiveTrip!.id, cancelReason); setShowCancelModal(false); }} disabled={!cancelReason.trim()} className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-bold uppercase text-xs shadow-xl shadow-red-100 transition-all active:scale-95">Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
