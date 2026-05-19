import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Settings, Save, Globe, MessageCircle, 
  CreditCard, ShieldCheck, AlertCircle, RefreshCw, 
  Key, Link as LinkIcon, Database, CheckCircle2,
  QrCode, LogOut, Wifi, WifiOff, Sparkles
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { evolutionService } from '../services/evolutionService';
import { dataService } from '../services/dataService';
import { ApiSettings } from '../types';

const ApiConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ApiSettings[]>([]);
  const [activeTab, setActiveTab] = useState<'infinitepay' | 'evolution' | 'gemini'>('evolution');

  // Form states
  const [infinitePayForm, setInfinitePayForm] = useState({
    handle: '',
    apiKey: '',
    environment: 'production' as 'production' | 'sandbox'
  });

  const [evolutionForm, setEvolutionForm] = useState({
    baseUrl: '',
    apiKey: '',
    instanceName: '',
    displayName: '',
    userId: ''
  });

  const [geminiForm, setGeminiForm] = useState({
    apiKey: '',
    managerEnabled: false,
    quoteGraceSeller: 24,
    quoteGraceDirector: 48,
    promiseGraceSeller: 4,
    promiseGraceDirector: 8,
    directorPhone: ''
  });

  const [whatsappInstances, setWhatsappInstances] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [activeInstance, setActiveInstance] = useState<any | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'LOADING'>('LOADING');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadWhatsappData();
  }, []);

  const loadWhatsappData = async () => {
    try {
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select(`
          *,
          user:system_users(id, name)
        `)
        .order('name', { ascending: true });
      
      setWhatsappInstances(instances || []);

      const { data: users } = await supabase
        .from('system_users')
        .select('id, name')
        .eq('active', true)
        .order('name', { ascending: true });
      
      setSystemUsers(users || []);
    } catch (err) {
      console.error('Erro ao carregar dados do WhatsApp:', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (qrCode && connectionStatus !== 'CONNECTED' && activeInstance) {
      interval = setInterval(() => {
        checkWhatsAppStatus(evolutionForm.baseUrl, evolutionForm.apiKey, activeInstance.instance_name);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [qrCode, connectionStatus, evolutionForm, activeInstance]);

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

      const gm = data.find(s => s.service === 'gemini');
      if (gm) {
        setGeminiForm(prev => ({ ...prev, ...gm.settings }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkWhatsAppStatus = async (baseUrl: string, apiKey: string, instanceName: string) => {
    if (!baseUrl || !instanceName) return;
    setCheckingConnection(true);
    try {
      const status = await evolutionService.getConnectionStatus(baseUrl, apiKey, instanceName);
      const isConnected = status.instance?.state === 'open';
      setConnectionStatus(isConnected ? 'CONNECTED' : 'DISCONNECTED');
      if (isConnected) {
        setQrCode(null);
        loadWhatsappData(); // Recarrega para atualizar status se necessário
      }
    } catch (err) {
      setConnectionStatus('DISCONNECTED');
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnectInstance = async (instance: any) => {
    setError(null);
    setActiveInstance(instance);
    try {
      setConnectionStatus('CONNECTING');
      const baseUrl = evolutionForm.baseUrl.replace(/\/$/, '');
      
      // Garantir que a instância exista na API e o Webhook esteja configurado
      await evolutionService.ensureInstanceExists(
        baseUrl, 
        evolutionForm.apiKey, 
        instance.instance_name, 
        instance.name
      );

      console.log('Gerando QR Code para:', instance.instance_name);
      const data = await evolutionService.getQRCode(baseUrl, evolutionForm.apiKey, instance.instance_name, instance.name);
      
      if (data.base64) {
        setQrCode(data.base64);
        setConnectionStatus('DISCONNECTED');
      } else if (data.instance?.state === 'open') {
        setConnectionStatus('CONNECTED');
        setQrCode(null);
        loadWhatsappData();
      } else {
        throw new Error("Não recebemos o QR Code. Tente novamente em instantes.");
      }
    } catch (err: any) {
      console.error('Erro ao conectar WhatsApp:', err);
      setError(err.message || "Erro ao conectar.");
      setConnectionStatus('DISCONNECTED');
    }
  };

  const handleCreateInstance = async () => {
    if (!evolutionForm.instanceName || !evolutionForm.displayName) {
      alert("Preencha o nome da instância e o nome de exibição.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: insError } = await supabase.from('whatsapp_instances').insert({
        name: evolutionForm.displayName,
        instance_name: evolutionForm.instanceName,
        apikey: evolutionForm.apiKey,
        user_id: evolutionForm.userId || null,
        is_active: true
      }).select().single();

      if (insError) throw insError;

      alert("Instância criada! Agora você pode conectar o QR Code.");
      loadWhatsappData();
      setEvolutionForm(prev => ({ ...prev, instanceName: '', displayName: '', userId: '' }));
    } catch (err: any) {
      alert("Erro ao criar instância: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInstance = async (id: string, instanceName: string) => {
    if (!window.confirm(`Deseja remover a instância ${instanceName}?`)) return;
    try {
      // Opcional: chamar logout na API também
      const { error } = await supabase.from('whatsapp_instances').delete().eq('id', id);
      if (error) throw error;
      loadWhatsappData();
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  };

  const handleLogout = async () => {
    if (!activeInstance) return;
    if (!window.confirm("Deseja realmente desconectar este WhatsApp?")) return;
    try {
      await evolutionService.logout(evolutionForm.baseUrl, evolutionForm.apiKey, activeInstance.instance_name);
      setConnectionStatus('DISCONNECTED');
      setQrCode(null);
      loadWhatsappData();
    } catch (err) {
      alert("Erro ao desconectar.");
    }
  };

  const handleSaveGlobal = async () => {
    setSaving(true);
    try {
      const existing = settings.find(s => s.service === 'evolution');
      await dataService.saveApiSettings({
        id: existing?.id,
        service: 'evolution',
        settings: {
          baseUrl: evolutionForm.baseUrl,
          apiKey: evolutionForm.apiKey
        }
      });
      alert("Configurações globais salvas!");
      loadSettings();
    } catch (err) {
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (activeTab === 'evolution') {
      handleSaveGlobal();
      return;
    }

    if (activeTab === 'gemini') {
      setSaving(true);
      try {
        const existing = settings.find(s => s.service === 'gemini');
        await dataService.saveApiSettings({
          id: existing?.id,
          service: 'gemini',
          settings: geminiForm
        });
        alert("Configuração do Gemini salva!");
        loadSettings();
      } catch (err) {
        alert("Erro ao salvar.");
      } finally {
        setSaving(false);
      }
      return;
    }
    
    setSaving(true);
    try {
      const existing = settings.find(s => s.service === 'infinitepay');
      await dataService.saveApiSettings({
        id: existing?.id,
        service: 'infinitepay',
        settings: infinitePayForm
      });
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
            onClick={() => setEvolutionForm(prev => prev)} // Dummy to refresh
            onMouseDown={() => setActiveTab('evolution')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'evolution' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessageCircle size={18} /> WhatsApp (Evolution)
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'gemini' ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={18} /> Google Gemini AI
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
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-12">
               <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <MessageCircle size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">Configuração Master WhatsApp</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Gerencie múltiplos números e atendentes</p>
                </div>
              </div>

              {/* Configuração Global */}
              <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-200 space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe size={14} /> Credenciais da Evolution API
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">URL da API</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://..."
                      value={evolutionForm.baseUrl}
                      onChange={e => setEvolutionForm({...evolutionForm, baseUrl: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Global API Key</label>
                    <input
                      type="password"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Sua API Key..."
                      value={evolutionForm.apiKey}
                      onChange={e => setEvolutionForm({...evolutionForm, apiKey: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveGlobal}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest"
                >
                  Salvar Credenciais
                </button>
              </div>

              {/* Lista de Instâncias */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 uppercase tracking-tighter text-md">Canais Conectados</h4>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {whatsappInstances.length} {whatsappInstances.length === 1 ? 'Canal' : 'Canais'}
                    </span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {whatsappInstances.map((instance) => (
                      <div key={instance.id} className="p-5 bg-white border border-slate-200 rounded-3xl hover:border-blue-200 transition-all group relative">
                         <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeInstance?.id === instance.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                  <Wifi size={20} />
                               </div>
                               <div>
                                  <h5 className="font-black text-slate-900 text-sm uppercase tracking-tighter">{instance.name}</h5>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">{instance.user?.name || 'Sem responsável'}</p>
                               </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteInstance(instance.id, instance.name)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                               <LogOut size={16} />
                            </button>
                         </div>

                         <div className="flex items-center justify-between gap-2 mt-4">
                            <span className="text-[9px] font-mono text-slate-400">ID: {instance.instance_name}</span>
                            <button 
                              onClick={() => handleConnectInstance(instance)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeInstance?.id === instance.id && connectionStatus === 'CONNECTED' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                            >
                               {activeInstance?.id === instance.id && connectionStatus === 'CONNECTED' ? 'Conectado' : 'Conectar QR Code'}
                            </button>
                         </div>
                      </div>
                    ))}

                    {/* Card de Adicionar */}
                    <div className="p-5 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col gap-4">
                        <div className="grid grid-cols-1 gap-3">
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                              placeholder="Nome Exibição (ex: Aline WhatsApp)"
                              value={evolutionForm.displayName}
                              onChange={e => setEvolutionForm({...evolutionForm, displayName: e.target.value})}
                           />
                           <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                              placeholder="ID Interno (ex: aline_01)"
                              value={evolutionForm.instanceName}
                              onChange={e => setEvolutionForm({...evolutionForm, instanceName: e.target.value})}
                           />
                           <select
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
                              value={evolutionForm.userId}
                              onChange={e => setEvolutionForm({...evolutionForm, userId: e.target.value})}
                           >
                              <option value="">Vincular a um usuário...</option>
                              {systemUsers.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                              ))}
                           </select>
                        </div>
                        <button 
                          onClick={handleCreateInstance}
                          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                        >
                           Adicionar Novo Número
                        </button>
                    </div>
                 </div>
              </div>

              {/* Área do QR Code Modal/Overlay */}
              {activeInstance && (connectionStatus === 'CONNECTING' || qrCode) && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                   <div className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
                      <div className="flex justify-between items-center mb-2">
                         <h5 className="font-black text-slate-900 uppercase tracking-tighter text-xl">Conectar {activeInstance.name}</h5>
                         <button onClick={() => {setQrCode(null); setActiveInstance(null);}} className="text-slate-400 hover:text-slate-600">
                            <LogOut size={20} />
                         </button>
                      </div>

                      {qrCode ? (
                        <div className="space-y-6">
                           <div className="p-4 bg-white rounded-3xl shadow-xl border border-slate-100 inline-block">
                              <img src={qrCode} alt="QR Code" className="w-64 h-64 mx-auto" />
                           </div>
                           <div className="space-y-2">
                              <p className="text-sm font-bold text-slate-600">Aponte a câmera do WhatsApp para este código</p>
                              <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest animate-pulse">
                                Aguardando sincronização...
                              </p>
                           </div>
                        </div>
                      ) : (
                        <div className="py-20 flex flex-col items-center gap-4">
                           <RefreshCw size={48} className="animate-spin text-blue-500" />
                           <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Gerando sessão segura...</p>
                        </div>
                      )}

                      {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
                   </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'gemini' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg leading-none">Inteligência Artificial</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Assistente de Respostas do CRM via Gemini 1.5 Flash</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-200 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gemini API Key</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="password"
                        className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        placeholder="Insira sua chave do Google AI Studio..."
                        value={geminiForm.apiKey}
                        onChange={e => setGeminiForm({ apiKey: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-purple-50 text-purple-700 rounded-2xl text-[10px] border border-purple-100 flex gap-4 items-center">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 border border-purple-100">
                       <AlertCircle size={16} />
                    </div>
                    <p className="font-medium">O modelo <b>Gemini 1.5 Flash</b> será usado para gerar sugestões de respostas rápidas e inteligentes diretamente no seu chat.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tighter text-sm">Gerente IA (Fofoqueiro)</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Monitoramento automático de Vendas e WhatsApp</p>
                    </div>
                    <button
                      onClick={() => setGeminiForm({ ...geminiForm, managerEnabled: !geminiForm.managerEnabled })}
                      className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                        geminiForm.managerEnabled 
                        ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200' 
                        : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {geminiForm.managerEnabled ? 'Serviço em Execução' : 'Serviço Pausado'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-100 transition-opacity">
                    <div className="space-y-4 p-5 bg-white border border-slate-200 rounded-3xl">
                       <h5 className="font-black text-slate-900 text-xs uppercase tracking-widest border-b border-slate-100 pb-3">Cobrança de Orçamentos</h5>
                       
                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Carência Vendedor (Horas após visita)</label>
                         <input
                           type="number"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none"
                           value={geminiForm.quoteGraceSeller}
                           onChange={e => setGeminiForm({ ...geminiForm, quoteGraceSeller: Number(e.target.value) })}
                         />
                       </div>

                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Escalonamento Diretor (Horas após visita)</label>
                         <input
                           type="number"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none"
                           value={geminiForm.quoteGraceDirector}
                           onChange={e => setGeminiForm({ ...geminiForm, quoteGraceDirector: Number(e.target.value) })}
                         />
                       </div>
                    </div>

                    <div className="space-y-4 p-5 bg-white border border-slate-200 rounded-3xl">
                       <h5 className="font-black text-slate-900 text-xs uppercase tracking-widest border-b border-slate-100 pb-3">Cobrança de Promessas (WhatsApp)</h5>
                       
                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Carência Vendedor (Horas úteis)</label>
                         <input
                           type="number"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none"
                           value={geminiForm.promiseGraceSeller}
                           onChange={e => setGeminiForm({ ...geminiForm, promiseGraceSeller: Number(e.target.value) })}
                         />
                       </div>

                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Escalonamento Diretor (Horas úteis)</label>
                         <input
                           type="number"
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none"
                           value={geminiForm.promiseGraceDirector}
                           onChange={e => setGeminiForm({ ...geminiForm, promiseGraceDirector: Number(e.target.value) })}
                         />
                       </div>
                    </div>

                    <div className="lg:col-span-2 space-y-2 p-5 bg-blue-50 border border-blue-100 rounded-3xl">
                      <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest ml-1">WhatsApp do Diretor (Escalonamento)</label>
                      <p className="text-[10px] text-blue-600 font-medium mb-3">Este número receberá os alertas quando um vendedor não cumprir os prazos de carência acima.</p>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ex: 5511999999999"
                        value={geminiForm.directorPhone}
                        onChange={e => setGeminiForm({ ...geminiForm, directorPhone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-4 border border-slate-200 rounded-3xl flex items-center justify-between hover:bg-slate-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        <LinkIcon size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Obter Chave Grátis</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Google AI Studio</p>
                      </div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiConfig;
