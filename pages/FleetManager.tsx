
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle } from '../types';

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, checklists, addMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle, resetDatabase } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

  // Modal para finalizar manutenção
  const [resolvingMaintenance, setResolvingMaintenance] = useState<{recordId: string, vehicleId: string} | null>(null);
  const [resolveKm, setResolveKm] = useState<number>(0);
  const [resolveCost, setResolveCost] = useState<string>('');
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 16));

  const [newRecord, setNewRecord] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    serviceType: '',
    cost: '',
    km: '',
    notes: '',
    isTireChange: false,
    tireBrand: '',
    tireModel: ''
  });

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    currentKm: '',
    fuelLevel: '100',
    fuelType: 'Diesel' as Vehicle['fuelType']
  });

  const handleResetDatabase = () => {
    const confirm1 = window.confirm("ATENÇÃO: Isso apagará permanentemente todos os veículos, motoristas, viagens e histórico de manutenção. Deseja continuar?");
    if (confirm1) {
      const confirm2 = window.confirm("TEM CERTEZA? Esta ação não pode ser desfeita e o sistema voltará às configurações de fábrica.");
      if (confirm2) {
        resetDatabase();
      }
    }
  };

  const startMaintenanceForVehicle = (vehicle: Vehicle) => {
    setNewRecord({
      ...newRecord,
      vehicleId: vehicle.id,
      km: vehicle.currentKm.toString()
    });
    setShowMaintenanceForm(true);
    setShowVehicleForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVehicleId = newRecord.vehicleId;
    const finalServiceType = newRecord.isTireChange ? 'Troca de Pneus' : newRecord.serviceType.trim();
    const costVal = newRecord.cost ? parseFloat(newRecord.cost) : 0;
    const kmVal = parseInt(newRecord.km);

    if (!selectedVehicleId || !finalServiceType || isNaN(kmVal)) {
      alert("Por favor, preencha todos os campos obrigatórios corretamente.");
      return;
    }

    let finalNotes = newRecord.notes.trim();
    if (newRecord.isTireChange) {
      const tireDetails = `Pneus: ${newRecord.tireBrand || 'N/A'} ${newRecord.tireModel || 'N/A'}`;
      finalNotes = finalNotes ? `${tireDetails} | ${finalNotes}` : tireDetails;
    }

    const record: MaintenanceRecord = {
      id: `maint-${Math.random().toString(36).substr(2, 9)}`,
      vehicleId: selectedVehicleId,
      date: newRecord.date,
      serviceType: finalServiceType,
      cost: costVal,
      km: kmVal,
      notes: finalNotes
    };

    addMaintenanceRecord(record);
    setNewRecord({ vehicleId: '', date: new Date().toISOString().split('T')[0], serviceType: '', cost: '', km: '', notes: '', isTireChange: false, tireBrand: '', tireModel: '' });
    setShowMaintenanceForm(false);
    alert('Manutenção registrada com sucesso!');
  };

  const handleResolveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance || !resolveKm) return;
    const finalCost = resolveCost ? parseFloat(resolveCost) : undefined;
    resolveMaintenance(resolvingMaintenance.vehicleId, resolvingMaintenance.recordId, resolveKm, resolveDate, finalCost);
    setResolvingMaintenance(null);
    setResolveCost('');
    alert('Manutenção finalizada!');
  };

  const handleSubmitVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.plate || !newVehicle.brand || !newVehicle.model) return;

    if (editingVehicleId) {
      updateVehicle(editingVehicleId, {
        plate: newVehicle.plate.toUpperCase(),
        brand: newVehicle.brand,
        model: newVehicle.model,
        year: parseInt(newVehicle.year),
        currentKm: parseInt(newVehicle.currentKm) || 0,
        fuelType: newVehicle.fuelType
      });
      alert('Veículo atualizado com sucesso!');
    } else {
      const vehicle: Vehicle = {
        id: Math.random().toString(36).substr(2, 9),
        plate: newVehicle.plate.toUpperCase(),
        brand: newVehicle.brand,
        model: newVehicle.model,
        year: parseInt(newVehicle.year),
        currentKm: parseInt(newVehicle.currentKm) || 0,
        fuelLevel: parseInt(newVehicle.fuelLevel),
        fuelType: newVehicle.fuelType,
        status: VehicleStatus.AVAILABLE
      };
      addVehicle(vehicle);
      alert('Veículo cadastrado com sucesso!');
    }

    setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear().toString(), currentKm: '', fuelLevel: '100', fuelType: 'Diesel' });
    setShowVehicleForm(false);
    setEditingVehicleId(null);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setNewVehicle({ plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: vehicle.year.toString(), currentKm: vehicle.currentKm.toString(), fuelLevel: vehicle.fuelLevel.toString(), fuelType: vehicle.fuelType });
    setEditingVehicleId(vehicle.id);
    setShowVehicleForm(true);
    setShowMaintenanceForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão da Frota</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controle de Ativos e Manutenções</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setShowMaintenanceForm(!showMaintenanceForm); setShowVehicleForm(false); setEditingVehicleId(null); }} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-all">
            <i className={`fas ${showMaintenanceForm ? 'fa-times' : 'fa-wrench'}`}></i> 
            {showMaintenanceForm ? 'Cancelar' : 'Registrar Manutenção'}
          </button>
          <button onClick={() => { setShowVehicleForm(!showVehicleForm); setShowMaintenanceForm(false); setEditingVehicleId(null); }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
            <i className={`fas ${showVehicleForm ? 'fa-times' : 'fa-plus'}`}></i> 
            {showVehicleForm ? 'Cancelar' : (editingVehicleId ? 'Cancelar Edição' : 'Novo Veículo')}
          </button>
        </div>
      </div>

      {showVehicleForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6">{editingVehicleId ? 'Editar Veículo' : 'Cadastro de Veículo'}</h3>
          <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Placa</label><input required placeholder="ABC-1234" value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Marca</label><input required placeholder="Ex: Mercedes-Benz" value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Modelo</label><input required placeholder="Ex: Sprinter 415" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ano</label><input required type="number" placeholder="2024" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual</label><input required type="number" placeholder="0" value={newVehicle.currentKm} onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Tipo de Combustível</label><select required value={newVehicle.fuelType} onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as Vehicle['fuelType'] })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none"><option value="Diesel">Diesel</option><option value="Gasolina">Gasolina</option><option value="Flex">Flex</option><option value="Elétrico">Elétrico</option><option value="GNV">GNV</option></select></div>
            <button type="submit" className="bg-blue-600 text-white py-4 rounded-xl font-write uppercase text-xs tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all md:col-span-3">{editingVehicleId ? 'Salvar Alterações' : 'Salvar Veículo'}</button>
          </form>
        </div>
      )}

      {showMaintenanceForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6">Registrar Saída para Manutenção</h3>
          <form onSubmit={handleSubmitMaintenance} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo Destinado</label><select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Selecione o veículo...</option>{vehicles.filter(v => v.status === VehicleStatus.AVAILABLE || v.id === newRecord.vehicleId).map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}</select></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Tipo de Serviço</label>{!newRecord.isTireChange ? (<input required={!newRecord.isTireChange} type="text" placeholder="Ex: Troca de pastilhas de freio" value={newRecord.serviceType} onChange={(e) => setNewRecord({ ...newRecord, serviceType: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />) : (<div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 font-bold flex items-center gap-2"><i className="fas fa-circle-check text-emerald-500"></i> Troca de Pneus</div>)}</div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Opções Especiais</label><button type="button" onClick={() => setNewRecord(prev => ({ ...prev, isTireChange: !prev.isTireChange, serviceType: !prev.isTireChange ? 'Troca de Pneus' : '' }))} className={`w-full p-3 border rounded-xl font-bold text-xs uppercase transition-all flex items-center justify-center gap-2 ${newRecord.isTireChange ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}><i className="fas fa-car-rear"></i> {newRecord.isTireChange ? 'Troca de Pneus Ativada' : 'É Troca de Pneus?'}</button></div>
            </div>
            {newRecord.isTireChange && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50 p-6 rounded-2xl border border-emerald-100 animate-in slide-in-from-left-4 duration-300">
                <div><label className="block text-[10px] font-write text-emerald-800 uppercase mb-2">Marca dos Pneus</label><input required={newRecord.isTireChange} placeholder="Ex: Michelin, Pirelli..." value={newRecord.tireBrand} onChange={(e) => setNewRecord({ ...newRecord, tireBrand: e.target.value })} className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                <div><label className="block text-[10px] font-write text-emerald-800 uppercase mb-2">Modelo dos Pneus</label><input required={newRecord.isTireChange} placeholder="Ex: Primacy 4, PZero..." value={newRecord.tireModel} onChange={(e) => setNewRecord({ ...newRecord, tireModel: e.target.value })} className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM de Saída</label><input required type="number" value={newRecord.km} onChange={(e) => setNewRecord({ ...newRecord, km: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Estimado</label><input type="number" step="0.01" value={newRecord.cost} onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data de Saída</label><input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="md:col-span-3"><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Observações Adicionais</label><textarea value={newRecord.notes} onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"></textarea></div>
              <button type="submit" className="bg-slate-900 text-white py-4 rounded-xl font-write uppercase text-xs tracking-widest hover:bg-slate-800 transition-all md:col-span-3">Confirmar Saída</button>
            </div>
          </form>
        </div>
      )}

      {resolvingMaintenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-800 text-white"><h3 className="text-lg font-write uppercase tracking-tight">Finalizar Manutenção</h3></div>
            <form onSubmit={handleResolveMaintenance} className="p-8 space-y-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual de Retorno</label><input type="number" required value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-write text-xl text-slate-800 text-center" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Final (R$)</label><input type="number" step="0.01" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800 text-center text-lg" /></div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setResolvingMaintenance(null)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Voltar</button><button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-emerald-100">Confirmar Retorno</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input type="text" placeholder="Buscar por placa ou modelo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-write text-slate-700 uppercase outline-none"><option value="ALL">Todos os Status</option><option value={VehicleStatus.AVAILABLE}>Disponível</option><option value={VehicleStatus.IN_USE}>Em Uso</option><option value={VehicleStatus.MAINTENANCE}>Manutenção</option></select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVehicles.map(vehicle => {
          const vehicleMaintenances = maintenanceRecords.filter(m => m.vehicleId === vehicle.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const activeMaintenance = vehicle.status === VehicleStatus.MAINTENANCE ? vehicleMaintenances.find(m => !m.returnDate) : null;
          const isExpanded = expandedVehicleId === vehicle.id;
          
          return (
            <div key={vehicle.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition-all">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-mono text-xs font-write shadow-sm tracking-widest">{vehicle.plate}</span>
                    <p className="text-[10px] font-write text-slate-400 uppercase">{vehicle.brand}</p>
                  </div>
                  <span className={`text-[10px] font-write px-3 py-1 rounded-full uppercase tracking-widest border-2 ${vehicle.status === VehicleStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : vehicle.status === VehicleStatus.IN_USE ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {vehicle.status === VehicleStatus.AVAILABLE ? 'Livre' : vehicle.status === VehicleStatus.IN_USE ? 'Em Rota' : 'Oficina'}
                  </span>
                </div>
                
                <h4 className="text-lg font-write text-slate-800 tracking-tight mb-4">{vehicle.model}</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-write text-slate-400 uppercase mb-1">Odômetro</p>
                    <p className="text-sm font-write text-slate-800">{vehicle.currentKm.toLocaleString()} KM</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-write text-slate-400 uppercase mb-1">Ano/Combustível</p>
                    <p className="text-xs font-write text-slate-800">{vehicle.year} • {vehicle.fuelType}</p>
                  </div>
                </div>

                {/* Ações Rápidas do Card */}
                <div className="mt-6 flex gap-2 border-t border-slate-50 pt-6">
                  <button 
                    onClick={() => handleEditVehicle(vehicle)}
                    className="flex-1 bg-slate-50 text-slate-600 py-3 rounded-xl text-[10px] font-write uppercase tracking-widest border border-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-edit"></i> Editar
                  </button>
                  
                  {vehicle.status === VehicleStatus.AVAILABLE && (
                    <button 
                      onClick={() => startMaintenanceForVehicle(vehicle)}
                      className="flex-1 bg-amber-50 text-amber-600 py-3 rounded-xl text-[10px] font-write uppercase tracking-widest border border-amber-100 hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-wrench"></i> Manutenção
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-write uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${isExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                  >
                    <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-list-ul'}`}></i> Detalhes
                  </button>
                </div>

                {activeMaintenance && (
                  <div className="mt-4 p-1 bg-red-50 rounded-2xl border border-red-100 animate-in fade-in duration-300">
                    <button 
                      onClick={() => { 
                        setResolvingMaintenance({recordId: activeMaintenance.id, vehicleId: vehicle.id}); 
                        setResolveKm(vehicle.currentKm); 
                      }} 
                      className="w-full py-3 bg-red-600 text-white rounded-xl text-[10px] font-write uppercase shadow-lg tracking-widest flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-check-circle"></i> Finalizar Manutenção
                    </button>
                  </div>
                )}
              </div>

              {/* Área Expandida (Detalhes) */}
              {isExpanded && (
                <div className="p-6 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-6">
                    <div>
                      <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fas fa-history text-blue-500"></i> Histórico Técnico Recente
                      </h5>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                        {vehicleMaintenances.length > 0 ? vehicleMaintenances.map(m => (
                          <div key={m.id} className="bg-white p-3 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600 flex justify-between items-center shadow-sm">
                            <div className="flex flex-col">
                              <span>{m.serviceType}</span>
                              <span className="text-slate-400 font-medium">{m.km.toLocaleString()} KM</span>
                            </div>
                            <div className="text-right">
                              <span className="text-blue-600 block">{new Date(m.date).toLocaleDateString()}</span>
                              <span className="text-emerald-600">R$ {m.cost.toLocaleString()}</span>
                            </div>
                          </div>
                        )) : (
                          <p className="text-[10px] text-slate-300 italic py-2">Nenhuma manutenção registrada.</p>
                        )}
                      </div>
                    </div>

                    {vehicle.lastChecklist && (
                      <div className="pt-4 border-t border-slate-200">
                        <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <i className="fas fa-clipboard-check text-emerald-500"></i> Último Checklist
                        </h5>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-3 gap-2">
                          <div className="flex flex-col items-center gap-1">
                             <i className={`fas fa-oil-can text-xs ${vehicle.lastChecklist.oilChecked ? 'text-emerald-500' : 'text-red-400'}`}></i>
                             <span className="text-[8px] font-bold uppercase text-slate-400">Óleo</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                             <i className={`fas fa-tint text-xs ${vehicle.lastChecklist.waterChecked ? 'text-emerald-500' : 'text-red-400'}`}></i>
                             <span className="text-[8px] font-bold uppercase text-slate-400">Água</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                             <i className={`fas fa-car text-xs ${vehicle.lastChecklist.tiresChecked ? 'text-emerald-500' : 'text-red-400'}`}></i>
                             <span className="text-[8px] font-bold uppercase text-slate-400">Pneus</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Zona de Perigo / Configurações */}
      <div className="mt-12 pt-10 border-t border-slate-200">
        <div className="bg-red-50/50 rounded-3xl p-8 border border-red-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                <i className="fas fa-radiation-alt"></i>
              </div>
              <div>
                <h3 className="text-lg font-write text-red-800 uppercase tracking-tight">Zona de Perigo</h3>
                <p className="text-xs text-red-400 font-medium">Cuidado: Estas ações são irreversíveis e afetam todo o sistema.</p>
              </div>
            </div>
            <button 
              onClick={handleResetDatabase}
              className="px-8 py-4 bg-red-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-red-200 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              <i className="fas fa-trash-can"></i>
              Limpar Base de Dados do Sistema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FleetManager;
