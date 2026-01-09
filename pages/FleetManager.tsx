
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle } from '../types';

// Opções de posições de pneus para o esquema gráfico (4 rodas apenas)
const TIRE_POSITIONS = [
  { id: 'FL', label: 'D. Esq', x: 'left-0', y: 'top-10' },
  { id: 'FR', label: 'D. Dir', x: 'right-0', y: 'top-10' },
  { id: 'RL', label: 'T. Esq', x: 'left-0', y: 'top-44' },
  { id: 'RR', label: 'T. Dir', x: 'right-0', y: 'top-44' },
];

const MAINTENANCE_CATEGORIES = [
  { id: 'oil', label: 'Troca de Óleo', icon: 'fa-oil-can', color: 'text-amber-500' },
  { id: 'mechanic', label: 'Mecânica Geral', icon: 'fa-wrench', color: 'text-blue-500' },
  { id: 'electric', label: 'Elétrica', icon: 'fa-bolt', color: 'text-yellow-500' },
  { id: 'wash', label: 'Lavagem', icon: 'fa-soap', color: 'text-cyan-500' },
  { id: 'tires', label: 'Troca de Pneus', icon: 'fa-car-rear', color: 'text-emerald-500' },
  { id: 'other', label: 'Outros', icon: 'fa-gears', color: 'text-slate-500' },
];

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, addMaintenanceRecord, updateMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle, resetDatabase } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const [expandedTiresId, setExpandedTiresId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [resolvingMaintenance, setResolvingMaintenance] = useState<{recordId: string | null, vehicleId: string} | null>(null);
  const [resolveKm, setResolveKm] = useState<number>(0);
  const [resolveCost, setResolveCost] = useState<string>('');
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 16));

  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const [newRecord, setNewRecord] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    returnDate: '', 
    serviceType: '',
    cost: '',
    km: '',
    notes: '',
    categories: [] as string[], // Alterado para array permitindo múltiplos serviços
    tireBrand: '',
    tireModel: '',
    selectedTires: [] as string[]
  });

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    currentKm: '',
    fuelLevel: '100',
    fuelType: 'Flex' as Vehicle['fuelType']
  });

  const toggleCategorySelection = (catId: string) => {
    setNewRecord(prev => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter(id => id !== catId)
        : [...prev.categories, catId]
    }));
  };

  const toggleTireSelection = (id: string) => {
    setNewRecord(prev => ({
      ...prev,
      selectedTires: prev.selectedTires.includes(id) 
        ? prev.selectedTires.filter(t => t !== id)
        : [...prev.selectedTires, id]
    }));
  };

  const handleResetDatabase = () => {
    const confirm1 = window.confirm("ATENÇÃO: Isso apagará permanentemente todos os veículos, motoristas, viagens e histórico de manutenção. Deseja continuar?");
    if (confirm1) {
      const confirm2 = window.confirm("TEM CERTEZA? Esta ação não pode ser desfeita.");
      if (confirm2) {
        resetDatabase();
      }
    }
  };

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!newRecord.vehicleId) {
      setFormError("Por favor, selecione um veículo.");
      return;
    }
    if (newRecord.categories.length === 0) {
      setFormError("Selecione ao menos uma categoria de serviço.");
      return;
    }

    const categoryLabels = newRecord.categories.map(catId => {
      if (catId === 'other') return newRecord.serviceType || 'Outros';
      return MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label || '';
    }).filter(label => label !== '');

    const finalServiceType = categoryLabels.join(', ');
    const costVal = newRecord.cost ? parseFloat(newRecord.cost) : 0;
    const kmVal = parseInt(newRecord.km);

    if (newRecord.categories.includes('other') && !newRecord.serviceType.trim()) {
      setFormError("O tipo de serviço 'Outros' deve ser descrito.");
      return;
    }
    if (isNaN(kmVal)) {
      setFormError("A quilometragem atual deve ser informada.");
      return;
    }
    if (newRecord.categories.includes('tires') && newRecord.selectedTires.length === 0) {
      setFormError("Selecione ao menos um pneu no esquema visual para o serviço de Troca de Pneus.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalNotes = newRecord.notes.trim();
      if (newRecord.categories.includes('tires')) {
        const tirePosLabels = TIRE_POSITIONS.filter(p => newRecord.selectedTires.includes(p.id)).map(p => p.label).join(', ');
        const tireDetails = `Pneus: ${newRecord.tireBrand || 'N/A'} ${newRecord.tireModel || 'N/A'} [Posições: ${tirePosLabels}]`;
        finalNotes = finalNotes ? `${tireDetails} | ${finalNotes}` : tireDetails;
      }

      const record: MaintenanceRecord = {
        id: `maint-${Math.random().toString(36).substr(2, 9)}`,
        vehicleId: newRecord.vehicleId,
        date: newRecord.date,
        returnDate: newRecord.returnDate || undefined,
        serviceType: finalServiceType,
        cost: costVal,
        km: kmVal,
        notes: finalNotes
      };

      await addMaintenanceRecord(record);
      
      setNewRecord({ 
        vehicleId: '', 
        date: new Date().toISOString().split('T')[0], 
        returnDate: '', 
        serviceType: '', 
        cost: '', 
        km: '', 
        notes: '', 
        categories: [], 
        tireBrand: '', 
        tireModel: '', 
        selectedTires: [] 
      });
      setShowMaintenanceForm(false);
      alert('Ordem de Manutenção aberta com sucesso!');
    } catch (error) {
      setFormError("Erro ao salvar registro técnico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!newVehicle.plate || !newVehicle.brand || !newVehicle.model) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    const normalizedPlate = newVehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const plateExists = vehicles.some(v => v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() === normalizedPlate && v.id !== editingVehicleId);

    if (plateExists) {
      setFormError(`Placa "${normalizedPlate}" já cadastrada.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const vehicleData = {
        plate: normalizedPlate,
        brand: newVehicle.brand,
        model: newVehicle.model,
        year: parseInt(newVehicle.year),
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

      setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear().toString(), currentKm: '', fuelLevel: '100', fuelType: 'Flex' });
      setShowVehicleForm(false);
      setEditingVehicleId(null);
    } catch (error) {
      setFormError("Erro ao processar dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setNewVehicle({ plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: vehicle.year.toString(), currentKm: vehicle.currentKm.toString(), fuelLevel: vehicle.fuelLevel.toString(), fuelType: vehicle.fuelType });
    setFormError(null);
    setEditingVehicleId(vehicle.id);
    setShowVehicleForm(true);
    setShowMaintenanceForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResolveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance) return;
    
    setIsSubmitting(true);
    try {
      await resolveMaintenance(resolvingMaintenance.vehicleId, resolvingMaintenance.recordId || '', resolveKm, resolveDate, resolveCost ? parseFloat(resolveCost) : undefined);
      setResolvingMaintenance(null);
      setResolveCost('');
      setResolveKm(0);
      alert('Veículo liberado!');
    } catch (error) {
      alert('Erro ao liberar veículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getTireDetails = (notes: string) => {
    if (!notes || !notes.startsWith('Pneus:')) return { brand: 'N/A', model: 'N/A', positions: [] as string[] };
    const mainParts = notes.split('|')[0].replace('Pneus:', '').trim();
    const posMatch = mainParts.match(/\[Posições: (.*?)\]/);
    const positions = posMatch ? posMatch[1].split(', ') : [];
    const brandModelPart = mainParts.replace(/\[Posições: .*?\]/, '').trim();
    const parts = brandModelPart.split(' ');
    
    return { brand: parts[0] || 'N/A', model: parts.slice(1).join(' ') || 'N/A', positions };
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manutenção & Ativos</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controle Técnico da Frota</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setFormError(null); setShowMaintenanceForm(!showMaintenanceForm); setShowVehicleForm(false); setEditingVehicleId(null); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${showMaintenanceForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
            <i className={`fas ${showMaintenanceForm ? 'fa-times' : 'fa-screwdriver-wrench'}`}></i> 
            {showMaintenanceForm ? 'Cancelar' : 'Nova Manutenção'}
          </button>
          <button onClick={() => { setFormError(null); setShowVehicleForm(!showVehicleForm); setShowMaintenanceForm(false); setEditingVehicleId(null); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${showVehicleForm ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <i className={`fas ${showVehicleForm ? 'fa-times' : (editingVehicleId ? 'fa-edit' : 'fa-plus')}`}></i> 
            {showVehicleForm ? 'Cancelar' : (editingVehicleId ? 'Editar Veículo' : 'Adicionar Veículo')}
          </button>
        </div>
      </div>

      {showVehicleForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Dados do Veículo</h3>
          <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Placa</label><input required placeholder="ABC-1234" value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Marca</label><input required placeholder="Ex: Toyota" value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Modelo</label><input required placeholder="Ex: Hilux" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ano</label><input required type="number" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual</label><input required type="number" value={newVehicle.currentKm} onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Combustível</label><select value={newVehicle.fuelType} onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as any })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"><option value="Flex">Flex</option><option value="Diesel">Diesel</option><option value="Gasolina">Gasolina</option><option value="Etanol">Etanol</option><option value="Elétrico">Elétrico</option><option value="GNV">GNV</option></select></div>
            <div className="md:col-span-3 flex justify-end gap-3 mt-4"><button type="submit" className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs shadow-xl">{editingVehicleId ? 'Salvar' : 'Cadastrar'}</button></div>
          </form>
        </div>
      )}

      {showMaintenanceForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Abertura de Chamado Técnico</h3>
          {formError && (<div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase flex items-center gap-3"><i className="fas fa-exclamation-circle"></i>{formError}</div>)}
          <form onSubmit={handleSubmitMaintenance} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo</label><select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"><option value="">Selecione um veículo...</option>{vehicles.map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}</select></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data Entrada</label><input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            </div>

            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 tracking-widest font-bold">Categorias de Serviço (Selecione um ou mais)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {MAINTENANCE_CATEGORIES.map(cat => (
                  <button key={cat.id} type="button" onClick={() => toggleCategorySelection(cat.id)} className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all ${newRecord.categories.includes(cat.id) ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-[1.02]' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                    <i className={`fas ${cat.icon} text-2xl ${newRecord.categories.includes(cat.id) ? 'text-white' : cat.color}`}></i>
                    <span className="text-[9px] font-write uppercase text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {newRecord.categories.includes('tires') && (
              <div className="bg-slate-50/50 p-10 rounded-[2.5rem] border border-slate-100 animate-in zoom-in-95">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6 flex flex-col justify-center">
                    <h4 className="text-[10px] font-write text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4"><i className="fas fa-info-circle text-blue-500"></i> Dados dos Novos Pneus</h4>
                    <div><label className="block text-[9px] font-write text-slate-400 uppercase mb-2">Marca</label><input required placeholder="Ex: Michelin" value={newRecord.tireBrand} onChange={(e) => setNewRecord({ ...newRecord, tireBrand: e.target.value })} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none" /></div>
                    <div><label className="block text-[9px] font-write text-slate-400 uppercase mb-2">Medida/Modelo</label><input required placeholder="Ex: 175/13/60" value={newRecord.tireModel} onChange={(e) => setNewRecord({ ...newRecord, tireModel: e.target.value })} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none" /></div>
                  </div>
                  <div className="flex flex-col items-center">
                    <h4 className="text-[11px] font-write text-slate-800 uppercase tracking-[0.2em] mb-8 flex items-center gap-2"><i className="fas fa-draw-polygon"></i> Seleção Visual de Pneus</h4>
                    <div className="relative p-6 bg-white border-4 border-blue-100 rounded-[3rem] shadow-xl">
                      <div className="relative w-40 h-60 bg-slate-100 rounded-[2rem] border-2 border-slate-200 shadow-inner">
                        <div className="absolute inset-x-8 inset-y-12 border-2 border-dashed border-slate-300 rounded-2xl opacity-20"></div>
                        {TIRE_POSITIONS.map(pos => (
                          <button key={pos.id} type="button" onClick={() => toggleTireSelection(pos.id)} className={`absolute w-12 h-16 rounded-xl border-2 transition-all flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 ${pos.x === 'left-0' ? 'left-0 -ml-2' : 'right-0 -mr-2'} ${pos.y} ${newRecord.selectedTires.includes(pos.id) ? 'bg-emerald-500 border-emerald-200 text-white shadow-lg scale-110' : 'bg-slate-800 border-slate-900 text-slate-600 hover:bg-slate-700'}`}>
                            <i className="fas fa-circle text-[6px]"></i>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-8 flex gap-2">
                       {newRecord.selectedTires.map(tid => (<span key={tid} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[8px] font-bold uppercase">{TIRE_POSITIONS.find(p => p.id === tid)?.label}</span>))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div className="md:col-span-2">
                 <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Descrição Adicional (Obrigatório se selecionado 'Outros')</label>
                 <input 
                   placeholder="Informações adicionais ou descrição do serviço 'Outros'..." 
                   value={newRecord.serviceType} 
                   onChange={(e) => setNewRecord({ ...newRecord, serviceType: e.target.value })} 
                   className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" 
                 />
                 {newRecord.categories.length > 0 && (
                   <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                     <p className="text-[10px] font-bold text-blue-700 uppercase">Serviços Selecionados:</p>
                     <p className="text-xs font-bold text-blue-900">{newRecord.categories.map(c => MAINTENANCE_CATEGORIES.find(m => m.id === c)?.label).join(' + ')}</p>
                   </div>
                 )}
               </div>
               <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual</label><input required type="number" value={newRecord.km} onChange={(e) => setNewRecord({ ...newRecord, km: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
               <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Est. (R$)</label><input type="number" step="0.01" value={newRecord.cost} onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Notas Finais / Observações Técnicas</label>
              <textarea 
                placeholder="Relate aqui detalhes técnicos para a oficina..." 
                value={newRecord.notes} 
                onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })} 
                className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none min-h-[80px]" 
              />
            </div>
            <div className="flex justify-end"><button type="submit" className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs shadow-xl active:scale-95 transition-all">Abrir Ordem de Serviço</button></div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredVehicles.map(vehicle => {
          const vehicleMaintenances = maintenanceRecords.filter(m => m.vehicleId === vehicle.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastTires = vehicleMaintenances.find(m => m.serviceType.includes('Troca de Pneus'));
          const isExpanded = expandedVehicleId === vehicle.id;
          const isTiresExpanded = expandedTiresId === vehicle.id;

          return (
            <div key={vehicle.id} className={`bg-white rounded-[2.5rem] shadow-sm border transition-all ${vehicle.status === VehicleStatus.MAINTENANCE ? 'border-red-200 bg-red-50/10' : 'border-slate-100'}`}>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <span className="bg-slate-900 text-white px-4 py-1.5 rounded-xl font-mono text-xs font-write tracking-widest">{vehicle.plate}</span>
                  <span className={`text-[9px] font-write px-4 py-1.5 rounded-full uppercase tracking-widest border-2 ${vehicle.status === VehicleStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : vehicle.status === VehicleStatus.IN_USE ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {vehicle.status === VehicleStatus.AVAILABLE ? 'Livre' : vehicle.status === VehicleStatus.IN_USE ? 'Em Rota' : 'Oficina'}
                  </span>
                </div>
                <h4 className="text-xl font-write text-slate-800 mb-6">{vehicle.model}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest mb-1">Odômetro</p>
                    <p className="text-xs font-bold text-slate-800">{vehicle.currentKm.toLocaleString()} KM</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest mb-1">Combustível</p>
                    <p className="text-xs font-bold text-slate-800">{vehicle.fuelType}</p>
                  </div>
                </div>
                <div className="mt-8 flex gap-2 border-t border-slate-50 pt-8">
                  <div className="flex-1 relative group">
                    <button onClick={() => setExpandedTiresId(isTiresExpanded ? null : vehicle.id)} className={`w-full py-4 rounded-2xl text-[9px] font-write uppercase tracking-widest border transition-all ${isTiresExpanded ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      <i className="fas fa-car-rear mr-2"></i> Pneus
                    </button>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-bold uppercase py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">Ver Estado Pneus</span>
                  </div>

                  {vehicle.status === VehicleStatus.MAINTENANCE && (
                    <div className="flex-1 relative group">
                      <button onClick={() => setResolvingMaintenance({ recordId: vehicleMaintenances[0]?.id || null, vehicleId: vehicle.id })} className="w-full bg-red-600 text-white py-4 rounded-2xl text-[9px] font-write uppercase tracking-widest shadow-lg">Liberar</button>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-bold uppercase py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">Retirar da Oficina</span>
                    </div>
                  )}

                  <div className="flex-1 relative group">
                    <button onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)} className={`w-full py-4 border rounded-2xl text-[9px] font-write uppercase transition-all ${isExpanded ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      <i className="fas fa-history mr-2"></i> Log
                    </button>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-bold uppercase py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">Histórico Técnico</span>
                  </div>
                </div>
              </div>
              
              {isTiresExpanded && (
                <div className="px-8 pb-8 animate-in slide-in-from-top-4 duration-300">
                  <div className="bg-slate-800 rounded-3xl p-8 text-white relative overflow-hidden group border border-slate-700">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform duration-700"><i className="fas fa-car-rear text-[100px]"></i></div>
                    {lastTires ? (
                      <div className="relative z-10 flex flex-col md:flex-row gap-8">
                        <div className="flex-1 space-y-6">
                           <p className="text-[10px] font-write text-emerald-400 uppercase tracking-widest border-b border-slate-700 pb-2">Status do Conjunto Rodante</p>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700"><p className="text-[8px] font-write text-slate-500 uppercase mb-1">Marca</p><p className="text-xs font-bold">{getTireDetails(lastTires.notes).brand}</p></div>
                              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700"><p className="text-[8px] font-write text-slate-500 uppercase mb-1">Medida</p><p className="text-xs font-bold">{getTireDetails(lastTires.notes).model}</p></div>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {getTireDetails(lastTires.notes).positions.map(p => (<span key={p} className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase">{p}</span>))}
                           </div>
                        </div>
                        <div className="relative w-32 h-48 bg-slate-900 rounded-[2rem] border-2 border-slate-700 shrink-0">
                           {TIRE_POSITIONS.map(pos => {
                             const isNew = getTireDetails(lastTires.notes).positions.includes(pos.label);
                             return (<div key={pos.id} className={`absolute w-10 h-14 rounded-xl border flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 ${pos.x === 'left-0' ? 'left-0 -ml-1' : 'right-0 -mr-1'} ${pos.y} ${isNew ? 'bg-emerald-500 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800 border-slate-700'}`}><div className={`w-1.5 h-1.5 rounded-full ${isNew ? 'bg-white animate-pulse' : 'bg-slate-600'}`}></div></div>);
                           })}
                        </div>
                      </div>
                    ) : (<div className="text-center py-10 opacity-30 text-[10px] font-write uppercase tracking-[0.2em]">Sem registro de pneus</div>)}
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="px-8 pb-8 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-4">
                    <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Histórico Técnico do Ativo</p>
                    {vehicleMaintenances.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {vehicleMaintenances.map(m => (
                          <div key={m.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl group/m">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-slate-800 uppercase leading-tight max-w-[70%]">{m.serviceType}</span>
                              <span className="text-[9px] font-write text-blue-600">{new Date(m.date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{m.km.toLocaleString()} KM Rodados</p>
                              <p className="text-[10px] font-write text-emerald-600">R$ {m.cost.toFixed(2)}</p>
                            </div>
                            {m.notes && (
                              <p className="mt-2 text-[9px] text-slate-500 italic line-clamp-2 border-t border-slate-200/50 pt-2">{m.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-6 text-slate-300 text-[10px] font-write uppercase tracking-widest italic">Sem intervenções registradas</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-20 pt-10 border-t border-slate-200">
        <div className="bg-red-50/50 rounded-[3rem] p-10 border border-red-100 flex flex-col md:flex-row items-center justify-between gap-8 group">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-xl shadow-red-200/50"><i className="fas fa-biohazard"></i></div>
            <div className="text-center md:text-left">
              <h3 className="text-xl font-write text-red-800 uppercase tracking-tight">Comando de Redefinição Global</h3>
              <p className="text-xs text-red-400 font-bold uppercase tracking-widest mt-1">Apaga permanentemente todo o banco de dados local.</p>
            </div>
          </div>
          <button onClick={handleResetDatabase} className="px-10 py-5 bg-red-600 text-white rounded-[2rem] font-write uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-red-700 transition-all flex items-center gap-4"><i className="fas fa-trash-can"></i>Limpar Cache Local</button>
        </div>
      </div>

      {resolvingMaintenance && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8 bg-slate-800 text-white text-center"><h3 className="text-xl font-write uppercase tracking-tight">Fechamento de OS</h3></div>
            <form onSubmit={handleResolveMaintenance} className="p-10 space-y-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center tracking-widest font-bold">Odômetro Final</label><input type="number" required value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value))} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-write text-3xl text-slate-800 text-center shadow-inner outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center tracking-widest font-bold">Custo Final (R$)</label><input type="number" step="0.01" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl font-write text-3xl text-slate-800 text-center shadow-inner outline-none" /></div>
              <div className="flex gap-4 pt-4"><button type="button" onClick={() => setResolvingMaintenance(null)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Voltar</button><button type="submit" className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl">Confirmar Saída</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
