
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus, TripType } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';
import { getOptimizedRoute } from '../services/geminiService';

interface OperationWizardProps {
  scheduledTripId?: string;
  onComplete?: () => void;
}

const OperationWizard: React.FC<OperationWizardProps> = ({ scheduledTripId, onComplete }) => {
  const { vehicles, scheduledTrips, currentUser, startTrip, deleteScheduledTrip } = useFleet();
  const [step, setStep] = useState(0); // 0: Selection, 1: Route/Setup, 2: Vehicle, 3: Checklist, 4: Confirm
  const [opType, setOpType] = useState<TripType>('STANDARD');
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  
  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingLocs, setIsLoadingLocs] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [adminJustification, setAdminJustification] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Partial<Checklist>>({
    km: 0,
    oilChecked: false,
    waterChecked: false,
    tiresChecked: false,
    comments: '',
    weeklyFuelAmount: 0,
    weeklyFuelLiters: 0
  });

  const [route, setRoute] = useState({
    origin: '',
    destination: '',
    city: '',
    state: '',
    tripDate: new Date().toISOString().split('T')[0],
    waypoints: [] as string[]
  });

  const isAdmin = currentUser?.username === 'admin';

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados:", err));
  }, []);

  useEffect(() => {
    if (route.state) {
      setIsLoadingLocs(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${route.state}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => {
          setCities(data.map((c: any) => c.nome));
          setIsLoadingLocs(false);
        })
        .catch(err => {
          console.error("Erro ao carregar cidades:", err);
          setIsLoadingLocs(false);
        });
    }
  }, [route.state]);

  useEffect(() => {
    if (scheduledTripId) {
      const schedule = scheduledTrips.find(s => s.id === scheduledTripId);
      if (schedule) {
        setOpType('STANDARD');
        setRoute({
          origin: schedule.origin || '',
          destination: schedule.destination || '',
          city: schedule.city || '',
          state: schedule.state || '',
          tripDate: schedule.scheduledDate || new Date().toISOString().split('T')[0],
          waypoints: schedule.waypoints || []
        });
        const vehicle = vehicles.find(v => v.id === schedule.vehicleId);
        if (vehicle) setSelectedVehicle(vehicle);
        
        // Extrai justificativa se houver
        if (schedule.notes?.includes('[JUSTIFICATIVA RODÍZIO]')) {
          const parts = schedule.notes.split('\n');
          const justificationLine = parts.find(p => p.includes('[JUSTIFICATIVA RODÍZIO]'));
          if (justificationLine) setAdminJustification(justificationLine);
        }

        setStep(1); // Pula seleção de tipo se vier de agendamento
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  useEffect(() => {
    if (selectedVehicle) {
      setChecklist(prev => ({ ...prev, km: selectedVehicle.currentKm }));
    }
  }, [selectedVehicle]);

  const isDestSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(route.city, route.state, route.destination);
  }, [route.city, route.state, route.destination]);

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
    const now = new Date().toISOString();
    const finalObservations = [
      `MODALIDADE: ${opType === 'WEEKLY_ROUTINE' ? 'ROTINA SEMANAL' : 'VIAGEM PADRÃO'}`,
      adminJustification ? adminJustification : null,
      aiSuggestion ? `IA SUGGEST: ${aiSuggestion}` : null,
      checklist.comments ? `OBS_SAIDA: ${checklist.comments}` : null
    ].filter(Boolean).join(' | ');

    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      type: opType,
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      origin: opType === 'WEEKLY_ROUTINE' ? 'Base / Oficina' : route.origin,
      destination: opType === 'WEEKLY_ROUTINE' ? 'Área de Atuação Regional' : route.destination,
      waypoints: route.waypoints,
      city: route.city,
      state: route.state,
      startTime: now,
      startKm: checklist.km || selectedVehicle.currentKm,
      observations: finalObservations
    };

    const finalChecklist: Checklist = {
      ...checklist as Checklist,
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      timestamp: now,
      fuelLevel: selectedVehicle.fuelLevel
    };

    startTrip(newTrip, finalChecklist);
    if (scheduledTripId) deleteScheduledTrip(scheduledTripId);

    if (opType === 'STANDARD') {
      const originEnc = encodeURIComponent(route.origin);
      const destEnc = encodeURIComponent(`${route.destination}, ${route.city} - ${route.state}`);
      const waypointsEnc = route.waypoints.length > 0 ? `&waypoints=${route.waypoints.map(w => encodeURIComponent(w)).join('|')}` : '';
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originEnc}&destination=${destEnc}${waypointsEnc}&travelmode=driving`;
      window.open(googleMapsUrl, '_blank');
    }

    if (onComplete) onComplete();
  };

  const handleOptimizeRoute = async () => {
    if (!route.origin || !route.destination) {
      alert("Informe origem e destino.");
      return;
    }
    setIsOptimizing(true);
    try {
      const result = await getOptimizedRoute(route.origin, route.destination, route.waypoints);
      setAiSuggestion(result.text);
    } catch (error) {
      setAiSuggestion("Otimização indisponível.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const availableVehicles = vehicles.filter(v => v.status === VehicleStatus.AVAILABLE || v.id === selectedVehicle?.id);

  const getVehicleRestriction = (vehicle: Vehicle) => {
    if (!isDestSaoPaulo || !route.tripDate) return null;
    const [y, m, d] = route.tripDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    if (checkSPRodizio(vehicle.plate, dateObj)) {
      return getRodizioDayLabel(vehicle.plate);
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      {/* Step Indicator */}
      {step > 0 && (
        <div className="flex items-center justify-between mb-10 px-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
              step >= s ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-300'
            }`}>
              <span className="font-write">{s}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        {/* Step 0: Modalidade */}
        {step === 0 && (
          <div className="p-10 space-y-8 animate-in fade-in duration-500 text-center">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Qual o tipo de atividade hoje?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={() => { setOpType('STANDARD'); setStep(1); }}
                className="p-10 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all group flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  <i className="fas fa-route"></i>
                </div>
                <div>
                  <p className="font-write text-slate-900 uppercase tracking-widest">Viagem Padrão</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Ponto a ponto, agendada ou avulsa com GPS.</p>
                </div>
              </button>
              <button 
                onClick={() => { setOpType('WEEKLY_ROUTINE'); setStep(2); }}
                className="p-10 rounded-[2rem] border-2 border-slate-100 hover:border-emerald-600 hover:bg-emerald-50 transition-all group flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  <i className="fas fa-calendar-week"></i>
                </div>
                <div>
                  <p className="font-write text-slate-900 uppercase tracking-widest">Rotina Semanal</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Atividades recorrentes, equipes de campo e rondas.</p>
                </div>
              </button>
            </div>
            <button onClick={onComplete} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold mt-4">Voltar ao Início</button>
          </div>
        )}

        {/* Step 1: Configuração de Rota (Apenas para STANDARD) */}
        {step === 1 && opType === 'STANDARD' && (
          <div className="p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">1. Planejamento da Jornada</h3>
              <button onClick={handleOptimizeRoute} disabled={isOptimizing} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-write uppercase tracking-widest flex items-center gap-2">
                <i className={`fas ${isOptimizing ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'}`}></i> IA Otimizar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <input type="date" value={route.tripDate} onChange={(e) => setRoute({...route, tripDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
              <select value={route.state} onChange={(e) => setRoute({...route, state: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                <option value="">UF...</option>
                {states.map(s => <option key={s.sigla} value={s.sigla}>{s.sigla}</option>)}
              </select>
              <input placeholder="Cidade" value={route.city} onChange={(e) => setRoute({...route, city: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
            </div>
            <div className="space-y-4">
              <input placeholder="Origem" value={route.origin} onChange={(e) => setRoute({...route, origin: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
              <input placeholder="Destino Final" value={route.destination} onChange={(e) => setRoute({...route, destination: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" />
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(0)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Trocar Tipo</button>
              <button disabled={!route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl">Próximo</button>
            </div>
          </div>
        )}

        {/* Step 2: Escolha de Veículo com Bloqueio Estrito */}
        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               {isDestSaoPaulo && (
                 <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-[9px] font-write uppercase tracking-widest border border-blue-100 animate-pulse">
                   Destino: São Paulo (Rodízio Ativo)
                 </span>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableVehicles.map(v => {
                const restriction = getVehicleRestriction(v);
                const isRestricted = !!restriction;

                return (
                  <button 
                    key={v.id} 
                    disabled={isRestricted}
                    onClick={() => setSelectedVehicle(v)} 
                    className={`p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group ${
                      selectedVehicle?.id === v.id ? 'border-blue-600 bg-blue-50' : 
                      isRestricted ? 'border-red-100 bg-red-50/20 grayscale-[0.8] opacity-60 cursor-not-allowed' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <p className="text-xl font-write tracking-widest text-slate-950">{v.plate}</p>
                       {isRestricted && (
                         <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[8px] font-write uppercase shadow-sm">
                           Rodízio: {restriction}
                         </span>
                       )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                    
                    {isRestricted && (
                      <div className="absolute inset-0 bg-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="bg-red-600 text-white px-4 py-2 rounded-xl text-[9px] font-write uppercase shadow-xl">Bloqueio Operacional</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-50">
              <button onClick={() => setStep(opType === 'WEEKLY_ROUTINE' ? 0 : 1)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button 
                disabled={!selectedVehicle} 
                onClick={() => setStep(3)} 
                className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Checklist */}
        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist de {opType === 'WEEKLY_ROUTINE' ? 'Início de Semana' : 'Saída'}</h3>
            
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center font-bold tracking-widest">Odômetro Atual no {selectedVehicle?.plate}</label>
                <input type="number" value={checklist.km} onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} className="w-full p-5 rounded-3xl border-2 font-write text-3xl text-center bg-white outline-none" />
            </div>

            {opType === 'WEEKLY_ROUTINE' && (
              <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <i className="fas fa-gas-pump"></i>
                  </div>
                  <div>
                    <h4 className="text-xs font-write text-emerald-900 uppercase tracking-widest">Abastecimento Inicial da Semana</h4>
                    <p className="text-[9px] text-emerald-600 font-bold uppercase">Informe quanto foi abastecido para iniciar a rotina</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-900 uppercase ml-1">Valor (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={checklist.weeklyFuelAmount || ''} 
                      onChange={(e) => setChecklist({...checklist, weeklyFuelAmount: parseFloat(e.target.value) || 0})} 
                      className="w-full p-4 rounded-2xl border-none font-bold outline-none shadow-inner bg-slate-800 !text-white" 
                      placeholder="0,00" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-900 uppercase ml-1">Litros (L)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={checklist.weeklyFuelLiters || ''} 
                      onChange={(e) => setChecklist({...checklist, weeklyFuelLiters: parseFloat(e.target.value) || 0})} 
                      className="w-full p-4 rounded-2xl border-none font-bold outline-none shadow-inner bg-slate-800 !text-white" 
                      placeholder="0.0" 
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                {['oilChecked', 'waterChecked', 'tiresChecked'].map(key => (
                  <button key={key} onClick={() => setChecklist({ ...checklist, [key]: !checklist[key as keyof Checklist] })} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${checklist[key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                    <i className="fas fa-check-circle text-xl"></i>
                    <span className="text-[10px] font-write uppercase tracking-widest">{key.replace('Checked','')} OK</span>
                  </button>
                ))}
            </div>

            <textarea placeholder="Relate aqui o estado do veículo..." value={checklist.comments} onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm outline-none min-h-[140px]" />

            <div className="flex justify-between pt-6 border-t border-slate-50">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl">Revisar e Iniciar</button>
            </div>
          </div>
        )}

        {/* Step 4: Finalização */}
        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">
              <i className="fas fa-flag-checkered"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Confirmação de Abertura</h3>
            
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-left space-y-6">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Tipo de Operação</p>
                    <p className="text-sm font-bold text-indigo-600 uppercase">{opType === 'WEEKLY_ROUTINE' ? 'Rotina Semanal' : 'Viagem Padrão'}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Veículo</p>
                    <p className="text-sm font-bold text-slate-900">{selectedVehicle?.plate}</p>
                 </div>
               </div>

               {adminJustification && (
                 <div className="bg-amber-100 p-5 rounded-2xl border border-amber-200 animate-in shake duration-500">
                    <div className="flex items-center gap-2 mb-2 text-amber-800">
                       <i className="fas fa-user-shield"></i>
                       <span className="text-[10px] font-write uppercase tracking-widest">Viagem Autorizada por Gestor</span>
                    </div>
                    <p className="text-xs text-amber-900 font-medium italic">"{adminJustification}"</p>
                 </div>
               )}

               {opType === 'WEEKLY_ROUTINE' && (
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Abastecimento Inicial Declarado</p>
                    <p className="text-sm font-bold text-emerald-600">R$ {checklist.weeklyFuelAmount?.toFixed(2)} ({checklist.weeklyFuelLiters}L)</p>
                  </div>
               )}
            </div>

            <div className="pt-8 space-y-4">
              <button onClick={handleStartTrip} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-emerald-700 transition-all active:scale-95">
                ABRIR SEMANA / INICIAR
              </button>
              <button onClick={() => setStep(3)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar ao Checklist</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
