
import React, { useState, useRef } from 'react';
import { useFleet } from '../context/FleetContext';
import { Fine, Driver } from '../types';

const DriverManagement: React.FC = () => {
  const { drivers, vehicles, fines, addFine, addDriver, updateDriver, deleteDriver, deleteFine } = useFleet();
  const [showFineForm, setShowFineForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  const [newFine, setNewFine] = useState({
    driverId: '',
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    value: '',
    points: '',
    description: ''
  });

  const [newDriver, setNewDriver] = useState({
    name: '',
    license: '',
    username: '',
    password: '',
    avatar: ''
  });

  const handleFineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFine.driverId || !newFine.vehicleId || !newFine.value) return;

    const fine: Fine = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: newFine.driverId,
      vehicleId: newFine.vehicleId,
      date: newFine.date,
      value: parseFloat(newFine.value),
      points: parseInt(newFine.points) || 0,
      description: newFine.description
    };

    addFine(fine);
    setNewFine({
      driverId: '',
      vehicleId: '',
      date: new Date().toISOString().split('T')[0],
      value: '',
      points: '',
      description: ''
    });
    setShowFineForm(false);
    alert('Multa registrada com sucesso!');
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.license || !newDriver.username) return;

    const driver: Driver = {
      id: Math.random().toString(36).substr(2, 9),
      name: newDriver.name,
      license: newDriver.license,
      username: newDriver.username,
      password: newDriver.password || '123',
      avatar: newDriver.avatar
    };

    addDriver(driver);
    setNewDriver({
      name: '',
      license: '',
      username: '',
      password: '',
      avatar: ''
    });
    setShowDriverForm(false);
    alert('Motorista cadastrado com sucesso!');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewDriver(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestão de Motoristas</h2>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              setShowFineForm(!showFineForm);
              setShowDriverForm(false);
            }}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2 transition-all"
          >
            <i className={`fas ${showFineForm ? 'fa-times' : 'fa-gavel'}`}></i>
            {showFineForm ? 'Cancelar' : 'Registrar Multa'}
          </button>
          <button 
            onClick={() => {
              setShowDriverForm(!showDriverForm);
              setShowFineForm(false);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
          >
            <i className={`fas ${showDriverForm ? 'fa-times' : 'fa-user-plus'}`}></i>
            {showDriverForm ? 'Cancelar' : 'Novo Motorista'}
          </button>
        </div>
      </div>

      {showDriverForm && (
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-600 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i className="fas fa-id-card text-blue-400"></i>
            Cadastro de Novo Motorista
          </h3>
          <form onSubmit={handleDriverSubmit} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center gap-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden group"
                >
                  {newDriver.avatar ? (
                    <img src={newDriver.avatar} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <i className="fas fa-camera text-slate-400 text-2xl group-hover:text-blue-500"></i>
                      <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Upload Foto</span>
                    </>
                  )}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome Completo</label>
                  <input
                    required
                    type="text"
                    placeholder="Nome do motorista"
                    value={newDriver.name}
                    onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-bold text-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Número da CNH</label>
                  <input
                    required
                    type="text"
                    placeholder="00000000000"
                    value={newDriver.license}
                    onChange={(e) => setNewDriver({ ...newDriver, license: e.target.value })}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-bold text-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Username</label>
                  <input
                    required
                    type="text"
                    placeholder="usuario.acesso"
                    value={newDriver.username}
                    onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-bold text-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Senha Inicial</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newDriver.password}
                    onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                    className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-bold text-slate-950"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                Cadastrar Motorista
              </button>
            </div>
          </form>
        </div>
      )}

      {showFineForm && (
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-red-600 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i className="fas fa-gavel text-red-400"></i>
            Registrar Auto de Infração
          </h3>
          <form onSubmit={handleFineSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motorista</label>
              <select
                required
                value={newFine.driverId}
                onChange={(e) => setNewFine({ ...newFine, driverId: e.target.value })}
                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-bold text-slate-950"
              >
                <option value="">Selecione o condutor...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Veículo</label>
              <select
                required
                value={newFine.vehicleId}
                onChange={(e) => setNewFine({ ...newFine, vehicleId: e.target.value })}
                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-bold text-slate-950"
              >
                <option value="">Selecione o veículo...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Data da Infração</label>
              <input
                required
                type="date"
                value={newFine.date}
                onChange={(e) => setNewFine({ ...newFine, date: e.target.value })}
                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-bold text-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Valor (R$)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newFine.value}
                  onChange={(e) => setNewFine({ ...newFine, value: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-bold text-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Pontos</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newFine.points}
                  onChange={(e) => setNewFine({ ...newFine, points: e.target.value })}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-bold text-slate-950"
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Descrição da Infração</label>
              <textarea
                placeholder="Ex: Excesso de velocidade..."
                value={newFine.description}
                onChange={(e) => setNewFine({ ...newFine, description: e.target.value })}
                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm font-bold text-slate-950 h-20 resize-none"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100">
                Salvar Infração
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Driver List */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Motoristas Cadastrados</h3>
          <div className="grid grid-cols-1 gap-4">
            {drivers.map(driver => {
              const driverFines = fines.filter(f => f.driverId === driver.id);
              const totalPoints = driverFines.reduce((sum, f) => sum + f.points, 0);
              
              return (
                <div key={driver.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 group hover:shadow-md transition-all">
                  <div className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
                    {driver.avatar ? (
                      <img src={driver.avatar} alt={driver.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-xl uppercase">
                        {driver.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate">{driver.name}</h4>
                    <p className="text-xs text-slate-400 font-medium">CNH: {driver.license}</p>
                    <div className="flex items-center gap-3 mt-2">
                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${totalPoints >= 20 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                        {totalPoints} Pontos
                       </span>
                       <span className="text-[10px] font-bold text-slate-300 uppercase">@{driver.username}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteDriver(driver.id)}
                    className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fines History */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2">Histórico de Infrações</h3>
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {fines.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {fines.map(fine => {
                  const driver = drivers.find(d => d.id === fine.driverId);
                  const vehicle = vehicles.find(v => v.id === fine.vehicleId);
                  return (
                    <div key={fine.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-write text-xs">
                          {fine.points}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{driver?.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{vehicle?.plate} • {new Date(fine.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">R$ {fine.value.toFixed(2)}</p>
                        <button onClick={() => deleteFine(fine.id)} className="text-[10px] text-red-300 hover:text-red-500 font-bold uppercase tracking-widest">Remover</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-300">
                <i className="fas fa-shield-halved text-4xl mb-3 opacity-20"></i>
                <p className="text-xs font-bold uppercase tracking-widest">Nenhuma infração registrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverManagement;
