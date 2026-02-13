
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
      // Filtra para permitir apenas números e um ponto decimal se for custo
      let cleanValue = value;
      if (field === 'cost') {
        cleanValue = value.replace(/[^0-9.]/g, '');
        // Garante apenas um ponto
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

    // VALIDACAO DE KM NA LIBERACAO DA MANUTENCAO
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
          <button onClick={() => { if(showVehicleForm) { setShowVehicleForm(false); setEditingVehicleId(null); setNewVehicle(initialVehicleState); } else { resetFormState(); setShowVehicleForm(true); } }} className="px-4 py-2.5 rounded-xl font-bold bg-blue-600 text-white flex items-center gap-2">
             <i className="fas fa-plus"></i> {editingVehicleId ? 'Editar Veículo' : 'Novo Veículo'}
          </button>
        </div>
      </div>

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
                   <span className="text-[10px] font-bold text-slate-700">{alert.vehicle.plate}</span>
                   <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-600 uppercase">Restam {alert.remaining}km</span>
                </div>
              ))}
           </div>
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
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${v.status === VehicleStatus.AVAILABLE ? 'bg-emerald-500' : v.status === VehicleStatus.IN_USE ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                        <span className={`text-[10px] font-bold uppercase ${v.status === VehicleStatus.MAINTENANCE ? 'text-amber-600' : 'text-slate-400'}`}>
                          {v.status === VehicleStatus.AVAILABLE ? 'Disponível' : v.status === VehicleStatus.IN_USE ? 'Em Uso' : 'Em Manutenção'}
                        </span>
                        
                        {v.status === VehicleStatus.MAINTENANCE && (
                          <div className="group relative">
                            <div className="bg-amber-100 text-amber-600 w-5 h-5 rounded-lg flex items-center justify-center animate-pulse cursor-help">
                              <i className="fas fa-screwdriver-wrench text-[10px]"></i>
                            </div>
                            <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-900 text-white text-[9px] rounded-xl whitespace-nowrap shadow-2xl z-50">
                              {maintenanceRecords.filter(r => r.vehicleId === v.id && !r.returnDate).map(r => (
                                <div key={r.id}>
                                  <p className="font-bold uppercase mb-1">Serviço: {r.serviceType}</p>
                                  <p className="opacity-70 font-medium">Entrada: {new Date(r.date).toLocaleDateString()}</p>
                                </div>
                              ))}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {hasTireAlert && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg animate-pulse border border-red-100 w-fit">
                          <i className="fas fa-triangle-exclamation text-[10px]"></i>
                          <span className="text-[8px] font-bold uppercase tracking-tight">Alerta: Pneu em Breve (&lt; 2000km)</span>
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
                                  {isCritical ? `Faltam ${remainingKm} KM para troca!` : `Restam aprox. ${remainingKm} KM`}
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

      {/* Modal Resolvendo Manutenção */}
      {resolvingMaintenance && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="p-8 bg-emerald-600 text-white flex justify-between items-center">
                <div>
                   <h3 className="text-xl font-bold uppercase tracking-tight">Liberar Veículo</h3>
                   <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Finalizar Ordem de Serviço</p>
                </div>
                <i className="fas fa-check-double text-3xl"></i>
             </div>
             <div className="p-10 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data de Saída</label>
                      <input type="datetime-local" value={resolveDate} onChange={(e) => setResolveDate(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs" />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">KM de Saída</label>
                      <input type="number" value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs" />
                   </div>
                </div>

                <div className="space-y-3">
                   <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Custo Total Realizado (R$)</label>
                   <input type="number" step="0.01" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} placeholder="0.00" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-lg" />
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest">Validação Final de Serviços</label>
                   <div className="space-y-2">
                      {resolvingMaintenance.record?.categories?.map(catId => (
                         <button key={catId} onClick={() => toggleChecklistItem(catId)} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${checkedItems.includes(catId) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}>
                            <span className="text-[10px] font-bold uppercase">{MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label}</span>
                            <i className={`fas ${checkedItems.includes(catId) ? 'fa-check-circle' : 'fa-circle'}`}></i>
                         </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 block">Anotações / Intercorrências da Manutenção</label>
                   <textarea 
                     placeholder="Descreva aqui qualquer detalhe técnico relevante, peças substituídas ou problemas identificados durante a execução do serviço..." 
                     value={closingNotes} 
                     onChange={(e) => setClosingNotes(e.target.value)} 
                     className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-bold text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-emerald-500"
                   />
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                   <button onClick={() => setResolvingMaintenance(null)} className="flex-1 py-4 text-slate-400 uppercase text-[10px] font-bold">Voltar</button>
                   <button onClick={handleResolveMaintenance} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold uppercase text-[10px] shadow-xl">Finalizar OS</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Modal Nova Manutenção */}
      {showMaintenanceForm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-bold uppercase tracking-tight">Nova Ordem de Serviço</h3>
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Manutenção Preventiva / Corretiva</p>
                 </div>
                 <i className="fas fa-wrench text-3xl opacity-20"></i>
              </div>
              <div className="p-10 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Veículo</label>
                       <select value={newRecord.vehicleId} onChange={(e) => setNewRecord({...newRecord, vehicleId: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs">
                          <option value="">Selecione...</option>
                          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Data de Entrada</label>
                       <input type="date" value={newRecord.date} onChange={(e) => setNewRecord({...newRecord, date: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs" />
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest">Categorias de Serviço</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                       {MAINTENANCE_CATEGORIES.map(cat => (
                          <button key={cat.id} type="button" onClick={() => toggleCategorySelection(cat.id)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${newRecord.categories.includes(cat.id) ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                             <i className={`fas ${cat.icon} text-lg ${newRecord.categories.includes(cat.id) ? 'text-blue-600' : 'text-slate-300'}`}></i>
                             <span className={`text-[9px] font-bold uppercase ${newRecord.categories.includes(cat.id) ? 'text-blue-800' : 'text-slate-400'}`}>{cat.label}</span>
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* DETALHAMENTO DE CUSTOS POR SERVIÇO */}
                 {newRecord.categories.length > 0 && (
                   <div className="space-y-4">
                     <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest">Custos Estimados por Serviço</label>
                     <div className="space-y-3">
                       {newRecord.categories.map(catId => {
                         const cat = MAINTENANCE_CATEGORIES.find(c => c.id === catId);
                         if (catId === 'tires') return null; // Pneus tem sua própria UI abaixo
                         return (
                           <div key={catId} className="flex gap-3 items-center">
                             <div className="flex-1 text-[10px] font-bold uppercase text-slate-600">{cat?.label}</div>
                             <input 
                               type="text" 
                               placeholder="0.00" 
                               value={serviceDetails[catId]?.cost || ''}
                               onChange={(e) => updateServiceDetail(catId, 'cost', e.target.value)}
                               onFocus={(e) => e.target.select()}
                               className="w-32 p-4 bg-white border border-slate-200 rounded-xl font-bold text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                             />
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* SEÇÃO DE PNEUS (QUANDO SELECIONADO) */}
                 {newRecord.categories.includes('tires') && (
                   <div className="bg-slate-50 p-6 rounded-[2rem] border border-blue-50 space-y-6">
                      <div className="flex items-center gap-3 border-b border-blue-100 pb-4">
                         <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                            <i className="fas fa-car-side"></i>
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-blue-800 uppercase">Detalhamento de Pneus</p>
                            <p className="text-[9px] text-blue-400 font-bold uppercase">Selecione as posições e insira os dados técnicos</p>
                         </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-8 items-center">
                         {/* ESQUEMA GRÁFICO */}
                         <div className="relative w-32 h-48 bg-slate-200/50 rounded-3xl border border-slate-300 flex flex-col justify-between p-4 shrink-0">
                            <div className="flex justify-between">
                               <button onClick={() => toggleWheelPosition('FL')} className={`w-8 h-12 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('FL') ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-slate-300'}`}></button>
                               <button onClick={() => toggleWheelPosition('FR')} className={`w-8 h-12 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('FR') ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-slate-300'}`}></button>
                            </div>
                            <div className="w-1 h-20 bg-slate-300 mx-auto rounded-full"></div>
                            <div className="flex justify-between">
                               <button onClick={() => toggleWheelPosition('RL')} className={`w-8 h-12 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('RL') ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-slate-300'}`}></button>
                               <button onClick={() => toggleWheelPosition('RR')} className={`w-8 h-12 rounded-lg border-2 transition-all ${selectedWheelPositions.includes('RR') ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-white border-slate-300'}`}></button>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                               <i className="fas fa-car text-4xl"></i>
                            </div>
                         </div>

                         {/* DADOS TÉCNICOS PNEUS */}
                         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Marca</label><input placeholder="Ex: Pirelli" value={tireTechnicalInfo.brand} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, brand: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" /></div>
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Modelo</label><input placeholder="Ex: Scorpion" value={tireTechnicalInfo.model} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, model: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" /></div>
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Custo Unitário (R$)</label><input type="number" step="0.01" value={tireTechnicalInfo.cost} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, cost: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" /></div>
                            <div><label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Vida Útil Estimada (KM)</label><input type="number" value={tireTechnicalInfo.lifespan} onChange={(e) => setTireTechnicalInfo({...tireTechnicalInfo, lifespan: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs" /></div>
                            <div className="md:col-span-2 p-3 bg-blue-100/50 rounded-xl text-center">
                               <p className="text-[9px] font-bold text-blue-700 uppercase">Custo Total Pneus: R$ {(selectedWheelPositions.length * (parseFloat(tireTechnicalInfo.cost) || 0)).toFixed(2)}</p>
                            </div>
                         </div>
                      </div>
                   </div>
                 )}

                 <div className="flex items-center justify-between p-6 bg-slate-900 rounded-3xl text-white shadow-xl">
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">Custo Total Previsto da OS</span>
                    <span className="text-2xl font-black">R$ {totalServicesCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                 </div>

                 <textarea value={newRecord.notes} onChange={(e) => setNewRecord({...newRecord, notes: e.target.value})} placeholder="Informações detalhadas sobre a manutenção, sintomas relatados pelo motorista e solicitações extras..." className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-bold text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-blue-500" />

                 {formError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase animate-shake">{formError}</div>}

                 <div className="flex gap-4 pt-4 border-t">
                    <button onClick={() => setShowMaintenanceForm(false)} className="flex-1 py-4 text-slate-400 uppercase text-[10px] font-bold hover:text-slate-600 transition-colors">Cancelar</button>
                    <button onClick={handleSubmitMaintenance} disabled={isSubmitting} className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95">Salvar Ordem</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
