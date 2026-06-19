import * as React from 'react';
import { useMemo, useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  AlertCircle,
  ChevronRight,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  Briefcase,
  Trophy,
  Zap,
  Target,
  BarChart3,
  Timer
, Flame, MessageCircle, MessageSquareDashed, BellRing, History } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { Order, OrderStatus, Seller, Customer, SystemUser, Appointment, SalesGoal, Product, TechnicalSheet } from '../types';
import { aiManagerService, SellerPerformance } from '../services/aiManagerService';
import { evolutionService } from '../services/evolutionService';
import { dataService } from '../services/dataService';

import { Settings, Plus, Trash2, Phone, ToggleLeft, ToggleRight, UserCheck, FileText, Link, X } from 'lucide-react';
import OrderContractPrint from '../components/OrderContractPrint';
import { supabase } from '../services/supabase';

interface IAManagerProps {
  orders: Order[];
  sellers: Seller[];
  customers: Customer[];
  appointments: Appointment[];
  currentUser: SystemUser;
  products: Product[];
  technicalSheets: TechnicalSheet[];
}

const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

const IAManager = ({ orders, sellers, customers, appointments, currentUser, products, technicalSheets }: IAManagerProps) => {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'FINANCE' || currentUser.role === 'MASTER';
  const [isSending, setIsSending] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedSellerReminders, setSelectedSellerReminders] = useState<{ sellerId: string, message: string } | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | 'month'>('7d');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'notifications'>('dashboard');
  const [salesGoals, setSalesGoals] = useState<SalesGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');

  // --- Team Notifications States ---
  interface TeamNotification {
    id: string;
    name: string;
    phone: string;
    stage_trigger: string;
    active: boolean;
  }
  const [teamNotifications, setTeamNotifications] = useState<TeamNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [newNotifName, setNewNotifName] = useState('');
  const [newNotifPhone, setNewNotifPhone] = useState('');
  const [newNotifStage, setNewNotifStage] = useState('Novos Pedidos');

  const [isRevisingText, setIsRevisingText] = useState(false);
  const [whatsappMessageModal, setWhatsappMessageModal] = useState<{
    isOpen: boolean;
    type: 'promo' | 'tranquil';
    phone: string;
    name: string;
    quoteId: string;
    quoteValue: number;
    discount: number;
    paymentMethod: string;
    installments: number;
    scarcityDate: string;
    message: string;
    sellerId?: string;
  } | null>(null);

  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [activeHtmlQuote, setActiveHtmlQuote] = useState<Order | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ base64?: string, code?: string, message?: string } | null>(null);

  const [customerPrefs, setCustomerPrefs] = useState<Record<string, any>>({});
  const [interestedCustomers, setInterestedCustomers] = useState<any[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    // Inicializa o áudio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [activeHistoryQuote, setActiveHistoryQuote] = useState<Order | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [isActionHistoryModalOpen, setIsActionHistoryModalOpen] = useState(false);
  const [actionHistoryMessages, setActionHistoryMessages] = useState<any[]>([]);
  const [activeActionHistoryQuote, setActiveActionHistoryQuote] = useState<Order | null>(null);
  const [isLoadingActionHistory, setIsLoadingActionHistory] = useState(false);
  
  // Polling para ler mensagens do banco
  useEffect(() => {
    const fetchHistoryAndPrefs = async () => {
      try {
        // Busca preferências
        const { data: prefsData } = await supabase.from('customer_whatsapp_preferences').select('*');
        if (prefsData) {
          const prefsMap: Record<string, any> = {};
          prefsData.forEach(p => prefsMap[p.customer_phone] = p);
          setCustomerPrefs(prefsMap);
        }

        // Verifica mensagens recentes inbound (últimas 24h)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        
        const { data: recentMsgs } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false });

        if (recentMsgs && recentMsgs.length > 0) {
          const interested: any[] = [];
          
          const byPhone: Record<string, any[]> = {};
          recentMsgs.forEach(m => {
             if (!byPhone[m.phone]) byPhone[m.phone] = [];
             byPhone[m.phone].push(m);
          });
          
          for (const phone in byPhone) {
            const msgs = byPhone[phone];
            const lastMsg = msgs[0];
            const lastInbound = msgs.find(m => m.direction === 'inbound');
            
            if (!lastInbound) continue;
            
            const text = (lastInbound.message || '').toLowerCase();
            
            // Check opt out
            if (text.includes('não mande') || text.includes('parar') || text.includes('sair') || text.includes('não quero')) {
               if (!customerPrefs[phone] || !customerPrefs[phone].opt_out) {
                 await supabase.from('customer_whatsapp_preferences').upsert({
                   customer_phone: phone,
                   opt_out: true,
                   last_intent: 'opt_out'
                 }, { onConflict: 'customer_phone' });
               }
               continue;
            }

            // Check interest
            if (text.includes('quero') || text.includes('sim') || text.includes('interesse') || text.includes('como') || text.includes('pagar')) {
               const cust = customers.find(c => {
                  const p1 = (c.phone || '').replace(/\D/g, '');
                  const p2 = (c.phone2 || '').replace(/\D/g, '');
                  return phone.includes(p1) || phone.includes(p2);
               });
               
               if (cust && !interested.find(i => i.phone === phone)) {
                  const hoursSinceInbound = (new Date().getTime() - new Date(lastInbound.created_at).getTime()) / (1000 * 60 * 60);
                  const isPendingClose = orders.some(o => o.customerId === cust.id && o.status === OrderStatus.QUOTE_SENT);
                  
                  if (hoursSinceInbound >= 2 && isPendingClose) {
                     interested.push({
                        id: cust.id,
                        name: cust.name,
                        phone: phone,
                        message: lastInbound.message,
                        escalated: true,
                        escalation_type: lastMsg.direction === 'outbound' ? 'PARADA' : 'IGNORADA',
                        in_progress: false,
                        time: new Date(lastInbound.created_at).toLocaleTimeString()
                     });
                  } else {
                     if (lastMsg.direction === 'outbound') {
                        interested.push({
                           id: cust.id,
                           name: cust.name,
                           phone: phone,
                           message: lastInbound.message,
                           escalated: false,
                           in_progress: true,
                           time: new Date(lastInbound.created_at).toLocaleTimeString()
                        });
                     } else {
                        interested.push({
                           id: cust.id,
                           name: cust.name,
                           phone: phone,
                           message: lastInbound.message,
                           escalated: false,
                           in_progress: false,
                           time: new Date(lastInbound.created_at).toLocaleTimeString()
                        });
                     }
                  }
               }
            }
          }
          
          setInterestedCustomers(interested);
          
          if (interested.length > lastMessageCount) {
             // Toca o sininho se o número de mensagens aumentou!
             if (audioRef.current) {
                // audioRef.current.play().catch(e => console.log('Audio play blocked:', e)); // Desativado a pedido do usuário
             }
          }
          setLastMessageCount(interested.length);

        }
      } catch (err) {
         console.error('Polling error', err);
      }
    };
    
    fetchHistoryAndPrefs();
    const interval = setInterval(fetchHistoryAndPrefs, 30000); // 30s
    return () => clearInterval(interval);
  }, [customers]);

  
  const generateAIAnalysis = (msgs: any[]) => {
    if (!msgs || msgs.length === 0) return "Nenhuma conversa registrada ainda. O cliente está frio.";
    const inboundMsgs = msgs.filter(m => m.direction === 'inbound');
    
    if (inboundMsgs.length === 0) return "O vendedor enviou mensagens, mas o cliente ainda não respondeu. Pode ser necessário um follow-up mais incisivo.";
    
    const lastInbound = inboundMsgs[inboundMsgs.length - 1]?.message?.toLowerCase() || '';
    
    if (lastInbound.includes('não') || lastInbound.includes('parar') || lastInbound.includes('caro')) {
       return "O cliente demonstrou objeções recentemente (possível bloqueio por preço ou falta de interesse). Sugiro não insistir muito agora ou oferecer uma alternativa mais barata.";
    }
    
    if (lastInbound.includes('quero') || lastInbound.includes('sim') || lastInbound.includes('pagar') || lastInbound.includes('parcela')) {
       return "O cliente está muito quente! As respostas indicam alta intenção de fechamento. Recomendo ser direto e conduzir para a conclusão da venda.";
    }
    
    return "O cliente está engajado na conversa. Mantenha o relacionamento e tente conduzi-lo para o fechamento ressaltando os benefícios do produto.";
  };

  const handleOpenHistory = async (quote: Order, customerPhone?: string) => {
    if (!customerPhone) return alert('Cliente sem telefone');
    setActiveHistoryQuote(quote);
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
       const cleanNumber = customerPhone.replace(/\D/g, '');
       const { data } = await supabase
         .from('whatsapp_messages')
         .select('*')
         .like('phone', `%${cleanNumber}%`)
         .order('created_at', { ascending: true });
         
       if (data) {
         setHistoryMessages(data);
       } else {
         setHistoryMessages([]);
       }
    } catch (err) {
       console.error(err);
    } finally {
       setIsLoadingHistory(false);
    }
  };
  
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [evolutionApiSettings, setEvolutionApiSettings] = useState<any>(null);

  // --- Fetch Goals ---
  const fetchGoals = async () => {
    try {
      setIsLoadingGoals(true);
      const data = await dataService.getSalesGoals();
      setSalesGoals(data);
    } catch (err) {
      console.error('Error fetching sales goals:', err);
    } finally {
      setIsLoadingGoals(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const { data, error } = await supabase
        .from('team_notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTeamNotifications(data || []);
    } catch (err) {
      console.error('Error fetching team notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotifications();
    }
  }, [activeTab]);

  const handleAddNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotifName || !newNotifPhone) {
      alert('Preencha o nome e o celular!');
      return;
    }
    let cleanedPhone = newNotifPhone.replace(/\D/g, '');
    if (cleanedPhone.length > 0 && !cleanedPhone.startsWith('55')) {
      cleanedPhone = '55' + cleanedPhone;
    }

    try {
      const { error } = await supabase
        .from('team_notifications')
        .insert([{
          name: newNotifName,
          phone: cleanedPhone,
          stage_trigger: newNotifStage,
          active: true
        }]);
      if (error) throw error;
      setNewNotifName('');
      setNewNotifPhone('');
      await fetchNotifications();
    } catch (err: any) {
      alert(`Erro ao salvar contato: ${err.message}`);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('team_notifications')
        .update({ active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      await fetchNotifications();
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Deseja realmente remover este contato de notificação?')) return;
    try {
      const { error } = await supabase
        .from('team_notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchNotifications();
    } catch (err: any) {
      alert(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleSaveGoal = async (sellerId: string | null, amount: number) => {
    try {
      await dataService.saveSalesGoal(sellerId, amount);
      await fetchGoals();
    } catch (err: any) {
      alert(`Erro ao salvar meta: ${err.message}`);
    }
  };

  // --- Common Data Logic ---
  const performanceData = useMemo(() => {
    return aiManagerService.calculateSellerPerformance(orders, appointments, sellers, salesGoals, timeRange);
  }, [orders, appointments, sellers, salesGoals, timeRange]);

  const staleQuotesGrouped = useMemo(() => {
    const stale = aiManagerService.getStaleQuotes(orders, 48);
    return aiManagerService.groupBySeller(stale, sellers);
  }, [orders, sellers]);

  // --- Admin Specific Logic ---
  const managerStats = useMemo(() => {
    const totalQuotes = staleQuotesGrouped.reduce((acc, group) => acc + group.quotes.length, 0);
    const totalValue = performanceData.reduce((acc, p) => acc + p.totalValue, 0);
    const avgConversion = performanceData.length > 0 ? performanceData.reduce((acc, p) => acc + p.conversionRate, 0) / performanceData.length : 0;

    return { totalQuotes, totalValue, avgConversion };
  }, [staleQuotesGrouped, performanceData]);

  const funnelData = useMemo(() => {
    const statusCounts = orders.reduce((acc: any, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    return [
      { name: 'Orçamentos', value: statusCounts[OrderStatus.QUOTE_SENT] || 0 },
      { name: 'Contatos', value: statusCounts[OrderStatus.CONTRACT_SIGNED] || 0 },
      { name: 'Produção', value: statusCounts[OrderStatus.IN_PRODUCTION] || 0 },
      { name: 'Entregues', value: (statusCounts[OrderStatus.FINISHED] || 0) + (statusCounts[OrderStatus.DELIVERED] || 0) },
    ];
  }, [orders]);

  // --- Seller Specific Logic ---
  const sellerData = useMemo(() => {
    if (isAdmin) return null;
    return performanceData.find(p => p.sellerId === currentUser.sellerId) || {
      sellerId: currentUser.sellerId || '',
      sellerName: currentUser.name,
      totalQuotes: 0,
      totalOrders: 0,
      totalValue: 0,
      conversionRate: 0,
      averageTicket: 0,
      avgSpeedToQuote: 0,
      staleQuotesCount: 0
    };
  }, [performanceData, isAdmin, currentUser]);

  const aiInsights = useMemo(() => {
    const globalGoalObj = salesGoals.find(g => g.sellerId === null);
    const globalGoal = globalGoalObj ? globalGoalObj.goalAmount : 200000;
    const periodGoal = timeRange === 'month' ? globalGoal : (globalGoal / 30) * 7;

    if (isAdmin) {
      return aiManagerService.getAIPerspective(performanceData, timeRange, periodGoal, true);
    } else if (sellerData) {
      const p = sellerData as SellerPerformance;
      const sGoal = p.monthlyGoal || globalGoal;
      const sPeriodGoal = timeRange === 'month' ? sGoal : (sGoal / 30) * 7;
      return aiManagerService.getAIPerspective([p], timeRange, sPeriodGoal, false);
    }
    return null;
  }, [isAdmin, performanceData, sellerData, timeRange]);

  
  
  const handleOpenMessageModal = (type: 'promo' | 'tranquil', phone?: string, name?: string, quoteId?: string, quoteValue?: number, sellerId?: string) => {
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    
    const discount = type === 'promo' ? 10 : 0;
    const paymentMethod = 'Cartão de Crédito';
    const installments = 4;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scarcityDate = tomorrow.toISOString().split('T')[0];
    const dateStr = tomorrow.toLocaleDateString('pt-BR');
    
    const value = quoteValue || 0;
    const discountedValue = value - (value * (discount / 100));
    const installmentValue = installments > 0 ? (discountedValue / installments) : discountedValue;
    
    const msg = type === 'promo' 
      ? `Olá *${name || 'Cliente'}*, tudo bem? Vi que seu orçamento está em aberto. Fechando até ${dateStr} consigo fazer por R$ ${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em ${installments}x de R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no ${paymentMethod}! Vamos aproveitar?`
      : `Olá *${name || 'Cliente'}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Lembrando que fechando até ${dateStr} consigo fazer por R$ ${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em ${installments}x de R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no ${paymentMethod}. Estou à disposição para ajudar!`;
      
    setWhatsappMessageModal({
      isOpen: true,
      type,
      phone,
      name: name || 'Cliente',
      quoteId: quoteId || '',
      quoteValue: value,
      discount,
      paymentMethod,
      installments,
      scarcityDate,
      message: msg,
      sellerId
    });
  };

  
  const handleReviseText = async () => {
    if (!whatsappMessageModal) return;
    setIsRevisingText(true);
    
    // Simulando tempo de resposta da IA
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let msg = whatsappMessageModal.message;
    
    // Melhorias simuladas (Heurísticas que dariam a impressão de IA real)
    if (whatsappMessageModal.type === 'promo') {
      msg = msg.replace('Olá', 'Olá! Espero que esteja tendo um ótimo dia,');
      msg = msg.replace('tudo bem?', '');
      msg = msg.replace('Vamos aproveitar?', 'Essa é uma condição super especial e exclusiva. Podemos seguir com o projeto e garantir sua vaga?');
    } else {
      msg = msg.replace('Olá', 'Oi');
      msg = msg.replace('Estou à disposição para ajudar!', 'Sigo totalmente à sua disposição. Me avise se precisar de algo, ok?');
    }
    

    
    setWhatsappMessageModal({...whatsappMessageModal, message: msg.replace(/\s+/g, ' ')});
    setIsRevisingText(false);
  };
  
  const handleSendCustomWhatsApp = async () => {
    if (!whatsappMessageModal) return;
    try {
      if (whatsappMessageModal.sellerId) {
        await evolutionService.sendMessageAutoBySellerId(whatsappMessageModal.phone, whatsappMessageModal.message, whatsappMessageModal.sellerId);
      } else {
        await evolutionService.sendMessageAuto(whatsappMessageModal.phone, whatsappMessageModal.message);
      }

      await supabase.from('ia_dispatches').insert({
        quote_id: whatsappMessageModal.quoteId,
        customer_name: whatsappMessageModal.name,
        phone: whatsappMessageModal.phone,
        type: whatsappMessageModal.type,
        seller_id: whatsappMessageModal.sellerId,
        message: whatsappMessageModal.message
      });

      alert('Mensagem enviada com sucesso!');
      setWhatsappMessageModal(null);
    } catch (err: any) {
      alert(`Erro ao enviar mensagem: ${err.message}`);
    }
  };

  const handleOpenActionHistory = async (quote: Order) => {
    setActiveActionHistoryQuote(quote);
    setIsActionHistoryModalOpen(true);
    setIsLoadingActionHistory(true);
    try {
      const { data } = await supabase
        .from('ia_dispatches')
        .select('*')
        .eq('quote_id', quote.id)
        .order('created_at', { ascending: false });
      
      setActionHistoryMessages(data || []);
    } catch (e) {
      console.error(e);
      setActionHistoryMessages([]);
    } finally {
      setIsLoadingActionHistory(false);
    }
  };

  const handleSendReminder = async (seller: Seller, quotes: Order[]) => {
    const message = aiManagerService.generateReminders(seller.name, quotes, managerStats.totalValue);
    setIsSending(seller.id);
    
    try {
      if (!seller.phone) throw new Error('Vendedor sem telefone cadastrado.');
      await aiManagerService.sendReminder(seller.phone, message);
      setSuccessMessage(`Cobrança de meta enviada para ${seller.name}!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsSending(null);
      setSelectedSellerReminders(null);
    }
  };

  const handlePreview = (seller: Seller, quotes: Order[]) => {
    const message = aiManagerService.generateReminders(seller.name, quotes, managerStats.totalValue);
    setSelectedSellerReminders({ sellerId: seller.id, message });
  };


  const renderOpenQuotesGrid = (sellerMode: boolean = false) => {
    const targetSellerFilter = sellerMode ? (currentUser?.sellerId || "") : selectedSellerFilter;
    return (

      <div className="space-y-8 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Briefcase size={20} className="text-purple-600" /> Detalhamento de Orçamentos em Aberto
            </h3>
            <p className="text-sm font-medium text-slate-500">Monitoramento agressivo de pipeline de vendas.</p>
          </div>
          {!sellerMode && (<div>
            <select 
              value={selectedSellerFilter}
              onChange={(e) => setSelectedSellerFilter(e.target.value)}
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
            >
              <option value="ALL">Todos os Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          )}
        </div>

        {/* Current Month Grid */}
        <div>
          <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp size={14} /> Mês Vigente
          </h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 sticky top-0">
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Cliente</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Vendedor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Valor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {orders
                    .filter(o => o.status === OrderStatus.QUOTE_SENT)
                    .filter(o => targetSellerFilter === 'ALL' || o.sellerId === targetSellerFilter)
                    .filter(o => {
                        const d = new Date(o.createdAt);
                        const now = new Date();
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    })
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(quote => {
                      const customer = customers.find(c => c.id === quote.customerId);
                      const seller = sellers.find(s => s.id === quote.sellerId);
                      
                      const aiInteraction = interestedCustomers.find(i => i.phone && customer?.phone && (i.phone.replace(/\D/g, '').includes(customer.phone.replace(/\D/g, '')) || customer.phone.replace(/\D/g, '').includes(i.phone.replace(/\D/g, ''))));
                      
                      return (
                        <React.Fragment key={quote.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{new Date(quote.createdAt).toLocaleDateString('pt-BR')}</td>
                           <td className="px-6 py-4 text-sm font-bold text-slate-900">{customer?.name || 'Desconhecido'}</td>
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{seller?.name || 'Não Informado'}</td>
                           <td className="px-6 py-4 text-sm font-black text-purple-600 text-right">R$ {quote.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                           <td className="px-6 py-4 text-center space-x-2 whitespace-nowrap">
                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">
                               <FileText size={16} />
                             </button>
                             <button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas">
                               <History size={16} />
                             </button>
                             <button onClick={() => handleOpenActionHistory(quote)} className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all inline-flex" title="Histórico de Disparos IA">
                               <Target size={16} />
                             </button>
                             {sellerMode && (
                               <>
                                 <button onClick={() => handleOpenMessageModal('promo', customer?.phone, customer?.name, quote.id, quote.totalValue, seller?.id)} disabled={customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out} className={`p-2 rounded-xl transition-all inline-flex ${(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`} title={(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Agressiva (Promoção e Escassez)'}>
                                   <Flame size={16} />
                                 </button>
                                 <button onClick={() => handleOpenMessageModal('tranquil', customer?.phone, customer?.name, quote.id, quote.totalValue, seller?.id)} disabled={customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out} className={`p-2 rounded-xl transition-all inline-flex ${(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`} title={(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Tranquila (Acompanhamento)'}>
                                   <MessageCircle size={16} />
                                 </button>
                                 {customer?.phone && (
                                   <a href={`https://wa.me/${customer.phone}`} target="_blank" rel="noopener noreferrer" className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all inline-flex" title="Abrir WhatsApp">
                                     <MessageSquareDashed size={16} />
                                   </a>
                                 )}
                                 {customer?.phone && (
                                   <a href={`tel:${customer.phone}`} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Ligar para Cliente">
                                     <Phone size={16} />
                                   </a>
                                 )}
                               </>
                             )}
                           </td>

                        </tr>
                        {aiInteraction && (
                           <tr className={`${aiInteraction.escalated ? 'bg-rose-50/80 border-rose-200 animate-pulse' : aiInteraction.in_progress ? 'bg-amber-50/20 border-amber-100' : 'bg-purple-50/60 border-purple-100 animate-pulse'} border-b`}>
                             <td colSpan={5} className="px-6 py-2">
                               {aiInteraction.in_progress ? (
                                  <div className="flex items-center justify-end gap-2 opacity-80">
                                     <Timer size={12} className="text-amber-500 animate-pulse shrink-0" />
                                     <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Em Fechamento (Atendido)</span>
                                  </div>
                               ) : (
                                  <div className="flex items-start gap-2">
                                    <Zap size={14} className={aiInteraction.escalated ? "text-rose-600 mt-0.5 shrink-0 animate-pulse" : "text-purple-600 mt-0.5 shrink-0 animate-pulse"} />
                                    <div>
                                      <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${aiInteraction.escalated ? 'text-rose-800' : 'text-purple-800'}`}>
                                        {aiInteraction.escalated ? (aiInteraction.escalation_type === 'IGNORADA' ? '🚨 ALERTA DIRETORIA: Cliente Ignorado há 2+ Horas!' : '⚠️ ATENÇÃO DIRETOR: Venda Parada há 2+ Horas') : 'Nova Mensagem do Cliente'}
                                      </p>
                                      <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                      <p className={`text-[10px] leading-tight ${aiInteraction.escalated ? 'text-rose-700 font-bold' : 'text-purple-700'}`}>
                                        {aiInteraction.escalated ? (aiInteraction.escalation_type === 'IGNORADA' ? 'O cliente demonstrou interesse, mas o VENDEDOR NÃO RESPONDEU.' : 'O vendedor interagiu, mas a venda não foi convertida após o interesse do cliente.') : generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}
                                      </p>
                                    </div>
                                  </div>
                               )}
                             </td>
                           </tr>
                        )}
                        </React.Fragment>
                      );

                    })}
               </tbody>
            </table>
          </div>
        </div>

        {/* Retroactive Grid */}
        <div>
          <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock size={14} /> Pendentes Retroativos (Meses Anteriores)
          </h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-rose-50/50 sticky top-0">
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase">Data</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase">Cliente</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase">Vendedor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-right">Valor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-center">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {orders
                    .filter(o => o.status === OrderStatus.QUOTE_SENT)
                    .filter(o => targetSellerFilter === 'ALL' || o.sellerId === targetSellerFilter)
                    .filter(o => {
                        const d = new Date(o.createdAt);
                        const now = new Date();
                        return !(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
                    })
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(quote => {
                      const customer = customers.find(c => c.id === quote.customerId);
                      const seller = sellers.find(s => s.id === quote.sellerId);
                      
                      const aiInteraction = interestedCustomers.find(i => i.phone && customer?.phone && (i.phone.replace(/\D/g, '').includes(customer.phone.replace(/\D/g, '')) || customer.phone.replace(/\D/g, '').includes(i.phone.replace(/\D/g, ''))));
                      
                      return (
                        <React.Fragment key={quote.id}>
                        <tr className="hover:bg-rose-50/30 transition-colors">
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{new Date(quote.createdAt).toLocaleDateString('pt-BR')}</td>
                           <td className="px-6 py-4 text-sm font-bold text-slate-900">{customer?.name || 'Desconhecido'}</td>
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{seller?.name || 'Não Informado'}</td>
                           <td className="px-6 py-4 text-sm font-black text-rose-600 text-right">R$ {quote.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                           <td className="px-6 py-4 text-center space-x-2 whitespace-nowrap">
                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">
                               <FileText size={16} />
                             </button>
                             <button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas">
                               <History size={16} />
                             </button>
                             <button onClick={() => handleOpenActionHistory(quote)} className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all inline-flex" title="Histórico de Disparos IA">
                               <Target size={16} />
                             </button>
                             {sellerMode && (
                               <>
                                 <button onClick={() => handleOpenMessageModal('promo', customer?.phone, customer?.name, quote.id, quote.totalValue, seller?.id)} disabled={customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out} className={`p-2 rounded-xl transition-all inline-flex ${(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}`} title={(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Agressiva (Promoção e Escassez)'}>
                                   <Flame size={16} />
                                 </button>
                                 <button onClick={() => handleOpenMessageModal('tranquil', customer?.phone, customer?.name, quote.id, quote.totalValue, seller?.id)} disabled={customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out} className={`p-2 rounded-xl transition-all inline-flex ${(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}`} title={(customerPrefs[customer?.phone?.replace(/\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Tranquila (Acompanhamento)'}>
                                   <MessageCircle size={16} />
                                 </button>
                                 {customer?.phone && (
                                   <a href={`https://wa.me/${customer.phone}`} target="_blank" rel="noopener noreferrer" className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all inline-flex" title="Abrir WhatsApp">
                                     <MessageSquareDashed size={16} />
                                   </a>
                                 )}
                                 {customer?.phone && (
                                   <a href={`tel:${customer.phone}`} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Ligar para Cliente">
                                     <Phone size={16} />
                                   </a>
                                 )}
                               </>
                             )}
                           </td>

                        </tr>
                        {aiInteraction && (
                           <tr className={`${aiInteraction.escalated ? 'bg-rose-50/80 border-rose-200 animate-pulse' : aiInteraction.in_progress ? 'bg-amber-50/20 border-amber-100' : 'bg-purple-50/60 border-purple-100 animate-pulse'} border-b`}>
                             <td colSpan={5} className="px-6 py-2">
                               {aiInteraction.in_progress ? (
                                  <div className="flex items-center justify-end gap-2 opacity-80">
                                     <Timer size={12} className="text-amber-500 animate-pulse shrink-0" />
                                     <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Em Fechamento (Atendido)</span>
                                  </div>
                               ) : (
                                  <div className="flex items-start gap-2">
                                    <Zap size={14} className={aiInteraction.escalated ? "text-rose-600 mt-0.5 shrink-0 animate-pulse" : "text-purple-600 mt-0.5 shrink-0 animate-pulse"} />
                                    <div>
                                      <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${aiInteraction.escalated ? 'text-rose-800' : 'text-purple-800'}`}>
                                        {aiInteraction.escalated ? (aiInteraction.escalation_type === 'IGNORADA' ? '🚨 ALERTA DIRETORIA: Cliente Ignorado há 2+ Horas!' : '⚠️ ATENÇÃO DIRETOR: Venda Parada há 2+ Horas') : 'Nova Mensagem do Cliente'}
                                      </p>
                                      <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                      <p className={`text-[10px] leading-tight ${aiInteraction.escalated ? 'text-rose-700 font-bold' : 'text-purple-700'}`}>
                                        {aiInteraction.escalated ? (aiInteraction.escalation_type === 'IGNORADA' ? 'O cliente demonstrou interesse, mas o VENDEDOR NÃO RESPONDEU.' : 'O vendedor interagiu, mas a venda não foi convertida após o interesse do cliente.') : generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}
                                      </p>
                                    </div>
                                  </div>
                               )}
                             </td>
                           </tr>
                        )}
                        </React.Fragment>
                      );

                    })}
               </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderModals = () => (
    <>

      {isActionHistoryModalOpen && activeActionHistoryQuote && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Target size={18} className="text-indigo-600" />
                  Histórico de Disparos IA
                </h3>
                <p className="text-xs text-slate-500 mt-1">Orçamento #{activeActionHistoryQuote.number || activeActionHistoryQuote.id.substring(0,8)}</p>
              </div>
              <button 
                onClick={() => setIsActionHistoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] flex flex-col gap-3">
              {isLoadingActionHistory ? (
                <div className="flex justify-center items-center h-full">
                  <Timer size={24} className="animate-spin text-indigo-600" />
                </div>
              ) : actionHistoryMessages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-slate-500 bg-white/50 py-2 px-4 rounded-xl self-center text-sm shadow-sm">
                  Nenhum disparo registrado para este orçamento.
                </div>
              ) : (
                actionHistoryMessages.map((msg, idx) => (
                  <div key={idx} className="flex justify-start">
                    <div className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-sm relative border ${msg.type === 'promo' ? 'bg-amber-50/50 border-amber-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {msg.type === 'promo' ? <Flame size={14} className="text-amber-500" /> : <MessageCircle size={14} className="text-emerald-500" />}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.type === 'promo' ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {msg.type === 'promo' ? 'Ação Agressiva' : 'Ação Tranquila'}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-auto">
                          {new Date(msg.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-slate-700">{msg.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && activeHistoryQuote && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <History size={18} className="text-purple-600" />
                  Histórico de Conversas (WhatsApp)
                </h3>
                <p className="text-xs text-slate-500 mt-1">Orçamento #{activeHistoryQuote.number}</p>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] flex flex-col gap-3">
              {!isLoadingHistory && historyMessages.length > 0 && (
                <div className="bg-gradient-to-r from-purple-100 to-blue-50 border border-purple-200 rounded-xl p-4 mb-4 shadow-sm relative overflow-hidden flex-shrink-0">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Bot size={64} />
                  </div>
                  <h4 className="text-xs font-black text-purple-800 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Zap size={14} className="text-purple-600" />
                    Análise Silenciosa da IA
                  </h4>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                    {generateAIAnalysis(historyMessages)}
                  </p>
                </div>
              )}
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-full">
                  <Timer size={24} className="animate-spin text-purple-600" />
                </div>
              ) : historyMessages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-slate-500 bg-white/50 py-2 px-4 rounded-xl self-center text-sm shadow-sm">
                  Nenhuma conversa encontrada no banco de dados para este telefone.
                </div>
              ) : (
                historyMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm relative ${msg.direction === 'inbound' ? 'bg-white text-slate-800 rounded-tl-none' : 'bg-[#dcf8c6] text-slate-800 rounded-tr-none'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <span className="text-[10px] text-slate-500 float-right mt-1 ml-3">
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Message Modal */}
      {whatsappMessageModal && whatsappMessageModal.isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className={`p-6 border-b border-slate-100 flex items-center justify-between ${whatsappMessageModal.type === 'promo' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl text-white ${whatsappMessageModal.type === 'promo' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                  {whatsappMessageModal.type === 'promo' ? <Flame size={24} /> : <MessageCircle size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {whatsappMessageModal.type === 'promo' ? 'Ação Agressiva (Promoção)' : 'Ação Tranquila (Acompanhamento)'}
                  </h3>
                  <p className="text-sm font-medium text-slate-500">Supervisão e edição de mensagem para {whatsappMessageModal.name}</p>
                </div>
              </div>
              <button onClick={() => setWhatsappMessageModal(null)} className="w-10 h-10 rounded-2xl bg-white/50 flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Desconto (%)</label>
                   <input 
                      type="number" 
                      value={whatsappMessageModal.discount}
                      onChange={(e) => {
                         const v = Number(e.target.value);
                         setWhatsappMessageModal({...whatsappMessageModal, discount: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Data Limite (Escassez)</label>
                   <input 
                      type="date" 
                      value={whatsappMessageModal.scarcityDate}
                      onChange={(e) => {
                         const v = e.target.value;
                         setWhatsappMessageModal({...whatsappMessageModal, scarcityDate: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Parcelas (Qtd)</label>
                   <input 
                      type="number" 
                      value={whatsappMessageModal.installments}
                      onChange={(e) => {
                         const v = Number(e.target.value);
                         setWhatsappMessageModal({...whatsappMessageModal, installments: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Forma de Pagamento</label>
                   <input 
                      type="text" 
                      value={whatsappMessageModal.paymentMethod}
                      onChange={(e) => {
                         const v = e.target.value;
                         setWhatsappMessageModal({...whatsappMessageModal, paymentMethod: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Texto da Mensagem (Sugerido pela IA)</label>
                   <div className="flex gap-2">
                     <button 
                       onClick={handleReviseText}
                       disabled={isRevisingText}
                       className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1 transition-all"
                     >
                       {isRevisingText ? <Timer size={12} className="animate-spin" /> : <Bot size={12} />}
                       {isRevisingText ? 'Revisando...' : 'Revisar com IA Gemini'}
                     </button>
                     <button 
                     onClick={() => {
                        const dateObj = new Date(whatsappMessageModal.scarcityDate);
                        dateObj.setDate(dateObj.getDate() + 1); // fix offset timezone
                        const dateStr = dateObj.toLocaleDateString('pt-BR');
                        const value = whatsappMessageModal.quoteValue;
                        const discountedValue = value - (value * (whatsappMessageModal.discount / 100));
                        const installmentValue = whatsappMessageModal.installments > 0 ? (discountedValue / whatsappMessageModal.installments) : discountedValue;
                        
                        const newMsg = whatsappMessageModal.type === 'promo'
                          ? `Olá *${whatsappMessageModal.name}*, tudo bem? Vi que seu orçamento está em aberto. Fechando até ${dateStr} consigo fazer por R$ ${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em ${whatsappMessageModal.installments}x de R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no ${whatsappMessageModal.paymentMethod}! Vamos aproveitar?`
                          : `Olá *${whatsappMessageModal.name}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Lembrando que fechando até ${dateStr} consigo fazer por R$ ${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em ${whatsappMessageModal.installments}x de R$ ${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no ${whatsappMessageModal.paymentMethod}. Estou à disposição para ajudar!`;
                        setWhatsappMessageModal({...whatsappMessageModal, message: newMsg});
                     }}
                     className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100"
                   >
                     Atualizar Texto
                   </button>
                   </div>
                </div>
                <textarea 
                   rows={5}
                   value={whatsappMessageModal.message}
                   onChange={(e) => setWhatsappMessageModal({...whatsappMessageModal, message: e.target.value})}
                   className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 focus:ring-2 ring-purple-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                 onClick={() => setWhatsappMessageModal(null)}
                 className="flex-1 py-4 bg-white text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all border border-slate-200"
              >
                 Cancelar
              </button>
              <button 
                 onClick={handleSendCustomWhatsApp}
                 className={`flex-1 py-4 text-white rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${whatsappMessageModal.type === 'promo' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
              >
                 <Send size={18} /> Enviar Mensagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML View Modal */}
      {isHtmlModalOpen && activeHtmlQuote && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><FileText size={24} /></div>
                <div><h3 className="text-xl font-black text-slate-900">Visualização de Contrato</h3></div>
              </div>
              <button onClick={() => { setIsHtmlModalOpen(false); setActiveHtmlQuote(null); }} className="w-10 h-10 rounded-2xl bg-slate-200 flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-200">
              <OrderContractPrint order={activeHtmlQuote} customers={customers} sellers={sellers} products={products} technicalSheets={technicalSheets} isPrintMode={false} />
            </div>
          </div>
        </div>
      )}
      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><Phone size={24} /></div>
                <div><h3 className="text-xl font-black text-slate-900">Conectar WhatsApp</h3></div>
              </div>
              <button onClick={() => { setIsQrModalOpen(false); setQrCodeData(null); }} className="p-2"><X size={20} /></button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              {isFetchingQr ? <p>Gerando QR Code...</p> : qrCodeData?.base64 ? <img src={qrCodeData.base64} className="w-64 h-64" /> : qrCodeData?.code ? <p className="text-3xl font-black">{qrCodeData.code}</p> : <p>{qrCodeData?.message}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // --- RENDER SELLER VIEW ---
  if (!isAdmin) {
    return (
      <div className="space-y-6 pb-20 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 bg-gradient-to-r from-purple-700 to-indigo-800 p-8 rounded-[40px] text-white shadow-xl">
           <div className="p-4 bg-white/20 backdrop-blur-md rounded-3xl">
              <Bot size={40} />
           </div>
           <div>
              <h2 className="text-2xl font-black">Meu Consultor IA</h2>
              <p className="opacity-80 font-medium">Olá {currentUser.name}, vamos bater a meta de 200k!</p>
           </div>
        </div>

        {/* Priority Alerts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Zap size={14} className="text-amber-500" /> Ações Prioritárias
              </h3>
              <div className="space-y-3">
                 {Array.isArray(aiInsights) && aiInsights.map((msg, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl border-l-4 border-purple-500 flex gap-3 items-start">
                       <div className="mt-1 text-purple-600"><Target size={18} /></div>
                       <p className="text-sm font-bold text-slate-700 leading-relaxed">{msg}</p>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Minha Performance (Recentemente)</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-6 bg-purple-50 rounded-3xl">
                    <p className="text-[10px] font-black text-purple-400 uppercase mb-1">Conversão</p>
                    <p className="text-2xl font-black text-purple-700">{Math.round(sellerData?.conversionRate || 0)}%</p>
                 </div>
                 <div className="p-6 bg-emerald-50 rounded-3xl">
                    <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Total Vendido</p>
                    <p className="text-lg font-black text-emerald-700">R$ {sellerData?.totalValue.toLocaleString('pt-BR')}</p>
                 </div>
                 <div className="p-6 bg-amber-50 rounded-3xl">
                    <p className="text-[10px] font-black text-amber-400 uppercase mb-1">Tempo Médio</p>
                    <p className="text-2xl font-black text-amber-700">{Math.round(sellerData?.avgSpeedToQuote || 0)}h</p>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ticket Médio</p>
                    <p className="text-lg font-black text-slate-700">R$ {Math.round(sellerData?.averageTicket || 0).toLocaleString('pt-BR')}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* My Stale Quotes */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-rose-50 opacity-10 group-hover:scale-110 transition-transform">
            <Clock size={80} />
          </div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-1">Orçamentos que são Prioridade de Meta</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {orders.filter(o => o.sellerId === currentUser.sellerId && o.status === OrderStatus.QUOTE_SENT)
               .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
               .slice(0, 9)
               .map(quote => {
                  const customer = customers.find(c => c.id === quote.customerId);
                  const hours = Math.floor((new Date().getTime() - new Date(quote.createdAt).getTime()) / (1000 * 60 * 60));
                  return (
                    <div key={quote.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between gap-4">
                       <div>
                          <div className="flex items-center justify-between mb-2">
                             <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${hours > 48 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                Parado há {hours}h
                             </span>
                          </div>
                          <p className="text-sm font-black text-slate-900 truncate">{customer?.name || 'Cliente'}</p>
                          <p className="text-[11px] font-bold text-slate-500">R$ {quote.totalValue.toLocaleString('pt-BR')}</p>
                       </div>
                    </div>
                  );
               })}
             {orders.filter(o => o.sellerId === currentUser.sellerId && o.status === OrderStatus.QUOTE_SENT).length === 0 && (
                <div className="col-span-full py-10 text-center text-slate-400 font-medium">
                   Não há orçamentos parados no momento. Excelente!
                </div>
             )}
          </div>
        </div>
        {renderOpenQuotesGrid(true)}
        {renderModals()}
      </div>
    );
  }

  // --- RENDER ADMIN VIEW ---
  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-500/20">
            <Bot size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Gerente IA</h2>
            <p className="text-slate-500 text-sm font-medium">Visão estratégica e autonomia de cobrança (Meta 200k).</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex p-1 bg-slate-100 rounded-2xl">
             <button 
               onClick={() => setActiveTab('dashboard')}
               className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
             >
                Dashboard
             </button>
             <button 
               onClick={() => setActiveTab('settings')}
               className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
             >
                <Settings size={14} className="inline mr-1" /> Configurações
             </button>
             <button 
               onClick={() => setActiveTab('notifications')}
               className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'notifications' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
             >
                <Users size={14} className="inline mr-1" /> Notificações da Equipe
             </button>
          </div>
        )}
        <div className="flex p-1 bg-slate-100 rounded-2xl">
           <button 
             onClick={() => setTimeRange('7d')}
             className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeRange === '7d' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
           >
              Agressivo (7d)
           </button>
           <button 
             onClick={() => setTimeRange('month')}
             className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${timeRange === 'month' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500'}`}
           >
              Estratégico (Mês)
           </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                 <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                    <Target size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900">Meta Global RTC</h3>
                    <p className="text-sm text-slate-500 font-medium">Meta padrão para todos os vendedores que não possuem meta individual.</p>
                 </div>
              </div>

              <div className="flex items-end gap-4">
                 <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor da Meta Mensal</label>
                    <div className="relative">
                       <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                       <input 
                         type="number"
                         placeholder="200.000"
                         className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-900 focus:ring-2 ring-purple-500"
                         defaultValue={salesGoals.find(g => g.sellerId === null)?.goalAmount || 200000}
                         onBlur={(e) => handleSaveGoal(null, Number(e.target.value))}
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Metas Individuais por Vendedor</h3>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-slate-50">
                          <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Vendedor</th>
                          <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Meta Mensal Personalizada (R$)</th>
                          <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {sellers.map((seller) => {
                          const goal = salesGoals.find(g => g.sellerId === seller.id);
                          return (
                             <tr key={seller.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                                         {seller.name.charAt(0)}
                                      </div>
                                      <span className="text-sm font-black text-slate-900">{seller.name}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-5">
                                   <div className="relative max-w-[200px]">
                                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                                      <input 
                                        type="number"
                                        placeholder="Meta Global"
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-black text-slate-900 focus:ring-2 ring-purple-500"
                                        defaultValue={goal?.goalAmount || ''}
                                        onBlur={(e) => handleSaveGoal(seller.id, Number(e.target.value))}
                                      />
                                   </div>
                                </td>
                                <td className="px-8 py-5 text-right">
                                   {goal ? (
                                      <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase">Personalizada</span>
                                   ) : (
                                      <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase">Usando Global</span>
                                   )}
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : activeTab === 'notifications' ? (
         <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Form to add notification contact */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
               <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                     <Users size={24} />
                  </div>
                  <div>
                     <h3 className="text-xl font-black text-slate-900">Novo Contato de Notificação</h3>
                     <p className="text-sm text-slate-500 font-medium">Cadastre contatos da equipe para receberem avisos automáticos via WhatsApp quando os pedidos entrarem em determinadas etapas de produção.</p>
                  </div>
               </div>

               <form onSubmit={handleAddNotification} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Contato</label>
                     <input 
                       type="text"
                       placeholder="Ex: Aline (PCP)"
                       required
                       value={newNotifName}
                       onChange={(e) => setNewNotifName(e.target.value)}
                       className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 ring-purple-500 text-sm"
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp/Celular</label>
                     <input 
                       type="text"
                       placeholder="Ex: 21999999999"
                       required
                       value={newNotifPhone}
                       onChange={(e) => setNewNotifPhone(e.target.value)}
                       className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 ring-purple-500 text-sm"
                     />
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Etapa de Produção</label>
                     <select 
                       value={newNotifStage}
                       onChange={(e) => setNewNotifStage(e.target.value)}
                       className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 ring-purple-500 text-sm appearance-none"
                     >
                        <option value="Novos Pedidos">Novos Pedidos (Aline PCP)</option>
                        <option value="Em Preparação">Em Preparação (Diretor)</option>
                        <option value="Provisionamento">Provisionamento (Wellington Compras)</option>
                        <option value="Cortes ou Soldas">Cortes ou Soldas</option>
                        <option value="Montagem">Montagem</option>
                        <option value="Instalações">Instalações</option>
                        <option value="Finalizado">Finalizado</option>
                     </select>
                  </div>

                  <button 
                    type="submit"
                    className="py-4 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                     <Plus size={16} /> Cadastrar Contato
                  </button>
               </form>
            </div>

            {/* List notifications rules */}
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Contatos e Gatilhos de Notificação Ativos</h3>
               </div>
               
               {loadingNotifications ? (
                  <div className="p-8 text-center text-slate-400">Carregando contatos...</div>
               ) : teamNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-medium">Nenhum contato cadastrado ainda.</div>
               ) : (
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-slate-50">
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Nome</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">WhatsApp</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Etapa de Disparo</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Status</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Ações</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {teamNotifications.map((notif) => (
                              <tr key={notif.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-8 py-4 font-bold text-slate-900">{notif.name}</td>
                                 <td className="px-8 py-4 text-sm text-slate-500 font-medium flex items-center gap-2">
                                    <Phone size={14} className="text-slate-400" />
                                    {notif.phone}
                                 </td>
                                 <td className="px-8 py-4">
                                    <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-bold">
                                       {notif.stage_trigger}
                                    </span>
                                 </td>
                                 <td className="px-8 py-4 text-center">
                                    <button 
                                      onClick={() => handleToggleActive(notif.id, notif.active)}
                                      className="focus:outline-none"
                                      type="button"
                                    >
                                       {notif.active ? (
                                          <ToggleRight size={28} className="text-purple-600" />
                                       ) : (
                                          <ToggleLeft size={28} className="text-slate-300" />
                                       )}
                                    </button>
                                 </td>
                                 <td className="px-8 py-4 text-right">
                                    <button 
                                      onClick={() => handleDeleteNotification(notif.id)}
                                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                                      type="button"
                                    >
                                       <Trash2 size={16} />
                                    </button>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>
         </div>
       ) : (
      <>

      {/* Meta de Faturamento Progress Bar */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm overflow-hidden relative">
         {(() => {
            const globalGoalObj = salesGoals.find(g => g.sellerId === null);
            const globalGoal = globalGoalObj ? globalGoalObj.goalAmount : 200000;
            const periodGoal = timeRange === 'month' ? globalGoal : (globalGoal / 30) * 7;
            const progress = (managerStats.totalValue / periodGoal) * 100;
            return (
               <>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                     <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Target size={14} className="text-purple-600" /> Meta Proporcional ({timeRange === '7d' ? '7 dias' : 'Mês'})
                        </h3>
                        <p className="text-2xl font-black text-slate-900">R$ {periodGoal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">Progresso no Período</p>
                        <p className="text-xl font-black text-purple-600">{Math.round(progress)}%</p>
                     </div>
                  </div>
                  <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden mb-2">
                     <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-1000" 
                        style={{ width: `${Math.min(progress, 100)}%` }} 
                     />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">
                     Faltam R$ {Math.max(periodGoal - managerStats.totalValue, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} para atingir a meta do período
                  </p>
               </>
            );
         })()}
      </div>

      {/* Admin Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Faturado</p>
          <p className="text-3xl font-black text-slate-900">R$ {managerStats.totalValue.toLocaleString('pt-BR')}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
            <TrendingUp size={12} /> {timeRange === '7d' ? '7 dias' : 'Mês Vigente'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
          <p className="text-[10px) font-black text-slate-400 uppercase tracking-widest mb-1">Conversão Média</p>
          <p className="text-3xl font-black text-slate-900">{Math.round(managerStats.avgConversion)}%</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-purple-600 bg-purple-50 w-fit px-2 py-1 rounded-lg">
            <Target size={12} /> Eficiência do Time
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Orçamentos Pendentes</p>
          <p className="text-3xl font-black text-slate-900">{managerStats.totalQuotes}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-rose-600 bg-rose-50 w-fit px-2 py-1 rounded-lg">
            <Clock size={12} /> Requer Atenção
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Funnel Chart */}
         <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Funil de Conversão</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={funnelData} margin={{ left: 40 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                     <XAxis type="number" hide />
                     <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                     <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                     />
                     <Bar dataKey="value" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={30} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* AI Perspective Card */}
         <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 text-white/5 pointer-events-none">
               <Bot size={150} />
            </div>
            <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-6">Autonomia IA: Monitor de Meta 200k</h3>
            <div className="space-y-6 relative z-10">
               <div>
                  <p className="text-xl font-bold leading-relaxed">
                     {aiInsights && (aiInsights as any).summary}
                  </p>
               </div>
               <div className="p-5 bg-white/10 rounded-3xl border border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                     <Trophy size={18} className="text-amber-400" />
                     <p className="text-xs font-black uppercase tracking-wider text-amber-400">Destaque</p>
                  </div>
                  <p className="text-sm font-medium opacity-90">{aiInsights && (aiInsights as any).topPerformance}</p>
               </div>
               <div className="p-5 bg-rose-500/10 rounded-3xl border border-rose-500/20 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-2">
                     <AlertCircle size={18} className="text-rose-400" />
                     <p className="text-xs font-black uppercase tracking-wider text-rose-400">Ação Autônoma de Cobrança</p>
                  </div>
                  <p className="text-sm font-medium opacity-90">{aiInsights && (aiInsights as any).alerts}</p>
               </div>
            </div>
         </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ranking de Faturamento ({timeRange === '7d' ? '7 dias' : 'Mês Vigente'})</h3>
            <BarChart3 size={20} className="text-slate-300" />
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50">
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Vendedor</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Vendas</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Conversão</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Velocidade</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Faturamento</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {performanceData.sort((a, b) => b.totalValue - a.totalValue).map((p, idx) => (
                     <tr key={p.sellerId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-slate-300">#{idx + 1}</span>
                              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                                 {p.sellerName.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-sm font-black text-slate-900">{p.sellerName}</span>
                                 <span className="text-[10px] font-bold text-slate-400">Meta: R$ {p.monthlyGoal.toLocaleString('pt-BR')}</span>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <span className="text-sm font-bold text-slate-600">{p.totalOrders} pedidos</span>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                 <div className="h-full bg-purple-500" style={{ width: `${Math.min(p.goalProgress, 100)}%` }} />
                              </div>
                              <span className="text-xs font-black text-slate-900">{Math.round(p.goalProgress)}%</span>
                           </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                           <div className="flex items-center justify-center gap-1.5 text-amber-600">
                              <Timer size={14} />
                              <span className="text-xs font-bold">{Math.round(p.avgSpeedToQuote)}h</span>
                           </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <span className="text-sm font-black text-purple-600">R$ {p.totalValue.toLocaleString('pt-BR')}</span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Suggested Follow-ups */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Autonomia de Cobrança: Pressionar Meta</h3>
        
        {staleQuotesGrouped.length === 0 ? (
          <div className="bg-white p-12 rounded-[40px] border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-xl font-black text-slate-900">Tudo em dia!</h4>
            <p className="text-slate-500 max-w-xs mx-auto">Nenhum orçamento parado bloqueando a nossa meta de 200k.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {staleQuotesGrouped.map((group) => (
              <div key={group.seller.id} className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black">
                      {group.seller.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900">{group.seller.name}</h4>
                      <p className="text-xs text-slate-500 font-bold">{group.quotes.length} itens parados</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">Impacto Meta</p>
                    <p className="text-lg font-black text-purple-600">
                      R$ {group.quotes.reduce((acc, q) => acc + q.totalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-2">
                  <button 
                    onClick={() => handlePreview(group.seller, group.quotes)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    <Eye size={16} /> Preview IA
                  </button>
                  <button 
                    disabled={isSending === group.seller.id}
                    onClick={() => handleSendReminder(group.seller, group.quotes)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-2xl text-xs font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isSending === group.seller.id ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                    Pressionar Agora
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderOpenQuotesGrid(false)}


      {/* Preview Modal */}
      {selectedSellerReminders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-100 bg-purple-50">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-purple-600 text-white rounded-2xl">
                       <MessageSquare size={24} />
                    </div>
                    <button 
                      onClick={() => setSelectedSellerReminders(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                       <AlertCircle className="rotate-45" size={24} />
                    </button>
                 </div>
                 <h4 className="text-xl font-black text-slate-900">Cobrança de Meta Desatada</h4>
                 <p className="text-sm text-slate-500 font-medium">Esta mensagem agressiva foca na meta de faturamento de 200k.</p>
              </div>
              <div className="p-8">
                 <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-700 font-medium leading-relaxed italic text-sm">
                       "{selectedSellerReminders.message}"
                    </p>
                 </div>
                 <div className="mt-8 flex gap-3">
                    <button 
                       onClick={() => setSelectedSellerReminders(null)}
                       className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                       Ajustar
                    </button>
                    <button 
                       onClick={() => {
                          const group = staleQuotesGrouped.find(g => g.seller.id === selectedSellerReminders.sellerId);
                          if (group) handleSendReminder(group.seller, group.quotes);
                       }}
                       className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                    >
                       Confirmar Envio
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-8 right-8 z-[60] bg-emerald-500 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-2xl animate-in slide-in-from-right-full duration-500">
          <CheckCircle2 size={24} />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}
      {renderModals()}
      </>
      )}
    </div>
  );
};

export default IAManager;
