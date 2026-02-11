
import * as React from 'react';
import { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { SystemUser } from '../types';

interface LoginProps {
  onLogin: (user: SystemUser) => void;
  systemUsers: SystemUser[];
}

const Login = ({ onLogin, systemUsers }: LoginProps) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulação de delay de rede
    setTimeout(() => {
      // Regra 1: Usuário Master (Hardcoded conforme pedido)
      if (login === 'Master' && password === '#Toldocor2026') {
        onLogin({
          id: 'admin-master',
          name: 'Administrador Master',
          login: 'Master',
          role: 'ADMIN' as any,
          active: true
        });
        setLoading(false);
        return;
      }

      // Regra 2: Usuários Cadastrados
      const user = systemUsers.find(u => u.login === login && u.password === password && u.active);

      if (user) {
        onLogin(user);
      } else {
        setError('Credenciais inválidas ou acesso desativado.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-blue-500/30">
      {/* Background Decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md relative animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl overflow-hidden">
          <div className="text-center mb-10">
            <div className="h-20 w-20 bg-white rounded-2xl flex items-center justify-center p-2 mx-auto mb-6 shadow-xl shadow-black/20 group hover:scale-105 transition-transform duration-500">
              <img
                src="https://www.rtcdecor.com.br/wp-content/uploads/2014/06/RTC-logo-atualizada-2.jpg"
                alt="RTC Decor"
                className="h-full w-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Acesso Restrito</h1>
            <p className="text-slate-400 text-sm font-medium">Gestão Inteligente RTC Toldos & Cortinas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuário / Login</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                <input
                  type="text"
                  required
                  placeholder="Seu login"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 py-3 px-4 rounded-xl flex items-center gap-3 animate-in shake duration-300">
                <ShieldCheck className="text-rose-500 shrink-0" size={18} />
                <p className="text-rose-500 text-xs font-bold leading-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">RTC Decor • 2024 • Rio de Janeiro</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
