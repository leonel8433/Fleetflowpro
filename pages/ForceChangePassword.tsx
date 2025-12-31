
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import Logo from '../components/Logo';

const ForceChangePassword: React.FC = () => {
  const { changePassword, currentUser } = useFleet();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword === '123' || newPassword === 'admin') {
      setError('Por favor, escolha uma senha diferente da senha padrão.');
      return;
    }

    changePassword(newPassword);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <Logo size="md" className="mb-6" />
          <h2 className="text-2xl font-bold text-slate-800">Segurança do Acesso</h2>
          <p className="text-slate-500 font-medium mt-2">Olá, {currentUser?.name}. Para sua segurança, é obrigatório alterar a senha padrão no seu primeiro acesso.</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
              <div className="relative">
                <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 4 caracteres"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-950 transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirmar Nova Senha</label>
              <div className="relative">
                <i className="fas fa-check-circle absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="password"
                  required
                  placeholder="Repita a nova senha"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-950 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-amber-50 text-amber-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3">
                <i className="fas fa-exclamation-triangle text-lg"></i>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all"
            >
              Atualizar Senha e Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForceChangePassword;
