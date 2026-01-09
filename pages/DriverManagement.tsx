
import React, { useState, useRef, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { Fine, Driver } from '../types';

const DriverManagement: React.FC = () => {
  const { drivers, vehicles, fines, addFine, addDriver, updateDriver, deleteDriver, deleteFine } = useFleet();
  const [showFineForm, setShowFineForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');

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
    category: 'B',
    email: '',
    phone: '',
    company: '',
    notes: '',
    username: '',
    password: '',
    avatar: ''
  });

  // Função para aplicar máscara de telefone (xx) xxxxx-xxxx
  const maskPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let masked = digits;

    if (digits.length <= 11) {
      if (digits.length > 0) masked = `(${digits.slice(0, 2)}`;
      if (digits.length > 2) masked += `) ${digits.slice(2, 7)}`;
      if (digits.length > 7) masked += `-${digits.slice(7, 11)}`;
    } else {
      // Caso ultrapasse 11 dígitos, mantém o padrão mas trunca
      masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }

    return masked;
  };

  const filteredDrivers = useMemo(() => {
    const term = driverSearchTerm.toLowerCase();
    return drivers.filter(d => 
      d.username !== 'admin' && (
        d.name.toLowerCase().includes(term) ||
        d.username.toLowerCase().includes(term) ||
        d.license.toLowerCase().includes(term) ||
        (d.company && d.company.toLowerCase().includes(term))
      )
    );
  }, [drivers, driverSearchTerm]);

  const handleFineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFine.driverId || !newFine.vehicleId || !newFine.value) {
      alert("Por favor, selecione o motorista, o veículo e o valor da multa.");
      return;
    }

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
    setNewFine({ driverId: '', vehicleId: '', date: new Date().toISOString().split('T')[0], value: '', points: '', description: '' });
    setShowFineForm(false);
    alert('Multa registrada com sucesso!');
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.license || !newDriver.username) return;

    const normalizedName = newDriver.name.trim();
    const normalizedUsername = newDriver.username.toLowerCase().trim().replace(/\s/g, '');
    const normalizedLicense = newDriver.license.trim();
    const normalizedEmail = newDriver.email?.toLowerCase().trim();

    const usernameExists = drivers.some(d => d.username === normalizedUsername && d.id !== editingDriverId);
    const licenseExists = drivers.some(d => d.license === normalizedLicense && d.id !== editingDriverId);

    if (usernameExists) {
      alert(`Erro: O nome de usuário "@${normalizedUsername}" já está em uso.`);
      return;
    }

    if (licenseExists) {
      alert(`Erro: A CNH "${normalizedLicense}" já está cadastrada para outro condutor.`);
      return;
    }

    const driverData: Partial<Driver> = {
      name: normalizedName,
      license: normalizedLicense,
      category: newDriver.category,
      email: normalizedEmail,
      phone: newDriver.phone,
      company: newDriver.company.trim(),
      notes: newDriver.notes.trim(),
      username: normalizedUsername,
      avatar: newDriver.avatar
    };

    if (editingDriverId) {
      if (newDriver.password.trim() !== '') {
        driverData.password = newDriver.password;
        driverData.passwordChanged = false;
      }
      updateDriver(editingDriverId, driverData);
      alert('Cadastro do motorista atualizado com sucesso!');
    } else {
      const driver: Driver = {
        id: Math.random().toString(36).substr(2, 9),
        name: normalizedName,
        license: normalizedLicense,
        category: newDriver.category,
        email: normalizedEmail,
        phone: newDriver.phone,
        company: newDriver.company.trim(),
        notes: newDriver.notes.trim(),
        username: normalizedUsername,
        password: newDriver.password || '123',
        passwordChanged: false,
        avatar: newDriver.avatar
      };
      addDriver(driver);
      alert('Motorista cadastrado com sucesso!');
    }

    resetFormState();
    setShowDriverForm(false);
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
      avatar: driver.avatar || ''
    });
    setEditingDriverId(driver.id);
    setShowDriverForm(true);
    setShowFineForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada é muito grande. Por favor, escolha uma foto de até 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewDriver(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setNewDriver(prev => ({ ...prev, avatar: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetFormState = () => {
    setNewDriver({ name: '', license: '', category: 'B', email: '', phone: '', company: '', notes: '', username: '', password: '', avatar: '' });
    setEditingDriverId(null);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Recursos Humanos & Condutores</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Motoristas e Pontuação</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => { setShowFineForm(!showFineForm); setShowDriverForm(false); setEditingDriverId(null); }}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${showFineForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            <i className={`fas ${showFineForm ? 'fa-times' : 'fa-gavel'}`}></i>
            {showFineForm ? 'Cancelar' : 'Registrar Multa'}
          </button>
          <button 
            onClick={() => { 
              if (showDriverForm) {
                setShowDriverForm(false);
                resetFormState();
              } else {
                resetFormState();
                setShowDriverForm(true);
                setShowFineForm(false);
              }
            }}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-100 transition-all"
          >
            <i className={`fas ${showDriverForm ? 'fa-times' : (editingDriverId ? 'fa-user-pen' : 'fa-user-plus')}`}></i>
            {showDriverForm ? 'Cancelar' : (editingDriverId ? 'Editar Motorista' : 'Novo Motorista')}
          </button>
        </div>
      </div>

      {showFineForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <i className="fas fa-gavel"></i>
            </div>
            <div>
              <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">Registrar Nova Infração</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Associe a multa ao condutor e ao veículo correspondente</p>
            </div>
          </div>
          
          <form onSubmit={handleFineSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Motorista Infrator</label>
                <select 
                  required 
                  value={newFine.driverId} 
                  onChange={(e) => setNewFine({ ...newFine, driverId: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900"
                >
                  <option value="">Selecione o motorista...</option>
                  {drivers.filter(d => d.username !== 'admin').map(d => (
                    <option key={d.id} value={d.id}>{d.name} (@{d.username})</option>
                  ))}
                </select>
              </div>
              
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo da Infração</label>
                <select 
                  required 
                  value={newFine.vehicleId} 
                  onChange={(e) => setNewFine({ ...newFine, vehicleId: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900"
                >
                  <option value="">Selecione o veículo...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Multa</label>
                <input 
                  type="date" 
                  required 
                  value={newFine.date} 
                  onChange={(e) => setNewFine({ ...newFine, date: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  required 
                  placeholder="0,00" 
                  value={newFine.value} 
                  onChange={(e) => setNewFine({ ...newFine, value: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Pontuação (CNH)</label>
                <input 
                  type="number" 
                  required 
                  placeholder="Ex: 7" 
                  value={newFine.points} 
                  onChange={(e) => setNewFine({ ...newFine, points: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900" 
                />
              </div>

              <div className="lg:col-span-1">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">&nbsp;</label>
                <button 
                  type="submit" 
                  className="w-full bg-red-600 text-white p-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95"
                >
                  Gravar Multa
                </button>
              </div>

              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Descrição da Infração</label>
                <textarea 
                  placeholder="Ex: Excesso de velocidade na Marginal Tietê..." 
                  value={newFine.description} 
                  onChange={(e) => setNewFine({ ...newFine, description: e.target.value })}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-900 min-h-[100px]"
                ></textarea>
              </div>
            </div>
          </form>
        </div>
      )}

      {showDriverForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">{editingDriverId ? 'Editar Cadastro de Condutor' : 'Cadastro de Novo Condutor'}</h3>
          <form onSubmit={handleDriverSubmit} className="space-y-8">
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="flex flex-col items-center gap-4 shrink-0">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-40 h-40 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden group shadow-inner relative"
                >
                  {newDriver.avatar ? (
                    <img src={newDriver.avatar} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <i className="fas fa-camera text-slate-300 text-3xl group-hover:text-blue-500 transition-colors"></i>
                      <span className="text-[10px] font-bold text-slate-300 mt-3 uppercase tracking-widest">Foto Perfil</span>
                    </>
                  )}
                  {newDriver.avatar && (
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <i className="fas fa-sync text-white text-xl"></i>
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                
                <div className="flex flex-col gap-2 w-full max-w-[160px]">
                  {newDriver.avatar && (
                    <button 
                      type="button" 
                      onClick={removeAvatar}
                      className="text-[9px] font-bold text-red-500 uppercase hover:text-red-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fas fa-trash-alt"></i> Remover Foto
                    </button>
                  )}
                  <p className="text-[9px] text-slate-400 font-medium uppercase text-center">Clique na moldura para fazer upload do avatar</p>
                </div>
              </div>
              
              <div className="flex-1 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="md:col-span-2">
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Nome Completo do Condutor</label>
                     <input required placeholder="Ex: Marcos Leonel" value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Empresa / Unidade</label>
                     <input placeholder="Ex: Matriz SP" value={newDriver.company} onChange={(e) => setNewDriver({ ...newDriver, company: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">E-mail Corporativo</label>
                     <input type="email" placeholder="nome@frota.com" value={newDriver.email} onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Telefone / WhatsApp</label>
                     <input 
                      placeholder="(11) 99999-9999" 
                      value={newDriver.phone} 
                      onChange={(e) => setNewDriver({ ...newDriver, phone: maskPhone(e.target.value) })} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" 
                    />
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Registro CNH</label>
                     <input required placeholder="00000000000" value={newDriver.license} onChange={(e) => setNewDriver({ ...newDriver, license: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Categoria CNH</label>
                     <select required value={newDriver.category} onChange={(e) => setNewDriver({ ...newDriver, category: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950">
                       <option value="A">A (Moto)</option>
                       <option value="B">B (Carro)</option>
                       <option value="AB">AB (Moto e Carro)</option>
                       <option value="C">C (Caminhão)</option>
                       <option value="D">D (Ônibus)</option>
                       <option value="E">E (Articulado)</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Usuário de Acesso</label>
                     <input required placeholder="login.sistema" value={newDriver.username} onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value.toLowerCase().replace(/\s/g, '') })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">
                       {editingDriverId ? 'Nova Senha (Opcional)' : 'Senha Provisória'}
                     </label>
                     <input 
                       type="password" 
                       placeholder={editingDriverId ? 'Deixe em branco para manter' : 'Mínimo 4 dígitos'} 
                       value={newDriver.password} 
                       onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })} 
                       className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" 
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Observações Administrativas</label>
                     <textarea placeholder="Notas sobre o perfil do condutor..." value={newDriver.notes} onChange={(e) => setNewDriver({ ...newDriver, notes: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950 min-h-[80px]" />
                   </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
              <button type="button" onClick={() => { setShowDriverForm(false); resetFormState(); }} className="px-8 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest">Cancelar</button>
              <button type="submit" className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">
                {editingDriverId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
            <h3 className="text-[10px] font-write text-slate-400 uppercase tracking-[0.2em]">Corpo de Condutores ({filteredDrivers.length})</h3>
            <div className="relative w-full md:w-64">
              <i className="fas fa-filter absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
              <input 
                type="text" 
                placeholder="Filtrar motoristas..." 
                value={driverSearchTerm}
                onChange={(e) => setDriverSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDrivers.map(driver => {
              const driverFines = fines.filter(f => f.driverId === driver.id);
              const totalPoints = driverFines.reduce((sum, f) => sum + f.points, 0);
              
              return (
                <div key={driver.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col group hover:shadow-md transition-all">
                  <div className="flex items-start gap-5 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-white shadow-inner overflow-hidden flex-shrink-0">
                      {driver.avatar ? (
                        <img src={driver.avatar} alt={driver.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-2xl uppercase">
                          {driver.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h4 className="font-write text-lg text-slate-800 truncate leading-tight mb-1">{driver.name}</h4>
                      {driver.company && <p className="text-[10px] text-blue-600 font-bold uppercase mb-2">{driver.company}</p>}
                      <div className="flex items-center gap-2 mb-3">
                         <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-write uppercase tracking-widest">CNH {driver.license}</span>
                         <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[8px] font-write uppercase tracking-widest">CAT {driver.category}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {driver.email && <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold"><i className="fas fa-envelope text-slate-200"></i> {driver.email}</div>}
                        {driver.phone && <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold"><i className="fas fa-phone text-slate-200"></i> {driver.phone}</div>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-write text-slate-400 uppercase tracking-widest">Status de Pontos</span>
                      <span className={`text-xs font-write uppercase ${totalPoints >= 20 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {totalPoints} {totalPoints === 1 ? 'Ponto' : 'Pontos'} Acumulados
                      </span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleEditDriver(driver)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-300 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all">
                        <i className="fas fa-pen text-xs"></i>
                      </button>
                      <button onClick={() => { if(window.confirm(`Tem certeza que deseja remover ${driver.name}?`)) deleteDriver(driver.id); }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredDrivers.length === 0 && (
              <div className="md:col-span-2 py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <i className="fas fa-users-slash text-4xl text-slate-200 mb-4"></i>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Nenhum motorista localizado</p>
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <h3 className="text-[10px] font-write text-slate-400 uppercase tracking-[0.2em] px-2 mb-6">Histórico Crítico</h3>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
               <h4 className="text-xs font-write text-slate-800 uppercase tracking-widest">Alertas de Infração</h4>
            </div>
            {fines.length > 0 ? (
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar">
                {fines.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(fine => {
                  const driver = drivers.find(d => d.id === fine.driverId);
                  const vehicle = vehicles.find(v => v.id === fine.vehicleId);
                  return (
                    <div key={fine.id} className="p-5 flex justify-between items-start hover:bg-slate-50 transition-colors">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex flex-col items-center justify-center font-write shrink-0 border border-red-100">
                          <span className="text-xs">{fine.points}</span>
                          <span className="text-[6px] uppercase">PTS</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-write text-slate-800 uppercase tracking-tight truncate">{driver?.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{vehicle?.plate} • {new Date(fine.date).toLocaleDateString()}</p>
                          <p className="text-[9px] text-slate-500 mt-2 italic line-clamp-2">{fine.description}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-write text-red-600">R$ {fine.value.toFixed(2)}</p>
                        <button onClick={() => deleteFine(fine.id)} className="text-[8px] text-slate-300 hover:text-red-500 font-bold uppercase tracking-widest mt-2 block">Excluir</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-16 text-center text-slate-300">
                <i className="fas fa-shield-check text-4xl mb-4 opacity-20"></i>
                <p className="text-[10px] font-write uppercase tracking-widest">Frota sem infrações registradas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverManagement;
