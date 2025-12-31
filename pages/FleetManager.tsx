
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle } from '../types';

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, addMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  const handleSubmitMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Captura e validação rigorosa dos dados antes de qualquer alteração de estado
    const selectedVehicleId = newRecord.vehicleId;
    const finalServiceType = newRecord.isTireChange ? 'Troca de Pneus' : newRecord.serviceType.trim();
    // O custo agora pode ser 0 se não informado
    const costVal = newRecord.cost ? parseFloat(newRecord.cost) : 0;
    const kmVal = parseInt(newRecord.km);

    if (!selectedVehicleId) {
      alert("Por favor, selecione um veículo.");
      return;
    }

    if (!finalServiceType) {
      alert("Por favor, informe o tipo de serviço.");
      return;
    }

    if (isNaN(kmVal)) {
      alert("KM deve ser um valor numérico válido.");
      return;
    }

    // Preparação das notas
    let finalNotes = newRecord.notes.trim();
    if (newRecord.isTireChange) {
      const tireDetails = `Pneus: ${newRecord.tireBrand || 'N/A'} ${newRecord.tireModel || 'N/A'}`;
      finalNotes = finalNotes ? `${tireDetails} | ${finalNotes}` : tireDetails;
    }

    // Criação do objeto de registro
    const record: MaintenanceRecord = {
      id: `maint-${Math.random().toString(36).substr(2, 9)}`,
      vehicleId: selectedVehicleId,
      date: newRecord.date,
      serviceType: finalServiceType,
      cost: costVal,
      km: kmVal,
      notes: finalNotes
    };

    try {
      // 2. Persistência no Contexto
      addMaintenanceRecord(record);
      
      // 3. Limpeza do formulário e feedback apenas após a chamada de sucesso
      setNewRecord({ 
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
      setShowMaintenanceForm(false);
      alert('Manutenção registrada com sucesso! O veículo agora está em status de OFICINA.');
    } catch (err) {
      console.error("Erro ao registrar manutenção:", err);
      alert("Erro ao salvar os dados. Tente novamente.");
    }
  };

  const handleResolveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance || !resolveKm) return;
    
    const finalCost = resolveCost ? parseFloat(resolveCost) : undefined;
    
    resolveMaintenance(
      resolvingMaintenance.vehicleId, 
      resolvingMaintenance.recordId, 
      resolveKm, 
      resolveDate,
      finalCost
    );
    
    setResolvingMaintenance(null);
    setResolveCost('');
    alert('Manutenção finalizada! O veículo retornou ao status DISPONÍVEL.');
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

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão da Frota</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controle de Ativos e Manutenções</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              setShowMaintenanceForm(!showMaintenanceForm);
              setShowVehicleForm(false);
              setEditingVehicleId(null);
            }} 
            className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition-all"
          >
            <i className={`fas ${showMaintenanceForm ? 'fa-times' : 'fa-wrench'}`}></i> 
            {showMaintenanceForm ? 'Cancelar' : 'Registrar Manutenção'}
          </button>
          <button 
            onClick={() => {
              if (showVehicleForm && editingVehicleId) {
                 setEditingVehicleId(null);
                 setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear().toString(), currentKm: '', fuelLevel: '100', fuelType: 'Diesel' });
              }
              setShowVehicleForm(!showVehicleForm);
              setShowMaintenanceForm(false);
            }} 
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
          >
            <i className={`fas ${showVehicleForm ? 'fa-times' : 'fa-plus'}`}></i> 
            {showVehicleForm ? 'Cancelar' : (editingVehicleId ? 'Cancelar Edição' : 'Novo Veículo')}
          </button>
        </div>
      </div>

      {/* Form Cadastro/Edição Veículo */}
      {showVehicleForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6">
            {editingVehicleId ? 'Editar Veículo' : 'Cadastro de Veículo'}
          </h3>
          <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Placa</label>
              <input required placeholder="ABC-1234" value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Marca</label>
              <input required placeholder="Ex: Mercedes-Benz" value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Modelo</label>
              <input required placeholder="Ex: Sprinter 415" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ano</label>
              <input required type="number" placeholder="2024" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual</label>
              <input required type="number" placeholder="0" value={newVehicle.currentKm} onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Tipo de Combustível</label>
              <select required value={newVehicle.fuelType} onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as Vehicle['fuelType'] })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Diesel">Diesel</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Flex">Flex</option>
                <option value="Elétrico">Elétrico</option>
                <option value="GNV">GNV</option>
              </select>
            </div>
            <button type="submit" className="bg-blue-600 text-white py-4 rounded-xl font-write uppercase text-xs tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all md:col-span-3">
              {editingVehicleId ? 'Salvar Alterações' : 'Salvar Veículo'}
            </button>
          </form>
        </div>
      )}

      {/* Form Registro Manutenção */}
      {showMaintenanceForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6">Registrar Saída para Manutenção</h3>
          <form onSubmit={handleSubmitMaintenance} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo Destinado</label>
                <select 
                  required 
                  value={newRecord.vehicleId} 
                  onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Selecione o veículo...</option>
                  {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => (
                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Tipo de Serviço</label>
                {!newRecord.isTireChange ? (
                  <input 
                    required={!newRecord.isTireChange}
                    type="text" 
                    placeholder="Ex: Troca de pastilhas de freio" 
                    value={newRecord.serviceType} 
                    onChange={(e) => setNewRecord({ ...newRecord, serviceType: e.target.value })} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                ) : (
                  <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 font-bold flex items-center gap-2">
                    <i className="fas fa-circle-check text-emerald-500"></i> Troca de Pneus
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Opções Especiais</label>
                <button 
                  type="button"
                  onClick={() => setNewRecord(prev => ({ 
                    ...prev, 
                    isTireChange: !prev.isTireChange, 
                    serviceType: !prev.isTireChange ? 'Troca de Pneus' : '' 
                  }))}
                  className={`w-full p-3 border rounded-xl font-bold text-xs uppercase transition-all flex items-center justify-center gap-2 ${newRecord.isTireChange ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}
                >
                  <i className="fas fa-car-rear"></i> {newRecord.isTireChange ? 'Troca de Pneus Ativada' : 'É Troca de Pneus?'}
                </button>
              </div>
            </div>

            {newRecord.isTireChange && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50 p-6 rounded-2xl border border-emerald-100 animate-in slide-in-from-left-4 duration-300">
                <div>
                  <label className="block text-[10px] font-write text-emerald-800 uppercase mb-2">Marca dos Pneus</label>
                  <input required={newRecord.isTireChange} placeholder="Ex: Michelin, Pirelli..." value={newRecord.tireBrand} onChange={(e) => setNewRecord({ ...newRecord, tireBrand: e.target.value })} className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-emerald-800 uppercase mb-2">Modelo dos Pneus</label>
                  <input required={newRecord.isTireChange} placeholder="Ex: Primacy 4, PZero..." value={newRecord.tireModel} onChange={(e) => setNewRecord({ ...newRecord, tireModel: e.target.value })} className="w-full p-3 bg-white border border-emerald-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM de Saída</label>
                <input required type="number" placeholder="Ex: 45000" value={newRecord.km} onChange={(e) => setNewRecord({ ...newRecord, km: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Estimado (Opcional)</label>
                <input type="number" step="0.01" placeholder="0.00" value={newRecord.cost} onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data de Saída</label>
                <input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Observações Adicionais</label>
                <textarea value={newRecord.notes} onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })} placeholder="Alguma observação importante sobre o serviço?" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"></textarea>
              </div>
              <button type="submit" className="bg-slate-900 text-white py-4 rounded-xl font-write uppercase text-xs tracking-widest hover:bg-slate-800 transition-all lg:col-span-1 md:col-span-2">Confirmar Envio</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Finalizar Manutenção */}
      {resolvingMaintenance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-800 text-white">
              <h3 className="text-lg font-write uppercase tracking-tight">Finalizar Manutenção</h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold mt-1">Registrar retorno do veículo</p>
            </div>
            <form onSubmit={handleResolveMaintenance} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Atual de Retorno</label>
                <input 
                  type="number" 
                  required 
                  value={resolveKm} 
                  onChange={(e) => setResolveKm(parseInt(e.target.value))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-write text-xl text-slate-800 text-center"
                  placeholder="000000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Final (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={resolveCost} 
                  onChange={(e) => setResolveCost(e.target.value)}
                  className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800 text-center text-lg"
                  placeholder="0.00"
                />
                <p className="text-[9px] text-slate-400 mt-1 uppercase text-center">Informe o valor total do serviço realizado</p>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data/Hora do Retorno</label>
                <input 
                  type="datetime-local" 
                  required 
                  value={resolveDate} 
                  onChange={(e) => setResolveDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setResolvingMaintenance(null)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl">Voltar</button>
                <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all">Confirmar Retorno</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            type="text" 
            placeholder="Buscar por placa ou modelo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-950 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-write text-slate-700 uppercase outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Todos os Status</option>
          <option value={VehicleStatus.AVAILABLE}>Disponível</option>
          <option value={VehicleStatus.IN_USE}>Em Uso</option>
          <option value={VehicleStatus.MAINTENANCE}>Manutenção</option>
        </select>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVehicles.map(vehicle => {
          const vehicleMaintenances = maintenanceRecords
            .filter(m => m.vehicleId === vehicle.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          const activeMaintenance = vehicle.status === VehicleStatus.MAINTENANCE 
            ? vehicleMaintenances.find(m => !m.returnDate) 
            : null;

          return (
            <div key={vehicle.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md transition-all">
              <div className="p-6 border-b border-slate-50">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-mono text-xs font-write shadow-sm tracking-widest">{vehicle.plate}</span>
                    <p className="text-[10px] font-write text-slate-400 uppercase">{vehicle.brand}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleEditVehicle(vehicle)}
                      className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:text-blue-600 hover:bg-blue-50 transition-all"
                      title="Editar Veículo"
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </button>
                    <span className={`text-[10px] font-write px-3 py-1 rounded-full uppercase tracking-widest border-2 ${
                      vehicle.status === VehicleStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      vehicle.status === VehicleStatus.IN_USE ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {vehicle.status === VehicleStatus.AVAILABLE ? 'Livre' : vehicle.status === VehicleStatus.IN_USE ? 'Em Rota' : 'Oficina'}
                    </span>
                  </div>
                </div>
                <h4 className="text-lg font-write text-slate-800 tracking-tight">{vehicle.model}</h4>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-1">Odômetro</p>
                    <p className="text-sm font-write text-slate-800">{vehicle.currentKm.toLocaleString()} KM</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-1">Ano/Combustível</p>
                    <p className="text-xs font-write text-slate-800">{vehicle.year} • {vehicle.fuelType}</p>
                  </div>
                </div>

                {activeMaintenance && (
                  <div className="mt-6 p-4 bg-red-50 rounded-2xl border border-red-100 animate-pulse">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[9px] font-write text-red-600 uppercase tracking-widest">Manutenção em Aberto</span>
                       <i className="fas fa-wrench text-red-400"></i>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{activeMaintenance.serviceType}</p>
                    <button 
                      onClick={() => {
                        setResolvingMaintenance({recordId: activeMaintenance.id, vehicleId: vehicle.id});
                        setResolveKm(vehicle.currentKm);
                      }}
                      className="w-full mt-3 py-2 bg-red-600 text-white rounded-xl text-[10px] font-write uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                    >
                      Finalizar Manutenção
                    </button>
                  </div>
                )}
              </div>

              {/* Maintenance History Section */}
              <div className="p-6 flex-1 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <i className="fas fa-history"></i> Histórico Técnico
                  </h5>
                  <span className="text-[9px] font-bold text-slate-300">{vehicleMaintenances.length} registros</span>
                </div>
                
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {vehicleMaintenances.length > 0 ? (
                    vehicleMaintenances.map(m => {
                      const isTireService = m.serviceType === 'Troca de Pneus' || m.notes.toLowerCase().includes('pneus:');
                      return (
                        <div key={m.id} className={`bg-white p-3 rounded-2xl border shadow-sm group hover:border-blue-200 transition-colors ${m.returnDate ? 'border-slate-100' : 'border-red-200 bg-red-50/20'} ${isTireService ? 'border-emerald-100 ring-1 ring-emerald-50' : ''}`}>
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-write text-slate-900 leading-tight mb-1 flex items-center gap-2">
                              {isTireService && <i className="fas fa-car-rear text-emerald-500 text-[10px]"></i>}
                              {m.serviceType}
                            </p>
                            <span className="text-[9px] font-write text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">R$ {m.cost.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex flex-col">
                              <p className="text-[10px] text-slate-400 font-bold">Saída: {new Date(m.date).toLocaleDateString('pt-BR')} | {m.km} KM</p>
                              {m.returnDate && (
                                <p className="text-[9px] text-emerald-600 font-write uppercase mt-0.5">Retorno: {new Date(m.returnDate).toLocaleDateString('pt-BR')}</p>
                              )}
                            </div>
                            
                            {m.notes && (
                              <div className="relative group/note">
                                <i className="fas fa-comment-dots text-slate-300 cursor-help hover:text-blue-500 transition-colors"></i>
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-800 text-white text-[10px] rounded-2xl opacity-0 invisible group-hover/note:opacity-100 group-hover/note:visible transition-all z-50 pointer-events-none shadow-2xl border border-slate-700 translate-y-2 group-hover/note:translate-y-0">
                                  <div className="font-write uppercase text-[8px] text-blue-400 mb-1.5 border-b border-slate-700 pb-1 flex items-center gap-1">
                                    <i className="fas fa-info-circle"></i> {isTireService ? 'Detalhes dos Pneus' : 'Observações'}
                                  </div>
                                  <p className="leading-relaxed text-slate-200 font-medium">{m.notes}</p>
                                  <div className="absolute top-full right-3 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                      <p className="text-[10px] font-write text-slate-300 uppercase italic">Sem manutenções registradas</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-white border-t border-slate-50">
                <button className="w-full py-2 bg-slate-50 text-slate-400 text-[10px] font-write uppercase tracking-widest rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all">
                  Ver Ficha Completa
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FleetManager;
