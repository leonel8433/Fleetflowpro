
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';
import { getOptimizedRoute } from '../services/geminiService';

interface OperationWizardProps {
  scheduledTripId?: string;
  onComplete?: () => void;
}

const OperationWizard: React.FC<OperationWizardProps> = ({ scheduledTripId, onComplete }) => {
  const { vehicles, scheduledTrips, drivers, currentUser, startTrip, deleteScheduledTrip } = useFleet();
  const [step, setStep] = useState(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  
  // Localidades IBGE
  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingLocs, setIsLoadingLocs] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState<Partial<Checklist>>({
    km: 0,
    oilChecked: false,
    waterChecked: false,
    tiresChecked: false,
    comments: ''
  });

  const [route, setRoute] = useState({
    origin: '',
    destination: '',
    city: '',
    state: '',
    tripDate: new Date().toISOString().split('T')[0],
    waypoints: [] as string[]
  });

  // Carregar Estados
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados:", err));
  }, []);

  // Carregar Cidades por UF
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
        setStep(2);
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  useEffect(() => {
    if (selectedVehicle) {
      setChecklist(prev => ({ ...prev, km: selectedVehicle.currentKm }));
    }
  }, [selectedVehicle]);

  const handleOptimizeRoute = async () => {
    if (!route.origin || !route.destination) {
      alert("Por favor, informe a origem e o destino para otimização.");
      return;
    }
    
    setIsOptimizing(true);
    setAiSuggestion(null);
    
    try {
      const result = await getOptimizedRoute(route.origin, route.destination, route.waypoints);
      setAiSuggestion(result.text);
    } catch (error) {
      console.error("Erro ao otimizar rota:", error);
      setAiSuggestion("Não foi possível obter sugestões da IA no momento.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);
  
  const isSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(route.city, route.state, route.destination);
  }, [route.city, route.state, route.destination]);

  const getSafeTripDate = () => {
    if (!route.tripDate) return new Date();
    const [year, month, day] = route.tripDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
    if (isSaoPaulo && checkSPRodizio(selectedVehicle.plate, getSafeTripDate())) {
      alert(`BLOQUEIO DE SEGURANÇA: Este veículo não pode circular em SP hoje devido ao rodízio (${getRodizioDayLabel(selectedVehicle.plate)}).`);
      return;
    }

    const now = new Date().toISOString();
    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      origin: route.origin,
      destination: route.destination,
      waypoints: route.waypoints,
      city: route.city,
      state: route.state,
      startTime: now,
      startKm: checklist.km || selectedVehicle.currentKm,
      observations: `${aiSuggestion ? `SUGESTÃO IA: ${aiSuggestion.slice(0, 300)}... ` : ''}${checklist.comments ? `| ANOTAÇÕES INICIAIS: ${checklist.comments}` : ''}`
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

    const originEnc = encodeURIComponent(route.origin);
    const destEnc = encodeURIComponent(`${route.destination}, ${route.city} - ${route.state}`);
    const waypointsEnc = route.waypoints.length > 0 
      ? `&waypoints=${route.waypoints.map(w => encodeURIComponent(w)).join('|')}` 
      : '';
      
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${originEnc}&destination=${destEnc}${waypointsEnc}&travelmode=driving`, '_blank');

    if (onComplete) onComplete();
  };

  // Correção da lógica de cancelamento (Foco da reclamação do usuário)
  const handleCancelWizard = () => {
    if (scheduledTripId) {
      const choice = window.confirm('Deseja APAGAR este agendamento da sua escala?\n\nClique OK para apagar o agendamento.\nClique CANCELAR para apenas sair e manter o agendamento salvo.');
      if (choice) {
        deleteScheduledTrip(scheduledTripId);
        alert('Agendamento removido.');
      }
    } else {
      if (!window.confirm('Deseja realmente cancelar a preparação desta viagem?')) {
        return;
      }
    }
    
    // Agora sempre chama onComplete para garantir que o usuário saia da tela
    if (onComplete) onComplete();
  };

  const addWaypoint = () => {
    setRoute(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  };

  const removeWaypoint = (index: number) => {
    setRoute(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
  };

  const updateWaypoint = (index: number, value: string) => {
    const newWaypoints = [...route.waypoints];
    newWaypoints[index] = value;
    setRoute(prev => ({ ...prev, waypoints: newWaypoints }));
  };

  const mapUrl = useMemo(() => {
    const origin = encodeURIComponent(route.origin);
    const destination = encodeURIComponent(route.destination + (route.city ? ', ' + route.city : '') + (route.state ? ' - ' + route.state : ''));
    const validWaypoints = route.waypoints.filter(w => w.trim() !== '');
    
    let daddr = destination;
    if (validWaypoints.length > 0) {
      daddr = validWaypoints.map(w => encodeURIComponent(w)).join('+to:') + '+to:' + destination;
    }
    
    return `https://www.google.com/maps?saddr=${origin}&daddr=${daddr}&output=embed`;
  }, [route.origin, route.destination, route.city, route.state, route.waypoints]);

  const showMapPreview = route.origin && route.destination;

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between mb-10 px-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
            step >= s ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-300'
          }`}>
            <span className="font-write">{s}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        {step === 1 && (
          <div className="p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">1. Definição da Rota</h3>
              <button 
                type="button" 
                onClick={handleOptimizeRoute}
                disabled={!route.origin || !route.destination || isOptimizing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-write uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                <i className={`fas ${isOptimizing ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                {isOptimizing ? 'Analisando...' : 'Consultar Rota Inteligente'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Viagem</label>
                <input type="date" value={route.tripDate} onChange={(e) => setRoute({ ...route, tripDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950 scroll-mt-20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Estado (UF)</label>
                  <select 
                    value={route.state} 
                    onChange={(e) => setRoute({ ...route, state: e.target.value, city: '' })} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950"
                  >
                    <option value="">Selecione...</option>
                    {states.map(s => <option key={s.sigla} value={s.sigla}>{s.sigla} - {s.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 flex justify-between">
                    Cidade
                    {isLoadingLocs && <i className="fas fa-circle-notch fa-spin text-blue-500"></i>}
                  </label>
                  <input 
                    list="wizard-cities"
                    placeholder={route.state ? "Digite ou selecione..." : "UF primeiro"}
                    disabled={!route.state}
                    value={route.city} 
                    onChange={(e) => setRoute({ ...route, city: e.target.value })} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950 scroll-mt-20" 
                  />
                  <datalist id="wizard-cities">
                    {cities.map((c, i) => <option key={i} value={c} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ponto de Partida</label>
                <input placeholder="Endereço de Origem" value={route.origin} onChange={(e) => setRoute({ ...route, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950 scroll-mt-20" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Paradas Intermediárias</label>
                  <button type="button" onClick={addWaypoint} className="text-[10px] bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold uppercase hover:bg-slate-800 transition-all">
                    <i className="fas fa-plus mr-1"></i> Add Parada
                  </button>
                </div>
                <div className="space-y-2">
                  {route.waypoints.map((wp, index) => (
                    <div key={index} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                      <input 
                        placeholder={`Endereço da parada ${index + 1}...`} 
                        value={wp} 
                        onChange={(e) => updateWaypoint(index, e.target.value)} 
                        className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-write font-bold text-xs text-slate-950 scroll-mt-20"
                      />
                      <button type="button" onClick={() => removeWaypoint(index)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white transition-all">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ponto de Chegada</label>
                <input placeholder="Endereço de Destino Final" value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950 scroll-mt-20" />
              </div>
            </div>

            {showMapPreview && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-map-marked-alt text-blue-500"></i> Pré-visualização do Trajeto Planejado
                </label>
                <div className="w-full h-80 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner relative group">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0, filter: 'grayscale(0.1) brightness(0.95)' }}
                    src={mapUrl}
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={handleCancelWizard} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Abandonar Operação</button>
              <button disabled={!route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Veículo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-500 uppercase">Apenas Disponíveis</span>
            </div>

            {isSaoPaulo && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <i className="fas fa-traffic-light text-amber-600 mt-1"></i>
                <div>
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Zona de Rodízio Detectada: São Paulo</p>
                  <p className="text-[9px] text-amber-700 font-medium leading-relaxed">O sistema validará automaticamente o rodízio para {getSafeTripDate().toLocaleDateString('pt-BR', { weekday: 'long' })}.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => {
                const restricted = isSaoPaulo && checkSPRodizio(v.plate, getSafeTripDate());
                
                const todayStr = new Date().toISOString().split('T')[0];
                const reservation = scheduledTrips.find(s => s.vehicleId === v.id && s.scheduledDate === todayStr);
                const isReservedForOther = reservation && reservation.driverId !== currentUser?.id;
                const reservationDriverName = isReservedForOther ? drivers.find(d => d.id === reservation.driverId)?.name : null;

                return (
                  <button 
                    key={v.id} 
                    disabled={restricted || isReservedForOther} 
                    onClick={() => setSelectedVehicle(v)} 
                    className={`p-6 rounded-3xl border-2 text-left relative overflow-hidden transition-all ${
                      restricted || isReservedForOther
                      ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed grayscale' 
                      : selectedVehicle?.id === v.id 
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' 
                        : 'border-slate-100 hover:border-blue-200 shadow-sm'
                    }`}
                  >
                    <div className="relative">
                      <p className="text-xl font-write tracking-widest text-slate-950">{v.plate}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                    </div>
                  </button>
                );
              })}
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length === 0 && (
                <div className="md:col-span-2 py-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold text-xs uppercase">Nenhum veículo disponível no momento.</p>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(1)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar: Rota</button>
              <div className="flex gap-4">
                <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4 hover:bg-red-50 rounded-xl transition-colors">CANCELAR</button>
                <button disabled={!selectedVehicle} onClick={() => setStep(3)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Checklist</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist de Saída</h3>
            <div className={`p-8 rounded-3xl border transition-all ${isKmInvalid ? 'bg-red-50/30 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center tracking-widest font-bold">KM Atual no Painel do {selectedVehicle?.plate}</label>
                <input 
                  type="number" 
                  value={checklist.km} 
                  onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} 
                  className="w-full p-5 rounded-3xl border-2 font-write text-3xl text-center outline-none bg-white text-slate-950 scroll-mt-20" 
                />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'oilChecked', label: 'Óleo' },
                  { key: 'waterChecked', label: 'Água' },
                  { key: 'tiresChecked', label: 'Pneus' }
                ].map(item => (
                  <button key={item.key} onClick={() => setChecklist({ ...checklist, [item.key]: !checklist[item.key as keyof Checklist] })} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${checklist[item.key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg' : 'bg-white border-slate-100 text-slate-300'}`}>
                    <i className={`fas ${checklist[item.key as keyof Checklist] ? 'fa-check-circle' : 'fa-circle-notch'} text-xl`}></i>
                    <span className="text-[10px] font-write uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest font-bold">Anotações do Condutor</label>
                <textarea 
                  placeholder="Relate aqui qualquer observação sobre o veículo..." 
                  value={checklist.comments} 
                  onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })} 
                  className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-950 text-sm outline-none min-h-[120px] scroll-mt-20"
                />
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Trocar Veículo</button>
              <div className="flex gap-4">
                <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4">Cancelar</button>
                <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked || isKmInvalid} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Revisar e Iniciar</button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-6"><i className="fas fa-check-double"></i></div>
            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Confirmar Início?</h3>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left">
               <p className="text-[10px] text-slate-400 font-bold uppercase">Resumo</p>
               <p className="text-sm font-bold text-slate-700">Veículo: {selectedVehicle?.plate}</p>
               <p className="text-sm font-bold text-slate-700">Destino: {route.destination}</p>
            </div>
            <div className="pt-8 flex flex-col gap-4">
              <button onClick={handleStartTrip} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-emerald-700 transition-all">INICIAR AGORA</button>
              <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold">Cancelar Operação</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
