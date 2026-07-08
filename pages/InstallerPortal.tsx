import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Truck, MapPin, Phone, MessageCircle, FileText, 
  CheckCircle2, AlertCircle, Clock, Map, 
  ChevronRight, X, User, HardHat, LogOut,
  Navigation, RotateCcw, Package
} from 'lucide-react';
import { Order, Customer, TechnicalSheet, Product, Appointment, Installer, TimeEntry, ProductionStage } from '../types';
import { dataService } from '../services/dataService';
import { notificationService } from '../services/notificationService';
import ProductionSheetPrint from '../components/ProductionSheetPrint';
import MeasurementForm from './MeasurementForm';

interface InstallerPortalProps {
  installer: Installer;
  orders: Order[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  appointments: Appointment[];
  onLogout: () => void;
  onUpdateOrder: (order: Order) => void;
  onSaveTechnicalSheet?: (sheet: TechnicalSheet) => Promise<TechnicalSheet>;
}

const OFFICE_LAT = -22.88363;
const OFFICE_LNG = -43.26623;
const ALLOWED_RADIUS_METERS = 300;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

const InstallerPortal = ({ 
  installer, 
  orders, 
  customers, 
  technicalSheets, 
  products, 
  appointments,
  onLogout,
  onUpdateOrder,
  onSaveTechnicalSheet
}: InstallerPortalProps) => {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceToOffice, setDistanceToOffice] = useState<number | null>(null);
  const [lastPoint, setLastPoint] = useState<TimeEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [showReworkModal, setShowReworkModal] = useState<string | null>(null); // OrderID
  const [showSheetModal, setShowSheetModal] = useState<string | null>(null); // Agora armazena o OrderId
  const [showReworkMeasurementForm, setShowReworkMeasurementForm] = useState<string | null>(null); // OrderId
  const [fullSheetData, setFullSheetData] = useState<any>(null);
  const [reworkReason, setReworkReason] = useState<'novo produto' | 'ajuste' | 'falta de peças'>('ajuste');
  const [reworkNotes, setReworkNotes] = useState('');
  
  // States para 'novo produto'
  const [reworkSelectedItemId, setReworkSelectedItemId] = useState<string>('');
  const [reworkWidth, setReworkWidth] = useState<string>('');
  const [reworkHeight, setReworkHeight] = useState<string>('');
  const [reworkColor, setReworkColor] = useState<string>('');
  const [reworkCommand, setReworkCommand] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSheetLoading, setIsSheetLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Instalações de hoje para este instalador (excluindo já finalizadas)
  const todaysInstallations = appointments
    .filter(app => app.date === today && app.installerIds?.includes(installer.id) && app.type === 'INSTALLATION')
    .map(app => {
      const order = orders.find(o => o.id === app.orderId);
      const customer = customers.find(c => c.id === app.customerId);
      return { app, order, customer };
    })
    .filter(({ order }) => !order || (order.productionStage !== ProductionStage.READY && order.productionStage !== ProductionStage.NEW_ORDER && order.productionStage !== ProductionStage.ASSEMBLY));

  // Instalações finalizadas para o histórico
  const historyInstallations = appointments
    .filter(app => app.installerIds?.includes(installer.id) && app.type === 'INSTALLATION')
    .map(app => {
      const order = orders.find(o => o.id === app.orderId);
      const customer = customers.find(c => c.id === app.customerId);
      return { app, order, customer };
    })
    .filter(({ order }) => order && order.productionStage === ProductionStage.READY)
    .sort((a, b) => new Date(b.app.date).getTime() - new Date(a.app.date).getTime());

  const displayedInstallations = activeTab === 'PENDING' ? todaysInstallations : historyInstallations;

  const hasInstallationsToday = todaysInstallations.length > 0;

  useEffect(() => {
    // Get last point
    dataService.getTimeEntries(installer.id).then(entries => {
      if (entries && entries.length > 0) {
        setLastPoint(entries[0]);
      }
    });

    // Watch location
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          const dist = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
          setDistanceToOffice(dist);
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [installer.id]);

  const handleBaterPonto = async (type: 'IN' | 'OUT' | 'LUNCH_OUT' | 'LUNCH_IN') => {
    if (!currentLocation || !distanceToOffice) {
      alert("Localização não encontrada. Ative o GPS.");
      return;
    }

    const isLunch = type === 'LUNCH_OUT' || type === 'LUNCH_IN';

    // Regra: Somente Entrada e Saída (shift start/end) exigem estar na sede
    if (!isLunch && distanceToOffice > ALLOWED_RADIUS_METERS) {
      alert(`Você está fora do raio permitido (${Math.round(distanceToOffice)}m). Dirija-se à empresa para bater ${type === 'IN' ? 'Entrada' : 'Saída'}.`);
      return;
    }

    setIsLoading(true);
    try {
      const entry = await dataService.saveTimeEntry({
        installerId: installer.id,
        type,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        timestamp: new Date().toISOString(),
        locationName: isLunch && distanceToOffice > ALLOWED_RADIUS_METERS ? 'Externo (Almoço)' : 'Sede Maria da Graça'
      });
      setLastPoint(entry);
      
      const labels: Record<string, string> = {
        'IN': 'Entrada',
        'OUT': 'Saída',
        'LUNCH_OUT': 'Saída p/ Almoço',
        'LUNCH_IN': 'Retorno do Almoço'
      };
      
      alert(`Ponto de ${labels[type]} registrado com sucesso!`);
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar ponto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalize = async (order: Order) => {
    if (!confirm("Confirmar conclusão da instalação?")) return;

    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const todayDate = now.split('T')[0];
      const newHistory = [
        ...(order.productionHistory || []),
        { stage: ProductionStage.READY, timestamp: now, notes: 'Finalizado pelo instalador' }
      ];
      const updatedOrder = {
        ...order,
        productionStage: ProductionStage.READY,
        productionHistory: newHistory,
        finalizedAt: todayDate,
        status: 'DELIVERED' as any
      };
      
      await dataService.saveOrder(updatedOrder);
      await dataService.updateProductionStage(order.id, ProductionStage.READY, newHistory);
      onUpdateOrder(updatedOrder);

      // Notificar Financeiro
      try {
        await notificationService.notifyFinanceAboutInstallation(updatedOrder);
        notificationService.sendAutomatedPaymentNotification(updatedOrder, 2);
      } catch (notifErr) {
        console.warn('Aviso: erro ao notificar financeiro (instalação foi finalizada mesmo assim)', notifErr);
      }

      alert("Instalação finalizada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar instalação. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSheet = async (orderId: string) => {
    setIsSheetLoading(true);
    setShowSheetModal(orderId);
    try {
      const data = await dataService.getOrderProductionData(orderId);
      setFullSheetData(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficha técnica.");
      setShowSheetModal(null);
    } finally {
      setIsSheetLoading(false);
    }
  };

  const handleSendRework = async (technicalSheetId?: string, newItemIds?: string[]) => {
    if (!showReworkModal) return;
    if (reworkReason !== 'novo produto' && !reworkNotes.trim()) {
      alert("Por favor, descreva o motivo do retrabalho.");
      return;
    }

    setIsLoading(true);
    try {
      // Tentar salvar no banco de reworks (pode falhar se tabela não existir)
      try {
        await dataService.saveRework({
          orderId: showReworkModal,
          reason: reworkReason,
          description: reworkNotes,
          createdBy: installer.id
        });
      } catch (reworkErr) {
        console.warn('Aviso: tabela reworks pode não existir, continuando com atualização do pedido...', reworkErr);
      }

      const order = orders.find(o => o.id === showReworkModal);
      if (order) {
        const targetStage = reworkReason === 'novo produto' ? ProductionStage.NEW_ORDER : ProductionStage.ASSEMBLY;
        const newHistory = [
          ...(order.productionHistory || []),
          { stage: targetStage, timestamp: new Date().toISOString(), notes: `[RETRABALHO]: ${reworkReason} - ${reworkNotes}` }
        ];

        const updatedOrder = {
          ...order,
          productionStage: targetStage,
          productionHistory: newHistory,
          isRework: true,
          reworkReason: reworkReason,
          reworkTechnicalSheetId: technicalSheetId,
          itemIds: newItemIds ? [...(order.itemIds || []), ...newItemIds] : order.itemIds,
          contractObservations: `${order.contractObservations || ''}\n[RETRABALHO]: ${reworkReason} - ${reworkNotes}`
        };
        await dataService.saveOrder(updatedOrder);
        await dataService.updateProductionStage(order.id, targetStage, newHistory);
        onUpdateOrder(updatedOrder);
      }

      alert("Retrabalho registrado com sucesso! Pedido enviado ao PCP.");
      setShowReworkModal(null);
      setReworkNotes('');
    } catch (err) {
      console.error('Erro ao registrar retrabalho:', err);
      alert("Erro ao registrar retrabalho. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const openWhatsApp = (phone: string) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length <= 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const openNavigation = (address: any) => {
    const query = encodeURIComponent(`${address.street}, ${address.number}, ${address.neighborhood}, ${address.city} - RJ`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Mobile */}
      <div className="bg-slate-900 text-white p-6 rounded-b-[40px] shadow-xl">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
              <HardHat className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Portal do Instalador</p>
              <h1 className="font-bold text-lg">{installer.name}</h1>
            </div>
          </div>
          <button onClick={onLogout} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all">
            <LogOut size={20} />
          </button>
        </div>

        {/* Card de Ponto */}
        <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Clock size={16} className="text-blue-400" /> 
              {lastPoint ? `Último ponto: ${
                lastPoint.type === 'IN' ? 'Entrada' : 
                lastPoint.type === 'OUT' ? 'Saída' : 
                lastPoint.type === 'LUNCH_OUT' ? 'Saída Almoço' : 'Retorno Almoço'
              } às ${new Date(lastPoint.timestamp).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` : 'Nenhum ponto hoje'}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase">
              <div className={`w-2 h-2 rounded-full ${distanceToOffice !== null && distanceToOffice <= ALLOWED_RADIUS_METERS ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              {distanceToOffice !== null && distanceToOffice <= ALLOWED_RADIUS_METERS ? 'Na Empresa' : 'Fora do Raio'}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isLoading || (lastPoint && lastPoint.type !== 'OUT' && lastPoint.type !== undefined)}
                onClick={() => handleBaterPonto('IN')}
                className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  (lastPoint && lastPoint.type !== 'OUT') ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white shadow-emerald-500/20'
                } disabled:opacity-50`}
              >
                <CheckCircle2 size={16} /> Entrada
              </button>
              
              <button
                disabled={isLoading || (lastPoint?.type !== 'IN' && lastPoint?.type !== 'LUNCH_IN')}
                onClick={() => handleBaterPonto('OUT')}
                className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  (lastPoint?.type === 'IN' || lastPoint?.type === 'LUNCH_IN') ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                <LogOut size={16} /> Saída
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isLoading || lastPoint?.type !== 'IN'}
                onClick={() => handleBaterPonto('LUNCH_OUT')}
                className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  lastPoint?.type === 'IN' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                <Clock size={16} /> Almoço (Saída)
              </button>
              
              <button
                disabled={isLoading || lastPoint?.type !== 'LUNCH_OUT'}
                onClick={() => handleBaterPonto('LUNCH_IN')}
                className={`py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  lastPoint?.type === 'LUNCH_OUT' ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                } disabled:opacity-50`}
              >
                <RotateCcw size={16} /> Almoço (Volta)
              </button>
            </div>
          </div>
          
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="flex gap-4 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('PENDING')}
            className={`pb-3 px-2 font-black uppercase tracking-widest text-[10px] border-b-2 transition-colors ${activeTab === 'PENDING' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            A Fazer Hoje
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-3 px-2 font-black uppercase tracking-widest text-[10px] border-b-2 transition-colors ${activeTab === 'HISTORY' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Histórico (Finalizados)
          </button>
        </div>
        
        {displayedInstallations.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
             <Truck className="mx-auto text-slate-200 mb-4" size={48} />
             <p className="text-slate-400 font-bold">{activeTab === 'PENDING' ? 'Nenhum serviço para hoje.' : 'Nenhum serviço finalizado.'}</p>
          </div>
        ) : (
          displayedInstallations.map(({ app, order, customer }) => (
            <div key={app.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-all">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1.5">{order?.contractNumber || 'Sem Contrato'}</p>
                    <h3 className="font-bold text-slate-900 text-lg leading-tight">{customer?.name}</h3>
                  </div>
                  <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                    {app.time}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <MapPin size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-700 leading-tight">
                        {customer?.address.street}, {customer?.address.number}
                        {customer?.address.complement ? ` - ${customer.address.complement}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">{customer?.address.neighborhood}, {customer?.address.city}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <Package size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Produtos</p>
                      <p className="text-xs font-bold text-slate-700">
                        {order?.itemIds?.length || 0} Itens (Veja Ficha Técnica)
                      </p>
                    </div>
                  </div>
                </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <button 
                      onClick={() => customer?.phone && window.open(`tel:${customer.phone}`)}
                      className="flex flex-col items-center justify-center gap-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-bold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      <Phone size={14} /> Ligar
                    </button>
                    <button 
                      onClick={() => customer?.phone && openWhatsApp(customer.phone)}
                      className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-500 text-white rounded-2xl text-[10px] font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button 
                      onClick={() => customer?.address && openNavigation(customer.address)}
                      className="flex flex-col items-center justify-center gap-1 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                    >
                      <Navigation size={14} /> Rota
                    </button>
                  </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100">
                <button 
                  onClick={() => order && handleViewSheet(order.id)}
                  className="flex flex-col items-center justify-center py-4 hover:bg-slate-50 transition-all group"
                >
                  <FileText className="text-slate-400 group-hover:text-blue-500 mb-1" size={18} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900">Ficha</span>
                </button>
                {activeTab === 'PENDING' ? (
                  <>
                    <button 
                      onClick={() => setShowReworkModal(order?.id || null)}
                      className="flex flex-col items-center justify-center py-4 hover:bg-slate-50 transition-all group"
                    >
                      <RotateCcw className="text-slate-400 group-hover:text-amber-500 mb-1" size={18} />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900">Retrabalho</span>
                    </button>
                    <button 
                      onClick={() => order && handleFinalize(order)}
                      className="flex flex-col items-center justify-center py-4 bg-emerald-50 hover:bg-emerald-100 transition-all group"
                    >
                      <CheckCircle2 className="text-emerald-500 mb-1" size={18} />
                      <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Finalizar</span>
                    </button>
                  </>
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-4 bg-slate-50 opacity-70">
                    <CheckCircle2 className="text-emerald-500 mb-1" size={18} />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Concluído em {new Date(app.date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rework Modal */}
      {showReworkModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">Registrar Retrabalho</h3>
              <button onClick={() => {
                setShowReworkModal(null);
                setReworkSelectedItemId('');
                setReworkWidth('');
                setReworkHeight('');
                setReworkColor('');
                setReworkCommand('');
              }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Selecione o Motivo</label>
                <div className="grid grid-cols-1 gap-2">
                  {['ajuste', 'novo produto', 'falta de peças'].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReworkReason(reason as any)}
                      className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all flex items-center justify-between ${
                        reworkReason === reason ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600'
                      }`}
                    >
                      {reason.charAt(0).toUpperCase() + reason.slice(1)}
                      {reworkReason === reason && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Observações Adicionais</label>
                <textarea
                  value={reworkNotes}
                  onChange={(e) => setReworkNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Detalhe o problema encontrado..."
                />
              </div>

              {reworkReason === 'novo produto' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Selecione o Produto do Contrato</label>
                    <select
                      value={reworkSelectedItemId}
                      onChange={(e) => setReworkSelectedItemId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Selecione o item --</option>
                      {showReworkModal && (technicalSheets.find(s => s.id === orders.find(o => o.id === showReworkModal)?.technicalSheetId)?.items || []).map(item => {
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <option key={item.id} value={item.id}>
                            {prod?.nome} - {item.environment} ({item.width}x{item.height})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nova Largura (m)</label>
                      <input type="number" step="0.01" value={reworkWidth} onChange={(e) => setReworkWidth(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 3.10" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nova Altura (m)</label>
                      <input type="number" step="0.01" value={reworkHeight} onChange={(e) => setReworkHeight(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 2.00" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Nova Cor</label>
                      <input type="text" value={reworkColor} onChange={(e) => setReworkColor(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="Opcional" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Comando / Lado</label>
                      <input type="text" value={reworkCommand} onChange={(e) => setReworkCommand(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Direito" />
                    </div>
                  </div>
                  <button
                    disabled={isLoading || !reworkSelectedItemId || !reworkWidth || !reworkHeight}
                    onClick={() => setShowReworkMeasurementForm(showReworkModal)}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Preencher Ficha de Produção
                  </button>
                </div>
              ) : (
                <button
                  disabled={isLoading}
                  onClick={() => handleSendRework()}
                  className="w-full py-5 bg-slate-900 text-white rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  Confirmar Registro de Retrabalho
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MeasurementForm Overlay para Retrabalho de Novo Produto */}
      {showReworkMeasurementForm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[2000] overflow-y-auto">
          <div className="min-h-screen p-4 flex items-center justify-center">
            <div className="bg-white w-full max-w-7xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative">
              <button 
                onClick={() => setShowReworkMeasurementForm(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-full transition-all"
              >
                <X size={24} />
              </button>
              <div className="h-[90vh] overflow-y-auto">
                <MeasurementForm
                  customers={customers}
                  products={products}
                  technicalSheets={technicalSheets}
                  initialCustomerId={orders.find(o => o.id === showReworkMeasurementForm)?.customerId}
                  editingSheet={technicalSheets.find(s => s.id === orders.find(o => o.id === showReworkMeasurementForm)?.technicalSheetId)}
                  currentUser={installer}
                  reworkItemPreFill={{
                    originalItemId: reworkSelectedItemId,
                    productId: (() => {
                      const sheet = technicalSheets.find(s => s.id === orders.find(o => o.id === showReworkMeasurementForm)?.technicalSheetId);
                      const item = sheet?.items.find(i => i.id === reworkSelectedItemId);
                      return item?.productId || '';
                    })(),
                    width: Number(reworkWidth.toString().replace(',', '.')),
                    height: Number(reworkHeight.toString().replace(',', '.')),
                    color: reworkColor,
                    command: reworkCommand,
                    notes: reworkNotes ? `[RETRABALHO]: ${reworkReason} - ${reworkNotes}` : `[RETRABALHO]: ${reworkReason}`
                  }}
                  onSave={async (sheet) => {
                    if (onSaveTechnicalSheet) {
                      const saved = await onSaveTechnicalSheet(sheet);
                      await handleSendRework(saved.id, saved.items.map((i: any) => i.id));
                      setShowReworkMeasurementForm(null);
                      setReworkSelectedItemId('');
                      setReworkWidth('');
                      setReworkHeight('');
                      setReworkColor('');
                      setReworkCommand('');
                    }
                  }}
                  onGenerateQuote={() => {}} // No-op, not used in this context
                  orders={orders}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technical Sheet Modal */}
      {showSheetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[95vh] sm:h-[90vh] animate-in slide-in-from-bottom duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">Ficha Técnica de Produção</h3>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mt-1">Layout Oficial PCP</p>
              </div>
              <button onClick={() => { setShowSheetModal(null); setFullSheetData(null); }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-100/50 p-2 sm:p-6">
              {isSheetLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-bold text-sm">Carregando dados técnicos...</p>
                </div>
              ) : fullSheetData ? (
                <div className="w-full overflow-x-auto rounded-3xl bg-white shadow-inner p-1 sm:p-0">
                   <div className="min-w-[800px] pointer-events-none origin-top scale-[0.9] sm:scale-100">
                      <ProductionSheetPrint data={fullSheetData} products={products} />
                   </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p className="font-bold">Ficha técnica não disponível.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
               <button
                onClick={() => { setShowSheetModal(null); setFullSheetData(null); }}
                className="w-full py-4 bg-slate-900 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar Mobile (Optional fallback links) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-around items-center sm:hidden">
        <div className="flex flex-col items-center">
          <Clock className="text-blue-600" size={24} />
          <span className="text-[10px] font-bold text-slate-400">Ponto</span>
        </div>
        <div className="flex flex-col items-center">
          <Truck className="text-slate-400" size={24} />
          <span className="text-[10px] font-bold text-slate-400">Agenda</span>
        </div>
        <div className="flex flex-col items-center">
          <User className="text-slate-400" size={24} />
          <span className="text-[10px] font-bold text-slate-400">Perfil</span>
        </div>
      </div>
    </div>
  );
};

export default InstallerPortal;
