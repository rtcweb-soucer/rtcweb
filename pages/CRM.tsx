import * as React from 'react';
import { useState, useRef } from 'react';
import { Customer, Product, Seller } from '../types';
import QuickQuoteCRM from './QuickQuoteCRM';
import CustomerForm from '../components/CustomerForm';
import SearchableCustomerSelect from '../components/SearchableCustomerSelect';
import { Search, Phone, MessageSquare, Send, Paperclip, CheckCheck, Clock, User, PhoneCall, MoreVertical, LayoutGrid, X, Filter, Mic, Image as ImageIcon, UserPlus, Save, MapPin, CreditCard, Thermometer, ShoppingCart, Link as LinkIcon } from 'lucide-react';

interface CRMProps {
  customers: Customer[];
  products: Product[];
  sellers: Seller[];
  onAddCustomer: (customer: any) => Promise<void> | void;
}

const CRM = ({ customers, products, sellers, onAddCustomer }: CRMProps) => {
  const [activeChat, setActiveChat] = useState<Customer | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ text: string; sender: 'me' | 'them'; time: string }[]>([
    { text: 'Olá, gostaria de um orçamento de toldo.', sender: 'them', time: '10:30' },
    { text: 'Claro! Pode me passar as medidas?', sender: 'me', time: '10:32' }
  ]);
  const [dragOver, setDragOver] = useState(false);
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'quote' | 'profile'>('quote');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<any>(null);

  // Simular leads recentes para o Kanban
  const recentLeads = customers.slice(0, 10);
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      setChatInput(prev => prev + (prev ? '\n\n' : '') + data);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const sendMessage = (type: 'text' | 'audio' | 'image' = 'text', content?: string) => {
    const text = content || chatInput;
    if (!text.trim() && type === 'text') return;
    
    setMessages([...messages, { 
      text: type === 'audio' ? '🎤 Mensagem de áudio' : (type === 'image' ? '🖼️ Imagem enviada' : text), 
      sender: 'me', 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    }]);
    if (type === 'text') setChatInput('');
  };

  const toggleRecording = () => {
    if (isRecording) {
      clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      setRecordingTime(0);
      sendMessage('audio');
    } else {
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-4 overflow-hidden">
      {/* CABEÇALHO CRM */}
      <div className="shrink-0 flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <MessageSquare className="text-emerald-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">WhatsApp Multi-Atendimento</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gestão de Leads e Orçamentos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowLeadsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 text-sm"
          >
            <LayoutGrid size={18} /> Funil de Leads (Kanban)
          </button>
          
          <div className="h-8 w-[1px] bg-slate-200 mx-2" />
          
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                <User size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
          <span className="text-xs font-bold text-slate-500 ml-1">3 Atendentes Online</span>
        </div>
      </div>

      {/* MODAL DE LEADS (KANBAN) */}
      {showLeadsModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-50 w-full max-w-6xl h-[85vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-white/20">
            <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <LayoutGrid className="text-blue-600" size={28} /> Funil de Vendas (CRM)
                </h3>
                <p className="text-sm text-slate-500 font-medium italic">Gerencie seus leads e arraste entre as colunas para atualizar o status.</p>
              </div>
              <button 
                onClick={() => setShowLeadsModal(false)}
                className="p-3 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-x-auto p-6 flex gap-6 custom-scrollbar">
              {/* Colunas do Kanban Simulado */}
              {[
                { title: 'Novos Leads', color: 'bg-blue-500', leads: recentLeads.slice(0, 3) },
                { title: 'Em Atendimento', color: 'bg-amber-500', leads: recentLeads.slice(3, 6) },
                { title: 'Orçamento Enviado', color: 'bg-purple-500', leads: recentLeads.slice(6, 8) },
                { title: 'Aguardando Medição', color: 'bg-emerald-500', leads: recentLeads.slice(8, 10) }
              ].map(column => (
                <div key={column.title} className="w-80 shrink-0 flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="font-black text-slate-800 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${column.color}`} />
                      {column.title}
                    </h4>
                    <span className="text-[10px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-500">
                      {column.leads.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 bg-slate-200/40 rounded-3xl p-3 border border-slate-200/60 space-y-3 overflow-y-auto custom-scrollbar">
                    {column.leads.map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          setActiveChat(lead);
                          setShowLeadsModal(false);
                        }}
                        className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500">Lead ID #{lead.id.slice(0,4)}</span>
                          <Clock size={12} className="text-slate-300" />
                        </div>
                        <h5 className="font-bold text-slate-800 mb-1">{lead.name}</h5>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-3"><Phone size={12}/> {lead.phone}</p>
                        
                        <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                          <div className="flex -space-x-1">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center border border-white">
                              <User size={10} className="text-blue-600" />
                            </div>
                          </div>
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">ABRIR CHAT</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-4 min-h-0">
        {/* COLUNA ESQUERDA: LISTA DE CHATS */}
        <div className="w-[260px] xl:w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
              <MessageSquare size={18} className="text-emerald-500" /> Conversas Ativas
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar conversa..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {recentLeads.slice(0, 5).map(lead => (
              <button 
                key={lead.id}
                onClick={() => setActiveChat(lead)}
                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-colors ${activeChat?.id === lead.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <User size={20} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{lead.name}</h4>
                    <span className="text-[10px] text-slate-400 font-bold">10:30</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">Pode me passar as medidas?</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* COLUNA CENTRAL: CHAT ATIVO */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center z-10 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{activeChat.name}</h3>
                    <p className="text-[11px] text-slate-500 font-medium">{activeChat.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-slate-400">
                  <button className="p-2 hover:bg-slate-200 rounded-full transition-colors"><PhoneCall size={16} /></button>
                  <button className="p-2 hover:bg-slate-200 rounded-full transition-colors"><MoreVertical size={16} /></button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/20 bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')] custom-scrollbar">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-xl shadow-sm relative text-sm ${msg.sender === 'me' ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                      <p className="text-slate-800 whitespace-pre-wrap leading-tight">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[9px] text-slate-500 font-medium">{msg.time}</span>
                        {msg.sender === 'me' && <CheckCheck size={12} className="text-blue-500" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <div 
                  className={`flex items-center gap-2 p-1.5 bg-white rounded-2xl border transition-all ${dragOver ? 'border-emerald-500 shadow-md bg-emerald-50' : 'border-slate-200'} ${isRecording ? 'border-rose-500 bg-rose-50' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {!isRecording ? (
                    <>
                      <button className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Anexar Arquivo"><Paperclip size={18} /></button>
                      <button className="p-2 text-slate-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors" title="Enviar Imagem"><ImageIcon size={18} /></button>
                      <textarea 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={dragOver ? "Solte o orçamento aqui..." : "Mensagem..."}
                        className="flex-1 bg-transparent resize-none outline-none py-2 px-1 text-sm max-h-24 custom-scrollbar placeholder:text-slate-400"
                        rows={1}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <button 
                        onMouseDown={toggleRecording}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" 
                        title="Gravar Áudio"
                      >
                        <Mic size={18} />
                      </button>
                      <button 
                        onClick={() => sendMessage()}
                        disabled={!chatInput.trim()}
                        className="p-2 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 rounded-lg transition-colors shadow-sm"
                      >
                        <Send size={18} />
                      </button>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-between px-2 py-1 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                        <span className="text-rose-600 font-bold text-sm">Gravando áudio... {formatTime(recordingTime)}</span>
                      </div>
                      <button 
                        onClick={toggleRecording}
                        className="bg-rose-600 text-white px-4 py-1.5 rounded-xl font-bold text-xs shadow-lg"
                      >
                        PARAR E ENVIAR
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-slate-300" />
              </div>
              <h2 className="text-lg font-black text-slate-700">CRM WhatsApp</h2>
              <p className="text-xs font-medium mt-1">Selecione um lead para começar.</p>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: PAINEL DE GESTÃO (TABS) */}
        <div className="w-[380px] xl:w-[450px] flex flex-col bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden shadow-inner">
          {/* SELETOR DE ABAS */}
          <div className="flex p-2 bg-white border-b border-slate-200 gap-2">
            <button 
              onClick={() => setRightPanelTab('quote')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${rightPanelTab === 'quote' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <ShoppingCart size={14} /> Orçamento
            </button>
            <button 
              onClick={() => setRightPanelTab('profile')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${rightPanelTab === 'profile' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <User size={14} /> Perfil Lead
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {rightPanelTab === 'quote' ? (
              <QuickQuoteCRM 
                key={activeChat?.id || 'general'} 
                products={products} 
                storageKey={activeChat ? activeChat.id : 'general'}
              />
            ) : (
              /* PAINEL DE PERFIL DO CLIENTE (FORMULÁRIO OFICIAL) */
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest flex items-center gap-2">
                      <UserPlus size={16} className="text-blue-600" /> Cadastro / Vínculo
                    </h3>
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                      <Thermometer size={10} className="text-amber-500" />
                      <span className="text-[8px] font-black text-amber-600 uppercase">Lead Morno</span>
                    </div>
                  </div>

                  {/* BUSCA E VÍNCULO DE CLIENTE EXISTENTE */}
                  <div className="px-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <LinkIcon size={12} /> Vincular Cliente Existente
                    </label>
                    <SearchableCustomerSelect 
                      customers={customers} 
                      onSelect={(customer) => {
                        if (window.confirm(`Deseja vincular esta conversa ao cliente "${customer.name}"?`)) {
                          setActiveChat(customer);
                        }
                      }} 
                    />
                    <p className="text-[8px] text-slate-400 italic">Dica: Se o cliente já estiver no sistema, vincule-o aqui para evitar duplicidade.</p>
                  </div>

                  <div className="h-px bg-slate-100 mx-2" />

                  <div className="bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                    <CustomerForm 
                      isEmbedded={true}
                      initialData={{
                        name: activeChat?.name || '',
                        phone: activeChat?.phone || '',
                      }}
                      onSave={async (data) => {
                        await onAddCustomer(data);
                        alert('Cliente salvo com sucesso na base de dados!');
                      }}
                    />
                  </div>

                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3">
                    <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Histórico Rápido</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-[10px] font-bold text-blue-800">
                        <div className="w-1 h-1 rounded-full bg-blue-500" />
                        <span>Iniciou conversa via site</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-blue-800">
                        <div className="w-1 h-1 rounded-full bg-blue-500" />
                        <span>Solicitou orçamento de Toldo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRM;
