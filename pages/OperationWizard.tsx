
import React, { useState, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus } from '../types';
import { checkSPRodizio, getRodizioDayLabel, getRestrictedDigitsForDate } from '../utils/trafficRules';

interface OperationWizardProps {
  scheduledTripId?: string;
  onComplete?: () => void;
}

const OperationWizard: React.FC<OperationWizardProps> = ({ scheduledTripId, onComplete }) => {
  const { vehicles, scheduledTrips, currentUser, startTrip, deleteScheduledTrip } = useFleet();
  const [step, setStep] = useState(1);
  
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState<Partial<Checklist>>({
    km: 0,
    fuelLevel: 50,
    oilChecked: false,
    waterChecked: false,
    tiresChecked: false,
    comments: ''
  });

  const [route, setRoute] = useState({
    origin: '',
    destination: '',
    waypoints: [] as string[],
    city: '',
    state: '',
    tripDate: new Date().toISOString().split('T')[0],
    observations: ''
  });

  useEffect(() => {
    if (scheduledTripId) {
      const schedule = scheduledTrips.find(s => s.id === scheduledTripId);
      if (schedule) {
        setRoute(prev => ({
          ...prev,
          origin: schedule.origin || '',
          destination: schedule.destination || '',
          waypoints: schedule.waypoints || [],
          city: schedule.city || '',
          state: schedule.state || '',
          tripDate: schedule.scheduledDate || new Date().toISOString().split('T')[0],
          observations: schedule.notes || ''
        }));
        
        const vehicle = vehicles.find(v => v.id === schedule.vehicleId);
        if (vehicle) setSelectedVehicle(vehicle);
        setStep(2);
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

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);
  const isChecklistValid = checklist.oilChecked && checklist.waterChecked && checklist.tiresChecked && !isKmInvalid && (checklist.km ?? 0) > 0;
  
  const normalizeText = (txt: string) => txt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const cityNorm = normalizeText(route.city);
  const stateNorm = normalizeText(route.state);
  const isSaoPaulo = cityNorm.includes('sao paulo') || cityNorm === 'sp' || stateNorm === 'sp';

  const getSafeTripDate = () => {
    if (!route.tripDate) return new Date();
    const [year, month, day] = route.tripDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) {
      alert("Erro: Motorista ou Veículo não identificados.");
      return;
    }
    
    const deviceStartTime = new Date().toISOString();
    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      origin: route.origin,
      destination: route.destination,
      city: route.city,
      state: route.state,
      startTime: deviceStartTime,
      startKm: checklist.km || selectedVehicle.currentKm,
      observations: route.observations
    };

    const finalChecklist: Checklist = {
      ...checklist as Checklist,
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      timestamp: deviceStartTime
    };

    // 1. Inicia no contexto
    startTrip(newTrip, finalChecklist);
    if (scheduledTripId) deleteScheduledTrip(scheduledTripId);

    // 2. Auto-abre o Google Maps com a rota
    const originEnc = encodeURIComponent(route.origin);
    const destEnc = encodeURIComponent(`${route.destination}, ${route.city} - ${route.state}`);
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${originEnc}&destination=${destEnc}&travelmode=driving`, '_blank');

    alert('Viagem Iniciada! Abrindo rota no GPS...');
    onComplete?.();
  };

  const handleAbortOperation = () => {
    if (window.confirm('Deseja cancelar o início desta viagem e voltar ao menu principal?')) {
      onComplete?.();
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between mb-10 px-4">
        {[
          { s: 1, label: 'Rota', icon: 'fa-map-location-dot' },
          { s: 2, label: 'Veículo', icon: 'fa-truck-pickup' },
          { s: 3, label: 'Checklist', icon: 'fa-clipboard-check' },
          { s: 4, label: 'Início', icon: 'fa-flag-checkered' }
        ].map((item) => (
          <div key={item.s} className="flex flex-col items-center flex-1 relative">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 z-10 ${
              step >= item.s ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-300'
            }`}>
              <i className={`fas ${item.icon}`}></i>
            </div>
            <span className={`text-[9px] mt-3 font-write uppercase tracking-widest ${step >= item.s ? 'text-slate-900' : 'text-slate-300'}`}>
              {item.label}
            </span>
            {item.s < 4 && (
              <div className={`absolute top-6 left-1/2 w-full h-[2px] -z-0 ${step > item.s ? 'bg-slate-900' : 'bg-slate-100'}`}></div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {step === 1 && (
          <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl">
                <i className="fas fa-route"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Definição do Trajeto</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Informe localidade e endereços para validação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Data da Viagem</label>
                <input type="date" value={route.tripDate} onChange={(e) => setRoute({ ...route, tripDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-write text-slate-900" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Cidade de Destino</label>
                <input placeholder="Ex: São Paulo" value={route.city} onChange={(e) => setRoute({ ...route, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-write text-slate-900" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Estado (UF)</label>
                <input placeholder="Ex: SP" maxLength={2} value={route.state} onChange={(e) => setRoute({ ...route, state: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-write text-slate-900" />
              </div>
            </div>

            {isSaoPaulo && (
              <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                   <i className="fas fa-triangle-exclamation"></i>
                </div>
                <div>
                  <h4 className="text-[10px] font-write text-amber-900 uppercase tracking-widest mb-1">Validação de Rodízio Ativa</h4>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">Destino <b>São Paulo</b> identificado. Na próxima etapa, o sistema filtrará os veículos com restrição.</p>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest">Ponto de Origem</label>
                <input placeholder="Logradouro, número, bairro..." value={route.origin} onChange={(e) => setRoute({ ...route, origin: e.target.value })} className="w-full p-4 bg-white rounded-2xl border border-slate-200 font-write text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest">Ponto de Chegada</label>
                <input placeholder="Logradouro, número, bairro..." value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })} className="w-full p-4 bg-white rounded-2xl border border-slate-200 font-write text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button onClick={handleAbortOperation} className="text-[10px] font-write text-red-500 uppercase tracking-widest hover:text-red-700">Cancelar Início</button>
              <button disabled={!route.city || !route.state || !route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest hover:bg-blue-900 disabled:opacity-30 transition-all shadow-xl shadow-slate-200">Próximo: Veículo <i className="fas fa-arrow-right ml-2"></i></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Seleção de Veículo</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Viagem para: <span className="text-slate-900 font-bold">{route.city}/{route.state}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => {
                const tripDateObj = getSafeTripDate();
                const restricted = isSaoPaulo && checkSPRodizio(v.plate, tripDateObj);
                return (
                  <button key={v.id} disabled={restricted} onClick={() => setSelectedVehicle(v)} className={`group p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden ${restricted ? 'bg-red-50 border-red-100 cursor-not-allowed opacity-80' : selectedVehicle?.id === v.id ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-50' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50 shadow-sm'}`}>
                    {restricted && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] animate-in fade-in duration-300">
                         <div className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-write uppercase tracking-widest shadow-xl flex items-center gap-2 mb-2 scale-110"><i className="fas fa-ban"></i> RODÍZIO: {getRodizioDayLabel(v.plate)}</div>
                         <p className="text-[9px] text-red-900 font-bold uppercase tracking-tight text-center px-4">Placa Final {v.plate.slice(-1)} bloqueada</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm border ${restricted ? 'bg-red-100 text-red-300 border-red-200' : 'bg-white text-blue-600 border-slate-100'}`}><i className={`fas ${restricted ? 'fa-triangle-exclamation' : 'fa-truck'}`}></i></div>
                      <div className="flex-1 overflow-hidden"><p className={`text-xl font-write tracking-widest ${restricted ? 'text-red-300' : 'text-slate-900'}`}>{v.plate}</p><p className="text-[10px] text-slate-400 font-bold uppercase truncate">{v.model}</p></div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 flex justify-between pt-6 border-t border-slate-50">
              <button onClick={() => setStep(1)} className="px-8 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest hover:text-slate-900">Voltar</button>
              <div className="flex gap-4">
                <button onClick={handleAbortOperation} className="px-6 py-4 text-red-500 font-write uppercase text-[9px] tracking-widest">Abortar</button>
                <button disabled={!selectedVehicle} onClick={() => setStep(3)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-20 transition-all">Próximo: Checklist</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Checklist Técnico</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Veículo: <span className="text-blue-600 font-bold">{selectedVehicle?.plate}</span></p>
              </div>
            </div>
            
            <div className="space-y-8">
              <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 tracking-widest">KM Atual no Painel</label>
                <input type="number" value={checklist.km} onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} className={`w-full p-5 rounded-3xl border-2 font-write text-slate-900 text-3xl text-center focus:ring-4 outline-none transition-all ${isKmInvalid ? 'border-red-400 bg-red-50 ring-red-100' : 'border-slate-200 bg-white focus:ring-blue-50 shadow-inner'}`} />
                {isKmInvalid && <p className="text-[10px] mt-3 text-red-500 font-bold uppercase text-center">KM inválido: deve ser maior ou igual a {selectedVehicle?.currentKm}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { key: 'oilChecked', label: 'Nível Óleo', icon: 'fa-oil-can' },
                  { key: 'waterChecked', label: 'Arrefecimento', icon: 'fa-tint' },
                  { key: 'tiresChecked', label: 'Pneus/Calib.', icon: 'fa-car' }
                ].map(item => {
                  const isChecked = checklist[item.key as keyof Checklist];
                  return (
                    <button key={item.key} onClick={() => setChecklist({ ...checklist, [item.key]: !isChecked })} className={`p-8 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-4 transition-all ${isChecked ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-xl shadow-emerald-100' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}>
                      <i className={`fas ${item.icon} text-2xl`}></i>
                      <span className="font-write text-[10px] uppercase tracking-widest">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Campo de Anotações do Condutor */}
              <div className="pt-4">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest">Anotações do Condutor (Opcional)</label>
                <textarea 
                  placeholder="Descreva aqui se notar algum detalhe no veículo (riscos, luzes acesas, etc)..." 
                  value={checklist.comments} 
                  onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })}
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 text-xs min-h-[120px] shadow-inner"
                />
              </div>
            </div>

            <div className="mt-12 flex justify-between pt-8 border-t border-slate-50">
              <button onClick={() => setStep(2)} className="px-8 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest">Trocar Veículo</button>
              <div className="flex gap-4">
                <button onClick={handleAbortOperation} className="px-6 py-4 text-red-500 font-write uppercase text-[9px] tracking-widest">Desistir</button>
                <button disabled={!isChecklistValid} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-20 transition-all">Revisar e Iniciar</button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner"><i className="fas fa-check-double"></i></div>
              <h3 className="text-2xl font-bold text-slate-800">Tudo Pronto para Partir?</h3>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Ao clicar em iniciar, abriremos o seu GPS automaticamente</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-write text-slate-400 uppercase tracking-widest">Veículo</span>
                  <div className="flex items-center gap-3"><span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-mono text-xs">{selectedVehicle?.plate}</span><span className="font-bold text-slate-700">{selectedVehicle?.model}</span></div>
               </div>
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                  <span className="text-[9px] font-write text-slate-400 uppercase tracking-widest">Destino</span>
                  <p className="font-bold text-slate-700 uppercase">{route.city} / {route.state}</p>
               </div>
            </div>

            <div className="pt-10 flex flex-col md:flex-row gap-4">
              <button onClick={() => setStep(3)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest border border-slate-100 rounded-2xl">Voltar Checklist</button>
              <button onClick={handleStartTrip} className="flex-[2] bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl shadow-emerald-100 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"><i className="fas fa-play"></i> INICIAR VIAGEM AGORA</button>
            </div>
            <button onClick={handleAbortOperation} className="w-full text-center text-[10px] font-write text-slate-400 uppercase tracking-widest hover:text-red-500 mt-4">Cancelar tudo e voltar</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
