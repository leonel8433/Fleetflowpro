
import React, { useState, useRef, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { Fine, Driver } from '../types';

const CNH_CATEGORIES = [
  { value: 'A', label: 'A (Moto)' },
  { value: 'B', label: 'B (Carro)' },
  { value: 'AB', label: 'AB (Moto e Carro)' },
  { value: 'C', label: 'C (Caminhão)' },
  { value: 'D', label: 'D (Ônibus)' },
  { value: 'E', label: 'E (Articulado / Carreta)' },
];

const DriverManagement: React.FC = () => {
  const { drivers, vehicles, fines, addFine, addDriver, updateDriver, deleteDriver } = useFleet();
  const [showFineForm, setShowFineForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');

  const initialFineState = {
    driverId: '',
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    value: '',
    points: '',
    description: ''
  };

  const initialDriverState = {
    name: '',
    license: '',
    category: 'B',
    email: '',
    phone: '',
    company: '',
    notes: '',
    username: '',
    password: '',
    avatar: '',
    initialPoints: '0'
  };

  const [newFine, setNewFine] = useState(initialFineState);
  const [newDriver, setNewDriver] = useState(initialDriverState);

  // Máscara de Telefone Brasileira Robusta
  const maskPhone = (value: string) => {
    let r = value.replace(/\D/g, "");
    r = r.substring(0, 11);
    if (r.length > 10) {
      r = r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (r.length > 5) {
      r = r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (r.length > 2) {
      r = r.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    } else if (r.length > 0) {
      r = r.replace(/^(\d*)/, "($1");
    }
    return r;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewDriver(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredDrivers = useMemo(() => {
    const term = driverSearchTerm.toLowerCase();
    return drivers.filter(d => 
      d.username !== 'admin' && (
        d.name.toLowerCase().includes(term) ||
        d.username.toLowerCase().includes(term) ||
        d.license.toLowerCase().includes(term)
      )
    );
  }, [drivers, driverSearchTerm]);

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
    setNewFine(initialFineState);
    setShowFineForm(false);
    alert('Multa registrada!');
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.license || !newDriver.username) return;

    // Normatização de dados para comparação
    const normalizedName = newDriver.name.trim().toLowerCase();
    const normalizedLicense = newDriver.license.trim();
    const normalizedEmail = newDriver.email?.trim().toLowerCase();
    const normalizedUsername = newDriver.username.toLowerCase().trim().replace(/\s/g, '');

    // Validação de Duplicidade
    const otherDrivers = drivers.filter(d => d.id !== editingDriverId);

    const nameExists = otherDrivers.some(d => d.name.trim().toLowerCase() === normalizedName);
    if (nameExists) {
      alert(`Erro: Já existe um motorista cadastrado com o nome "${newDriver.name.trim()}".`);
      return;
    }

    const licenseExists = otherDrivers.some(d => d.license.trim() === normalizedLicense);
    if (licenseExists) {
      alert(`Erro: A CNH "${normalizedLicense}" já está vinculada a outro motorista.`);
      return;
    }

    if (normalizedEmail) {
      const emailExists = otherDrivers.some(d => d.email?.trim().toLowerCase() === normalizedEmail);
      if (emailExists) {
        alert(`Erro: O e-mail "${normalizedEmail}" já está em uso por outro cadastro.`);
        return;
      }
    }

    const usernameExists = otherDrivers.some(d => d.username.toLowerCase() === normalizedUsername);
    if (usernameExists) {
      alert(`Erro: O nome de usuário "@${normalizedUsername}" já está em uso.`);
      return;
    }

    // Validação mínima de telefone
    if (newDriver.phone && newDriver.phone.replace(/\D/g, '').length < 10) {
      alert('Por favor, informe um telefone válido com DDD.');
      return;
    }

    const driverData: Partial<Driver> = {
      name: newDriver.name.trim(),
      license: normalizedLicense,
      category: newDriver.category,
      email: normalizedEmail || undefined,
      phone: newDriver.phone,
      company: newDriver.company.trim(),
      notes: newDriver.notes.trim(),
      username: normalizedUsername,
      avatar: newDriver.avatar,
      initialPoints: parseInt(newDriver.initialPoints) || 0
    };

    try {
      if (editingDriverId) {
        if (newDriver.password) driverData.password = newDriver.password;
        await updateDriver(editingDriverId, driverData);
        alert('Cadastro do condutor atualizado com sucesso!');
      } else {
        const driver: Driver = {
          id: Math.random().toString(36).substr(2, 9),
          ...driverData as Driver,
          password: newDriver.password || '123',
          passwordChanged: false
        };
        await addDriver(driver);
        alert('Condutor cadastrado com sucesso!');
      }
      resetFormState();
      setShowDriverForm(false);
    } catch (error) {
      alert('Erro ao salvar as informações do motorista.');
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setNewDriver({
      name: driver.name,
      license: driver.license,
      category: driver.category,
      email: driver.email || '',
      phone: driver.phone || '',
      company: driver.company || '',
      notes: driver.notes || '',
      username: driver.username,
      password: '',
      avatar: driver.avatar || '',
      initialPoints: (driver.initialPoints || 0).toString()
    });
    setEditingDriverId(driver.id);
    setShowDriverForm(true);
    setShowFineForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetFormState = () => {
    setNewDriver(initialDriverState);
    setEditingDriverId(null);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão de Condutores</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Recursos Humanos & Pontuação</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowFineForm(!showFineForm)} className="px-4 py-2.5 rounded-xl font-bold bg-white text-slate-700 border border-slate-200 transition-all hover:bg-slate-50">
            <i className="fas fa-gavel"></i> Registrar Multa
          </button>
          <button onClick={() => { if(showDriverForm) { setShowDriverForm(false); resetFormState(); } else { resetFormState(); setShowDriverForm(true); } }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-white transition-all ${showDriverForm && !editingDriverId ? 'bg-slate-900' : 'bg-blue-600'}`}>
             <i className={`fas ${showDriverForm ? 'fa-times' : 'fa-user-plus'}`}></i> {showDriverForm && !editingDriverId ? 'Cancelar' : 'Novo Motorista'}
          </button>
        </div>
      </div>

      {showFineForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8 border-b pb-4">Nova Infração</h3>
          <form onSubmit={handleFineSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Motorista</label>
                <select required value={newFine.driverId} onChange={(e) => setNewFine({ ...newFine, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">
                  <option value="">Selecione...</option>
                  {drivers.filter(d => d.username !== 'admin').map(d => (<option key={d.id} value={d.id}>{d.name} (@{d.username})</option>))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Veículo</label>
                <select required value={newFine.vehicleId} onChange={(e) => setNewFine({ ...newFine, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">
                  <option value="">Selecione...</option>
                  {vehicles.map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}
                </select>
              </div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Data</label><input type="date" required value={newFine.date} onChange={(e) => setNewFine({ ...newFine, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Valor (R$)</label><input type="number" step="0.01" required value={newFine.value} onChange={(e) => setNewFine({ ...newFine, value: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div><label className="block text-[10px] text-slate-400 uppercase mb-2">Pontos</label><input type="number" required value={newFine.points} onChange={(e) => setNewFine({ ...newFine, points: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" /></div>
              <div className="lg:col-span-3">
                <label className="block text-[10px] text-slate-400 uppercase mb-2">Descrição / Motivo da Multa</label>
                <textarea 
                  placeholder="Ex: Excesso de velocidade na BR-101, conversão proibida, estacionamento irregular..." 
                  value={newFine.description} 
                  onChange={(e) => setNewFine({ ...newFine, description: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none min-h-[80px]"
                />
              </div>
              <div className="flex items-end"><button type="submit" className="w-full bg-red-600 text-white p-4 rounded-2xl font-write uppercase text-[10px] shadow-lg">Gravar Multa</button></div>
          </form>
        </div>
      )}

      {showDriverForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-6 mb-10">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-300 rounded-[2rem] flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:bg-slate-100 transition-all group relative"
              title="Clique para carregar foto"
            >
               {newDriver.avatar ? (
                 <>
                   <img src={newDriver.avatar} className="w-full h-full object-cover" alt="Preview" />
                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <i className="fas fa-camera text-white text-xl"></i>
                   </div>
                 </>
               ) : (
                 <>
                   <i className="fas fa-camera text-2xl text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                   <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase text-center px-2">Trocar Foto</span>
                 </>
               )}
               <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
            <div>
              <h3 className="text-xl font-write text-slate-800 uppercase tracking-tight">{editingDriverId ? 'Ajustar Cadastro' : 'Novo Condutor'}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Edite as informações abaixo e clique em Salvar</p>
            </div>
          </div>
          
          <form onSubmit={handleDriverSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Nome Completo</label>
              <input required value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Nº CNH</label>
              <input required value={newDriver.license} onChange={(e) => setNewDriver({ ...newDriver, license: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Categoria CNH</label>
              <select required value={newDriver.category} onChange={(e) => setNewDriver({ ...newDriver, category: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500">
                {CNH_CATEGORIES.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">E-mail Corporativo</label>
              <input type="email" value={newDriver.email} onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="exemplo@empresa.com" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Telefone / WhatsApp</label>
              <input 
                value={newDriver.phone} 
                onChange={(e) => setNewDriver({ ...newDriver, phone: maskPhone(e.target.value) })} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="(00) 00000-0000" 
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Empresa / Contratante</label>
              <input value={newDriver.company} onChange={(e) => setNewDriver({ ...newDriver, company: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Razão Social" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Pontuação Inicial</label>
              <input type="number" value={newDriver.initialPoints} onChange={(e) => setNewDriver({ ...newDriver, initialPoints: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Usuário de Acesso</label>
              <input required value={newDriver.username} onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value.toLowerCase().replace(/\s/g, '') })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Senha de Acesso</label>
              <input type="password" value={newDriver.password} onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder={editingDriverId ? "Deixe vazio para manter atual" : "Senha padrão"} />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-[10px] text-slate-400 uppercase mb-2 ml-1">Observações / Prontuário</label>
              <textarea value={newDriver.notes} onChange={(e) => setNewDriver({ ...newDriver, notes: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none min-h-[100px] focus:ring-2 focus:ring-blue-500" placeholder="Informações relevantes sobre o condutor..." />
            </div>
            <div className="lg:col-span-3 flex justify-end gap-3 pt-6 border-t border-slate-50">
              <button type="button" onClick={() => { setShowDriverForm(false); resetFormState(); }} className="px-6 py-4 text-slate-400 uppercase text-[10px] font-bold transition-colors hover:text-slate-600">Cancelar</button>
              <button type="submit" className="bg-blue-600 text-white px-16 py-5 rounded-2xl font-write uppercase text-xs shadow-xl active:scale-95 transition-all hover:bg-blue-700">
                {editingDriverId ? 'Salvar Alterações' : 'Salvar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b">
          <div className="relative w-full md:w-64">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
            <input type="text" placeholder="Buscar motoristas..." value={driverSearchTerm} onChange={(e) => setDriverSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
            {filteredDrivers.map(driver => {
              const driverFines = fines.filter(f => f.driverId === driver.id);
              const totalPoints = (driver.initialPoints || 0) + driverFines.reduce((sum, f) => sum + f.points, 0);
              return (
                <div key={driver.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col group hover:shadow-md transition-all relative overflow-hidden">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-slate-50 border flex items-center justify-center font-bold text-slate-300 text-xl uppercase shrink-0 overflow-hidden shadow-inner">
                      {driver.avatar ? <img src={driver.avatar} className="w-full h-full object-cover" alt={driver.name} /> : driver.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-write text-base text-slate-800 truncate uppercase tracking-tight">{driver.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">@{driver.username} • {driver.company || 'Frota Própria'}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[8px] font-write uppercase border border-blue-100">CNH {driver.license}</span>
                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[8px] font-write uppercase border border-slate-200">CAT {driver.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex gap-6">
                       <div>
                         <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mb-1">Pontuação</p>
                         <p className={`text-sm font-write uppercase ${totalPoints >= 40 ? 'text-red-600' : 'text-emerald-500'}`}>{totalPoints} PTS</p>
                       </div>
                       {driver.phone && (
                         <div>
                           <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest mb-1">WhatsApp</p>
                           <p className="text-[11px] font-bold text-slate-700">{driver.phone}</p>
                         </div>
                       )}
                    </div>
                    <button 
                      onClick={() => handleEditDriver(driver)} 
                      className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-blue-600 hover:bg-white flex items-center justify-center border border-slate-100 transition-all shadow-sm"
                      title="Editar motorista"
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default DriverManagement;
