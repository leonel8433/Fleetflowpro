
import React, { useState, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus } from '../types';
import { checkSPRodizio, getRodizioDayLabel } from '../utils/trafficRules';

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
    tripDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (scheduledTripId) {
      const schedule = scheduledTrips.find(s => s.id === scheduledTripId);
      if (schedule) {
        setRoute({
          origin: schedule.origin || '',
          destination: schedule.destination || '',
          city: schedule.city || '',
          state: schedule.state || '',
          tripDate: schedule.scheduledDate || new Date().toISOString().split('T')[0]
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

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);
  
  // Normalização para identificar São Paulo
  const cityNorm = (route.city || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const stateNorm = (route.state || '').toUpperCase().trim();
  const isSaoPaulo = cityNorm.includes('sao paulo') || cityNorm === 'sp' || stateNorm === 'SP';

  const getSafeTripDate = () => {
    if (!route.tripDate) return new Date();
    const [year, month, day] = route.tripDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
    // Verificação de segurança extra no momento do start
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
      city: route.city,
      state: route.state,
      startTime: now,
      startKm: checklist.km || selectedVehicle.currentKm
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Viagem</label>
                <input type="date" value={route.tripDate} onChange={(e) => setRoute({ ...route, tripDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Cidade</label>
                  <input placeholder="São Paulo" value={route.city} onChange={(e) => setRoute({ ...route, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">UF</label>
                  <input placeholder="SP" maxLength={2} value={route.state} onChange={(e) => setRoute({ ...route, state: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <input placeholder="Origem" value={route.origin} onChange={(e) => setRoute({ ...route, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
              <input placeholder="Destino Final" value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
            </div>
            <div className="flex justify-end pt-4">
              <button disabled={!route.city || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Veículo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-500 uppercase">Apenas Disponíveis</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => {
                const restricted = isSaoPaulo && checkSPRodizio(v.plate, getSafeTripDate());
                return (
                  <button 
                    key={v.id} 
                    disabled={restricted} 
                    onClick={() => setSelectedVehicle(v)} 
                    className={`p-6 rounded-3xl border-2 text-left relative overflow-hidden transition-all ${
                      restricted 
                      ? 'bg-red-50 border-red-100 opacity-50 cursor-not-allowed' 
                      : selectedVehicle?.id === v.id 
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' 
                        : 'border-slate-100 hover:border-blue-200 shadow-sm'
                    }`}
                  >
                    {restricted && (
                      <div className="absolute inset-0 bg-red-600/10 flex flex-col items-center justify-center gap-1">
                         <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-write uppercase tracking-widest">RODÍZIO SP</span>
                         <span className="text-[9px] font-bold text-red-700 uppercase">{getRodizioDayLabel(v.plate)}</span>
                      </div>
                    )}
                    <p className="text-xl font-write tracking-widest text-slate-950">{v.plate}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
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
              <button disabled={!selectedVehicle} onClick={() => setStep(3)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Checklist</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist de Saída</h3>
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center tracking-widest font-bold">KM Atual no Painel do {selectedVehicle?.plate}</label>
                <input type="number" value={checklist.km} onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} className={`w-full p-5 rounded-3xl border-2 font-write text-slate-950 text-3xl text-center outline-none focus:ring-4 transition-all ${isKmInvalid ? 'border-red-400 bg-red-50 focus:ring-red-100' : 'border-slate-200 bg-white focus:ring-blue-50 shadow-inner'}`} />
                {isKmInvalid && <p className="text-[10px] text-red-500 text-center mt-2 font-bold uppercase">KM deve ser maior ou igual a {selectedVehicle?.currentKm}</p>}
            </div>
            <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'oilChecked', label: 'Óleo' },
                  { key: 'waterChecked', label: 'Água' },
                  { key: 'tiresChecked', label: 'Pneus' }
                ].map(item => (
                  <button key={item.key} onClick={() => setChecklist({ ...checklist, [item.key]: !checklist[item.key as keyof Checklist] })} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${checklist[item.key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}>
                    <i className={`fas ${checklist[item.key as keyof Checklist] ? 'fa-check-circle' : 'fa-circle-notch'} text-xl`}></i>
                    <span className="text-[10px] font-write uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Trocar Veículo</button>
              <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked || isKmInvalid} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Revisar e Iniciar</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner mb-6"><i className="fas fa-check-double"></i></div>
            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Confirmar Início de Jornada?</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">A rota será aberta automaticamente no seu GPS padrão</p>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left space-y-2">
               <p className="text-[10px] text-slate-400 font-bold uppercase">Resumo da Operação</p>
               <p className="text-sm font-bold text-slate-700">Veículo: {selectedVehicle?.plate} ({selectedVehicle?.model})</p>
               <p className="text-sm font-bold text-slate-700">Destino: {route.destination}</p>
            </div>
            <div className="pt-8 flex flex-col gap-4">
              <button onClick={handleStartTrip} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all">INICIAR AGORA</button>
              <button onClick={() => setStep(3)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Revisar Checklist</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
