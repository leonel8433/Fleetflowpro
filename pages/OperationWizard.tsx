
import React, { useState, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus } from '../types';
import { checkSPRodizio } from '../utils/trafficRules';

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
    zipCode: '',
    plannedDeparture: new Date().toISOString().slice(0, 16),
    plannedArrival: '',
    observations: ''
  });

  useEffect(() => {
    if (scheduledTripId) {
      const schedule = scheduledTrips.find(s => s.id === scheduledTripId);
      if (schedule) {
        const vehicle = vehicles.find(v => v.id === schedule.vehicleId);
        if (vehicle) {
          setSelectedVehicle(vehicle);
          setRoute({
            origin: schedule.origin || '',
            destination: schedule.destination || '',
            waypoints: schedule.waypoints || [],
            city: schedule.city || '',
            state: schedule.state || '',
            zipCode: schedule.zipCode || '',
            plannedDeparture: new Date().toISOString().slice(0, 16),
            plannedArrival: schedule.plannedArrival || '',
            observations: schedule.notes || ''
          });
          setStep(2);
        }
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  useEffect(() => {
    if (selectedVehicle) {
      setChecklist(prev => ({ 
        ...prev, 
        km: selectedVehicle.currentKm, 
        fuelLevel: selectedVehicle.fuelLevel,
        oilChecked: false,
        waterChecked: false,
        tiresChecked: false 
      }));
    }
  }, [selectedVehicle]);

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);

  const isChecklistValid = 
    checklist.oilChecked && 
    checklist.waterChecked && 
    checklist.tiresChecked && 
    !isKmInvalid &&
    (checklist.km ?? 0) > 0;

  const handlePreviewMap = () => {
    if (!route.origin || !route.destination) {
      alert("Informe o endereço de partida e o endereço do destino para visualizar o mapa.");
      return;
    }
    const origin = encodeURIComponent(route.origin);
    const dest = encodeURIComponent(`${route.destination}${route.city ? ', ' + route.city : ''}`);
    const wps = route.waypoints.length > 0 
      ? `&waypoints=${route.waypoints.map(w => encodeURIComponent(w)).join('|')}` 
      : '';
    
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps}&travelmode=driving`, '_blank');
  };

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
    const deviceStartTime = new Date().toISOString();

    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      origin: route.origin,
      destination: route.destination,
      waypoints: route.waypoints,
      city: route.city,
      state: route.state,
      zipCode: route.zipCode,
      plannedDeparture: route.plannedDeparture || deviceStartTime,
      plannedArrival: route.plannedArrival,
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

    startTrip(newTrip, finalChecklist);
    
    if (scheduledTripId) {
      deleteScheduledTrip(scheduledTripId);
    }

    alert('Viagem iniciada! A rota foi salva no histórico para verificação futura.');
    setStep(1);
    setSelectedVehicle(null);
    setRoute({
      origin: '',
      destination: '',
      waypoints: [],
      city: '',
      state: '',
      zipCode: '',
      plannedDeparture: new Date().toISOString().slice(0, 16),
      plannedArrival: '',
      observations: ''
    });
    onComplete?.();
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between mb-8 px-4">
        {[
          { step: 1, label: 'Veículo', icon: 'fa-truck-pickup' },
          { step: 2, label: 'Checklist', icon: 'fa-clipboard-check' },
          { step: 3, label: 'Rota', icon: 'fa-map-marked-alt' }
        ].map((s) => (
          <div key={s.step} className="flex flex-col items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
              step >= s.step ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-200 text-slate-400'
            }`}>
              <i className={`fas ${s.icon}`}></i>
            </div>
            <span className={`text-[10px] mt-2 font-write uppercase tracking-wider ${step >= s.step ? 'text-blue-600' : 'text-slate-300'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {step === 1 && (
          <div className="p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Qual veículo você está pegando?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => {
                const restrictedToday = checkSPRodizio(v.plate);
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-6 rounded-2xl border-2 text-left transition-all flex flex-col gap-4 relative ${
                      selectedVehicle?.id === v.id ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-100' : 'border-slate-100 hover:border-blue-200'
                    }`}
                  >
                    {restrictedToday && (
                       <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500 text-black font-write text-[8px] px-1.5 py-0.5 rounded shadow-sm">
                         <i className="fas fa-exclamation-triangle"></i> RODÍZIO SP HOJE
                       </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                        <i className="fas fa-truck text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-slate-800">{v.plate}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase">{v.brand} {v.model}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex justify-end">
              <button
                disabled={!selectedVehicle}
                onClick={() => setStep(2)}
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-write uppercase text-xs tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                Próximo Passo <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Checklist de Saída</h3>
            <p className="text-slate-400 text-xs font-bold uppercase mb-8">Veículo: <span className="text-blue-600 underline">{selectedVehicle?.plate}</span></p>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-write text-slate-400 uppercase tracking-widest mb-2">Quilometragem Inicial</label>
                  <input
                    type="number"
                    min={selectedVehicle?.currentKm}
                    value={checklist.km}
                    onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })}
                    className={`w-full p-4 rounded-2xl border font-write text-slate-800 text-lg focus:ring-2 outline-none transition-all ${
                      isKmInvalid ? 'border-red-500 bg-red-50 focus:ring-red-200' : 'border-slate-200 bg-white focus:ring-blue-500'
                    }`}
                  />
                  {isKmInvalid ? (
                    <p className="text-[10px] mt-2 text-red-500 font-write uppercase animate-pulse">
                      <i className="fas fa-circle-exclamation mr-1"></i> A quilometragem não pode ser menor que o registro atual ({selectedVehicle?.currentKm} km)
                    </p>
                  ) : (
                    <p className="text-[10px] mt-2 text-slate-400 font-bold italic">Mínimo registrado: {selectedVehicle?.currentKm} km</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-write text-slate-400 uppercase tracking-widest mb-2">Combustível</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={checklist.fuelLevel}
                    onChange={(e) => setChecklist({ ...checklist, fuelLevel: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-6"
                  />
                  <div className="flex justify-between text-[10px] font-write text-slate-400 mt-3 uppercase tracking-widest">
                    <span>Vazio</span>
                    <span className="text-blue-600 text-sm">{checklist.fuelLevel}%</span>
                    <span>Cheio</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'oilChecked', label: 'Óleo', icon: 'fa-oil-can' },
                  { key: 'waterChecked', label: 'Água', icon: 'fa-tint' },
                  { key: 'tiresChecked', label: 'Pneus', icon: 'fa-car' }
                ].map(item => {
                  const isChecked = checklist[item.key as keyof Checklist];
                  return (
                    <button
                      key={item.key}
                      onClick={() => setChecklist({ ...checklist, [item.key]: !isChecked })}
                      className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all ${
                        isChecked ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-300'
                      }`}
                    >
                      <i className={`fas ${item.icon} text-xl`}></i>
                      <span className="font-write text-[10px] uppercase">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 flex justify-between">
              <button 
                onClick={() => scheduledTripId ? onComplete?.() : setStep(1)} 
                className="px-6 py-3 text-slate-400 font-write uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-xl transition-all"
              >
                {scheduledTripId ? 'Cancelar' : 'Voltar'}
              </button>
              <button
                disabled={!isChecklistValid}
                onClick={() => setStep(3)}
                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-blue-100 disabled:opacity-30 transition-all flex items-center gap-2"
              >
                Próximo Passo <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-8">Confirmar Rota de Navegação</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-write text-slate-400 uppercase tracking-widest mb-2">Endereço de Partida</label>
                  <input
                    placeholder="Ex: Av. Paulista, 1000, São Paulo - SP"
                    value={route.origin}
                    onChange={(e) => setRoute({ ...route, origin: e.target.value })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-write text-slate-400 uppercase tracking-widest mb-2">Endereço do Destino</label>
                  <input
                    placeholder="Ex: Rua das Flores, 50, Campinas - SP"
                    value={route.destination}
                    onChange={(e) => setRoute({ ...route, destination: e.target.value })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="button"
                    onClick={handlePreviewMap}
                    className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-2xl font-write text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-map-location-dot text-lg"></i>
                    Testar Rota no Google Maps
                  </button>
                  <p className="text-[9px] text-slate-400 text-center mt-2 font-bold uppercase">A rota acima será salva permanentemente nesta viagem</p>
                </div>

                {/* Waypoints review in Wizard */}
                {route.waypoints.length > 0 && (
                  <div>
                    <label className="block text-xs font-write text-slate-400 uppercase tracking-widest mb-2">Paradas Confirmadas ({route.waypoints.length})</label>
                    <div className="space-y-2">
                      {route.waypoints.map((wp, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 flex items-center gap-3">
                          <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] border border-slate-200">{i+1}</span>
                          {wp}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Cidade"
                    value={route.city}
                    onChange={(e) => setRoute({ ...route, city: e.target.value })}
                    className="w-full p-4 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                  <input
                    placeholder="UF"
                    maxLength={2}
                    value={route.state}
                    onChange={(e) => setRoute({ ...route, state: e.target.value.toUpperCase() })}
                    className="w-full p-4 bg-white rounded-xl border border-slate-200 text-center focus:ring-2 focus:ring-blue-500 outline-none font-write text-slate-800"
                  />
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-3xl p-6 flex flex-col items-center justify-center border border-dashed border-slate-200">
                <i className="fas fa-route text-4xl text-slate-200 mb-4"></i>
                <p className="text-center text-xs text-slate-400 font-medium">Os endereços de partida e destino são fundamentais para o monitoramento e segurança da jornada.</p>
              </div>
            </div>

            <div className="mt-12 flex justify-between border-t border-slate-50 pt-8">
              <button onClick={() => setStep(2)} className="px-6 py-3 text-slate-400 font-write uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-xl transition-all">Voltar</button>
              <button
                onClick={handleStartTrip}
                disabled={!route.origin || !route.destination || !route.city}
                className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-3 disabled:opacity-30"
              >
                Confirmar Saída <i className="fas fa-check-double"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
