
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

  const handleCancelWizard = () => {
    const confirmMsg = scheduledTripId 
      ? 'Deseja encerrar a preparação? O agendamento continuará salvo na sua agenda.'
      : 'Deseja realmente cancelar a preparação desta viagem?';
      
    if (window.confirm(confirmMsg)) {
      if (onComplete) onComplete();
    }
  };

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);
  const isSaoPaulo = useMemo(() => isLocationSaoPaulo(route.city, route.state, route.destination), [route.city, route.state, route.destination]);

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
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
      observations: checklist.comments
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
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${originEnc}&destination=${destEnc}&travelmode=driving`, '_blank');

    if (onComplete) onComplete();
  };

  const availableVehicles = vehicles.filter(v => v.status === VehicleStatus.AVAILABLE);

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
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">1. Definição da Rota</h3>
            <div className="space-y-4">
              <input placeholder="Origem" value={route.origin} onChange={(e) => setRoute({ ...route, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32" />
              <input placeholder="Destino Final" value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32" />
            </div>
            <div className="flex justify-between">
              <button onClick={handleCancelWizard} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Abandonar</button>
              <button disabled={!route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest">Próximo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-400 uppercase">Apenas Disponíveis</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableVehicles.map(v => (
                <button 
                  key={v.id} 
                  onClick={() => setSelectedVehicle(v)} 
                  className={`p-6 rounded-3xl border-2 text-left transition-all ${selectedVehicle?.id === v.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}
                >
                  <p className="text-xl font-write tracking-widest">{v.plate}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                </button>
              ))}
              {availableVehicles.length === 0 && (
                <div className="md:col-span-2 py-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold text-xs uppercase">Nenhum veículo disponível no momento.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(1)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <div className="flex gap-4">
                <button type="button" onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4 hover:bg-red-50 rounded-xl transition-colors">CANCELAR</button>
                <button disabled={!selectedVehicle} onClick={() => setStep(3)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30">Próximo</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist</h3>
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center font-bold">KM Atual</label>
                <input type="number" value={checklist.km} onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} className="w-full p-5 rounded-3xl border-2 font-write text-3xl text-center scroll-mt-40" />
            </div>
            <div className="grid grid-cols-3 gap-4">
                {['oilChecked', 'waterChecked', 'tiresChecked'].map(key => (
                  <button key={key} onClick={() => setChecklist({ ...checklist, [key]: !checklist[key as keyof Checklist] })} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 ${checklist[key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                    <i className="fas fa-check-circle text-xl"></i>
                    <span className="text-[10px] font-write uppercase">{key.replace('Checked','')}</span>
                  </button>
                ))}
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked || isKmInvalid} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest">Revisar</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Confirmar Início?</h3>
            <button onClick={handleStartTrip} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl">INICIAR AGORA</button>
            <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
