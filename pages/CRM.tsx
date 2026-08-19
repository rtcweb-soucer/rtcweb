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

const whatsappStyles = `
  .whatsapp-bg {
    background-color: #efe7de;
    background-image: url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png");
    background-repeat: repeat;
    background-size: 400px;
    background-attachment: local;
  }
  .message-tail-in {
    position: absolute;
    left: -8px;
    top: 0;
    width: 8px;
    height: 13px;
    background-color: white;
    clip-path: polygon(100% 0, 0 0, 100% 100%);
  }
  .message-tail-out {
    position: absolute;
    right: -8px;
    top: 0;
    width: 8px;
    height: 13px;
    background-color: #d9fdd3;
    clip-path: polygon(0 0, 100% 0, 0 100%);
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #ced0d1;
    border-radius: 10px;
  }
`;

interface CRMProps {
  customers: Customer[];
  products: Product[];
  sellers: Seller[];
  onAddCustomer: (customer: any) => Promise<void> | void;
  currentUser: SystemUser;
}

const CRM = ({ customers, products, sellers, onAddCustomer, currentUser }: CRMProps) => {
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = whatsappStyles;
    document.head.appendChild(styleSheet);
    return () => { document.head.removeChild(styleSheet); };
  }, []);

  const [activeChat, setActiveChat] = useState<Customer | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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

  const autoUpdateLeadStage = async (stage: string, value: number = 0) => {
    if (!activeChat) return;

    try {
      const cleanPhone = activeChat.phone?.replace(/\D/g, '') || '';
      const phoneVariants = [cleanPhone];
      if (cleanPhone.startsWith('55')) phoneVariants.push(cleanPhone.substring(2));
      else phoneVariants.push('55' + cleanPhone);

      const lead = crmLeads.find(l => 
        l.customer_id === activeChat.id || 
        phoneVariants.includes(l.phone?.replace(/\D/g, '')) ||
        phoneVariants.includes(l.customer?.phone?.replace(/\D/g, ''))
      );

      if (lead) {
        const updates: any = { 
          id: lead.id, 
          stage,
          lastContact: new Date().toISOString()
        };
        
        if (value > 0) {
          updates.deal_value = value;
        }

        // Adicionar nota histórica
        const timestamp = new Date().toLocaleString();
        const valueMsg = value > 0 ? ` (Valor: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : '';
        const newNote = `[${timestamp}] Automação: Fase alterada para ${stage}${valueMsg}`;
        updates.notes = lead.notes ? `${lead.notes}\n---\n${newNote}` : newNote;

        await dataService.saveCRMLead(updates);
        await loadLeads();
      }
    } catch (err) {
      console.error("Erro na automação do CRM:", err);
    }
  };
  const [lastIdentifiedPhone, setLastIdentifiedPhone] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);

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

    // Setup Realtime para MENSAGENS (atualiza last_contact para forçar reordenação)
    const globalMessagesChannel = supabase
      .channel('crm-messages-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'api_messages' },
        async (payload) => {
           const newMsg = payload.new;
           if (newMsg && newMsg.phone) {
               try {
                   const cleanPhone = newMsg.phone.replace(/\D/g, '');
                   // Find the lead and update last_contact to trigger re-render and sort
                   const { data: leads } = await supabase.from('crm_leads').select('id').ilike('phone', `%${cleanPhone}%`).limit(1);
                   if (leads && leads.length > 0) {
                       await supabase.from('crm_leads').update({ last_contact: new Date().toISOString() }).eq('id', leads[0].id);
                   }
               } catch(e) {
                   console.error('Error updating lead last_contact on new message:', e);
               }
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(globalMessagesChannel);
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
      
      // Filtrar instâncias se não for ADMIN e também filtrar para exibir apenas 'welington' e 'aline01' no CRM
      const allowedInstances = data.filter(inst => inst.instance_name === 'welington' || inst.instance_name === 'aline01');
      const isAdmin = currentUser.role === 'ADMIN';
      const availableInstances = isAdmin ? allowedInstances : allowedInstances.filter(inst => inst.user_id === currentUser.id);
      
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

      // Diagnóstico: verificar se a config está completa
      console.log('🔧 [CRM] Config carregada:', {
        evolution_url: config?.evolution_url,
        evolution_apikey: config?.evolution_apikey ? '✅ presente' : '❌ ausente',
        instancias: availableInstances.map(i => ({ name: i.name, instance: i.instance_name, apikey: i.apikey ? '✅' : '❌' }))
      });
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
      
      // Marca como lido
      dataService.markChatAsRead(activeChat.phone).then(() => {
        setCrmLeads(prev => prev.map(l => (l.phone === activeChat.phone || l.customer?.phone === activeChat.phone) ? { ...l, unreadCount: 0 } : l));
      });

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
            filter: `phone=eq.${activeChat.phone.replace(/\D/g, '')}`
          },
          (payload) => {
            // Ao invés de baixar 50 msgs, apenas adiciona a nova no final do array local
            if (payload.new) {
               setMessages(prev => {
                 // Verifica duplicidade (evolution pode disparar webhook + db insert)
                 if (prev.find(m => m.id === payload.new.id)) return prev;
                 return [...prev, payload.new];
               });
               // Scroll suave para a nova mensagem se o usuário não estiver rolando pra cima
               setTimeout(() => scrollToBottom(), 100);
            }
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
        await evolutionService.sendMessage(
          systemConfig.evolution_url,
          selectedInstance.apikey,
          selectedInstance.instance_name,
          cleanPhone,
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
        const fileName = extraData || (type === 'image' ? 'imagem.jpg' : type === 'audio' ? 'audio.mp3' : 'documento.pdf');

        console.log(`Enviando mídia (${type}) para ${cleanPhone}:`, fileName);
        await evolutionService.sendMedia(
            systemConfig.evolution_url,
            selectedInstance.apikey,
            selectedInstance.instance_name,
            cleanPhone,
            content,
            mediaType,
            fileName,
            '' // caption vazio
        );
        console.log('Mídia enviada com sucesso para Evolution API');

        try {
          await dataService.saveWhatsappMessage({
              phone: cleanPhone,
              message: content.startsWith('data:') ? content : (
                type === 'document' ? `data:application/pdf;base64,${content}` : 
                `data:audio/ogg;base64,${content}`
              ),
              direction: 'outbound',
              instance_id: selectedInstance.id,
              client_id: activeChat.id,
              media_url: null,
              media_type: type
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
        const mimeType = 'audio/webm; codecs=opus';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            console.log(`🎤 Áudio gravado: ${audioBlob.size} bytes, tipo: ${mimeType}`);
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
          phone: lead.phone || activeChat.phone,
          stage: 'ATENDIMENTO', // Mudar para atendimento ao vincular
          productInterest: lead.productInterest,
          assignedTo: lead.assigned_to || lead.assignedTo,
          notes: lead.notes ? `${lead.notes}\n---\nVinculado ao cliente ${customer.name} (Fase movida p/ ATENDIMENTO)` : `Vinculado manualmente ao cliente ${customer.name}`
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
                { title: 'Aguardando Medição', stage: 'MEDICAO', color: 'bg-emerald-500' },
                { title: 'Vendido (Fechado)', stage: 'FECHADO', color: 'bg-emerald-900' }
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
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(lead.lastContact).toLocaleDateString()}</span>
                            {lead.deal_value > 0 && (
                              <span className="text-[10px] font-black text-emerald-600 mt-1">R$ {lead.deal_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            )}
                          </div>
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
        {/* COLUNA ESQUERDA: LISTA DE CHATS (WhatsApp Style) */}
        <div className="w-[300px] xl:w-[350px] bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0">
          {/* Header da Sidebar */}
          <div className="p-3 bg-[#f0f2f5] flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden border border-slate-200">
              <User size={40} className="text-slate-500 mt-2" />
            </div>
            <div className="flex items-center gap-3 text-slate-500">
              <MessageSquare size={20} className="cursor-pointer" />
              <MoreVertical size={20} className="cursor-pointer" />
            </div>
          </div>

          {/* Busca e Filtros */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar contato ou número..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-0 outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="flex gap-2 px-1 overflow-x-auto no-scrollbar py-1">
              {[
                { id: currentUser?.id || 'me', label: 'Minhas' },
                { id: 'transferred', label: 'Transferidas' },
                { id: 'all', label: 'Todas' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveUserTab(filter.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${activeUserTab === 'all' && filter.id === 'all' ? 'bg-[#e7fce3] text-[#06503c]' : 'bg-[#f0f2f5] text-slate-500 hover:bg-slate-200'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {(() => {
              const filtered = crmLeads.filter(l => {
                const cName = (l.customer?.name || l.pushName || '').toLowerCase();
                const cPhone = (l.phone || '').toLowerCase();
                const matchSearch = !searchTerm || cName.includes(searchTerm.toLowerCase()) || cPhone.includes(searchTerm);
                if (!matchSearch) return false;

                if (activeUserTab === 'all') return true;
                if (activeUserTab === 'transferred') return l.assigned_to !== currentUser?.id && l.assigned_to !== null;
                
                return l.assigned_to === activeUserTab;
              });

              // Ordenar e filtrar por hoje/não lidos (exceto se estiver buscando)
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);

              let displayLeads = filtered;
              
              if (!searchTerm) {
                 displayLeads = filtered.filter(l => {
                    if (l.unreadCount > 0) return true;
                    const leadTime = new Date(l.lastMessageTime || l.updated_at || l.created_at || 0).getTime();
                    return leadTime >= todayStart.getTime();
                 });
              }

              displayLeads.sort((a, b) => {
                 // Bolinha verde (não lido) sempre no topo
                 if ((a.unreadCount || 0) > 0 && (b.unreadCount || 0) === 0) return -1;
                 if ((b.unreadCount || 0) > 0 && (a.unreadCount || 0) === 0) return 1;
                 
                 // Depois, os mais recentes primeiro
                 const timeA = new Date(a.lastMessageTime || a.updated_at || a.created_at || 0).getTime();
                 const timeB = new Date(b.lastMessageTime || b.updated_at || b.created_at || 0).getTime();
                 return timeB - timeA;
              });

              if (displayLeads.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-40 opacity-40">
                    <MessageSquare size={32} className="text-slate-400 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center px-4">Nenhuma conversa encontrada</p>
                  </div>
                );
              }

              return displayLeads.slice(0, 50).map(lead => {
                const assignedUser = users.find(u => u.id === lead.assigned_to);
                const isActive = activeChat?.id === (lead.customer?.id || lead.customer_id || lead.id);
                
                return (
                  <button 
                    key={lead.id}
                    onClick={(e) => {
                      e.preventDefault();
                      console.log("CLICKED LEAD:", lead);
                      let cust = lead.customer;
                      if (!cust && lead.customer_id) {
                         cust = customers.find(c => c.id === lead.customer_id);
                      }
                      if (!cust) {
                         cust = {
                           id: lead.customer_id || lead.id,
                           name: 'Lead WhatsApp',
                           phone: lead.phone || '',
                           document: '',
                           address: '',
                           created_at: new Date().toISOString()
                         };
                      } else {
                         // PRESERVE LEAD PHONE! Se o telefone original do WhatsApp for diferente do cadastro
                         // (ou se o cadastro não tem), priorizamos o do WhatsApp para carregar o histórico correto!
                         cust = { ...cust, phone: lead.phone || cust.phone };
                      }
                      setActiveChat(cust);
                    }}
                    className={`w-full px-3 py-3 flex items-center gap-3 transition-all border-b border-slate-50 ${isActive ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                      {lead.customer?.photo ? (
                        <img src={lead.customer.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className="font-semibold text-slate-900 text-base truncate pr-2">
                          {lead.customer?.name || lead.pushName || 'Lead WhatsApp'}
                        </h4>
                        <span className={`text-[11px] ${lead.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-slate-400 font-medium'}`}>
                          {lead.lastContact ? new Date(lead.lastContact).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm text-slate-500 truncate flex-1">
                          {lead.notes || lead.customer?.phone || 'Clique para conversar'}
                        </p>
                        {lead.unreadCount > 0 && (
                          <span className="bg-[#25d366] text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                            {lead.unreadCount}
                          </span>
                        )}
                        {lead.temperature === 'QUENTE' && !lead.unreadCount && (
                          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Lead Quente" />
                        )}
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
              {/* Chat Header (WhatsApp Style) */}
                <div className="px-4 py-2 bg-[#f0f2f5] border-b border-slate-200 flex justify-between items-center z-10 min-h-[60px]">
                  <div className="flex items-center gap-3 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center border border-slate-200 overflow-hidden">
                      {activeChat.photo ? (
                        <img src={activeChat.photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-900 text-base leading-tight truncate max-w-[200px]">{activeChat.name}</h3>
                      <span className="text-xs text-slate-500">visto por último hoje às {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-slate-500">
                    <Search size={20} className="cursor-pointer hover:text-slate-700" />
                    
                    {/* SELETOR DE CANAL (Discreto) */}
                    <div className="flex items-center gap-1 bg-white/50 p-1 rounded-lg border border-slate-200">
                      {instances.map(inst => (
                        <button
                          key={inst.id}
                          onClick={() => setSelectedInstance(inst)}
                          className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all border ${selectedInstance?.id === inst.id ? 'bg-[#25d366] text-white border-[#25d366]' : 'text-slate-400 border-transparent'}`}
                        >
                          {inst.name}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={() => setShowTransferModal(true)}
                      className="p-1.5 hover:bg-slate-200 rounded-full transition-all text-slate-500"
                      title="Transferir"
                    >
                      <UserPlus size={20} />
                    </button>
                    
                    <MoreVertical size={20} className="cursor-pointer hover:text-slate-700" />
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

              {/* Messages Area (WhatsApp Wallpaper + Tails) */}
              <div 
                className="flex-1 overflow-y-auto p-6 space-y-2 whatsapp-bg custom-scrollbar" 
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
                    className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-md text-slate-600 hover:bg-slate-50 transition-all z-20 flex items-center gap-2 border border-slate-100"
                  >
                    <TrendingUp className="rotate-180" size={16} />
                    <span className="text-xs font-semibold">Novas Mensagens</span>
                  </button>
                )}

                {messages.length > 0 ? (
                    messages.map((msg, i) => {
                      const text = msg.text || '';
                      const isMe = msg.sender === 'me';
                      
                      // Detecção robusta de mídia
                      const isImage = msg.mediaType === 'image' || text === 'Imagem' || text.startsWith('data:image/') || (text.length > 50 && text.includes('/9j/'));
                      const isAudio = msg.mediaType === 'audio' || text === 'Áudio' || text.startsWith('data:audio/') || text.startsWith('OggS') || text.startsWith('GkXfo');
                      const isPDF = msg.mediaType === 'document' || text.startsWith('data:application/pdf');
                      
                      const mediaUrl = msg.mediaUrl || (text.startsWith('data:') ? text : null);
                      
                      return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                          <div 
                            className={`max-w-[85%] sm:max-w-[70%] px-2 py-1.5 rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] relative text-[14.2px] ${isMe ? 'bg-[#d9fdd3] rounded-tr-none' : 'bg-white rounded-tl-none'}`}
                          >
                            {/* Tails */}
                            <div className={isMe ? 'message-tail-out' : 'message-tail-in'} />

                            {isImage ? (
                              <div className="space-y-1">
                                {(() => {
                                   let imgSrc = msg.mediaUrl;
                                   if (!imgSrc && msg.base64) imgSrc = msg.base64.startsWith('data:') ? msg.base64 : `data:image/jpeg;base64,${msg.base64}`;
                                   if (!imgSrc && text.startsWith('http')) imgSrc = text;
                                   if (!imgSrc && text.startsWith('data:')) imgSrc = text;
                                   if (!imgSrc && text.length > 200 && !text.includes(' ')) imgSrc = `data:image/jpeg;base64,${text.replace('base64,', '')}`;
                                   
                                   if (!imgSrc) return <p className="text-[10px] italic text-slate-400">🖼️ Imagem indisponível</p>;
                                   
                                   return (
                                     <img 
                                       src={imgSrc} 
                                       alt="Mídia" 
                                       className="rounded max-h-80 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                       onClick={() => window.open(imgSrc)}
                                     />
                                   );
                                })()}
                              </div>
                            ) : isAudio ? (
                              <div className="py-1 min-w-[240px]">
                                <audio 
                                  src={mediaUrl || (text.startsWith('data:') ? text : (text.includes('base64') ? text : (text.startsWith('GkXfo') ? `data:audio/webm;base64,${text}` : `data:audio/mp4;base64,${text}`)))} 
                                  controls 
                                  className="h-8 w-full accent-[#25d366]"
                                  preload="metadata"
                                />
                              </div>
                            ) : isPDF ? (
                              <div className="flex items-center gap-3 bg-[#f0f2f5]/50 p-2 rounded border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                onClick={() => {
                                  const base64 = text.includes('base64,') ? text.split('base64,')[1] : text;
                                  const link = document.createElement('a');
                                  link.href = `data:application/pdf;base64,${base64}`;
                                  link.download = `documento_${msg.time.replace(':', '-')}.pdf`;
                                  link.click();
                                }}
                              >
                                <div className="h-10 w-10 bg-red-100 rounded flex items-center justify-center text-red-600 shrink-0">
                                  <FileText size={24} />
                                </div>
                                <div className="text-left overflow-hidden">
                                  <div className="font-semibold text-xs text-slate-700 truncate max-w-[150px]">
                                    Documento PDF
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-medium">Clique para baixar</div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[#111b21] leading-[1.4]" style={{ whiteSpace: 'pre-wrap' }}>
                                  {text.length > 200 && !text.includes(' ') ? <span className="italic text-slate-400 text-[10px] break-all max-w-[200px] overflow-hidden line-clamp-2">Mídia processada</span> : msg.text}
                                </p>
                            )}
                            
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[11px] text-[#667781] font-normal uppercase">{msg.time}</span>
                              {isMe && (
                                <span className={msg.status === 'READ' ? "text-[#53bdeb]" : "text-[#667781]"}>
                                  <CheckCheck size={16} />
                                </span>
                              )}
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

              {/* Chat Input (WhatsApp Style) */}
              <div className="px-4 py-2 bg-[#f0f2f5] border-t border-slate-200 flex items-center gap-3">
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
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all" 
                    title="Anexar"
                  >
                    <Paperclip size={22} />
                  </button>
                  <button 
                    onClick={() => document.getElementById('image-upload')?.click()}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all" 
                    title="Imagens"
                  >
                    <ImageIcon size={22} />
                  </button>
                </div>

                <div className="flex-1 relative">
                  {recordedAudio ? (
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                      <button 
                        onClick={() => {
                          if (audioPlayerRef.current) {
                            if (isPlayingRecorded) audioPlayerRef.current.pause();
                            else audioPlayerRef.current.play();
                            setIsPlayingRecorded(!isPlayingRecorded);
                          }
                        }}
                        className="text-[#25d366]"
                      >
                        {isPlayingRecorded ? <X size={20} /> : <div className="ml-1 border-l-[14px] border-l-[#25d366] border-y-[8px] border-y-transparent" />}
                      </button>
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-[#25d366] transition-all ${isPlayingRecorded ? 'w-full duration-[10s] ease-linear' : 'w-0'}`} />
                      </div>
                      <button onClick={() => setRecordedAudio(null)} className="text-rose-500"><X size={20} /></button>
                      <audio ref={audioPlayerRef} src={recordedAudio.url} className="hidden" onEnded={() => setIsPlayingRecorded(false)} />
                    </div>
                  ) : isRecording ? (
                    <div className="flex-1 flex items-center justify-between bg-white px-4 py-2 rounded-full border border-rose-200 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                        <span className="text-rose-600 font-semibold text-sm">{formatTime(recordingTime)}</span>
                      </div>
                      <button onClick={toggleRecording} className="text-rose-600 font-bold text-xs uppercase tracking-wider">Cancelar</button>
                    </div>
                  ) : (
                    <textarea 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Digite uma mensagem"
                      className="w-full bg-white rounded-[24px] py-[10px] px-6 text-base md:text-lg outline-none border-none shadow-sm placeholder:text-slate-500 resize-none max-h-48 min-h-[44px] leading-normal flex items-center overflow-y-auto custom-scrollbar"
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

                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleAiSuggestion}
                    disabled={isGeneratingAi}
                    className={`p-2 rounded-full transition-all ${isGeneratingAi ? 'text-purple-600' : 'text-slate-500 hover:bg-slate-200'}`}
                    title="IA Sugestão"
                  >
                    <Sparkles size={22} />
                  </button>
                  
                  {(!chatInput.trim() && !recordedAudio && !isRecording) ? (
                    <button 
                      onMouseDown={toggleRecording}
                      className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-all"
                    >
                      <Mic size={22} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        if (recordedAudio) {
                          sendMessage('audio', recordedAudio.base64, `audio_${Date.now()}.mp3`);
                          setRecordedAudio(null);
                        } else {
                          sendMessage();
                        }
                      }}
                      disabled={isSending}
                      className="p-2 text-[#25d366] hover:bg-slate-200 rounded-full transition-all"
                    >
                      {isSending ? <RefreshCw size={22} className="animate-spin" /> : <Send size={22} />}
                    </button>
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

          {/* BOTÃO VERTICAL PARA OCULTAR/MOSTRAR PAINEL DIREITO */}
          <button 
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-slate-200 border-r-0 rounded-l-xl p-1 shadow-md text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all h-20 flex items-center justify-center group"
            title={showRightPanel ? "Ocultar Painel" : "Mostrar Painel"}
          >
            <div className="flex flex-col items-center gap-1">
              {showRightPanel ? (
                <div className="flex flex-col items-center">
                  <span className="w-1 h-1 bg-slate-300 rounded-full mb-1 group-hover:bg-blue-400" />
                  <span className="w-1 h-1 bg-slate-300 rounded-full mb-1 group-hover:bg-blue-400" />
                  <span className="w-1 h-1 bg-slate-300 rounded-full group-hover:bg-blue-400" />
                </div>
              ) : (
                <ShoppingCart size={16} className="text-blue-500 animate-pulse" />
              )}
            </div>
          </button>
        </div>

        {/* COLUNA DIREITA: PAINEL DE GESTÃO (TABS) */}
        {showRightPanel && (
          <div className="w-[380px] xl:w-[450px] flex flex-col bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden shadow-inner animate-in slide-in-from-right-4 duration-300 shrink-0">
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
                onSave={(value) => autoUpdateLeadStage('ORCAMENTO', value)}
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
                      key={`customer-form-${activeChat?.id || activeChat?.phone || 'new'}`}
                      isEmbedded={true}
                      initialData={activeChat || {
                        name: activeChat?.name || '',
                        phone: activeChat?.phone || '',
                      }}
                      onSave={async (data) => {
                        await onAddCustomer(data);
                        // Ao salvar um novo cliente no perfil, movemos para atendimento se for um lead
                        await autoUpdateLeadStage('ATENDIMENTO');
                        alert('Cliente salvo com sucesso na base de dados!');
                      }}
                    />
                  </div>

                  <div className="px-2 pb-2">
                    <button 
                      onClick={() => {
                        // Abrir modal de agendamento ou avisar
                        if (!activeChat?.id) {
                          alert("Salve ou vincule o cliente antes de agendar uma visita.");
                          return;
                        }
                        // Podemos adicionar uma flag para abrir o modal de agendamento do App.tsx 
                        // ou integrar aqui. Por enquanto vamos simular a mudança de fase se o usuário "agendar".
                        if (window.confirm("Deseja agendar uma visita técnica para este cliente? (Moverá para Medição)")) {
                          autoUpdateLeadStage('MEDICAO');
                        }
                      }}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                      <Calendar size={14} /> Agendar Visita / Medição
                    </button>
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
                                <span className="text-xs font-black text-slate-900">R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                                <span className="text-xs font-black text-purple-600">R$ {(quote.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                                <span className="text-[10px] font-black text-slate-800 capitalize">{(app.type || 'Outro').toLowerCase()}</span>
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
      )}
    </div>
  </div>
);
};

export default CRM;
