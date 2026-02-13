
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
  const { vehicles, maintenanceRecords, tireChanges, addTireChange, deleteTireChange, addMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [expandedVehicleTires, setExpandedVehicleTires] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados para Detalhamento de Pneus na OS
  const [selectedWheelPositions, setSelectedWheelPositions] = useState<TireDetail['position'][]>([]);
  const [tireTechnicalInfo, setTireTechnicalInfo] = useState({
    brand: '',
    model: '',
    cost: '',
    lifespan: '40000'
  });

  // Estados para Registro Direto de Pneus na Área Expansível
  const [newTireEntry, setNewTireEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    brand: '',
    model: '',
    km: '',
    cost: ''
  });

  // Estados para Fechamento de Manutenção
  const [resolvingMaintenance, setResolvingMaintenance] = useState<{record: MaintenanceRecord | null, vehicleId: string} | null>(null);
  const [resolveKm, setResolveKm] = useState<number>(0);
  const [resolveCost, setResolveCost] = useState<string>('');
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 16));
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [closingNotes, setClosingNotes] = useState('');

  // Estado para custos e notas por serviço selecionado
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

  const resetFormState = () => {
    setNewVehicle(initialVehicleState);
    setEditingVehicleId(null);
    setFormError(null);
  };

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
        const nextDetails = { ...serviceDetails };
        delete nextDetails[catId];
        setServiceDetails(nextDetails);
        if (catId === 'tires') setSelectedWheelPositions([]);
    } else {
        setServiceDetails(prev => ({
            ...prev,
            [catId]: { cost: '', notes: '' }
        }));
    }
  };

  const toggleWheelPosition = (pos: TireDetail['position']) => {
    setSelectedWheelPositions(prev => 
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const updateServiceDetail = (catId: string, field: 'cost' | 'notes', value: string) => {
      let cleanValue = value;
      if (field === 'cost') {
        cleanValue = value.replace(/[^0-9.]/g, '');
        const parts = cleanValue.split('.');
        if (parts.length > 2) cleanValue = parts[0] + '.' + parts.slice(1).join('');
      }

      setServiceDetails(prev => ({
          ...prev,
          [catId]: { 
            ...(prev[catId] || { cost: '', notes: '' }), 
            [field]: cleanValue 
          }
      }));
  };

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
    
    if (newRecord.categories.includes('tires')) {
      if (selectedWheelPositions.length === 0) {
        setFormError("Você selecionou Troca de Pneus, mas não indicou quais pneus no gráfico.");
        return;
      }
      if (!tireTechnicalInfo.brand || !tireTechnicalInfo.cost) {
        setFormError("Informe a Marca e o Custo Unitário dos Pneus.");
        return;
      }
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
            cost: td.cost,
            position: td.position,
            nextChangeKm: kmVal + td.expectedLifespanKm
          });
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

  const handleResolveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance?.record) return;

    if (resolveKm < resolvingMaintenance.record.km) {
      alert(`ERRO DE QUILOMETRAGEM: O KM de saída (${resolveKm}) não pode ser inferior ao KM de entrada na oficina (${resolvingMaintenance.record.km}).`);
      return;
    }

    const requestedCategories = resolvingMaintenance.record.categories || [];
    const allChecked = requestedCategories.every(cat => checkedItems.includes(cat));

    if (!allChecked) {
      alert("⚠️ Checklist incompleto: Todos os serviços devem ser validados antes da liberação.");
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
      setClosingNotes('');
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
    if (plateExists) { 
      setFormError(`ERRO: A placa ${normalizedPlate} já está cadastrada em outro veículo da frota.`); 
      return; 
    }

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

  const handleAddQuickTireChange = async (vehicleId: string) => {
    if (!newTireEntry.brand || !newTireEntry.model || !newTireEntry.km) {
      alert("Preencha Marca, Modelo e Quilometragem.");
      return;
    }

    const kmVal = parseInt(newTireEntry.km);
    const costVal = parseFloat(newTireEntry.cost) || 0;

    const tc: TireChange = {
      id: Math.random().toString(36).substr(2, 9),
      vehicleId,
      date: newTireEntry.date,
      brand: newTireEntry.brand,
      model: newTireEntry.model,
      km: kmVal,
      cost: costVal,
      nextChangeKm: kmVal + 40000 
    };

    await addTireChange(tc);
    setNewTireEntry({
      date: new Date().toISOString().split('T')[0],
      brand: '',
      model: '',
      km: '',
      cost: ''
    });
    alert("Troca de pneu registrada com sucesso!");
  };

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
          <button onClick={() => { if(showVehicleForm) { setShowVehicleForm(false); setEditingVehicleId(null); setNewVehicle(initialVehicleState); } else { resetFormState(); setShowVehicleForm(true); } }} className="px-4 py-2.5 rounded-xl font-bold bg-blue-600 text-white flex items-center gap-2 shadow-lg">
             <i className="fas fa-plus"></i> {editingVehicleId ? 'Editar' : 'Novo Veículo'}
          </button>
        </div>
      </div>

      {showMaintenanceForm && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in fade-in slide-in-from-top-4 overflow-hidden">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Abertura de Ordem de Serviço</h3>
             <button onClick={() => setShowMaintenanceForm(false)} className="text-slate-400 hover:text-red-500"><i className="fas fa-times text-xl"></i></button>
          </div>

          <form onSubmit={handleSubmitMaintenance} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Veículo</label>
                <select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({...newRecord, vehicleId: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                  <option value="">Selecione...</option>
                  {vehicles.map(v => <option key={v.id} value={v.id} disabled={v.status === VehicleStatus.MAINTENANCE}>{v.plate} - {v.model} {v.status === VehicleStatus.MAINTENANCE ? '(JÁ EM MANUT.)' : ''}</option>)}
                </select>
              </div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data de Entrada</label><input type="date" value={newRecord.date} onChange={(e) => setNewRecord({...newRecord, date: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /></div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">KM na Entrada</label><input type="number" placeholder={selectedVehicleForMaintenance?.currentKm?.toString() || '0'} value={newRecord.km} onChange={(e) => setNewRecord({...newRecord, km: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /></div>
            </div>

            <div className="space-y-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serviços Solicitados</p>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                 {MAINTENANCE_CATEGORIES.map(cat => (
                   <button key={cat.id} type="button" onClick={() => toggleCategorySelection(cat.id)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${newRecord.categories.includes(cat.id) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                      <i className={`fas ${cat.icon} text-lg ${newRecord.categories.includes(cat.id) ? 'text-white' : cat.color}`}></i>
                      <span className="text-[9px] font-bold uppercase">{cat.label}</span>
                   </button>
                 ))}
               </div>
            </div>

            {newRecord.categories.length > 0 && (
              <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6 animate-in slide-in-from-bottom-2">
                 <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest border-b pb-4">Detalhamento Financeiro e Técnico</h4>
                 
                 <div className="space-y-6 divide-y divide-slate-200">
                    {newRecord.categories.map(catId => {
                        const cat = MAINTENANCE_CATEGORIES.find(c => c.id === catId);
                        if (catId === 'tires') return (
                          <div key={catId} className="pt-6">
                            <div className="flex items-center gap-2 mb-4">
                              <i className="fas fa-car-rear text-emerald-500"></i>
                              <span className="text-[11px] font-bold uppercase text-slate-700">Troca de Pneus (Selecione no Gráfico)</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                                <div className="flex justify-center bg-white p-6 rounded-3xl border border-slate-100">
                                   <div className="relative w-40 h-64 bg-slate-50 border-2 border-slate-200 rounded-[2rem] flex flex-col justify-between p-6">
                                      <div className="flex justify-between">
                                         <button type="button" onClick={() => toggleWheelPosition('FL')} className={`w-10 h-14 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-[10px] ${selectedWheelPositions.includes('FL') ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300'}`}>FL</button>
                                         <button type="button" onClick={() => toggleWheelPosition('FR')} className={`w-10 h-14 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-[10px] ${selectedWheelPositions.includes('FR') ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300'}`}>FR</button>
                                      </div>
                                      <div className="flex justify-between">
                                         <button type="button" onClick={() => toggleWheelPosition('RL')} className={`w-10 h-14 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-[10px] ${selectedWheelPositions.includes('RL') ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300'}`}>RL</button>
                                         <button type="button" onClick={() => toggleWheelPosition('RR')} className={`w-10 h-14 rounded-lg border-2 transition-all flex items-center justify-center font-bold text-[10px] ${selectedWheelPositions.includes('RR') ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-300'}`}>RR</button>
                                      </div>
                                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-black text-slate-200 uppercase tracking-[0.3em] rotate-90">Eixos</div>
                                   </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="md:col-span-2 bg-emerald-50 px-4 py-2 rounded-xl text-[10px] font-bold text-emerald-700 uppercase">Configuração Técnica dos Pneus</div>
                                   <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Marca</label><input required={newRecord.categories.includes('tires')} value={tireTechnicalInfo.brand} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, brand: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" /></div>
                                   <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Custo Unitário</label><input required={newRecord.categories.includes('tires')} type="number" step="0.01" value={tireTechnicalInfo.cost} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, cost: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" /></div>
                                   <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Vida Útil (KM)</label><input type="number" value={tireTechnicalInfo.lifespan} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, lifespan: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" /></div>
                                   <div className="flex items-end">
                                      <div className="w-full p-3 bg-slate-900 text-white rounded-xl flex justify-between items-center">
                                         <span className="text-[9px] font-bold uppercase tracking-widest">Total Pneus</span>
                                         <span className="text-xs font-bold">R$ {(selectedWheelPositions.length * (parseFloat(tireTechnicalInfo.cost) || 0)).toFixed(2)}</span>
                                      </div>
                                   </div>
                                </div>
                            </div>
                          </div>
                        );

                        return (
                          <div key={catId} className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                             <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat?.bg}`}>
                                   <i className={`fas ${cat?.icon} ${cat?.color} text-xs`}></i>
                                </div>
                                <span className="text-[11px] font-bold uppercase text-slate-700">{cat?.label}</span>
                             </div>
                             <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Custo do Serviço</label>
                                <div className="relative">
                                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px] font-bold">R$</span>
                                   <input type="text" placeholder="0.00" value={serviceDetails[catId]?.cost || ''} onChange={(e) => updateServiceDetail(catId, 'cost', e.target.value)} className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" />
                                </div>
                             </div>
                             <div>
                                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Notas do Prestador</label>
                                <input type="text" placeholder="Peças, detalhes, garantia..." value={serviceDetails[catId]?.notes || ''} onChange={(e) => updateServiceDetail(catId, 'notes', e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold" />
                             </div>
                          </div>
                        );
                    })}
                 </div>

                 <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-center md:text-left">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Custo Estimado da OS</p>
                       <p className="text-3xl font-write text-slate-900">R$ {totalServicesCost.toFixed(2)}</p>
                    </div>
                    <textarea placeholder="Observações Administrativas Gerais..." value={newRecord.notes} onChange={(e) => setNewRecord({...newRecord, notes: e.target.value})} className="flex-1 w-full max-w-md p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none" />
                 </div>
              </div>
            )}
            
            {formError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold animate-shake">{formError}</div>}
            
            <div className="flex justify-end gap-3 pt-4">
               <button type="button" onClick={() => setShowMaintenanceForm(false)} className="px-6 py-4 text-slate-400 uppercase text-[10px] font-bold">Cancelar</button>
               <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-16 py-5 rounded-2xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-all">Abrir Ordem de Serviço</button>
            </div>
          </form>
        </div>
      )}

      {showVehicleForm && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-blue-50 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-slate-800 uppercase mb-8">{editingVehicleId ? 'Atualizar Veículo' : 'Cadastrar Novo Veículo'}</h3>
          <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Placa</label><input required placeholder="ABC1D23" value={newVehicle.plate} onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold uppercase" /></div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Marca</label>
              <select required value={newVehicle.brand} onChange={(e) => setNewVehicle({...newVehicle, brand: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                <option value="">Selecione...</option>
                {COMMON_VEHICLE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Modelo</label><input required placeholder="Ex: Onix" value={newVehicle.model} onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Ano</label><input type="number" required value={newVehicle.year} onChange={(e) => setNewVehicle({...newVehicle, year: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">KM Atual</label><input type="number" required value={newVehicle.currentKm} onChange={(e) => setNewVehicle({...newVehicle, currentKm: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" /></div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Combustível</label>
              <select value={newVehicle.fuelType} onChange={(e) => setNewVehicle({...newVehicle, fuelType: e.target.value as any})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold">
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            
            {formError && <div className="md:col-span-3 bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold animate-shake">{formError}</div>}
            
            <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t">
               <button type="button" onClick={() => { setShowVehicleForm(false); setEditingVehicleId(null); }} className="px-6 py-4 text-slate-400 uppercase text-[10px] font-bold">Cancelar</button>
               <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold uppercase text-[10px] shadow-lg">Salvar Veículo</button>
            </div>
          </form>
        </div>
      )}

      {/* Listagem de Veículos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map(v => {
          const vehicleTireAlerts = tireAlertsSummary.filter(a => a.vehicle.id === v.id);
          const hasTireAlert = vehicleTireAlerts.length > 0;

          // Badges de Status Refinados
          const statusConfig = {
            [VehicleStatus.AVAILABLE]: { label: 'Disponível', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', icon: 'fa-check-circle' },
            [VehicleStatus.IN_USE]: { label: 'Em Uso', color: 'bg-blue-50 text-blue-600 border-blue-100', dot: 'bg-blue-500', icon: 'fa-route' },
            [VehicleStatus.MAINTENANCE]: { label: 'Manutenção', color: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-500', icon: 'fa-screwdriver-wrench' }
          }[v.status];

          return (
            <div key={v.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col group hover:shadow-md transition-all relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border font-mono text-[10px] font-bold shadow-inner uppercase">
                  <span className="opacity-40 text-[8px] mb-0.5">Placa</span>
                  {v.plate}
                </div>
                <div className="text-right">
                  <h4 className="font-bold text-slate-900 uppercase tracking-tight">{v.model}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{v.brand} {v.year}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                 <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusConfig.color} w-fit`}>
                        <i className={`fas ${statusConfig.icon} text-[10px]`}></i>
                        <span className="text-[9px] font-bold uppercase tracking-wider">{statusConfig.label}</span>
                      </div>

                      {hasTireAlert && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg animate-pulse border border-red-100 w-fit">
                          <i className="fas fa-triangle-exclamation text-[10px]"></i>
                          <span className="text-[8px] font-bold uppercase tracking-tight">Pneu em Breve (&lt; 2km)</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">{v.currentKm.toLocaleString()} KM</span>
                 </div>
                 
                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${v.fuelLevel < 20 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${v.fuelLevel}%` }}></div>
                 </div>
              </div>

              <div className="mt-auto pt-6 border-t grid grid-cols-2 gap-2">
                 <button onClick={() => handleEditVehicle(v)} className="py-3 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl text-[9px] font-bold uppercase border border-slate-100">Editar</button>
                 <button onClick={() => setExpandedVehicleTires(expandedVehicleTires === v.id ? null : v.id)} className={`py-3 rounded-xl text-[9px] font-bold uppercase border transition-all ${expandedVehicleTires === v.id ? 'bg-blue-600 text-white border-blue-600' : hasTireAlert ? 'bg-red-50 text-red-600 border-red-200 shadow-sm shadow-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                   Pneus {hasTireAlert && <i className="fas fa-triangle-exclamation ml-1 text-[8px]"></i>}
                 </button>
                 {v.status === VehicleStatus.MAINTENANCE ? (
                   <button onClick={() => handleOpenResolve(v.id)} className="col-span-2 py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase shadow-lg">Liberar Veículo</button>
                 ) : (
                   <button onClick={() => { setNewRecord({...newRecord, vehicleId: v.id}); setShowMaintenanceForm(true); }} className="col-span-2 py-3 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase shadow-lg">Abrir Manutenção</button>
                 )}
              </div>

              {expandedVehicleTires === v.id && (
                <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Histórico de Pneus</h5>
                    <i className="fas fa-car-side text-slate-200"></i>
                  </div>
                  
                  <div className="space-y-3 mb-6 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {tireChanges.filter(tc => tc.vehicleId === v.id).length > 0 ? (
                      tireChanges.filter(tc => tc.vehicleId === v.id).map(tc => {
                        const remainingKm = (tc.nextChangeKm || 0) - v.currentKm;
                        const isCritical = remainingKm <= 2000;

                        return (
                          <div key={tc.id} className={`p-3 rounded-xl border relative group transition-colors ${isCritical ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                            <button onClick={() => deleteTireChange(tc.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                              <i className="fas fa-times-circle text-[10px]"></i>
                            </button>
                            <div className="flex justify-between items-start">
                              <p className="text-[9px] font-bold text-slate-700">{new Date(tc.date).toLocaleDateString()}</p>
                              <div className="text-right">
                                <p className={`text-[9px] font-bold ${isCritical ? 'text-red-600' : 'text-blue-600'}`}>{tc.km.toLocaleString()} KM</p>
                                <p className={`text-[8px] font-bold uppercase tracking-tighter ${isCritical ? 'text-red-600 animate-pulse' : 'text-slate-400'}`}>
                                  {isCritical ? `Faltam ${remainingKm} KM!` : `Restam aprox. ${remainingKm} KM`}
                                </p>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium uppercase mt-1">{tc.brand} - {tc.model}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[9px] text-slate-300 italic text-center py-4">Nenhum registro de troca de pneu.</p>
                    )}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-blue-50 space-y-3">
                    <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest text-center">Registrar Nova Troca</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={newTireEntry.date} onChange={(e) => setNewTireEntry({...newTireEntry, date: e.target.value})} className="p-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold" />
                      <input type="number" placeholder="KM Atual" value={newTireEntry.km} onChange={(e) => setNewTireEntry({...newTireEntry, km: e.target.value})} className="p-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold" />
                      <input placeholder="Marca" value={newTireEntry.brand} onChange={(e) => setNewTireEntry({...newTireEntry, brand: e.target.value})} className="p-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold" />
                      <input placeholder="Modelo" value={newTireEntry.model} onChange={(e) => setNewTireEntry({...newTireEntry, model: e.target.value})} className="p-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold" />
                      <div className="col-span-2">
                        <input type="number" step="0.01" placeholder="Custo da Troca (R$)" value={newTireEntry.cost} onChange={(e) => setNewTireEntry({...newTireEntry, cost: e.target.value})} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold" />
                      </div>
                    </div>
                    <button onClick={() => handleAddQuickTireChange(v.id)} className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-bold uppercase shadow-md">Salvar Troca</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DE LIBERAÇÃO DE VEÍCULO (FECHAMENTO DE MANUTENÇÃO) */}
      {resolvingMaintenance && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
              <div className="p-10 bg-emerald-600 text-white">
                 <h3 className="text-2xl font-bold uppercase tracking-tight">Checklist de Liberação</h3>
                 <p className="text-[10px] font-bold text-emerald-100 uppercase mt-1 tracking-widest">Veículo: {vehicles.find(v => v.id === resolvingMaintenance.vehicleId)?.plate}</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data de Saída</label>
                       <input type="datetime-local" value={resolveDate} onChange={(e) => setResolveDate(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" />
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">KM na Saída</label>
                       <input type="number" value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validação de Serviços Executados</p>
                    <div className="grid grid-cols-1 gap-3">
                       {resolvingMaintenance.record?.categories?.map(catId => {
                          const cat = MAINTENANCE_CATEGORIES.find(c => c.id === catId);
                          const isChecked = checkedItems.includes(catId);
                          return (
                             <button key={catId} type="button" onClick={() => toggleChecklistItem(catId)} className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${isChecked ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}>
                                <div className="flex items-center gap-4">
                                   <i className={`fas ${cat?.icon} ${isChecked ? 'text-emerald-600' : 'text-slate-300'}`}></i>
                                   <span className={`text-[11px] font-bold uppercase ${isChecked ? 'text-emerald-900' : 'text-slate-400'}`}>{cat?.label}</span>
                                </div>
                                <i className={`fas ${isChecked ? 'fa-check-circle text-emerald-500' : 'fa-circle text-slate-100'} text-xl`}></i>
                             </button>
                          );
                       })}
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Valor Final Pago (Opcional se alterado)</label>
                    <input type="number" step="0.01" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" placeholder="R$ 0,00" />
                 </div>

                 <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Notas de Encerramento</label>
                    <textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2rem] font-bold text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Relate detalhes da manutenção, garantia das peças, etc..." />
                 </div>
              </div>

              <div className="p-10 border-t bg-slate-50 flex justify-between items-center">
                 <button onClick={() => setResolvingMaintenance(null)} className="px-8 py-4 text-slate-400 font-bold uppercase text-[10px]">Cancelar</button>
                 <button onClick={handleResolveMaintenance} disabled={isSubmitting} className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-bold uppercase text-xs shadow-xl active:scale-95 transition-all">Finalizar OS e Liberar Veículo</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
