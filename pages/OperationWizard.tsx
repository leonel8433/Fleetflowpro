
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus, TripType } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';
import { getOptimizedRoute } from '../services/geminiService';

interface OperationWizardProps {
  scheduledTripId?: string;
  onComplete?: () => void;
}

const OperationWizard: React.FC<OperationWizardProps> = ({ scheduledTripId, onComplete }) => {
  const { vehicles, scheduledTrips, currentUser, startTrip, deleteScheduledTrip, updateVehicle } = useFleet();
  const [step, setStep] = useState(0); 
  const [opType, setOpType] = useState<TripType>('STANDARD');
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  
  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingLocs, setIsLoadingLocs] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [adminJustification, setAdminJustification] = useState<string>('');
  const [scheduledNotes, setScheduledNotes] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [checklist, setChecklist] = useState<Partial<Checklist>>({
    km: 0,
    fuelLevel: 100,
    oilChecked: false,
    waterChecked: false,
    tiresChecked: false,
    comments: '',
    damageDescription: '',
    damagePhoto: undefined,
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
        if (vehicle) {
          setSelectedVehicle(vehicle);
          setChecklist(prev => ({ ...prev, fuelLevel: vehicle.fuelLevel }));
        }
        
        // Separa justificativas administrativas de notas gerais
        if (schedule.notes) {
          const parts = schedule.notes.split('\n');
          const rodizioPart = parts.find(p => p.includes('[JUSTIFICATIVA RODÍZIO]'));
          if (rodizioPart) {
            setAdminJustification(rodizioPart.replace('[JUSTIFICATIVA RODÍZIO]: ', ''));
          }
          // Filtra o que não for tag de auditoria/justificativa para exibir como nota operacional
          const filteredNotes = parts.filter(p => !p.includes('[')).join('\n');
          setScheduledNotes(filteredNotes);
        }

        setStep(1); 
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  useEffect(() => {
    if (selectedVehicle) {
      setChecklist(prev => ({ 
        ...prev, 
        km: selectedVehicle.currentKm,
        fuelLevel: selectedVehicle.fuelLevel 
      }));
    }
  }, [selectedVehicle]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChecklist(prev => ({ ...prev, damagePhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isDestSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(route.city, route.state, route.destination);
  }, [route.city, route.state, route.destination]);

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
    const now = new Date().toISOString();
    const finalObservations = [
      `MODALIDADE: ${opType === 'WEEKLY_ROUTINE' ? 'ROTINA SEMANAL' : 'VIAGEM PADRÃO'}`,
      scheduledNotes ? `[NOTAS AGENDAMENTO]: ${scheduledNotes}` : null,
      adminJustification ? `[JUSTIFICATIVA RODÍZIO]: ${adminJustification}` : null,
      aiSuggestion ? `IA SUGGEST: ${aiSuggestion}` : null,
      checklist.damageDescription ? `AVARIA: ${checklist.damageDescription}` : null,
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
    };

    startTrip(newTrip, finalChecklist);
    updateVehicle(selectedVehicle.id, { fuelLevel: checklist.fuelLevel });

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

        {step === 1 && opType === 'STANDARD' && (
          <div className="p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">1. Planejamento da Jornada</h3>
              <button onClick={handleOptimizeRoute} disabled={isOptimizing} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-write uppercase tracking-widest flex items-center gap-2">
                <i className={`fas ${isOptimizing ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'}`}></i> IA Otimizar
              </button>
            </div>

            {scheduledNotes && (
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 animate-in slide-in-from-top-2">
                 <div className="flex items-center gap-2 mb-2 text-indigo-800">
                    <i className="fas fa-clipboard-list text-sm"></i>
                    <span className="text-[10px] font-write uppercase tracking-widest">Instruções do Agendamento:</span>
                 </div>
                 <p className="text-sm font-bold text-indigo-900 italic leading-relaxed">"{scheduledNotes}"</p>
              </div>
            )}

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

            {route.origin && route.destination && (
              <div className="w-full h-64 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-500 relative shadow-inner">
                <iframe
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  style={{ border: 0 }}
                  src={`https://www.google.com/maps?saddr=${encodeURIComponent(route.origin)}&daddr=${encodeURIComponent(route.destination + (route.city ? ', ' + route.city : ''))}&output=embed`}
                  allowFullScreen
                ></iframe>
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm pointer-events-none">
                   <p className="text-[10px] font-write text-slate-800 uppercase tracking-widest">Visualização da Rota</p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(0)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Trocar Tipo</button>
              <button disabled={!route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl">Próximo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500 overflow-y-auto max-h-[80vh] custom-scrollbar">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               {isDestSaoPaulo && (
                 <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 animate-pulse shadow-sm">
                    <i className="fas fa-traffic-light text-red-600 text-sm"></i>
                    <span className="text-[10px] font-write uppercase text-red-700 tracking-widest">Rodízio SP Ativo para esta Rota</span>
                 </div>
               )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableVehicles.map(v => {
                const restriction = getVehicleRestriction(v);
                const isRestricted = !!restriction;
                const canSelect = !isRestricted || isAdmin || adminJustification !== '';

                return (
                  <button 
                    key={v.id} 
                    disabled={!canSelect}
                    onClick={() => setSelectedVehicle(v)} 
                    className={`p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden group ${
                      selectedVehicle?.id === v.id ? 'border-blue-600 bg-blue-50 shadow-md' : 
                      !canSelect ? 'border-red-100 bg-red-50/20 grayscale-[0.8] opacity-60 cursor-not-allowed' : 'border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <p className="text-xl font-write tracking-widest text-slate-950">{v.plate}</p>
                       {isRestricted && (
                         <span className={`px-2 py-0.5 rounded text-[8px] font-write uppercase shadow-sm ${canSelect ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'}`}>
                           {restriction}
                         </span>
                       )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                    
                    {isRestricted && (
                      <div className={`mt-3 flex items-center gap-1.5 ${canSelect ? 'text-amber-600' : 'text-red-600'}`}>
                         <i className="fas fa-calendar-times text-[10px]"></i>
                         <span className="text-[8px] font-bold uppercase">Restrito na {restriction} (Placa final {v.plate.slice(-1)})</span>
                      </div>
                    )}
                    
                    {!canSelect && (
                      <div className="absolute inset-0 bg-white/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-6 text-center backdrop-blur-[1px]">
                         <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center mb-3 shadow-2xl">
                           <i className="fas fa-lock text-lg"></i>
                         </div>
                         <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-write uppercase shadow-xl mb-1.5">Bloqueio Rodízio</span>
                         <p className="text-[8px] text-red-800 font-bold uppercase leading-tight">Placa final {v.plate.slice(-1)} restrita para circulação em São Paulo nesta data ({restriction})</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedVehicle && getVehicleRestriction(selectedVehicle) && isAdmin && (
              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-200 animate-in shake duration-500">
                <p className="text-[10px] font-bold text-amber-700 uppercase mb-3 tracking-widest flex items-center gap-2">
                  <i className="fas fa-shield-halved text-amber-600"></i> Liberação Especial de Rodízio (Admin)
                </p>
                <textarea 
                  required
                  value={adminJustification}
                  onChange={(e) => setAdminJustification(e.target.value)}
                  placeholder="Justifique obrigatoriamente o motivo operacional da liberação deste veículo em dia restrito..."
                  className="w-full p-4 bg-white border border-amber-200 rounded-2xl font-bold text-sm outline-none min-h-[80px] focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            <div className="flex justify-between pt-6 border-t border-slate-50">
              <button onClick={() => setStep(opType === 'WEEKLY_ROUTINE' ? 0 : 1)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button 
                disabled={!selectedVehicle || (getVehicleRestriction(selectedVehicle) !== null && !isAdmin && adminJustification === '') || (getVehicleRestriction(selectedVehicle) !== null && isAdmin && adminJustification.trim() === '')} 
                onClick={() => setStep(3)} 
                className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500 overflow-y-auto max-h-[80vh] custom-scrollbar">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist de Saída</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center font-bold tracking-widest">Odômetro Atual ({selectedVehicle?.plate})</label>
                  <input type="number" value={checklist.km} onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} className="w-full p-4 rounded-2xl border-2 font-write text-2xl text-center bg-white outline-none" />
              </div>
              
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center font-bold tracking-widest">Nível de Combustível: {checklist.fuelLevel}%</label>
                  <div className="flex items-center gap-4">
                    <i className="fas fa-gas-pump text-slate-400"></i>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5" 
                      value={checklist.fuelLevel} 
                      onChange={(e) => setChecklist({ ...checklist, fuelLevel: parseInt(e.target.value) })} 
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <i className="fas fa-gas-pump text-blue-600"></i>
                  </div>
              </div>
            </div>

            {opType === 'WEEKLY_ROUTINE' && (
              <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                    <i className="fas fa-gas-pump"></i>
                  </div>
                  <div>
                    <h4 className="text-xs font-write text-emerald-900 uppercase tracking-widest">Abastecimento Inicial</h4>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" step="0.01" value={checklist.weeklyFuelAmount || ''} onChange={(e) => setChecklist({...checklist, weeklyFuelAmount: parseFloat(e.target.value) || 0})} className="p-4 rounded-2xl border-none font-bold outline-none shadow-inner bg-slate-800 !text-white" placeholder="Valor (R$)" />
                  <input type="number" step="0.1" value={checklist.weeklyFuelLiters || ''} onChange={(e) => setChecklist({...checklist, weeklyFuelLiters: parseFloat(e.target.value) || 0})} className="p-4 rounded-2xl border-none font-bold outline-none shadow-inner bg-slate-800 !text-white" placeholder="Litros (L)" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                {['oilChecked', 'waterChecked', 'tiresChecked'].map(key => (
                  <button key={key} onClick={() => setChecklist({ ...checklist, [key]: !checklist[key as keyof Checklist] })} className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${checklist[key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                    <i className="fas fa-check-circle text-xl"></i>
                    <span className="text-[8px] font-write uppercase tracking-widest">{key.replace('Checked','')} OK</span>
                  </button>
                ))}
            </div>

            <div className="bg-amber-50 p-8 rounded-[2rem] border border-amber-100 space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-write text-amber-900 uppercase tracking-widest flex items-center gap-2">
                  <i className="fas fa-car-burst text-amber-500"></i> Relatar Avaria / Dano no Veículo
                </h4>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white px-4 py-2 rounded-xl text-[10px] font-write uppercase text-slate-600 border border-amber-200 shadow-sm hover:bg-amber-100 transition-all"
                >
                  <i className="fas fa-camera mr-2"></i> {checklist.damagePhoto ? 'Alterar Foto' : 'Anexar Foto da Avaria'}
                </button>
                <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
              </div>

              {checklist.damagePhoto && (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border-4 border-white shadow-lg animate-in zoom-in-95">
                  <img src={checklist.damagePhoto} alt="Avaria registrada" className="w-full h-full object-cover" />
                  <button onClick={() => setChecklist(prev => ({ ...prev, damagePhoto: undefined }))} className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}

              <textarea 
                placeholder="Descreva detalhadamente qualquer avaria física identificada agora..." 
                value={checklist.damageDescription} 
                onChange={(e) => setChecklist({ ...checklist, damageDescription: e.target.value })} 
                className="w-full p-4 bg-white border border-amber-200 rounded-2xl font-bold text-sm outline-none min-h-[100px] placeholder:text-amber-200" 
              />
            </div>

            <textarea placeholder="Observações gerais complementares..." value={checklist.comments} onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm outline-none min-h-[120px]" />

            <div className="flex justify-between pt-6 border-t border-slate-50">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl">Revisar e Iniciar</button>
            </div>
          </div>
        )}

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

               {scheduledNotes && (
                 <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200">
                    <p className="text-[9px] font-write text-indigo-700 uppercase mb-1 tracking-widest">Instruções de Escala</p>
                    <p className="text-xs text-indigo-900 font-bold italic leading-relaxed">"{scheduledNotes}"</p>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Combustível Declarado</p>
                    <p className="text-sm font-bold text-slate-900">{checklist.fuelLevel}%</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">KM Declarado</p>
                    <p className="text-sm font-bold text-slate-900">{checklist.km} km</p>
                 </div>
               </div>

               {checklist.damagePhoto && (
                 <div className="bg-amber-100 p-4 rounded-2xl border border-amber-200">
                    <p className="text-[9px] font-write text-amber-700 uppercase mb-2">Avaria Registrada</p>
                    <div className="flex items-center gap-3">
                      <img src={checklist.damagePhoto} className="w-12 h-12 rounded-lg object-cover border-2 border-white" alt="" />
                      <p className="text-[10px] text-amber-900 font-medium truncate">{checklist.damageDescription || 'Sem descrição textual.'}</p>
                    </div>
                 </div>
               )}
            </div>

            <div className="pt-8 space-y-4">
              <button onClick={handleStartTrip} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-emerald-700 transition-all active:scale-95">
                CONCORDAR E INICIAR
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
