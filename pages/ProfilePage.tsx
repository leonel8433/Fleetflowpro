
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';

const ProfilePage: React.FC = () => {
  const { currentUser, changePassword } = useFleet();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validação de segurança básica
    // Se currentUser.password não estiver presente, e for o admin, permite 'admin' como padrão
    const storedPassword = currentUser?.password;
    const isAdmin = currentUser?.username === 'admin';
    
    const isValidCurrent = storedPassword 
      ? currentPassword === storedPassword 
      : (isAdmin && currentPassword === 'admin');

    if (!isValidCurrent) {
      setError('A senha atual informada está incorreta.');
      return;
    }

    if (newPassword.length < 4) {
      setError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não coincide.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('A nova senha não pode ser igual à senha atual.');
      return;
    }

    changePassword(newPassword);
    setSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    
    // Auto-hide success message after 5 seconds
    setTimeout(() => setSuccess(false), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Meu Perfil</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gerenciamento de Conta e Segurança</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Card de Informações */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-50 border-2 border-white shadow-inner overflow-hidden mb-4 ring-4 ring-blue-50">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-3xl uppercase">
                  {currentUser?.name.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="font-write text-xl text-slate-800 leading-tight">{currentUser?.name}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">@{currentUser?.username}</p>
            
            <div className="w-full mt-8 pt-8 border-t border-slate-50 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Categoria CNH</span>
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-[10px] font-write uppercase">{currentUser?.category || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Nível de Acesso</span>
                <span className="bg-slate-900 text-white px-3 py-1 rounded-xl text-[10px] font-write uppercase">{currentUser?.username === 'admin' ? 'Administrador' : 'Condutor'}</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
            <i className="fas fa-shield-halved absolute -right-4 -bottom-4 text-8xl opacity-10 group-hover:scale-110 transition-transform"></i>
            <h4 className="text-sm font-write uppercase tracking-widest mb-2">Dica de Segurança</h4>
            <p className="text-xs opacity-80 leading-relaxed">Troque sua senha periodicamente para manter a integridade dos dados da frota e do seu histórico profissional.</p>
          </div>
        </div>

        {/* Formulário de Alteração de Senha */}
        <div className="lg:col-span-2">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
            <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-10 flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                <i className="fas fa-lock text-xs"></i>
              </div>
              Alterar Senha de Acesso
            </h3>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest ml-1">Senha Atual</label>
                  <div className="relative">
                    <i className="fas fa-key absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input 
                      type="password" 
                      required 
                      placeholder="Sua senha atual" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                  <div>
                    <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest ml-1">Nova Senha</label>
                    <div className="relative">
                      <i className="fas fa-shield-cat absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                      <input 
                        type="password" 
                        required 
                        placeholder="Mínimo 4 dígitos" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest ml-1">Confirmar Nova Senha</label>
                    <div className="relative">
                      <i className="fas fa-circle-check absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
                      <input 
                        type="password" 
                        required 
                        placeholder="Repita a nova senha" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-14 pr-5 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-5 rounded-2xl text-xs font-bold flex items-center gap-3 animate-shake">
                  <i className="fas fa-circle-exclamation text-lg"></i>
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 text-emerald-600 p-5 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in fade-in zoom-in-95">
                  <i className="fas fa-circle-check text-lg"></i>
                  Senha alterada com sucesso! Utilize a nova senha no próximo acesso.
                </div>
              )}

              <button 
                type="submit" 
                className="w-full bg-slate-900 text-white py-6 rounded-3xl font-write uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-blue-900 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-sync-alt"></i> Atualizar Dados de Acesso
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
