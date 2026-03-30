import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Settings, Save, Globe, MessageCircle, 
  CreditCard, ShieldCheck, AlertCircle, RefreshCw, 
  Key, Link as LinkIcon, Database, CheckCircle2
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { ApiSettings } from '../types';

const ApiConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ApiSettings[]>([]);
  const [activeTab, setActiveTab] = useState<'infinitepay' | 'evolution'>('infinitepay');

  // Form states
  const [infinitePayForm, setInfinitePayForm] = useState({
    handle: '',
    apiKey: '',
    environment: 'production' as 'production' | 'sandbox'
  });

  const [evolutionForm, setEvolutionForm] = useState({
    baseUrl: '',
    apiKey: '',
    instanceName: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await dataService.getApiSettings();
      setSettings(data);
      
      const ip = data.find(s => s.service === 'infinitepay');
      if (ip) {
        setInfinitePayForm(prev => ({ ...prev, ...ip.settings }));
      }

      const ev = data.find(s => s.service === 'evolution');
      if (ev) {
        setEvolutionForm(prev => ({ ...prev, ...ev.settings }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === 'infinitepay') {
        const existing = settings.find(s => s.service === 'infinitepay');
        await dataService.saveApiSettings({
          id: existing?.id,
          service: 'infinitepay',
          settings: infinitePayForm
        });
      } else {
        const existing = settings.find(s => s.service === 'evolution');
        await dataService.saveApiSettings({
          id: existing?.id,
          service: 'evolution',
          settings: evolutionForm
        });
      }
      alert("Configurações salvas com sucesso!");
      loadSettings();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-4">
        <RefreshCw size={48} className="animate-spin opacity-20" />
        <p className="font-bold text-sm text-[10px] uppercase tracking-widest">Carregando configurações de API...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 p-4 md:p-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Settings size={22} />
            </div>
            Configuração de APIs
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Gerencie as credenciais e conexões com serviços externos.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          Salvar Alterações
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col md:flex-row">
        {/* Sidebar Abas */}
        <div className="w-full md:w-64 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('infinitepay')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'infinitepay' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <CreditCard size={18} /> InfinitePay
          </button>
          <button
            onClick={() => setActiveTab('evolution')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'evolution' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessageCircle size={18} /> WhatsApp (Evolution)
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 p-8 lg:p-12 space-y-8">
          {activeTab === 'infinitepay' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Globe size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">InfinitePay Checkout</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Link de Pagamento e PIX via InfiniteTag</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">InfiniteTag (Handle)</label>
                  <div className="relative">
                    <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300 placeholder:italic"
                      placeholder="Ex: rtc-persianas (sem o $)"
                      value={infinitePayForm.handle}
                      onChange={e => setInfinitePayForm({...infinitePayForm, handle: e.target.value.replace('$', '')})}
                    />
                  </div>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key (X-API-Key - Opcional)</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300 placeholder:italic"
                      placeholder="Chave de API se houver..."
                      value={infinitePayForm.apiKey}
                      onChange={e => setInfinitePayForm({...infinitePayForm, apiKey: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">Ambiente de Execução</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                    <button
                      onClick={() => setInfinitePayForm({...infinitePayForm, environment: 'production'})}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        infinitePayForm.environment === 'production' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Produção
                    </button>
                    <button
                      onClick={() => setInfinitePayForm({...infinitePayForm, environment: 'sandbox'})}
                      className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        infinitePayForm.environment === 'sandbox' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      Sandbox
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-50/50 text-blue-700 rounded-2xl text-xs border border-blue-100 flex gap-4 items-center">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-blue-100 text-blue-500">
                   <AlertCircle size={20} />
                </div>
                <p className="font-medium text-[10px]">Suas credenciais são usadas para gerar links do <b>Checkout Integrado</b>. Utilize a sua InfiniteTag (ex: rtc-persianas) encontrada nas configurações do seu painel InfinitePay.</p>
              </div>
            </div>
          )}

          {activeTab === 'evolution' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <MessageCircle size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">Evolution API (WhatsApp)</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Automação de Mensagens Transacionais</p>
                </div>
              </div>

              <div className="space-y-6">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL Base da API</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300 placeholder:italic"
                      placeholder="https://sua-instancia.evolution-api.com"
                      value={evolutionForm.baseUrl}
                      onChange={e => setEvolutionForm({...evolutionForm, baseUrl: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key (Global/Local)</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300 placeholder:italic"
                        placeholder="Chave de acesso..."
                        value={evolutionForm.apiKey}
                        onChange={e => setEvolutionForm({...evolutionForm, apiKey: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Instância</label>
                    <div className="relative">
                      <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-300 placeholder:italic"
                        placeholder="ex: Instance_01"
                        value={evolutionForm.instanceName}
                        onChange={e => setEvolutionForm({...evolutionForm, instanceName: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

               <div className="mt-8 p-4 bg-amber-50/50 text-amber-700 rounded-2xl text-xs border border-amber-100 flex gap-4 items-center">
                 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-amber-100 text-amber-500">
                   <AlertCircle size={20} />
                </div>
                <p className="font-medium">A Evolution API deve estar online e com o <b>QR Code já escaneado</b> para que as mensagens automáticas de cobrança sejam enviadas.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiConfig;
