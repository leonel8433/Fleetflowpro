
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle, TireChange, TireDetail, MaintenanceServiceItem } from '../types';

const MAINTENANCE_CATEGORIES = [
  { id: 'oil', label: 'Troca de Óleo', icon: 'fa-oil-can', color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'mechanic', label: 'Mecânica Geral', icon: 'fa-wrench', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'electric', label: 'Elétrica', icon: 'fa-bolt', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'wash', label: 'Lavagem', icon: 'fa-soap', color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { id: 'tires', label: 'Troca de Pneus', icon: 'fa-car-rear', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'other', label: 'Outros', icon: 'fa-gears', color: 'text-slate-500', bg: 'bg-slate-50' },
];

const COMMON_VEHICLE_BRANDS = [
  'Fiat', 'Volkswagen', 'Chevrolet', 'Toyota', 'Ford', 'Honda', 'Hyundai', 'Renault', 
  'Jeep', 'Nissan', 'Mitsubishi', 'Peugeot', 'Citroën', 'BMW', 'Mercedes-Benz', 
  'Volvo', 'Land Rover', 'Audi', 'Kia', 'Caoa Chery', 'Iveco', 'Scania', 'MAN', 'DAF'
].sort();

const FUEL_TYPES: Vehicle['fuelType'][] = ['Flex', 'Gasolina', 'Diesel', 'Etanol', 'GNV', 'Elétrico'];

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, tireChanges, addTireChange, deleteTireChange, addMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle, scheduledTrips } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [expandedVehicleTires, setExpandedVehicleTires] = useState<string | null>(null);
  const [expandedMaintHistory, setExpandedMaintHistory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados para Detalhamento de Pneus
  const [selectedWheelPositions, setSelectedWheelPositions] = useState<TireDetail['position'][]>([]);
  const [tireTechnicalInfo, setTireTechnicalInfo] = useState({
    brand: '',
    model: '',
    cost: '',
    lifespan: '40000'
  });

  // Estados para Fechamento de Manutenção
  const [resolvingMaintenance, setResolvingMaintenance] = useState<{record: MaintenanceRecord | null, vehicleId: string} | null>(null);
  const [resolveKm, setResolveKm] = useState<number>(0);
  const [resolveCost, setResolveCost] = useState<string>('');
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 16));
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [closingNotes, setClosingNotes] = useState('');

  // Novo estado para custos e notas por serviço
  const [serviceDetails, setServiceDetails] = useState<Record<string, { cost: string, notes: string }>>({});

  const [newRecord, setNewRecord] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    serviceType: '',
    cost: '',
    km: '',
    notes: '',
    categories: [] as string[]
  });

  const initialVehicleState = {
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    currentKm: '',
    fuelLevel: '100',
    fuelType: 'Flex' as Vehicle['fuelType']
  };

  const [newVehicle, setNewVehicle] = useState(initialVehicleState);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedVehicleForMaintenance = useMemo(() => 
    vehicles.find(v => v.id === newRecord.vehicleId), [newRecord.vehicleId, vehicles]
  );

  const toggleCategorySelection = (catId: string) => {
    setNewRecord(prev => {
      const isSelected = prev.categories.includes(catId);
      const newCategories = isSelected
        ? prev.categories.filter(id => id !== catId)
        : [...prev.categories, catId];
      
      return { ...prev, categories: newCategories };
    });

    if (newRecord.categories.includes(catId)) {
        // Remover detalhes ao desmarcar
        const nextDetails = { ...serviceDetails };
        delete nextDetails[catId];
        setServiceDetails(nextDetails);
        if (catId === 'tires') setSelectedWheelPositions([]);
    } else {
        // Inicializar detalhes ao marcar
        setServiceDetails(prev => ({
            ...prev,
            [catId]: { cost: '', notes: '' }
        }));
    }
  };

  const updateServiceDetail = (catId: string, field: 'cost' | 'notes', value: string) => {
      setServiceDetails(prev => ({
          ...prev,
          [catId]: { ...prev[catId], [field]: value }
      }));
  };

  const toggleWheel = (pos: TireDetail['position']) => {
    setSelectedWheelPositions(prev => 
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const handleOpenResolve = (vId: string) => {
    const record = maintenanceRecords.find(r => r.vehicleId === vId && !r.returnDate);
    const vehicle = vehicles.find(v => v.id === vId);
    if (record) {
      setResolvingMaintenance({ record, vehicleId: vId });
      setResolveKm(vehicle?.currentKm || 0);
      setResolveCost(record.cost > 0 ? record.cost.toString() : '');
      setCheckedItems([]); 
      setClosingNotes('');
    }
  };

  const toggleChecklistItem = (catId: string) => {
    setCheckedItems(prev => 
      prev.includes(catId) ? prev.filter(i => i !== catId) : [...prev, catId]
    );
  };

  // Fix: Explicitly typing baseCost as number and item as any to avoid 'unknown' type issues with Object.values.
  const totalServicesCost = useMemo(() => {
      const baseCost = (Object.values(serviceDetails) as any[]).reduce((sum: number, item: any) => sum + (parseFloat(item.cost) || 0), 0);
      const tiresCost = selectedWheelPositions.length * (parseFloat(tireTechnicalInfo.cost) || 0);
      return baseCost + tiresCost;
  }, [serviceDetails, selectedWheelPositions, tireTechnicalInfo.cost]);

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newRecord.vehicleId) { setFormError("Selecione um veículo."); return; }
    if (newRecord.categories.length === 0) { setFormError("Selecione ao menos um serviço."); return; }
    
    if (newRecord.categories.includes('tires') && selectedWheelPositions.length === 0) {
      setFormError("Você selecionou Troca de Pneus, mas não indicou quais pneus no gráfico.");
      return;
    }

    const kmVal = parseInt(newRecord.km) || selectedVehicleForMaintenance?.currentKm || 0;

    const tireDetails: TireDetail[] = selectedWheelPositions.map(pos => ({
      position: pos,
      brand: tireTechnicalInfo.brand,
      model: tireTechnicalInfo.model,
      cost: parseFloat(tireTechnicalInfo.cost) || 0,
      expectedLifespanKm: parseInt(tireTechnicalInfo.lifespan) || 40000
    }));

    const services: MaintenanceServiceItem[] = newRecord.categories.map(catId => ({
        category: MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label || catId,
        cost: catId === 'tires' 
            ? tireDetails.reduce((s, t) => s + t.cost, 0)
            : (parseFloat(serviceDetails[catId]?.cost) || 0),
        notes: serviceDetails[catId]?.notes || ''
    }));

    const categoryLabels = services.map(s => s.category);
    const finalServiceType = categoryLabels.join(', ');

    setIsSubmitting(true);
    try {
      const record: MaintenanceRecord = {
        id: `maint-${Math.random().toString(36).substr(2, 9)}`,
        vehicleId: newRecord.vehicleId,
        date: newRecord.date,
        serviceType: finalServiceType,
        cost: totalServicesCost,
        km: kmVal,
        notes: newRecord.notes.trim(),
        categories: newRecord.categories,
        services: services,
        tireDetails: tireDetails.length > 0 ? tireDetails : undefined
      };
      
      await addMaintenanceRecord(record);

      if (tireDetails.length > 0) {
        for (const td of tireDetails) {
          await addTireChange({
            id: Math.random().toString(36).substr(2, 9),
            vehicleId: newRecord.vehicleId,
            date: newRecord.date,
            brand: td.brand,
            model: td.model,
            km: kmVal,
            position: td.position,
            nextChangeKm: kmVal + td.expectedLifespanKm
          } as any);
        }
      }

      setNewRecord({ vehicleId: '', date: new Date().toISOString().split('T')[0], serviceType: '', cost: '', km: '', notes: '', categories: [] });
      setServiceDetails({});
      setSelectedWheelPositions([]);
      setTireTechnicalInfo({ brand: '', model: '', cost: '', lifespan: '40000' });
      setShowMaintenanceForm(false);
      alert('Ordem de Serviço aberta com sucesso!');
    } catch (error) {
      setFormError("Erro ao processar OS.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance?.record) return;

    const requestedCategories = resolvingMaintenance.record.categories || [];
    const allChecked = requestedCategories.every(cat => checkedItems.includes(cat));

    if (!allChecked) {
      alert("⚠️ Checklist incompleto: Todos os serviços devem ser validados.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resolveMaintenance(
        resolvingMaintenance.vehicleId, 
        resolvingMaintenance.record.id, 
        resolveKm, 
        resolveDate, 
        resolveCost ? parseFloat(resolveCost) : undefined,
        closingNotes.trim()
      );
      setResolvingMaintenance(null);
      alert("✅ Veículo liberado para a frota!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setNewVehicle({ 
      plate: vehicle.plate, 
      brand: vehicle.brand, 
      model: vehicle.model, 
      year: vehicle.year.toString(), 
      currentKm: vehicle.currentKm.toString(), 
      fuelLevel: vehicle.fuelLevel.toString(), 
      fuelType: vehicle.fuelType 
    });
    setEditingVehicleId(vehicle.id);
    setShowVehicleForm(true);
    setShowMaintenanceForm(false);
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const normalizedPlate = newVehicle.plate.toUpperCase().replace(/\s/g, '');
    
    if (!normalizedPlate || !newVehicle.model || !newVehicle.brand || !newVehicle.currentKm) { 
      setFormError("Todos os campos obrigatórios devem ser preenchidos."); 
      return; 
    }

    const plateExists = vehicles.some(v => v.plate === normalizedPlate && v.id !== editingVehicleId);
    if (plateExists) { setFormError("Esta placa já existe no sistema."); return; }

    setIsSubmitting(true);
    try {
      const vehicleData = { 
        plate: normalizedPlate, 
        brand: newVehicle.brand, 
        model: newVehicle.model, 
        year: parseInt(newVehicle.year) || new Date().getFullYear(), 
        currentKm: parseInt(newVehicle.currentKm) || 0, 
        fuelType: newVehicle.fuelType, 
        fuelLevel: parseInt(newVehicle.fuelLevel) || 100 
      };

      if (editingVehicleId) { 
        await updateVehicle(editingVehicleId, vehicleData); 
        alert('Veículo atualizado!');
      } else { 
        const vehicle: Vehicle = { id: Math.random().toString(36).substr(2, 9), ...vehicleData, status: VehicleStatus.AVAILABLE }; 
        await addVehicle(vehicle); 
        alert('Veículo cadastrado!');
      }
      setNewVehicle(initialVehicleState); 
      setShowVehicleForm(false); 
      setEditingVehicleId(null);
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // Lógica de alerta global de pneus (2000km)
  const tireAlertsSummary = useMemo(() => {
    const alerts: { vehicle: Vehicle, tire: TireChange, remaining: number }[] = [];
    tireChanges.forEach(tc => {
      const vehicle = vehicles.find(v => v.id === tc.vehicleId);
      if (vehicle && tc.nextChangeKm) {
        const remaining = tc.nextChangeKm - vehicle.currentKm;
        if (remaining <= 2000) {
          alerts.push({ vehicle, tire: tc, remaining });
        }
      }
    });
    return alerts.sort((a, b) => a.remaining - b.remaining);
  }, [tireChanges, vehicles]);

  const progressPercentage = resolvingMaintenance?.record?.categories 
    ? Math.round((checkedItems.length / resolvingMaintenance.record.categories.length) * 100)
    : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Frota & Ativos</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controle Técnico e Disponibilidade</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setFormError(null); setShowMaintenanceForm(!showMaintenanceForm); setShowVehicleForm(false); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${showMaintenanceForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
            <i className="fas fa-screwdriver-wrench"></i> Nova Manutenção
          </button>
          <button onClick={() => { if(showVehicleForm) { setShowVehicleForm(false); setEditingVehicleId(null); setNewVehicle(initialVehicleState); } else { setShowVehicleForm(true); setShowMaintenanceForm(false); } }} className="px-4 py-2.5 rounded-xl font-bold bg-blue-600 text-white flex items-center gap-2">
             <i className="fas fa-plus"></i> {editingVehicleId ? 'Editar Veículo' : 'Novo Veículo'}
          </button>
        </div>
      </div>

      {/* Alertas Globais de Pneus no Topo */}
      {tireAlertsSummary.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                 <i className="fas fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-sm font-write text-red-800 uppercase tracking-widest">Atenção: Pneus em Limite de Vida Útil</h3>
           </div>
           <div className="flex flex-wrap gap-3">
              {tireAlertsSummary.slice(0, 3).map((alert, i) => (
                <div key={i} className="bg-white/60 px-4 py-2 rounded-2xl border border-red-200 flex items-center gap-3">
                   <span className="text-[10px] font-bold text-red-700">{alert.vehicle.plate}</span>
                   <span className="w-1 h-1 bg-red-300 rounded-full"></span>
                   <span className="text-[9px] font-write text-red-600 uppercase">{alert.tire.position} - {alert.remaining <= 0 ? 'VENCIDO' : `${alert.remaining}KM`}</span>
                </div>
              ))}
              {tireAlertsSummary.length > 3 && <span className="text-[9px] text-red-400 font-bold uppercase mt-2 self-center">+ {tireAlertsSummary.length - 3} outros alertas</span>}
           </div>
        </div>
      )}

      {showMaintenanceForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">Abertura de O.S. Técnica</h3>
              <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-write uppercase">
                  Total Previsto: R$ {totalServicesCost.toFixed(2)}
              </div>
          </div>
          
          {formError && ( <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold flex items-center gap-2"> <i className="fas fa-exclamation-circle"></i> {formError} </div> )}
          
          <form onSubmit={handleSubmitMaintenance} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo para Reparo</label>
                <select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">
                  <option value="">Selecione...</option>
                  {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}
                </select>
              </div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data Entrada</label><input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">1. Selecione as Categorias de Serviço:</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {MAINTENANCE_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id} 
                    type="button" 
                    onClick={() => toggleCategorySelection(cat.id)} 
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all ${newRecord.categories.includes(cat.id) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <i className={`fas ${cat.icon} text-2xl ${newRecord.categories.includes(cat.id) ? 'text-white' : cat.color}`}></i>
                    <span className="text-[9px] font-write uppercase text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {newRecord.categories.length > 0 && (
                <div className="space-y-6 animate-in fade-in duration-500">
                    <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">2. Detalhamento de Custos e Observações:</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {newRecord.categories.map(catId => {
                            const cat = MAINTENANCE_CATEGORIES.find(c => c.id === catId);
                            if (catId === 'tires') return null; // Detalhado separadamente no gráfico

                            return (
                                <div key={catId} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <i className={`fas ${cat?.icon} ${cat?.color}`}></i>
                                        <span className="text-[10px] font-write uppercase text-slate-800">{cat?.label}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block">Custo Unitário (R$)</label>
                                            <input 
                                                type="number" 
                                                placeholder="0,00" 
                                                value={serviceDetails[catId]?.cost || ''} 
                                                onChange={(e) => updateServiceDetail(catId, 'cost', e.target.value)}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] font-bold text-slate-400 uppercase mb-1 block">Nota Específica do Serviço</label>
                                            <textarea 
                                                placeholder="Detalhes sobre este serviço..." 
                                                value={serviceDetails[catId]?.notes || ''} 
                                                onChange={(e) => updateServiceDetail(catId, 'notes', e.target.value)}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs min-h-[60px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {newRecord.categories.includes('tires') && (
              <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-800 animate-in zoom-in-95 duration-500">
                <div className="flex flex-col lg:flex-row gap-10">
                  {/* Diagrama do Veículo */}
                  <div className="w-64 h-96 bg-slate-900 rounded-3xl border border-white/5 relative p-8 flex flex-col items-center shrink-0">
                     <div className="w-36 h-72 border-2 border-white/10 rounded-[3rem] relative flex flex-col justify-between p-4">
                        <div className="flex justify-between w-full">
                           <button type="button" onClick={() => toggleWheel('FL')} className={`w-10 h-16 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('FL') ? 'bg-emerald-50 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-white/10'}`}>
                              <span className="text-[8px] text-white font-bold opacity-40">FL</span>
                           </button>
                           <button type="button" onClick={() => toggleWheel('FR')} className={`w-10 h-16 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('FR') ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-white/10'}`}>
                              <span className="text-[8px] text-white font-bold opacity-30">FR</span>
                           </button>
                        </div>
                        <div className="flex justify-between w-full">
                           <button type="button" onClick={() => toggleWheel('RL')} className={`w-10 h-16 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('RL') ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-white/10'}`}>
                              <span className="text-[8px] text-white font-bold opacity-30">RL</span>
                           </button>
                           <button type="button" onClick={() => toggleWheel('RR')} className={`w-10 h-16 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('RR') ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-white/10'}`}>
                              <span className="text-[8px] text-white font-bold opacity-30">RR</span>
                           </button>
                        </div>
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-20 h-32 border border-white/5 rounded-2xl bg-white/5"></div>
                     </div>
                     <p className="text-[9px] text-slate-500 font-bold uppercase mt-6 text-center">Selecione as rodas para troca</p>
                  </div>

                  <div className="flex-1 space-y-6">
                    <h4 className="text-white font-write text-sm uppercase tracking-widest flex items-center gap-2">
                       <i className="fas fa-info-circle text-emerald-500"></i> Informações do Lote de Pneus
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase mb-2">Marca</label>
                        <input placeholder="Ex: Pirelli" value={tireTechnicalInfo.brand} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, brand: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl !text-white outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase mb-2">Modelo</label>
                        <input placeholder="Ex: Scorpion ATR" value={tireTechnicalInfo.model} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, model: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl !text-white outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase mb-2">Custo Un (R$)</label>
                        <input type="number" placeholder="0.00" value={tireTechnicalInfo.cost} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, cost: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl !text-white outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-500 uppercase mb-2">Durabilidade (KM)</label>
                        <input type="number" value={tireTechnicalInfo.lifespan} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, lifespan: e.target.value})} className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl !text-white outline-none focus:border-emerald-500 placeholder:text-slate-600" />
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                      <p className="text-[10px] text-emerald-400 font-medium italic">* Próxima troca sugerida em: {(selectedVehicleForMaintenance?.currentKm || 0) + (parseInt(tireTechnicalInfo.lifespan) || 0)} KM</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Observações Gerais da Ordem de Serviço</label>
              <textarea placeholder="Relate sintomas globais do veículo ou observações da oficina que abrangem todos os serviços..." value={newRecord.notes} onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none min-h-[100px]" />
            </div>

            <div className="flex justify-end pt-6 border-t">
               <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs shadow-xl">{isSubmitting ? 'Gravando...' : 'Abrir Ordem de Serviço'}</button>
            </div>
          </form>
        </div>
      )}

      {showVehicleForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-blue-100 animate-in fade-in slide-in-from-top-4">
           <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">{editingVehicleId ? 'Ajustar Dados do Ativo' : 'Cadastro de Novo Ativo'}</h3>
           {formError && ( <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold"> {formError} </div> )}
           <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Placa</label><input required placeholder="ABC-1234" value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
              
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Marca</label>
                <input 
                  required 
                  list="brands-list"
                  placeholder="Selecione ou digite..." 
                  value={newVehicle.brand} 
                  onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" 
                />
                <datalist id="brands-list">
                  {COMMON_VEHICLE_BRANDS.map(brand => <option key={brand} value={brand} />)}
                </datalist>
              </div>

              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Modelo</label><input required placeholder="Ex: Corolla" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ano</label><input required type="number" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual</label><input required type="number" value={newVehicle.currentKm} onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Combustível</label><select value={newVehicle.fuelType} onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as any })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">{FUEL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></div>
              <div className="md:col-span-3 flex justify-end gap-3 pt-6 border-t">
                <button type="button" onClick={() => { setShowVehicleForm(false); setEditingVehicleId(null); }} className="px-6 py-4 text-slate-400 uppercase text-[10px] font-bold">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs shadow-xl">{isSubmitting ? 'Salvando...' : 'Salvar Veículo'}</button>
              </div>
           </form>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b flex flex-wrap gap-4 items-center justify-between">
           <div className="relative w-full md:w-64">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input type="text" placeholder="Filtrar por placa ou modelo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none" />
           </div>
           <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold uppercase outline-none">
              <option value="ALL">Todos Status</option>
              <option value={VehicleStatus.AVAILABLE}>Disponível</option>
              <option value={VehicleStatus.IN_USE}>Em Viagem</option>
              <option value={VehicleStatus.MAINTENANCE}>Manutenção</option>
           </select>
        </div>
        <div className="divide-y divide-slate-50">
           {filteredVehicles.map(v => {
             const hasTireAlert = tireAlertsSummary.some(a => a.vehicle.id === v.id);
             
             return (
               <div key={v.id} className="flex flex-col group">
                 <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center gap-6">
                       <div className="w-20 h-20 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center font-write shrink-0">
                          <span className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Placa</span>
                          <span className="text-sm text-slate-900">{v.plate}</span>
                       </div>
                       <div>
                          <div className="flex items-center gap-3">
                             <h4 className="font-write text-lg text-slate-800 uppercase tracking-tight">{v.model}</h4>
                             {hasTireAlert && (
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[8px] font-write uppercase animate-pulse">⚠️ Pneu</span>
                             )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{v.brand} • {v.year}</p>
                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                            <p className="text-[10px] text-blue-600 font-bold uppercase">{v.currentKm} KM Totais</p>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       {v.status === VehicleStatus.AVAILABLE && (
                         <span className="px-4 py-1.5 rounded-full text-[9px] font-write uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
                           Disponível
                         </span>
                       )}
                       {v.status === VehicleStatus.IN_USE && (
                         <span className="px-4 py-1.5 rounded-full text-[9px] font-write uppercase tracking-widest border bg-blue-50 text-blue-600 border-blue-100">
                           Em Viagem
                         </span>
                       )}
                       {v.status === VehicleStatus.MAINTENANCE && (
                         <span className="px-4 py-1.5 rounded-full text-[9px] font-write uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-100">
                           Manutenção
                         </span>
                       )}
                       <div className="flex gap-2">
                         <button onClick={() => setExpandedMaintHistory(expandedMaintHistory === v.id ? null : v.id)} title="Histórico de Manutenções" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${expandedMaintHistory === v.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                           <i className="fas fa-history text-xs"></i>
                         </button>
                         <button onClick={() => setExpandedVehicleTires(expandedVehicleTires === v.id ? null : v.id)} title="Histórico Técnico Pneus" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${expandedVehicleTires === v.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                           <i className="fas fa-car-rear text-xs"></i>
                         </button>
                         <button onClick={() => handleEditVehicle(v)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-blue-600 flex items-center justify-center transition-all border">
                           <i className="fas fa-edit text-xs"></i>
                         </button>
                         {v.status === VehicleStatus.MAINTENANCE && (
                            <button onClick={() => handleOpenResolve(v.id)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-write uppercase tracking-widest shadow-lg">Liberar</button>
                         )}
                       </div>
                    </div>
                 </div>

                 {expandedMaintHistory === v.id && (
                     <div className="p-8 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                          <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-6">Detalhamento de Ordens de Serviço</h5>
                          {maintenanceRecords.filter(m => m.vehicleId === v.id).length > 0 ? (
                              <div className="space-y-4">
                                  {maintenanceRecords.filter(m => m.vehicleId === v.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                                      <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                          <div className="flex justify-between items-start">
                                              <div>
                                                  <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(m.date + 'T12:00:00').toLocaleDateString()}</p>
                                                  <h6 className="text-sm font-write text-slate-800 uppercase">{m.serviceType}</h6>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-xs font-write text-blue-600">R$ {m.cost.toFixed(2)}</p>
                                                  <p className="text-[8px] font-bold text-slate-400 uppercase">{m.km} KM</p>
                                              </div>
                                          </div>
                                          {m.services && m.services.length > 0 && (
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t">
                                                  {m.services.map((s, idx) => (
                                                      <div key={idx} className="bg-slate-50 p-3 rounded-2xl flex justify-between items-center">
                                                          <div>
                                                              <span className="text-[9px] font-bold text-slate-800 uppercase block">{s.category}</span>
                                                              <span className="text-[8px] text-slate-400 italic block">{s.notes}</span>
                                                          </div>
                                                          <span className="text-[9px] font-write text-slate-600">R$ {s.cost.toFixed(2)}</span>
                                                      </div>
                                                  ))}
                                              </div>
                                          )}
                                          {m.notes && <p className="text-[10px] text-slate-500 italic bg-amber-50/30 p-3 rounded-xl">Obs Geral: {m.notes}</p>}
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <p className="text-center text-slate-400 font-bold text-[10px] uppercase py-8 border-2 border-dashed rounded-2xl">Sem histórico de manutenções registradas</p>
                          )}
                     </div>
                 )}

                 {expandedVehicleTires === v.id && (
                   <div className="p-8 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                      <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-6">Controle Individual de Eixos</h5>
                      {tireChanges.filter(tc => tc.vehicleId === v.id).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {tireChanges.filter(tc => tc.vehicleId === v.id).map(tc => {
                             const remainingKm = tc.nextChangeKm ? tc.nextChangeKm - v.currentKm : 10000;
                             const isCritical = remainingKm <= 0;
                             const isWarning = remainingKm <= 2000;

                             return (
                               <div key={tc.id} className={`bg-white p-4 rounded-2xl border flex items-center justify-between shadow-sm transition-all ${isCritical ? 'border-red-200 bg-red-50/30' : isWarning ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
                                  <div className="flex items-center gap-4">
                                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[9px] ${isCritical ? 'bg-red-600 text-white' : isWarning ? 'bg-amber-500 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {tc.position || '??'}
                                     </div>
                                     <div>
                                        <p className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                                          {tc.brand} - {tc.model}
                                          {isCritical && <i className="fas fa-triangle-exclamation text-red-600 animate-pulse"></i>}
                                          {isWarning && !isCritical && <i className="fas fa-circle-info text-amber-500"></i>}
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(tc.date + 'T12:00:00').toLocaleDateString()} • Instalado: {tc.km} KM</p>
                                     </div>
                                  </div>
                                  <div className="text-right">
                                     <p className={`text-[8px] font-bold uppercase ${isCritical ? 'text-red-500' : 'text-slate-400'}`}>Previsão Troca</p>
                                     <p className={`text-xs font-write ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'}`}>
                                       {tc.nextChangeKm || 'N/A'} KM
                                     </p>
                                     <p className="text-[7px] font-bold uppercase opacity-60">Restam: {remainingKm > 0 ? remainingKm : 0} KM</p>
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                      ) : (
                        <p className="text-center text-slate-400 font-bold text-[10px] uppercase py-8 border-2 border-dashed rounded-2xl">Sem histórico de trocas técnicas</p>
                      )}
                   </div>
                 )}
               </div>
             );
           })}
        </div>
      </div>

      {/* Modal Fechamento OS */}
      {resolvingMaintenance?.record && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <div>
                  <h3 className="text-2xl font-write uppercase text-slate-800">Concluir Ordem de Serviço</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Protocolo: {resolvingMaintenance.record.id}</p>
               </div>
               <div className="text-2xl font-write text-blue-600">{progressPercentage}%</div>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                 <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-2">Relato Inicial:</p>
                 <p className="text-xs text-blue-800 italic">"{resolvingMaintenance.record.notes}"</p>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Checklist de Execução:</label>
                <div className="grid grid-cols-1 gap-3">
                  {(resolvingMaintenance.record.categories || []).map(catId => (
                    <button key={catId} onClick={() => toggleChecklistItem(catId)} className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${checkedItems.includes(catId) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}>
                      <div className="flex items-center gap-4">
                        <i className={`fas ${MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.icon} text-lg`}></i>
                        <span className="text-[11px] font-write uppercase">{MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label}</span>
                      </div>
                      <i className={`fas ${checkedItems.includes(catId) ? 'fa-check-circle' : 'fa-circle'} text-xl`}></i>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Odômetro Saída</label><input type="number" value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
                <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Total (R$)</label><input type="number" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
              </div>

              <div className="space-y-2">
                 <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Notas de Fechamento / Garantia</label>
                 <textarea placeholder="Detalhes sobre peças substituídas ou recomendações..." value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none min-h-[80px]" />
              </div>
            </div>

            <div className="p-8 bg-white border-t flex gap-4">
              <button onClick={() => setResolvingMaintenance(null)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
              <button onClick={handleResolveMaintenance} disabled={progressPercentage < 100 || isSubmitting} className={`flex-[2] py-4 rounded-xl font-write text-[10px] uppercase shadow-xl transition-all ${progressPercentage === 100 ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-300'}`}>Finalizar e Liberar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
