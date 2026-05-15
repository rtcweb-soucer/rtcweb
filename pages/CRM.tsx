import { useState, useRef, useEffect } from 'react';
import { Customer, Product, Seller, Order, Appointment, SystemUser } from '../types';
import QuickQuoteCRM from './QuickQuoteCRM';
import CustomerForm from '../components/CustomerForm';
import SearchableCustomerSelect from '../components/SearchableCustomerSelect';
import { dataService } from '../services/dataService';
import { Search, Phone, MessageSquare, Send, Paperclip, CheckCheck, Clock, User, PhoneCall, MoreVertical, LayoutGrid, X, Filter, Mic, Image as ImageIcon, UserPlus, Save, MapPin, CreditCard, Thermometer, ShoppingCart, Link as LinkIcon, History, FileText, Calendar, TrendingUp, RefreshCw, Smartphone } from 'lucide-react';
import { supabase } from '../services/supabase';
import { evolutionService } from '../services/evolutionService';
import { suggestChatMessage } from '../services/geminiService';
import { Sparkles } from 'lucide-react';

interface CRMProps {
  customers: Customer[];
  products: Product[];
  sellers: Seller[];
  onAddCustomer: (customer: any) => Promise<void> | void;
  currentUser: SystemUser;
}

const CRM = ({ customers, products, sellers, onAddCustomer, currentUser }: CRMProps) => {
  const [activeChat, setActiveChat] = useState<Customer | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'quote' | 'profile' | 'history'>('quote');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<any>(null);
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [crmLeads, setCrmLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeUserTab, setActiveUserTab] = useState<string>(currentUser?.id || 'all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob, url: string, base64: string } | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [history, setHistory] = useState<{
    orders: Order[];
    quotes: any[];
    appointments: Appointment[];
  }>({ orders: [], quotes: [], appointments: [] });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [lastIdentifiedPhone, setLastIdentifiedPhone] = useState<string | null>(null);

  // Carregar leads do CRM
  const loadLeads = async () => {
    try {
      const leads = await dataService.getCRMLeads();
      setCrmLeads(leads);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    }
  };

  useEffect(() => {
    loadLeads();
    loadInstances();
    loadUsers();

    // Setup Realtime para a lista de leads (Kanban)
    const leadsChannel = supabase
      .channel('crm-leads-global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crm_leads'
        },
        () => loadLeads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  const loadUsers = async () => {
    try {
      const data = await dataService.getSystemUsers();
      setUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  // Identificação automática do nome do cliente ao selecionar chat
  useEffect(() => {
    if (activeChat?.phone && activeChat.phone !== lastIdentifiedPhone && (activeChat.name === 'Novo Cliente WhatsApp' || !activeChat.id)) {
      setLastIdentifiedPhone(activeChat.phone);
      const identifyCustomer = async () => {
        const found = await dataService.findCustomerByPhone(activeChat.phone!);
        if (found) {
          setActiveChat(prev => prev ? { ...prev, name: found.name, id: found.id } : null);
          
          // Tentar vincular o lead ao cliente definitivamente no banco
          const lead = crmLeads.find(l => l.phone === activeChat.phone);
          if (lead && !lead.customer_id) {
            await dataService.saveCRMLead({
              id: lead.id,
              customerId: found.id,
              stage: lead.stage
            });
            loadLeads();
          }
        } else if (messages.length > 0) {
          // Se for cliente novo, tentar pegar o nome do WhatsApp (pushName)
          const inboundMsg = messages.find(m => m.sender === 'them' && m.pushName);
          if (inboundMsg?.pushName && activeChat.name === 'Novo Cliente WhatsApp') {
            setActiveChat(prev => prev ? { ...prev, name: inboundMsg.pushName } : null);
          }
        }
      };
      identifyCustomer();
    }
  }, [activeChat, lastIdentifiedPhone]);

  const loadInstances = async () => {
    try {
      const data = await dataService.getWhatsappInstances();
      
      // Filtrar instâncias se não for ADMIN
      const isAdmin = currentUser.role === 'ADMIN';
      const availableInstances = isAdmin ? data : data.filter(inst => inst.user_id === currentUser.id);
      
      setInstances(availableInstances);
      
      // Seleciona automaticamente a instância do usuário logado ou a primeira disponível
      const myInstance = availableInstances.find(inst => inst.user_id === currentUser.id);
      if (myInstance) {
        setSelectedInstance(myInstance);
      } else if (availableInstances.length > 0) {
        setSelectedInstance(availableInstances[0]);
      }
      
      const config = await dataService.getSystemConfig();
      setSystemConfig(config);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  // Scroll inteligente: só rola para o fim se o usuário já estiver lá ou se for o carregamento inicial
  const scrollToBottom = (force = false) => {
    const container = document.getElementById('chat-messages');
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (force || (autoScroll && isAtBottom)) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: force ? 'auto' : 'smooth'
        });
      }
    }
  };

  // Detectar se o usuário está rolando para cima
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    // Se o usuário subir mais de 150px do fundo, desligamos o autoscroll
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    
    if (isAtBottom) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
  };

  const loadMessages = async (phone: string) => {
    try {
      const msgs = await dataService.getWhatsappMessages(phone);
      // Preservar mensagens locais que ainda não foram sincronizadas (opcional, mas o ideal é o Realtime)
      setMessages(msgs);
      
      // Inteligência: Tenta selecionar a última instância que interagiu com este cliente
      if (msgs.length > 0) {
        const lastMsg = [...msgs].reverse().find(m => m.instance_id);
        if (lastMsg) {
          const inst = instances.find(i => i.id === lastMsg.instance_id);
          if (inst) setSelectedInstance(inst);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  useEffect(() => {
    if (activeChat?.phone) {
      setMessages([]); // Limpar instantaneamente para dar feedback visual de troca
      setAutoScroll(true);
      setIsInitialLoad(true);
      loadMessages(activeChat.phone);

      // Setup Realtime para novas mensagens deste cliente
      let cleanPhone = activeChat.phone.replace(/\D/g, '');
      if (cleanPhone.length === 11 || cleanPhone.length === 10) {
        cleanPhone = '55' + cleanPhone;
      }
      
      const channel = supabase
        .channel(`chat-${cleanPhone}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'whatsapp_messages',
            filter: `phone=in.(${activeChat.phone.replace(/\D/g, '')},55${activeChat.phone.replace(/\D/g, '')})`
          },
          (payload) => {
            loadMessages(activeChat.phone!);
            // Não rolamos mais automaticamente aqui para evitar teimosia
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChat]);

  // Efeito para forçar scroll no primeiro carregamento das mensagens
  useEffect(() => {
    if (messages.length > 0 && isInitialLoad) {
      // Pequeno atraso para garantir que o DOM renderizou as mensagens
      const timer = setTimeout(() => {
        scrollToBottom(true);
        setIsInitialLoad(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isInitialLoad]);

  // Carregar histórico quando mudar o chat
  useEffect(() => {
    if (activeChat?.id) {
      setLoadingHistory(true);
      dataService.getCustomerFullHistory(activeChat.id)
        .then(data => {
          setHistory(data as any);
        })
        .finally(() => setLoadingHistory(false));
    } else {
      setHistory({ orders: [], quotes: [], appointments: [] });
    }
  }, [activeChat]);

  const updateLeadStage = async (leadId: string, newStage: string) => {
    try {
      await dataService.updateCRMLeadStage(leadId, newStage);
      await loadLeads();
    } catch (error) {
      console.error('Erro ao atualizar estágio:', error);
    }
  };

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

  const sendMessage = async (type: 'text' | 'image' | 'audio' | 'document' = 'text', content?: string, extraData?: string) => {
    if (isSending || !selectedInstance || !activeChat) return;
    const text = content || chatInput;
    if (type === 'text' && !text.trim()) return;
    if (type !== 'text' && !content) return;
    if (!activeChat || !selectedInstance || !systemConfig) {
      alert('Selecione um cliente e um canal de atendimento.');
      return;
    }

    setIsSending(true);
    try {
      const cleanPhone = activeChat.phone!.replace(/\D/g, '');
      
      if (type === 'text') {
        let phoneWithDDI = cleanPhone;
        if (!phoneWithDDI.startsWith('55') && phoneWithDDI.length >= 10) {
          phoneWithDDI = '55' + phoneWithDDI;
        }

        await evolutionService.sendMessage(
          systemConfig.evolution_url,
          selectedInstance.apikey,
          selectedInstance.instance_name,
          phoneWithDDI,
          text
        );
        
        await dataService.saveWhatsappMessage({
          phone: cleanPhone,
          message: text,
          direction: 'outbound',
          instance_id: selectedInstance.id,
          client_id: activeChat.id
        });

        setChatInput('');
      } else if (type === 'image' || type === 'audio' || type === 'document') {
        // Envio de mídia via Base64 (content deve ser a string base64)
        if (!content) return;
        
        const mediaType = type === 'image' ? 'image' : type === 'audio' ? 'audio' : 'document';
        const fileName = extraData || (type === 'image' ? 'imagem.jpg' : type === 'audio' ? 'audio.ogg' : 'documento.pdf');

        let phoneWithDDI = cleanPhone;
        if (!phoneWithDDI.startsWith('55') && phoneWithDDI.length >= 10) {
          phoneWithDDI = '55' + phoneWithDDI;
        }

        console.log(`Enviando mídia (${type}) para ${phoneWithDDI}:`, fileName);
        await evolutionService.sendMedia(
            systemConfig.evolution_url,
            selectedInstance.apikey,
            selectedInstance.instance_name,
            phoneWithDDI,
            content,
            mediaType,
            fileName,
            '' // caption vazio
        );
        console.log('Mídia enviada com sucesso para Evolution API');

        try {
          await dataService.saveWhatsappMessage({
              phone: cleanPhone,
              message: content.startsWith('data:') ? content : `data:audio/ogg;base64,${content}`,
              direction: 'outbound',
              instance_id: selectedInstance.id,
              client_id: activeChat.id,
              media_url: null,
              media_type: 'audio'
          });
          // Forçar atualização da tela após salvar usando o cleanPhone consistente
          await loadMessages(cleanPhone);
        } catch (dbError) {
          console.error('Erro ao salvar log no banco:', dbError);
        }
      }
      
      // O Realtime cuidará de atualizar a lista de mensagens automaticamente
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      alert(`Falha ao enviar mensagem: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máximo 16MB para WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      alert('Arquivo muito grande. O limite é 16MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      await sendMessage(type === 'image' ? 'image' : type === 'audio' ? 'audio' : 'document', base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Parar gravação
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      clearInterval(recordingIntervalRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    } else {
      // Iniciar gravação
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Forçar webm que é o padrão mais estável para gravação via browser
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current);
          const reader = new FileReader();
          reader.onloadend = async () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            setRecordedAudio({
              blob: audioBlob,
              url: URL.createObjectURL(audioBlob),
              base64: base64
            });
          };
          reader.readAsDataURL(audioBlob);
          
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (err) {
        console.error("Erro ao acessar microfone:", err);
        alert("Não foi possível acessar o microfone. Verifique as permissões.");
      }
    }
  };

  const handleLinkCustomer = async (customer: Customer) => {
    if (!activeChat) return;
    
    try {
      // 1. Tenta achar o lead pelo ID ou pelo telefone (limpo)
      const cleanPhone = activeChat.phone?.replace(/\D/g, '') || '';
      const phoneVariants = [cleanPhone];
      if (cleanPhone.startsWith('55')) phoneVariants.push(cleanPhone.substring(2));
      else phoneVariants.push('55' + cleanPhone);

      let lead = crmLeads.find(l => 
        l.customer_id === activeChat.id || 
        phoneVariants.includes(l.phone?.replace(/\D/g, '')) ||
        phoneVariants.includes(l.customer?.phone?.replace(/\D/g, ''))
      );
      
      // Se não achar o lead, vamos criar um agora para poder vincular
      if (!lead) {
        console.log("Lead não encontrado, criando novo lead para vínculo...");
        const newLead = await dataService.saveCRMLead({
          customerId: customer.id,
          phone: activeChat.phone,
          stage: 'contato',
          temperature: 'morno',
          notes: `Lead criado automaticamente ao vincular conversa do WhatsApp.`
        });
        lead = { ...newLead, id: newLead.id };
      } else {
        // Atualiza o lead existente vinculando ao novo customer_id
        await dataService.saveCRMLead({
          id: lead.id,
          customerId: customer.id,
          stage: lead.stage,
          productInterest: lead.productInterest,
          assignedTo: lead.assigned_to || lead.assignedTo,
          notes: lead.notes ? `${lead.notes}\n---\nVinculado ao cliente ${customer.name}` : `Vinculado manualmente ao cliente ${customer.name}`
        });
      }

      // 3. Atualiza interface
      setActiveChat({ ...customer, phone: activeChat.phone }); 
      await loadLeads();
      alert(`Conversa vinculada com sucesso ao cliente ${customer.name}`);
    } catch (error) {
      console.error("Erro ao vincular cliente:", error);
      alert("Erro ao vincular cliente no banco de dados.");
    }
  };

  const handleAiSuggestion = async () => {
    if (!activeChat || isGeneratingAi) return;
    
    setIsGeneratingAi(true);
    try {
      const lead = crmLeads.find(l => l.phone === activeChat.phone);
      const suggestion = await suggestChatMessage(messages, {
        name: activeChat.name,
        productInterest: lead?.productInterest
      });
      
      if (suggestion) {
        setChatInput(suggestion);
      }
    } catch (error) {
      console.error("Erro ao gerar sugestão:", error);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const findAndLinkCustomer = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const found = customers.find(c => {
      const cPhone = c.phone?.replace(/\D/g, '');
      const cPhone2 = c.phone2?.replace(/\D/g, '');
      const cContact = c.contactPhone?.replace(/\D/g, '');
      return cPhone === cleanPhone || cPhone2 === cleanPhone || cContact === cleanPhone;
    });

    if (found) {
      setActiveChat(found);
      return found;
    }
    return null;
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
              {/* Colunas do Kanban */}
              {[
                { title: 'Novos Leads', stage: 'NOVO', color: 'bg-blue-500' },
                { title: 'Em Atendimento', stage: 'ATENDIMENTO', color: 'bg-amber-500' },
                { title: 'Orçamento Enviado', stage: 'ORCAMENTO', color: 'bg-purple-500' },
                { title: 'Aguardando Medição', stage: 'MEDICAO', color: 'bg-emerald-500' }
              ].map(column => {
                // Filtrar leads por estágio e permissão (se selecionada uma instância específica)
                let columnLeads = crmLeads.filter(l => l.stage === column.stage);
                
                // Se não for ADMIN e houver instâncias, filtrar por elas (lógica simplificada no front)
                // Idealmente o backend filtraria, mas aqui garantimos a visão do usuário
                if (currentUser.role !== 'ADMIN' && instances.length > 0) {
                  const myInstanceIds = instances.map(i => i.id);
                  // Filtro opcional: aqui poderíamos filtrar leads que já tiveram msg com minhas instâncias
                  // Por enquanto, mostramos os leads que o usuário "pode" ver
                }

                return (
                <div key={column.title} className="w-80 shrink-0 flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="font-black text-slate-800 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${column.color}`} />
                      {column.title}
                    </h4>
                    <span className="text-[10px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-500">
                      {columnLeads.length}
                    </span>
                  </div>
                  
                  <div 
                    className="flex-1 bg-slate-200/40 rounded-3xl p-3 border border-slate-200/60 space-y-3 overflow-y-auto custom-scrollbar"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      const leadId = e.dataTransfer.getData('leadId');
                      if (leadId) {
                        await updateLeadStage(leadId, column.stage);
                      }
                    }}
                  >
                    {columnLeads.map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
                        onClick={() => {
                          setActiveChat(lead.customer);
                          setShowLeadsModal(false);
                        }}
                        className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-blue-500">Lead ID #{lead.id.slice(0,4)}</span>
                          <div className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${lead.temperature === 'QUENTE' ? 'bg-rose-500' : lead.temperature === 'MORNO' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                            <Clock size={12} className="text-slate-300" />
                          </div>
                        </div>
                        <h5 className="font-bold text-slate-800 mb-1">{lead.customer?.name || 'Cliente s/ nome'}</h5>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mb-2"><Phone size={12}/> {lead.customer?.phone}</p>
                        
                        {lead.productInterest && lead.productInterest.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {lead.productInterest.map((p: string) => (
                              <span key={p} className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">{p}</span>
                            ))}
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(lead.lastContact).toLocaleDateString()}</span>
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">ABRIR CHAT</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
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
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar conversa..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {/* ABAS DE ATENDENTES */}
            <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar-hidden no-scrollbar">
              <button
                onClick={() => setActiveUserTab('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${activeUserTab === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                Geral
              </button>
              <button
                onClick={() => setActiveUserTab(currentUser.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${activeUserTab === currentUser.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}
              >
                Meus
              </button>
              {users.filter(u => u.id !== currentUser.id).map(user => (
                <button
                  key={user.id}
                  onClick={() => setActiveUserTab(user.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${activeUserTab === user.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  {user.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {(() => {
              const filtered = crmLeads.filter(l => {
                if (activeUserTab === 'all') return true;
                return l.assigned_to === activeUserTab;
              });

              if (filtered.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-40 opacity-40">
                    <MessageSquare size={32} className="text-slate-400 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nenhuma conversa nesta aba</p>
                  </div>
                );
              }

              return filtered.slice(0, 50).map(lead => {
                const assignedUser = users.find(u => u.id === lead.assigned_to);
                
                return (
                  <button 
                    key={lead.id}
                    onClick={() => {
                      const customer = lead.customer || customers.find(c => c.id === lead.customer_id);
                      if (customer) {
                        setActiveChat(customer);
                        loadMessages(customer.phone);
                      }
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all border ${activeChat?.id === (lead.customer?.id || lead.customer_id) ? 'bg-emerald-50 border-emerald-100' : 'hover:bg-slate-50 border-transparent'}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                      <User size={20} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className="font-bold text-slate-800 text-sm truncate">
                          {lead.customer?.name || 'Novo Lead WhatsApp'}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-black">
                          {lead.lastContact ? new Date(lead.lastContact).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-slate-500 truncate flex-1">
                          {lead.notes || lead.customer?.phone || 'Clique para atender'}
                        </p>
                        {assignedUser && activeUserTab === 'all' && (
                          <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                            {assignedUser.name.split(' ')[0]}
                          </span>
                        )}
                        <div className={`w-1.5 h-1.5 rounded-full ${lead.temperature === 'QUENTE' ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
                      </div>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </div>

        {/* COLUNA CENTRAL: CHAT ATIVO */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          {activeChat ? (
            <>
              {/* Chat Header Compacto */}
                <div className="px-4 py-2 border-b border-slate-100 bg-white flex justify-between items-center z-10 shadow-sm min-h-[60px]">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                      <User size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-bold text-slate-800 text-sm leading-tight truncate max-w-[150px]">{activeChat.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">{activeChat.phone}</span>
                        <div className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight">Ativo</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* SELETOR DE CANAL COMPACTO */}
                    <div className="hidden sm:flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                      {instances.map(inst => (
                        <button
                          key={inst.id}
                          onClick={() => setSelectedInstance(inst)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 border ${selectedInstance?.id === inst.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-transparent text-slate-400 border-transparent hover:text-slate-600'}`}
                          title={`Responder via ${inst.name}`}
                        >
                          <Smartphone size={10} />
                          <span className="hidden md:inline">{inst.name}</span>
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center gap-1 px-2 py-1.5 text-[10px] font-black bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white rounded-lg transition-all border border-slate-200 uppercase tracking-tighter"
                      title="Transferir conversa"
                    >
                      <UserPlus size={12} />
                      <span className="hidden lg:inline">TRANSFERIR</span>
                    </button>

                    <div className="flex items-center">
                      <button className="p-1.5 text-slate-400 hover:text-blue-500 rounded-full transition-colors"><Phone size={18} /></button>
                      <button className="p-1.5 text-slate-400 hover:text-blue-500 rounded-full transition-colors"><MoreVertical size={18} /></button>
                    </div>
                  </div>
                </div>

              {/* Modal de Transferência */}
              {showTransferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                          <UserPlus size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Transferir Atendimento</h3>
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Selecione o novo atendente</p>
                        </div>
                      </div>
                      <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                      </button>
                    </div>
                    <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {users.filter(u => u.id !== currentUser.id).map(user => (
                        <button
                          key={user.id}
                          onClick={async () => {
                            try {
                              const cleanPhone = activeChat?.phone?.replace(/\D/g, '') || '';
                              const phoneVariants = [cleanPhone];
                              if (cleanPhone.startsWith('55')) phoneVariants.push(cleanPhone.substring(2));
                              else phoneVariants.push('55' + cleanPhone);

                              const lead = crmLeads.find(l => 
                                l.id === activeChat?.id || 
                                l.customer_id === activeChat?.id || 
                                phoneVariants.includes(l.phone?.replace(/\D/g, '')) ||
                                phoneVariants.includes(l.customer?.phone?.replace(/\D/g, ''))
                              );
                              if (lead) {
                                await dataService.transferCRMLead(lead.id, user.id);
                                alert(`Atendimento transferido para ${user.name}`);
                                setShowTransferModal(false);
                                loadLeads();
                                setActiveChat(null);
                              } else {
                                alert('Não foi possível localizar o registro do Lead para esta conversa.');
                              }
                            } catch (err: any) {
                              alert('Erro ao transferir: ' + (err.message || JSON.stringify(err)));
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl transition-all group"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                            <User size={20} className="text-slate-500" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{user.name}</div>
                            <div className="text-[10px] text-slate-400 uppercase font-bold">{user.role}</div>
                          </div>
                          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <Send size={16} className="text-blue-500" />
                          </div>
                        </button>
                      ))}
                      {users.filter(u => u.id !== currentUser.id).length === 0 && (
                        <div className="p-8 text-center text-slate-400 italic text-sm">
                          Nenhum outro atendente disponível
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#e5ddd5] custom-scrollbar" 
                id="chat-messages"
                onScroll={handleScroll}
              >
                {/* Botão de Scroll para o Fim (WhatsApp Style) */}
                {!autoScroll && (
                  <button 
                    onClick={() => {
                      setAutoScroll(true);
                      scrollToBottom(true);
                    }}
                    className="absolute bottom-24 right-8 bg-white p-2 rounded-full shadow-lg border border-slate-200 text-blue-500 hover:bg-slate-50 transition-all z-20 flex items-center gap-2 animate-bounce"
                  >
                    <TrendingUp className="rotate-180" size={16} />
                    <span className="text-[10px] font-bold uppercase pr-1">Novas Mensagens</span>
                  </button>
                )}

                {messages.length > 0 ? (
                    messages.map((msg, i) => {
                      const text = msg.text || '';
                      // Detecção robusta de mídia
                      const isImage = msg.mediaType === 'image' || text === 'Imagem' || text.startsWith('data:image/') || (text.length > 50 && text.includes('/9j/'));
                      const isAudio = msg.mediaType === 'audio' || text === 'Áudio' || text.startsWith('data:audio/') || text.startsWith('OggS') || text.startsWith('GkXfo');
                      const isPDF = msg.mediaType === 'document' || text.startsWith('data:application/pdf');
                      
                      const mediaUrl = msg.mediaUrl || (text.startsWith('data:') ? text : null);
                      
                      return (
                        <div key={i} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div 
                            className={`max-w-[85%] p-2.5 rounded-xl shadow-sm relative text-sm ${msg.sender === 'me' ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}
                          >
                            {isImage ? (
                              <div className="space-y-1">
                                <img 
                                  src={mediaUrl || (text.startsWith('data:') ? text : `data:image/jpeg;base64,${text}`)} 
                                  alt="Mídia" 
                                  className="rounded-lg max-h-60 cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(mediaUrl || (text.startsWith('data:') ? text : `data:image/jpeg;base64,${text}`))}
                                />
                              </div>
                            ) : isAudio ? (
                              <div className="py-1 px-1 min-w-[200px]">
                                <audio 
                                  src={mediaUrl || (text.startsWith('data:') ? text : (text.includes('base64') ? text : (text.startsWith('GkXfo') ? `data:audio/webm;base64,${text}` : `data:audio/mp4;base64,${text}`)))} 
                                  controls 
                                  className="h-8 w-full accent-emerald-500"
                                  preload="metadata"
                                />
                              </div>
                            ) : isPDF ? (
                              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => {
                                  const base64 = text.includes('base64,') ? text.split('base64,')[1] : text;
                                  const link = document.createElement('a');
                                  link.href = `data:application/pdf;base64,${base64}`;
                                  link.download = `documento_${msg.time.replace(':', '-')}.pdf`;
                                  link.click();
                                }}
                              >
                                <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                                  <FileText size={24} />
                                </div>
                                <div className="text-left overflow-hidden">
                                  <div className="font-bold text-xs text-slate-700 truncate max-w-[150px]">
                                    Documento PDF
                                  </div>
                                  <div className="text-[10px] text-slate-400">Clique para baixar</div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-800 leading-tight" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                            )}
                            
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[9px] text-slate-500 font-medium">{msg.time}</span>
                              {msg.sender === 'me' && <CheckCheck size={12} className={msg.status === 'READ' ? "text-blue-500" : "text-slate-400"} />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-40">
                    <MessageSquare size={48} className="text-slate-400 mb-2" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nenhuma mensagem neste chat</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  onChange={(e) => handleFileUpload(e, 'document')}
                />
                <input 
                  type="file" 
                  id="image-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileUpload(e, 'image')}
                />
                <div 
                  className={`flex items-center gap-2 p-1.5 bg-white rounded-2xl border transition-all ${dragOver ? 'border-emerald-500 shadow-md bg-emerald-50' : 'border-slate-200'} ${isRecording ? 'border-rose-500 bg-rose-50' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {!isRecording ? (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <button 
                          onClick={() => document.getElementById('file-upload')?.click()}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" 
                          title="Anexar Arquivo"
                        >
                          <Paperclip size={14} />
                        </button>
                        <button 
                          onClick={() => document.getElementById('image-upload')?.click()}
                          className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors" 
                          title="Enviar Imagem"
                        >
                          <ImageIcon size={14} />
                        </button>
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        {recordedAudio ? (
                          <div className="flex items-center gap-3 bg-emerald-50 p-2 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-bottom-2">
                            <button 
                              onClick={() => {
                                if (audioPlayerRef.current) {
                                  if (isPlayingRecorded) audioPlayerRef.current.pause();
                                  else audioPlayerRef.current.play();
                                  setIsPlayingRecorded(!isPlayingRecorded);
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors"
                            >
                              {isPlayingRecorded ? <X size={16} /> : <div className="ml-0.5 border-l-[10px] border-l-white border-y-[6px] border-y-transparent" />}
                            </button>
                            
                            <div className="flex-1 h-1.5 bg-emerald-200 rounded-full overflow-hidden relative">
                              <div className={`h-full bg-emerald-500 transition-all ${isPlayingRecorded ? 'w-full duration-[10s] ease-linear' : 'w-0'}`} />
                            </div>

                            <button 
                              onClick={() => {
                                setRecordedAudio(null);
                                setIsPlayingRecorded(false);
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                              <X size={16} />
                            </button>

                            <audio 
                              ref={audioPlayerRef} 
                              src={recordedAudio.url} 
                              className="hidden" 
                              onEnded={() => setIsPlayingRecorded(false)}
                            />
                          </div>
                        ) : (
                          <textarea 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={dragOver ? "Solte o orçamento aqui..." : "Digite sua mensagem..."}
                            className="w-full bg-slate-50/50 rounded-xl border border-slate-100 resize-none outline-none py-2 px-3 text-sm min-h-[44px] max-h-40 custom-scrollbar placeholder:text-slate-400 focus:bg-white focus:border-emerald-200 transition-all"
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                          />
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <button 
                          onMouseDown={toggleRecording}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" 
                          title="Gravar Áudio"
                        >
                          <Mic size={14} />
                        </button>
                        
                        <button 
                          onClick={handleAiSuggestion}
                          disabled={isGeneratingAi || !activeChat}
                          className={`p-1.5 rounded-lg transition-all ${isGeneratingAi ? 'bg-purple-100 text-purple-600 animate-pulse' : 'text-purple-500 hover:bg-purple-50'}`}
                          title="Sugestão de Resposta (IA)"
                        >
                          <Sparkles size={14} className={isGeneratingAi ? 'animate-spin' : ''} />
                        </button>
                      </div>

                      <button 
                        onClick={() => {
                          if (recordedAudio) {
                            sendMessage('audio', recordedAudio.base64, `audio_${Date.now()}.ogg`);
                            setRecordedAudio(null);
                          } else {
                            sendMessage();
                          }
                        }}
                        disabled={isSending || (!chatInput.trim() && !recordedAudio)}
                        className="w-12 h-12 flex items-center justify-center bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        {isSending ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
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
                        CONCLUIR
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
              <User size={14} /> Perfil
            </button>
            <button 
              onClick={() => setRightPanelTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${rightPanelTab === 'history' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <History size={14} /> Histórico 360
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {rightPanelTab === 'quote' ? (
              <QuickQuoteCRM 
                key={activeChat?.id || 'general'} 
                products={products} 
                storageKey={activeChat ? activeChat.id : 'general'}
              />
            ) : rightPanelTab === 'profile' ? (
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
                          handleLinkCustomer(customer);
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
                </div>
              </div>
            ) : (
              /* PAINEL DE HISTÓRICO 360 */
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 pb-20">
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest flex items-center gap-2 mb-4 px-2">
                    <History size={16} className="text-emerald-600" /> Visão 360 do Cliente
                  </h3>

                  {loadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 animate-pulse">
                      <RefreshCw className="animate-spin" size={32} />
                      <span className="text-xs font-bold uppercase tracking-widest">Carregando Histórico...</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* PEDIDOS E NFE */}
                      <section className="space-y-3">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                          <FileText size={14} className="text-blue-500" /> Pedidos & Notas Fiscais ({history.orders.length})
                        </h4>
                        <div className="space-y-2">
                          {history.orders.length > 0 ? history.orders.map(order => (
                            <div key={order.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-blue-200 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black text-slate-800">Pedido #{order.contractNumber || order.id.slice(0,6)}</span>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {order.status}
                                </span>
                              </div>
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-[10px] text-slate-500 font-bold">{new Date(order.createdAt).toLocaleDateString()}</p>
                                  {order.nfeNumber && (
                                    <p className="text-[9px] text-emerald-600 font-black mt-1 flex items-center gap-1">
                                      <CheckCheck size={10} /> NF-e: {order.nfeNumber}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs font-black text-slate-900">R$ {order.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          )) : (
                            <p className="text-[10px] text-slate-400 italic px-2">Nenhum pedido encontrado.</p>
                          )}
                        </div>
                      </section>

                      {/* ORÇAMENTOS RÁPIDOS */}
                      <section className="space-y-3">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                          <TrendingUp size={14} className="text-purple-500" /> Orçamentos Realizados ({history.quotes.length})
                        </h4>
                        <div className="space-y-2">
                          {history.quotes.length > 0 ? history.quotes.map(quote => (
                            <div key={quote.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-purple-200 transition-all">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-800">Orc. #{quote.quick_quote_number || quote.id.slice(0,4)}</span>
                                <span className="text-xs font-black text-purple-600">R$ {quote.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold">{new Date(quote.created_at).toLocaleDateString()}</p>
                            </div>
                          )) : (
                            <p className="text-[10px] text-slate-400 italic px-2">Nenhum orçamento encontrado.</p>
                          )}
                        </div>
                      </section>

                      {/* VISITAS TÉCNICAS */}
                      <section className="space-y-3">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                          <Calendar size={14} className="text-amber-500" /> Visitas & Agendas ({history.appointments.length})
                        </h4>
                        <div className="space-y-2">
                          {history.appointments.length > 0 ? history.appointments.map(app => (
                            <div key={app.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-black text-slate-800 capitalize">{app.type.toLowerCase()}</span>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${app.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                  {app.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                <MapPin size={12} className="text-slate-400" />
                                <span>{new Date(app.date).toLocaleDateString()} às {app.time}</span>
                              </div>
                            </div>
                          )) : (
                            <p className="text-[10px] text-slate-400 italic px-2">Nenhum agendamento encontrado.</p>
                          )}
                        </div>
                      </section>
                    </div>
                  )}
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
