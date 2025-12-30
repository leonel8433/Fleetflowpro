
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const { login } = useFleet();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = login(username, password);
    if (!success) {
      setError('Usuário ou senha inválidos.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative patterns */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/5 rounded-full blur-3xl -ml-48 -mb-48"></div>

      <div className="max-w-md w-full relative">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Logo size="lg" className="mb-6 drop-shadow-md" />
          <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full mb-4"></div>
          <p className="text-slate-500 font-medium">Gestão Inteligente de Logística e Frota</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 animate-in zoom-in-95 duration-500">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Usuário de Acesso</label>
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="text"
                  placeholder="Nome de usuário"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-950 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2 ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                <a href="#" className="text-xs font-bold text-blue-600 hover:underline">Recuperar acesso</a>
              </div>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-950 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-shake">
                <i className="fas fa-circle-exclamation text-lg"></i>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-blue-900 shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
            >
              Iniciar Sessão
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50">
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              Propriedade de Help System<br/>
              Acesso Monitorado para Fins Profissionais
            </p>
          </div>
        </div>
        
        {/* Demo Credentials Hint */}
        <div className="mt-8 text-center bg-white/50 backdrop-blur-sm py-3 px-6 rounded-full border border-white inline-block left-1/2 -translate-x-1/2 relative shadow-sm">
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-tighter">
            <span className="text-slate-400">Gestor: <b className="text-blue-600">admin / admin</b></span>
            <div className="w-px h-3 bg-slate-200"></div>
            <span className="text-slate-400">Motorista: <b className="text-blue-600">joao / 123</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
