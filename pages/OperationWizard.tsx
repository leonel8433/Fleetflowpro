
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus, TripType } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';

const OperationWizard: React.FC<{ scheduledTripId?: string; onComplete?: () => void }> = ({ scheduledTripId, onComplete }) => {
  const { vehicles, currentUser, startTrip, fines, scheduledTrips, activeTrips, deleteScheduledTrip } = useFleet();
  const [step, setStep] = useState(0); 
  const [opType, setOpType] = useState<TripType>('STANDARD');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados do Roteiro e Localização (IBGE)
  const [route, setRoute] = useState({
    origin: '',
    destination: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    city: '',
    state: '',
    waypoints: [] as string[]
  });

  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingLocs, setIsLoadingLocs] = useState(false);
  const [adminJustification, setAdminJustification] = useState('');
  const [newWaypoint, setNewWaypoint] = useState('');
  
  // Estado para verificar autorização prévia (Rodízio)
  const [isPreAuthorized, setIsPreAuthorized] = useState(false);

  const isAdmin = currentUser?.username === 'admin';

  // Busca de Estados do IBGE
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados:", err));
  }, []);

  // Busca de Cidades do IBGE baseada no Estado selecionado
  useEffect(() => {
    if (route.state) {
      setIsLoadingLocs(true);
      setCities([]); 
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
    } else {
      setCities([]);
    }
  }, [route.state]);

  // Checklist e Detalhes
  const [weeklyChecklist, setWeeklyChecklist] = useState({
    tires: false,
    fluids: false,
    lighting: false,
    docs: false,
    security: false,
    cleaning: false
  });

  const [checklist, setChecklist] = useState<Partial<Checklist>>({
    km: 0,
    kmFinal: 0,
    fuelLevel: 100,
    comments: '',
    damageDescription: '',
    damagePhoto: ''
  });

  const [showDamageReport, setShowDamageReport] = useState(false);

  // Efeito para carregar dados de um agendamento prévio
  useEffect(() => {
    if (scheduledTripId) {
      const trip = scheduledTrips.find(t => t.id === scheduledTripId);
      if (trip) {
        setOpType(trip.type || 'STANDARD');
        setRoute({
          origin: trip.origin || '',
          destination: trip.destination || '',
          startDate: trip.scheduledDate || new Date().toISOString().split('T')[0],
          endDate: trip.scheduledEndDate || trip.scheduledDate || new Date().toISOString().split('T')[0],
          city: trip.city || '',
          state: trip.state || '',
          waypoints: trip.waypoints || []
        });
        
        // Verifica se já existe uma justificativa de rodízio nas notas (autorização do admin)
        if (trip.notes?.includes('[JUSTIFICATIVA RODÍZIO SP]')) {
          setIsPreAuthorized(true);
        }

        const vehicle = vehicles.find(v => v.id === trip.vehicleId);
        if (vehicle) {
          setSelectedVehicle(vehicle);
          setChecklist(prev => ({ 
            ...prev, 
            km: vehicle.currentKm, 
            fuelLevel: vehicle.fuelLevel 
          }));
        }
        setStep(1);
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  const driverPoints = useMemo(() => {
    if (!currentUser) return 0;
    const myFines = fines.filter(f => f.driverId === currentUser.id);
    return (currentUser.initialPoints || 0) + myFines.reduce((sum, f) => sum + f.points, 0);
  }, [currentUser, fines]);

  useEffect(() => {
    if (selectedVehicle && !scheduledTripId) {
      setChecklist(prev => ({ ...prev, km: selectedVehicle.currentKm, fuelLevel: selectedVehicle.fuelLevel }));
    }
  }, [selectedVehicle, scheduledTripId]);

  // Validação de Localidade São Paulo
  const isDestSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(route.city, route.state, route.destination);
  }, [route.city, route.state, route.destination]);

  // URL Dinâmica para o Mapa de Pré-visualização
  const mapPreviewUrl = useMemo(() => {
    if (!route.origin && !route.destination) return null;
    
    const originStr = route.origin;
    const destStr = `${route.destination}, ${route.city} - ${route.state}`;
    
    const origin = encodeURIComponent(originStr);
    const destination = encodeURIComponent(destStr);
    
    const waypoints = route.waypoints.length > 0 
      ? `+to:${route.waypoints.map(wp => encodeURIComponent(wp)).join('+to:')}`
      : '';
    return `https://www.google.com/maps?saddr=${origin}&daddr=${destination}${waypoints}&output=embed`;
  }, [route.origin, route.destination, route.city, route.state, route.waypoints]);

  const handleOpenExternalMaps = () => {
    if (!route.origin && !route.destination) return;
    
    const originStr = route.origin;
    const destStr = `${route.destination}, ${route.city} - ${route.state}`;
    
    const origin = encodeURIComponent(originStr);
    const destination = encodeURIComponent(destStr);
    
    const waypoints = route.waypoints.length > 0 
      ? `&waypoints=${route.waypoints.map(wp => encodeURIComponent(wp)).join('|')}` 
      : '';
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}&travelmode=driving`, '_blank');
  };

  const addWaypoint = () => {
    if (newWaypoint.trim()) {
      setRoute(prev => ({ ...prev, waypoints: [...prev.waypoints, newWaypoint.trim()] }));
      setNewWaypoint('');
    }
  };

  const removeWaypoint = (index: number) => {
    setRoute(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setChecklist(prev => ({ ...prev, damagePhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartTrip = async () => {
    if (!selectedVehicle || !currentUser) return;

    const driverHasActive = activeTrips.some(t => String(t.driverId) === String(currentUser.id));
    if (driverHasActive) {
      alert("⚠️ OPERAÇÃO BLOQUEADA: Você já possui uma jornada em andamento.");
      return;
    }

    const vehicleInUse = activeTrips.some(t => t.vehicleId === selectedVehicle.id);
    if (vehicleInUse) {
      alert("⚠️ VEÍCULO EM USO: Este ativo não está liberado.");
      return;
    }
    
    const kmInformado = checklist.km || 0;
    const kmAtualVeiculo = selectedVehicle.currentKm;

    if (kmInformado < kmAtualVeiculo) {
      alert(`⚠️ KM INVÁLIDO: O KM atual (${kmInformado}) é menor que o último registro (${kmAtualVeiculo}).`);
      return;
    }

    if (isDestSaoPaulo && checkSPRodizio(selectedVehicle.plate, new Date(route.startDate + 'T12:00:00'))) {
      if (!isAdmin && !isPreAuthorized) {
        alert("Erro: Veículo em rodízio.");
        return;
      } else if (isAdmin && !adminJustification.trim() && !isPreAuthorized) {
        alert("Justificativa de rodízio obrigatória.");
        return;
      }
    }

    if (scheduledTripId) {
      await deleteScheduledTrip(scheduledTripId);
    }

    const now = new Date().toISOString();
    const isWeekly = opType === 'WEEKLY_ROUTINE';

    if (!isWeekly) {
      handleOpenExternalMaps();
    }

    // Inclusão da Avaria nas observações da viagem
    const damageLog = showDamageReport && checklist.damageDescription ? `\n[AVARIA RELATADA]: ${checklist.damageDescription}` : '';

    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      type: opType,
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      origin: route.origin,
      destination: route.destination,
      city: route.city,
      state: route.state,
      waypoints: route.waypoints,
      startTime: now,
      endDate: isWeekly ? route.endDate : route.startDate,
      startKm: kmInformado,
      observations: (isWeekly 
        ? `[ABERTURA SEMANAL] Início: ${route.startDate} | Fim: ${route.endDate}\nCondutor: ${currentUser.name}\nVeículo: ${selectedVehicle.plate}` 
        : (adminJustification ? `[JUSTIFICATIVA RODÍZIO SP]: ${adminJustification}\n` : '')) + damageLog
    };

    const finalChecklist: Checklist = {
      ...checklist as Checklist,
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      timestamp: now,
      km: kmInformado,
      oilChecked: weeklyChecklist.fluids,
      waterChecked: weeklyChecklist.fluids,
      tiresChecked: weeklyChecklist.tires,
      damageDescription: showDamageReport ? checklist.damageDescription : '',
      damagePhoto: showDamageReport ? checklist.damagePhoto : ''
    };

    startTrip(newTrip, finalChecklist);
    if (onComplete) onComplete();
  };

  const isWeeklyChecklistValid = Object.values(weeklyChecklist).every(v => v);

  const isVehicleAvailableInRange = (v: Vehicle) => {
    const start = new Date(route.startDate).getTime();
    const end = new Date(route.endDate || route.startDate).getTime();

    const hasConflictingSchedule = scheduledTrips.some(s => {
      if (s.vehicleId !== v.id || s.id === scheduledTripId) return false;
      const sStart = new Date(s.scheduledDate).getTime();
      const sEnd = new Date(s.scheduledEndDate || s.scheduledDate).getTime();
      return (start <= sEnd && end >= sStart);
    });
    if (hasConflictingSchedule) return false;

    return true;
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className={`mb-6 p-4 rounded-3xl border flex items-center justify-between ${driverPoints >= 20 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
        <div className="flex items-center gap-4">
           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${driverPoints >= 20 ? 'bg-red-600' : 'bg-blue-600'}`}>
              <i className="fas fa-id-card"></i>
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Minha Pontuação CNH</p>
              <p className={`text-lg font-bold ${driverPoints >= 20 ? 'text-red-700' : 'text-blue-700'}`}>{driverPoints} Pontos acumulados</p>
           </div>
        </div>
        {driverPoints >= 20 && (
          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-bold uppercase animate-pulse">Atenção Crítica</span>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        {step === 0 && (
          <div className="p-10 space-y-8 text-center animate-in fade-in">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Tipo de Operação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button onClick={() => { setOpType('STANDARD'); setStep(1); }} className="p-10 rounded-[2rem] border-2 border-slate-100 hover:border-indigo-600 transition-all flex flex-col items-center gap-4 group">
                <i className="fas fa-route text-3xl text-indigo-600 group-hover:scale-110 transition-transform"></i>
                <div>
                  <p className="font-bold text-slate-900 uppercase">Viagem Avulsa</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ponto a Ponto</p>
                </div>
              </button>
              <button onClick={() => { setOpType('WEEKLY_ROUTINE'); setStep(1); }} className="p-10 rounded-[2rem] border-2 border-slate-100 hover:border-emerald-600 transition-all flex flex-col items-center gap-4 group">
                <i className="fas fa-calendar-week text-3xl text-emerald-600 group-hover:scale-110 transition-transform"></i>
                <div>
                  <p className="font-bold text-slate-900 uppercase">Rotina Semanal</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ciclo contínuo</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{opType === 'WEEKLY_ROUTINE' ? 'Planejamento da Semana' : 'Roteiro e Data'}</h3>
              {scheduledTripId && <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-[9px] font-bold uppercase">Viagem Agendada</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className={opType === 'WEEKLY_ROUTINE' ? 'md:col-span-1' : 'md:col-span-2'}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data de Início</label>
                  <input type="date" value={route.startDate} onChange={(e) => setRoute({...route, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
               </div>
               {opType === 'WEEKLY_ROUTINE' && (
                 <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data de Término</label>
                    <input type="date" min={route.startDate} value={route.endDate} onChange={(e) => setRoute({...route, endDate: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold border-emerald-200 focus:border-emerald-500" />
                 </div>
               )}
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Origem (Local de Partida)</label>
                  <input placeholder="Ex: Pátio Principal" value={route.origin} onChange={(e) => setRoute({...route, origin: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Destino Principal</label>
                  <input placeholder="Ex: Endereço de Entrega" value={route.destination} onChange={(e) => setRoute({...route, destination: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Estado</label>
                <select value={route.state} onChange={(e) => setRoute({ ...route, state: e.target.value, city: '' })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  <option value="">Selecione...</option>
                  {states.map(s => <option key={s.sigla} value={s.sigla}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Cidade</label>
                <select value={route.city} onChange={(e) => setRoute({ ...route, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" disabled={!route.state || isLoadingLocs}>
                  <option value="">{isLoadingLocs ? 'Carregando...' : 'Selecione...'}</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest">Paradas Intermediárias (Opcional)</label>
              <div className="flex gap-2">
                <input 
                  placeholder="Adicionar ponto de parada..." 
                  value={newWaypoint} 
                  onChange={(e) => setNewWaypoint(e.target.value)}
                  className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl font-bold text-xs"
                />
                <button onClick={addWaypoint} className="px-6 bg-indigo-600 text-white rounded-2xl"><i className="fas fa-plus"></i></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {route.waypoints.map((wp, idx) => (
                  <div key={idx} className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-700 uppercase">{wp}</span>
                    <button onClick={() => removeWaypoint(idx)} className="text-red-400 hover:text-red-600"><i className="fas fa-times"></i></button>
                  </div>
                ))}
              </div>
            </div>

            {mapPreviewUrl && (
              <div className="animate-in fade-in zoom-in duration-500 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest ml-1">Pré-visualização da Rota</label>
                </div>
                <div className="w-full h-64 rounded-[2rem] overflow-hidden border-4 border-slate-100 shadow-inner bg-slate-50">
                  <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src={mapPreviewUrl} allowFullScreen title="Previsão de Rota"></iframe>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(0)} className="text-slate-400 uppercase font-bold text-xs tracking-widest" disabled={!!scheduledTripId}>
                {scheduledTripId ? 'Viagem Agendada' : 'Voltar'}
              </button>
              <button disabled={!route.destination || !route.startDate || !route.city || (opType === 'WEEKLY_ROUTINE' && !route.endDate)} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-all">Próximo: Veículo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Seleção de Ativo</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Status: {isDestSaoPaulo ? 'Destino monitorado por rodízio' : 'Rota convencional'}</p>
                <p className="text-[9px] text-blue-600 font-bold uppercase mt-1">Período: {new Date(route.startDate + 'T12:00:00').toLocaleDateString()} {opType === 'WEEKLY_ROUTINE' ? `até ${new Date(route.endDate + 'T12:00:00').toLocaleDateString()}` : ''}</p>
              </div>
              {isDestSaoPaulo && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                  <i className="fas fa-traffic-light text-xs"></i>
                  <span className="text-[9px] font-bold uppercase">Restrição SP Capital Ativa</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles
                .filter(v => (v.status === VehicleStatus.AVAILABLE || v.id === selectedVehicle?.id) && isVehicleAvailableInRange(v))
                .map(v => {
                  const isRestricted = isDestSaoPaulo && checkSPRodizio(v.plate, new Date(route.startDate + 'T12:00:00'));
                  const canSelect = !isRestricted || isAdmin || isPreAuthorized;
                  
                  return (
                    <button 
                      key={v.id} 
                      disabled={!canSelect}
                      onClick={() => setSelectedVehicle(v)} 
                      className={`p-6 rounded-3xl border-2 transition-all text-left relative flex flex-col h-full ${
                        !canSelect
                          ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed' 
                          : selectedVehicle?.id === v.id 
                            ? 'border-indigo-600 bg-indigo-50 shadow-lg' 
                            : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className={`text-lg font-bold ${isRestricted ? (isPreAuthorized ? 'text-amber-600' : 'text-red-800') : 'text-slate-900'}`}>{v.plate}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                        </div>
                        {isRestricted && (
                          <span className={`${isPreAuthorized ? 'bg-amber-500' : 'bg-red-600'} text-white text-[7px] font-bold px-1.5 py-0.5 rounded uppercase`}>
                            {isPreAuthorized ? 'Autorizado' : 'Rodízio'}
                          </span>
                        )}
                      </div>
                      <div className="mt-auto flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>{v.brand}</span>
                        <span>{v.currentKm.toLocaleString()} KM</span>
                      </div>
                    </button>
                  );
                })}
              {vehicles.filter(v => (v.status === VehicleStatus.AVAILABLE || v.id === selectedVehicle?.id) && isVehicleAvailableInRange(v)).length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold uppercase text-xs">Nenhum veículo disponível para o período selecionado.</p>
                </div>
              )}
            </div>

            {selectedVehicle && isDestSaoPaulo && checkSPRodizio(selectedVehicle.plate, new Date(route.startDate + 'T12:00:00')) && (
               <div className={`${isPreAuthorized ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'} p-6 rounded-3xl border animate-in slide-in-from-top-2`}>
                  <p className={`text-[10px] font-bold uppercase mb-3 flex items-center gap-2 ${isPreAuthorized ? 'text-blue-800' : 'text-amber-800'}`}>
                    <i className={`fas ${isPreAuthorized ? 'fa-check-circle' : 'fa-triangle-exclamation'}`}></i> 
                    VEÍCULO EM RODÍZIO: {getRodizioDayLabel(selectedVehicle.plate)}
                  </p>
                  {isPreAuthorized ? (
                    <div className="p-4 bg-white/60 rounded-2xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-bold uppercase">
                        ✅ ESTE AGENDAMENTO POSSUI AUTORIZAÇÃO ADMINISTRATIVA. 
                      </p>
                      <p className="text-[9px] text-blue-500 mt-1 uppercase font-medium">A liberação foi registrada pelo administrador no momento da escala.</p>
                    </div>
                  ) : isAdmin ? (
                    <div className="space-y-3">
                       <label className="block text-[9px] font-bold text-amber-700 uppercase">Justificativa Administrativa Necessária</label>
                       <textarea 
                        placeholder="Informe o motivo da liberação deste veículo em dia de rodízio..." 
                        value={adminJustification} 
                        onChange={(e) => setAdminJustification(e.target.value)} 
                        className="w-full p-4 bg-white border border-amber-200 rounded-2xl font-bold text-xs min-h-[80px] outline-none" 
                       />
                    </div>
                  ) : (
                    <p className="text-[10px] text-red-600 font-bold uppercase">Motorista, este veículo não possui autorização administrativa para circular no rodízio hoje. Operação bloqueada.</p>
                  )}
               </div>
            )}
            
            <div className="flex justify-between pt-6 border-t">
              <button onClick={() => setStep(1)} className="text-slate-400 uppercase font-bold text-xs tracking-widest">Voltar</button>
              <button 
                disabled={!selectedVehicle || (isDestSaoPaulo && checkSPRodizio(selectedVehicle.plate, new Date(route.startDate + 'T12:00:00')) && (!isAdmin && !isPreAuthorized || isAdmin && !isPreAuthorized && !adminJustification.trim()))} 
                onClick={() => setStep(3)} 
                className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-all"
              >
                Avançar para Checklist
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">{opType === 'WEEKLY_ROUTINE' ? 'Checklist e Detalhes da Semana' : 'Checklist de Início'}</h3>
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                <i className="fas fa-gauge-high text-slate-400 text-[10px]"></i>
                <span className="text-[9px] font-bold text-slate-500 uppercase">Segurança Operacional</span>
              </div>
            </div>

            {opType === 'WEEKLY_ROUTINE' && (
              <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                <div className="md:col-span-2 flex items-center gap-3 border-b border-slate-200 pb-4">
                  <i className="fas fa-calendar-check text-emerald-600"></i>
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Resumo do Ciclo Semanal</span>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Condutor Responsável</label>
                   <p className="text-sm font-bold text-slate-800 uppercase">{currentUser?.name}</p>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Período do Ciclo</label>
                   <p className="text-sm font-bold text-indigo-600 uppercase">
                     {new Date(route.startDate + 'T12:00:00').toLocaleDateString()} até {new Date(route.endDate + 'T12:00:00').toLocaleDateString()}
                   </p>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Local de Partida</label>
                   <p className="text-sm font-bold text-slate-800 uppercase">{route.origin}</p>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Destino Principal</label>
                   <p className="text-sm font-bold text-slate-800 uppercase">{route.destination} ({route.city}/{route.state})</p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 text-center">
                 <label className="block text-[10px] text-slate-400 uppercase mb-2 font-bold tracking-widest">KM Inicial da Viagem</label>
                 <input 
                  type="number" 
                  value={checklist.km} 
                  onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} 
                  className="w-full p-4 rounded-2xl border-2 border-slate-200 font-bold text-2xl text-center bg-white focus:border-indigo-500 outline-none" 
                 />
                 <p className="text-[9px] text-slate-400 mt-2 uppercase font-medium">Último KM Registrado: {selectedVehicle?.currentKm}</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 text-center">
                 <label className="block text-[10px] text-slate-400 uppercase mb-2 font-bold tracking-widest">KM Final Estimado</label>
                 <input 
                  type="number" 
                  value={checklist.kmFinal} 
                  onChange={(e) => setChecklist({ ...checklist, kmFinal: parseInt(e.target.value) || 0 })} 
                  className="w-full p-4 rounded-2xl border-2 border-slate-200 font-bold text-2xl text-center bg-white focus:border-indigo-500 outline-none" 
                 />
                 <p className="text-[9px] text-slate-400 mt-2 uppercase font-medium">Previsão de encerramento</p>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 text-center">
              <label className="block text-[10px] text-slate-400 uppercase mb-4 font-bold tracking-widest">Nível de Combustível de Saída</label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: 'C', value: 100 },
                  { label: '3/4', value: 75 },
                  { label: '1/2', value: 50 },
                  { label: '1/4', value: 25 },
                  { label: 'R', value: 10 }
                ].map(level => (
                  <button 
                    key={level.label} 
                    type="button"
                    onClick={() => setChecklist({ ...checklist, fuelLevel: level.value })}
                    className={`py-3 px-1 rounded-2xl text-[10px] font-bold uppercase border transition-all ${checklist.fuelLevel === level.value ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <p className="md:col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inspeção Visual Obrigatória</p>
                {[
                  { id: 'tires', label: 'Pneus e Calibragem', icon: 'fa-car-side' },
                  { id: 'fluids', label: 'Níveis de Fluidos (Óleo/Água)', icon: 'fa-oil-can' },
                  { id: 'lighting', label: 'Sistema de Iluminação', icon: 'fa-lightbulb' },
                  { id: 'docs', label: 'Documentação (CRLV)', icon: 'fa-file-shield' },
                  { id: 'security', label: 'Itens de Segurança', icon: 'fa-shield-halved' },
                  { id: 'cleaning', label: 'Limpeza e Conservação', icon: 'fa-soap' }
                ].map(item => (
                  <button key={item.id} onClick={() => setWeeklyChecklist({...weeklyChecklist, [item.id]: !weeklyChecklist[item.id as keyof typeof weeklyChecklist]})} className={`p-5 rounded-3xl border-2 flex items-center justify-between transition-all ${weeklyChecklist[item.id as keyof typeof weeklyChecklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}>
                    <div className="flex items-center gap-3">
                      <i className={`fas ${item.icon} text-sm`}></i>
                      <span className="text-[10px] font-bold uppercase">{item.label}</span>
                    </div>
                    <i className={`fas ${weeklyChecklist[item.id as keyof typeof weeklyChecklist] ? 'fa-check-circle' : 'fa-circle'}`}></i>
                  </button>
                ))}
            </div>

            {/* SEÇÃO DE AVARIA */}
            <div className={`p-8 rounded-[2rem] border-2 transition-all ${showDamageReport ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showDamageReport ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <i className="fas fa-car-burst"></i>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">Relatar Avaria Encontrada?</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Identificou danos no veículo antes de sair?</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowDamageReport(!showDamageReport)}
                  className={`w-14 h-8 rounded-full transition-all relative ${showDamageReport ? 'bg-amber-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${showDamageReport ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              {showDamageReport && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold text-amber-700 uppercase tracking-widest ml-1">Descrição da Avaria</label>
                    <textarea 
                      placeholder="Descreva detalhadamente o dano identificado..." 
                      value={checklist.damageDescription} 
                      onChange={(e) => setChecklist({ ...checklist, damageDescription: e.target.value })} 
                      className="w-full p-5 bg-white border border-amber-200 rounded-2xl font-bold text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-amber-500" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold text-amber-700 uppercase tracking-widest ml-1">Evidência Fotográfica</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-48 bg-white border-2 border-dashed border-amber-300 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-amber-100/50 transition-all group relative"
                    >
                      {checklist.damagePhoto ? (
                        <>
                          <img src={checklist.damagePhoto} className="w-full h-full object-cover" alt="Dano" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-white text-[10px] font-bold uppercase tracking-widest">Alterar Foto</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-camera text-3xl text-amber-300 group-hover:scale-110 transition-transform"></i>
                          <span className="text-[10px] font-bold text-amber-400 mt-2 uppercase">Anexar Foto da Avaria</span>
                          <span className="text-[8px] text-amber-300 mt-1 uppercase">Clique para selecionar ou capturar</span>
                        </>
                      )}
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-widest ml-1">Notas Gerais do Condutor</label>
              <textarea 
                placeholder="Relate aqui qualquer observação adicional..." 
                value={checklist.comments} 
                onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })} 
                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm min-h-[120px] outline-none" 
              />
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
              <button onClick={() => setStep(2)} className="text-slate-400 uppercase font-bold text-xs tracking-widest">Voltar</button>
              <button 
                disabled={!isWeeklyChecklistValid} 
                onClick={handleStartTrip} 
                className={`px-16 py-5 rounded-2xl font-bold uppercase text-xs shadow-xl transition-all ${!isWeeklyChecklistValid ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white'}`}
              >
                {opType === 'WEEKLY_ROUTINE' ? 'Confirmar e Iniciar Semana' : 'Confirmar e Iniciar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
