
import * as React from 'react';
import { useState, useRef } from 'react';
import { Order, Customer, TechnicalSheet, Product, OrderStatus, Seller, Installment, ProductionStage, MeasurementItem, SystemUser, UserRole } from '../types';
import { nfEmailService } from '../services/nfEmailService';
import { SEFAZTxtGenerator } from '../services/sefazTxtGenerator';
import { dataService } from '../services/dataService';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Briefcase,
  Search,
  ChevronRight,
  MapPin,
  Calendar,
  User,
  ArrowLeft,
  DollarSign,
  Layers,
  Printer,
  Monitor,
  Info,
  CreditCard as CreditCardIcon,
  FileText,
  Edit3,
  Trash2,
  X,
  Clock,
  Activity,
  ArrowDown,
  Phone,
  Filter,
  UserCheck,
  MapPin as PinIcon,
  CreditCard as DocIcon,
  Download,
  FileDown,
  ExternalLink,
  RefreshCw,
  FileEdit,
  Ban,
  SendHorizontal,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';

interface OrdersProps {
  orders: Order[];
  customers: Customer[];
  technicalSheets: TechnicalSheet[];
  products: Product[];
  sellers: Seller[];
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  currentUser: SystemUser;
  initialOrderId?: string;
  onClearInitialOrder?: () => void;
}

import OrderContractPrint from '../components/OrderContractPrint';


const Orders = ({
  orders,
  customers,
  technicalSheets,
  products,
  sellers,
  onUpdateOrder,
  onDeleteOrder,
  currentUser,
  initialOrderId,
  onClearInitialOrder
}: OrdersProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [showCustomerChangeModal, setShowCustomerChangeModal] = useState(false);
  const [searchTermCustomers, setSearchTermCustomers] = useState('');
  const [showCVModal, setShowCVModal] = useState(false);
  const [cvInputs, setCvInputs] = useState<Record<string, string>>({});

  const handleCopyValue = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado com sucesso!");
  };

  const handleGeneratePaymentForInstallment = async (inst: any, order: Order) => {
    setIsGenerating(`${order.id}-${inst.id}`);
    try {
      const { infinitePayService } = await import('../services/infinitePayService');
      const customer = customers.find(c => c.id === order.customerId);
      const customerData = {
        name: customer?.name || 'Cliente',
        email: customer?.email || '',
        phone: customer?.phone || ''
      };

      const charge = await infinitePayService.createCharge(order, inst, customerData);

      const updatedInstallments = order.installments?.map(i => {
        if (i.id === inst.id) {
          return {
            ...i,
            paymentLink: charge.url,
            pixCopyPaste: charge.pixCode,
            paymentId: charge.id
          };
        }
        return i;
      });

      onUpdateOrder({ ...order, installments: updatedInstallments });
    } catch (err: any) {
      alert("Erro ao oferecer pagamento: " + err.message);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleGenerateMasterPayment = async (order: Order) => {
    setIsGenerating(`master-${order.id}`);
    try {
      const pendingInstallments = order.installments?.filter(i => i.status !== 'PAID') || [];
      if (pendingInstallments.length === 0) {
        alert("Não há parcelas pendentes para faturar neste pedido.");
        return;
      }

      const { infinitePayService } = await import('../services/infinitePayService');
      const customer = customers.find(c => c.id === order.customerId);
      const customerData = {
        name: customer?.name || 'Cliente',
        email: customer?.email || '',
        phone: customer?.phone || ''
      };

      // Analisa quantas parcelas do tipo Cartão de Crédito existem no contrato
      const ccCount = order.installments?.filter(i => i.paymentMethod?.toUpperCase().includes('CARTÃO')).length || 0;
      
      // Se tiver parcelas de Cartão, trava o parcelamento máximo nessa mesma quantidade do contrato.
      // E quando for só PIX (ou outro meio), trava imediatamente em 1 parcela (à vista).
      const maxInstallments = ccCount > 0 ? ccCount : 1;

      // Gera a cobrança impondo esse limite cravado
      const charge = await infinitePayService.createMasterOrderCharge(order, pendingInstallments, customerData, maxInstallments);

      // Distribuir o LINK MESTRE para todas as pendentes para referência
      const updatedInstallments = order.installments?.map(i => {
        if (i.status !== 'PAID') {
          return { ...i, paymentLink: charge.url, paymentId: charge.id };
        }
        return i;
      });

      onUpdateOrder({ ...order, installments: updatedInstallments });
      alert("Link Único de Cartão (agrupado) gerado com sucesso! Envie pelo WhatsApp clicando no ícone do balãozinho.");
    } catch (err: any) {
      alert("Erro ao oferecer pagamento único: " + err.message);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleWhatsAppManualShare = (inst: any, order: Order) => {
    const customer = customers.find(c => c.id === order.customerId);
    const phone = customer?.phone || order.customerPhone;
    if (!phone) {
      alert("Telefone do cliente não encontrado");
      return;
    }

    let message = `Olá! Referente ao seu pedido *${order.contractNumber || order.id.slice(0, 8).toUpperCase()}*, segue a cobrança da parcela *${inst.number}/${order.installments?.length}*.\n\n`;
    message += `💰 *Valor:* R$ ${inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;

    if (inst.pixCopyPaste) {
      message += `\n*Código PIX Copia e Cola:*\n\`${inst.pixCopyPaste}\`\n\n_Copie e cole no app do seu banco._`;
    } else if (inst.paymentLink) {
      message += `\n🔗 *Link para Pagamento:* ${inst.paymentLink}`;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Estados para ações avançadas de NFe
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCCeModal, setShowCCeModal] = useState(false);
  const [modalInput, setModalInput] = useState('');

  // Handle deep-linking from NFe Dashboard
  React.useEffect(() => {
    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
      onClearInitialOrder?.();
    }
  }, [initialOrderId]);

  // New Filters
  const [filterSellerId, setFilterSellerId] = useState(() => {
    if (currentUser && currentUser.role === UserRole.SELLER) {
      return currentUser.sellerId || currentUser.id || '';
    }
    return '';
  });
  const [filterNeighborhood, setFilterNeighborhood] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterCPF, setFilterCPF] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const sortedOrders = [...orders].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const filteredOrders = sortedOrders.filter((order: Order) => {
    const isOrder = (order.status !== OrderStatus.QUOTE_SENT && order.status !== OrderStatus.PENDING_MEASUREMENT) || !!order.contractNumber;
    if (!isOrder) return false;

    const customer = customers.find((c: Customer) => c.id === order.customerId);
    const orderDate = new Date(order.createdAt);

    // Filter Logic
    const matchSearch = customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) || order.id.includes(searchTerm);
    const matchSeller = filterSellerId === '' || order.sellerId === filterSellerId;
    const matchNeighborhood = filterNeighborhood === '' || customer?.address.neighborhood.toLowerCase().includes(filterNeighborhood.toLowerCase());
    const matchAddress = filterAddress === '' || customer?.address.street.toLowerCase().includes(filterAddress.toLowerCase());
    const matchPhone = filterPhone === '' || customer?.phone.includes(filterPhone);
    const matchCPF = filterCPF === '' || customer?.document.includes(filterCPF);

    const matchDateStart = filterStartDate === '' || orderDate >= new Date(filterStartDate);
    const matchDateEnd = filterEndDate === '' || orderDate <= new Date(filterEndDate + 'T23:59:59');

    return matchSearch && matchSeller && matchNeighborhood && matchAddress && matchPhone && matchCPF && matchDateStart && matchDateEnd;
  });

  const selectedOrder = orders.find((o: Order) => o.id === selectedOrderId);
  const selectedCustomer = selectedOrder ? customers.find((c: Customer) => c.id === selectedOrder.customerId) : null;
  const seller = selectedOrder ? sellers.find((s: Seller) => s.id === selectedOrder.sellerId) : null;
  const originalSheet = selectedOrder ? technicalSheets.find((s: TechnicalSheet) => s.id === selectedOrder.technicalSheetId) : null;

  const orderItems = (() => {
    // PREFERÊNCIA 1: Snapshot (itens congelados no momento da aprovação/criação)
    if (selectedOrder?.itemsSnapshot && selectedOrder.itemsSnapshot.length > 0) {
      return selectedOrder.itemsSnapshot;
    }

    // PREFERÊNCIA 2: Live Data
    if (!originalSheet) return [];
    if (!selectedOrder?.itemIds) return originalSheet.items;
    return originalSheet.items.filter((item: MeasurementItem) => selectedOrder.itemIds?.includes(item.id));
  })();

  const calculateItemPrice = (item: MeasurementItem) => {
    if (!selectedOrder) return 0;

    // 1. Se houver um preço explícito definido para este item, use-o
    if (selectedOrder.itemPrices && selectedOrder.itemPrices[item.id] !== undefined) {
      return selectedOrder.itemPrices[item.id];
    }

    // 2. Caso contrário, tente encontrar o produto e calcular o preço base
    const product = products.find((p: Product) => p.id === item.productId);
    if (!product) return 0;

    const area = (item.width * item.height) || 1;
    const baseValue = product.unidade === 'M2' ? product.valor * area : product.valor;

    // 3. Se não houver itemPrices explícitos, mas o total do pedido for diferente 
    // do total esperado pela tabela de preços, aplique a proporção global (legado)
    const originalTotal = orderItems.reduce((acc: number, it: MeasurementItem) => {
      const p = products.find((prod: Product) => prod.id === it.productId);
      if (!p) return acc;
      const a = (it.width * it.height) || 1;
      return acc + (p.unidade === 'M2' ? p.valor * a : p.valor);
    }, 0);

    if (originalTotal > 0 && selectedOrder.totalValue !== originalTotal) {
      // Evita aplicar ratio se já existem itemPrices definidos
      if (selectedOrder.itemPrices && Object.keys(selectedOrder.itemPrices).length > 0) {
        return baseValue;
      }
      const ratio = selectedOrder.totalValue / originalTotal;
      return baseValue * ratio;
    }
    return baseValue;
  };

  const handleEditClick = () => {
    if (selectedOrder) {
      setEditingOrder({ ...selectedOrder });
      setShowEditModal(true);
    }
  };

  const openHistory = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setHistoryOrder(order);
    setShowHistoryModal(true);
  };

  const handleUpdateInstallment = (index: number, field: keyof Installment, value: any) => {
    if (!editingOrder?.installments) return;
    const updated = [...editingOrder.installments];
    updated[index] = { ...updated[index], [field]: value };

    setEditingOrder({ ...editingOrder, installments: updated });
  };

  const handleUpdateItemPrice = (itemId: string, newPrice: number) => {
    if (!editingOrder) return;

    const newItemPrices = { ...(editingOrder.itemPrices || {}) };
    newItemPrices[itemId] = newPrice;

    // Recalcular total se necessário, mas geralmente o total do pedido é soberano sobre a soma dos itens
    // No entanto, para manter consistência, podemos atualizar o total se o usuário estiver editando itens
    const newTotal = orderItems.reduce((acc, item) => {
      return acc + (item.id === itemId ? newPrice : (newItemPrices[item.id] ?? calculateItemPrice(item)));
    }, 0);

    setEditingOrder({
      ...editingOrder,
      itemPrices: newItemPrices,
      totalValue: parseFloat(newTotal.toFixed(2))
    });
  };

  const saveEdits = () => {
    if (editingOrder) {
      // Validação crítica: a soma das parcelas deve ser igual ao valor total do pedido
      const sumInstallments = editingOrder.installments?.reduce((acc: number, curr: Installment) => acc + (parseFloat(curr.value.toString()) || 0), 0) || 0;

      const sumCents = Math.round(sumInstallments * 100);
      const totalCents = Math.round(editingOrder.totalValue * 100);

      if (sumCents !== totalCents) {
        alert(`ERRO DE VALIDAÇÃO: A soma das parcelas (R$ ${sumInstallments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) não coincide com o valor total do pedido (R$ ${editingOrder.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).\n\nA diferença é de R$ ${Math.abs((sumCents - totalCents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n\nPor favor, ajuste os valores das parcelas para que o total seja EXATO.`);
        return;
      }

      onUpdateOrder(editingOrder);
      setShowEditModal(false);
      setEditingOrder(null);
    }
  };

  // Componente de Input de Moeda com Estado Local para evitar travamentos
  const CurrencyInput = ({
    value,
    onChange,
    className = "",
    prefix = "R$",
    prefixColor = "text-slate-400"
  }: {
    value: number,
    onChange: (val: number) => void,
    className?: string,
    prefix?: string,
    prefixColor?: string
  }) => {
    const [localValue, setLocalValue] = useState(value.toFixed(2));
    const [isFocused, setIsFocused] = useState(false);

    React.useEffect(() => {
      if (!isFocused) {
        setLocalValue(value.toFixed(2));
      }
    }, [value, isFocused]);

    const handleBlur = () => {
      setIsFocused(false);
      const numericValue = parseFloat(localValue.replace(',', '.'));
      if (!isNaN(numericValue)) {
        onChange(numericValue);
      } else {
        setLocalValue(value.toFixed(2));
      }
    };

    return (
      <div className={`relative flex items-center gap-1 ${className}`}>
        {prefix && <span className={`text-[10px] font-bold ${prefixColor}`}>{prefix}</span>}
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          className="w-20 text-right bg-transparent border-none p-0 font-black text-slate-900 focus:ring-0 outline-none no-print appearance-none"
        />
      </div>
    );
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const handleGeneratePrint = (autoPrint: boolean = true) => {
    if (!printRef.current || !selectedOrder) return;

    const printWindow = window.open('', '_blank', 'width=1024,height=800');
    if (!printWindow) {
      alert("Por favor, habilite pop-ups.");
      return;
    }

    const content = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-br">
        <head>
          <meta charset="UTF-8">
          <title>RTC DECOR - ${selectedOrder.contractNumber || selectedOrder.quoteNumber || selectedOrder.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet">
          <style>
            @media print {
              body { margin: 0; padding: 0; background: white; }
              .no-print { display: none !important; }
              @page { size: A4; margin: 10mm 0; }
              
              /* Repeating Header & Footer Logic */
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              tr { page-break-inside: avoid; }
              section { page-break-inside: avoid; margin-bottom: 20px; }
              
              .print-container { width: 100%; border: none; }
              .a4-page { box-shadow: none; border: none; width: 100%; padding: 0; margin: 0; }
              .print-header-padding { height: 10mm; }
              .print-footer-padding { height: 10mm; }
            }
            
            body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; padding: 40px 20px; display: flex; justify-content: center; }
            .a4-page { background: white; width: 210mm; min-height: 297mm; padding: 8mm; margin: 0 auto; box-shadow: 0 0 40px rgba(0,0,0,0.1); box-sizing: border-box; position: relative; border-radius: 8px; }
            .logo-img { max-height: 70px; }
            table.print-table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="a4-page">
            <table class="print-table">
              ${content}
            </table>
          </div>
          ${autoPrint ? `<script>window.onload = () => { setTimeout(() => { window.print(); }, 1000); };</script>` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportPDF = async () => {
    if (!printRef.current || !selectedOrder) return;

    // Criamos um clone do elemento para poder ajustar estilos sem afetar a tela
    const element = printRef.current.cloneNode(true) as HTMLElement;

    // Configurações para garantir que o clone tenha o layout correto para captura
    element.style.position = 'fixed';
    element.style.left = '-9999px';
    element.style.top = '0';
    element.style.width = '1024px';
    element.style.boxShadow = 'none';
    element.style.border = 'none';
    element.style.borderRadius = '0';
    element.style.backgroundColor = 'white';

    // Remover elementos que não devem sair no print
    const noPrintElements = element.querySelectorAll('.no-print');
    noPrintElements.forEach(el => (el as HTMLElement).style.display = 'none');

    // Forçar visibilidade de elementos que só aparecem no print
    const printOnlyElements = element.querySelectorAll('.print\\:block, .hidden.print\\:block');
    printOnlyElements.forEach(el => {
      el.classList.remove('hidden', 'print:block');
      (el as HTMLElement).style.display = 'block';
    });

    const printInlineElements = element.querySelectorAll('.print\\:inline');
    printInlineElements.forEach(el => {
      el.classList.remove('print:inline');
      (el as HTMLElement).style.display = 'inline';
    });

    // Garantir que o logo e imagens sejam carregados
    const images = element.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));

    // Remove truncagens para mostrar o conteúdo completo
    const truncatedElements = element.querySelectorAll('.truncate');
    truncatedElements.forEach(el => {
      el.classList.remove('truncate');
      (el as HTMLElement).style.overflow = 'visible';
      (el as HTMLElement).style.whiteSpace = 'normal';
    });

    document.body.appendChild(element);

    // Pequeno delay para garantir que o navegador processou os estilos do clone
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1024,
        windowWidth: 1024
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const margin = 10;
      const contentWidth = pdfWidth - (2 * margin);
      const ratio = contentWidth / canvasWidth;
      const contentHeight = canvasHeight * ratio;

      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight);

      pdf.save(`RTC_DECOR_${(selectedOrder.contractNumber || selectedOrder.quoteNumber || selectedOrder.id).replace(/\//g, '_')}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      document.body.removeChild(element);
    }
  };

  const handleExportNFe = async () => {
    if (!selectedOrder || !selectedCustomer) return;

    if (selectedOrder.nfeStatus === 'AUTHORIZED') {
      alert("Este pedido já possui uma NF-e Autorizada.");
      return;
    }

    // Verificação de duplicidade conforme solicitado
    if (selectedOrder.nfeNumber || selectedOrder.nfeKey) {
      if (!confirm(`Este pedido já possui dados de exportação (Nº ${selectedOrder.nfeNumber}). Deseja transmitir novamente para o portal?`)) {
        return;
      }
    }

    try {
      // 1. Obter Configurações de Numeração
      const settings = await dataService.getNFeSettings();
      const nNumber = settings.nextNumber;
      const nSeries = settings.currentSeries;

      const items = orderItems;
      const customPrices: Record<string, number> = {};
      items.forEach(item => {
        customPrices[item.id] = calculateItemPrice(item);
      });

      // 2. Enviar para API com número sequencial
      const response = await nfEmailService.sendOrderMethods(
        selectedOrder,
        selectedCustomer,
        items,
        products,
        customPrices,
        nNumber,
        nSeries
      );

      const result = nfEmailService.parseNFeStatus(response);

      // 4. Atualizar Pedido com os dados da nota
      const updatedOrder = {
        ...selectedOrder,
        nfeNumber: nNumber,
        nfeSeries: nSeries,
        nfeKey: result?.chNFe || (response.match(/[0-9]{44}/)?.[0] || selectedOrder.nfeKey),
        nfeStatus: result?.status || 'PENDING',
        nfeMessage: result?.xMotivo || 'Enviada ao Portal'
      } as Order;

      await dataService.saveOrder(updatedOrder);
      onUpdateOrder(updatedOrder);

      // 5. Incrementar Numeração
      await dataService.saveNFeSettings({
        ...settings,
        nextNumber: nNumber + 1
      });

      alert(`NF-e nº ${nNumber} (Série ${nSeries}) enviada com sucesso! ${updatedOrder.nfeKey ? '\nChave: ' + updatedOrder.nfeKey : ''}`);
    } catch (error: any) {
      alert("Erro ao enviar NF-e: " + error.message);
    }
  };

  const handleSyncNFe = async () => {
    if (!selectedOrder) return;

    let currentKey = selectedOrder.nfeKey;

    // Se não houver chave, tentamos recuperar do portal pelo número da nota
    if (!currentKey && selectedOrder.nfeNumber) {
      try {
        const xmlList = await nfEmailService.listNFe(1, 10, '', selectedOrder.nfeNumber.toString());
        const notes = nfEmailService.parseNFeList(xmlList);
        const foundNote = notes.find((n: any) => {
          const portalNum = parseInt(n.number || '0');
          const localNum = parseInt(selectedOrder.nfeNumber?.toString() || '0');
          const portalSeries = n.series ? parseInt(n.series) : null;
          const localSeries = selectedOrder.nfeSeries || 1;
          return portalNum === localNum && (portalSeries === null || portalSeries === localSeries) && portalNum > 0;
        });

        if (foundNote && foundNote.key) {
          currentKey = foundNote.key;
        }
      } catch (e) {
        console.error("Erro ao recuperar chave no Orders:", e);
      }
    }

    if (!currentKey) {
      alert("Não foi possível encontrar a chave de acesso. Verifique se a nota foi enviada corretamente.");
      return;
    }

    try {
      const xmlResponse = await nfEmailService.getNFeStatus(currentKey);
      const result = nfEmailService.parseNFeStatus(xmlResponse);

      if (result) {
        const updatedOrder = {
          ...selectedOrder,
          nfeStatus: result.status,
          nfeKey: result.chNFe || currentKey,
          nfeMessage: result.xMotivo
        } as Order;

        await dataService.saveOrder(updatedOrder);
        onUpdateOrder(updatedOrder);

        if (result.status === 'AUTHORIZED') {
          alert("Nota Autorizada! Agora você pode visualizar o DANFE e imprimir o contrato atualizado.");
        } else {
          alert("Status atualizado: " + result.status + "\n" + (result.xMotivo || ''));
        }
      } else {
        alert("Não foi possível processar a resposta da SEFAZ.");
      }
    } catch (e: any) {
      alert("Erro ao sincronizar: " + e.message);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder || !modalInput) return;
    if (modalInput.length < 15) {
      alert("A justificativa deve ter pelo menos 15 caracteres.");
      return;
    }

    setIsProcessingAction(true);
    try {
      const xmlResponse = await nfEmailService.cancelNFe(selectedOrder.nfeKey!, modalInput);
      const result = nfEmailService.parseNFeStatus(xmlResponse);

      if (result && result.status === 'CANCELED') {
        const updatedOrder = {
          ...selectedOrder,
          nfeStatus: 'CANCELED',
          nfeMessage: result.xMotivo || 'Nota Cancelada'
        } as Order;
        onUpdateOrder(updatedOrder);
        setShowCancelModal(false);
        alert("Nota cancelada com sucesso!");
      } else {
        alert("Falha ao cancelar: " + (result?.xMotivo || "Resposta desconhecida"));
      }
    } catch (error: any) {
      alert("Erro ao processar cancelamento: " + error.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSendCorrection = async () => {
    if (!selectedOrder || !modalInput) return;
    if (modalInput.length < 15) {
      alert("A correção deve ter pelo menos 15 caracteres.");
      return;
    }

    setIsProcessingAction(true);
    try {
      const xmlResponse = await nfEmailService.sendCCe(selectedOrder.nfeKey!, modalInput);
      const result = nfEmailService.parseNFeStatus(xmlResponse);

      // No caso de CC-e, o status da nota continua AUTHORIZED, mas registramos a mensagem
      if (result && (result.cStat === '135' || result.status === 'AUTHORIZED')) {
        const updatedOrder = {
          ...selectedOrder,
          nfeMessage: `CC-e enviada: ${modalInput}`
        } as Order;
        onUpdateOrder(updatedOrder);
        setShowCCeModal(false);
        alert("Carta de Correção enviada com sucesso!");
      } else {
        alert("Falha ao enviar correção: " + (result?.xMotivo || "Resposta desconhecida"));
      }
    } catch (error: any) {
      alert("Erro ao processar correção: " + error.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleChangeCustomer = (newCustomer: Customer) => {
    if (!selectedOrder) return;
    if (confirm(`Deseja realmente transferir este pedido para o cliente ${newCustomer.name}? Medidas e valores permanecerão os mesmos.`)) {
      const updatedOrder = {
        ...selectedOrder,
        customerId: newCustomer.id,
        customerName: newCustomer.name,
        customerPhone: newCustomer.phone
      } as unknown as Order;
      
      onUpdateOrder(updatedOrder);
      setShowCustomerChangeModal(false);
      setSearchTermCustomers('');
    }
  };

  if (selectedOrderId && selectedOrder && selectedCustomer) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 mb-20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 no-print">
          <button onClick={() => setSelectedOrderId(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors">
            <ArrowLeft size={20} /> Voltar para Lista
          </button>
          <div className="flex flex-wrap gap-3">
            <button onClick={(e) => openHistory(e, selectedOrder)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              <Activity size={18} className="text-blue-500" /> Ver Log PCP
            </button>
            <button onClick={() => setShowCustomerChangeModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all shadow-sm">
              <UserCheck size={18} /> Trocar Cliente
            </button>
            <button onClick={handleEditClick} className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              <Edit3 size={18} /> Editar Pedido
            </button>
            <button onClick={() => onDeleteOrder(selectedOrder.id)} className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all shadow-sm">
              <Trash2 size={18} /> Excluir
            </button>
            <button onClick={async () => {
              if (!selectedOrder || !selectedCustomer) return;
              try {
                const issuer = {
                  cnpj: '12655737000121',
                  name: "RTC TOLDOS E PERSIANAS",
                  address: {
                    street: "RUA DO CLIENTE",
                    number: "100",
                    neighborhood: "CENTRO",
                    city: "RIO DE JANEIRO",
                    state: "RJ",
                    cep: "20000000",
                    ibge: "3304557"
                  }
                };
                const items = orderItems;
                const customPrices: Record<string, number> = {};
                items.forEach(item => {
                  customPrices[item.id] = calculateItemPrice(item);
                });

                const txtContent = SEFAZTxtGenerator.generate(selectedOrder, selectedCustomer, items, products, issuer, customPrices);
                const blob = new Blob([txtContent], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `NFe_${selectedOrder.id}.txt`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (e: any) {
                alert("Erro ao gerar TXT: " + e.message);
              }
            }} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all shadow-sm">
              <Download size={18} /> Baixar TXT
            </button>
            <button
              onClick={handleExportNFe}
              disabled={selectedOrder.nfeStatus === 'AUTHORIZED'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all ${selectedOrder.nfeStatus === 'AUTHORIZED'
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                }`}
            >
              <FileDown size={18} />
              {selectedOrder.nfeStatus === 'AUTHORIZED' ? 'NFe Autorizada' : 'Exportar NF-e'}
            </button>

            {selectedOrder.nfeKey && (
              <a
                href={nfEmailService.getDANFEUrl(selectedOrder.nfeKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-all shadow-sm"
              >
                <ExternalLink size={18} /> Ver DANFE
              </a>
            )}

            {selectedOrder.nfeNumber && (
              <div className="flex items-center gap-2">
                {selectedOrder.nfeStatus === 'AUTHORIZED' && selectedOrder.nfeKey && (
                  <>
                    <button
                      onClick={() => {
                        setModalInput('');
                        setShowCCeModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                      title="Carta de Correção (CC-e)"
                    >
                      <FileEdit size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setModalInput('');
                        setShowCancelModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="Cancelar NF-e"
                    >
                      <Ban size={18} />
                    </button>
                  </>
                )}
                <button
                  onClick={handleSyncNFe}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Sincronizar Status"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            )}

            <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all shadow-sm active:scale-95">
              <FileDown size={18} /> Exportar PDF
            </button>
            <button onClick={() => handleGeneratePrint(true)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              <Printer size={18} /> Imprimir / PDF
            </button>
            <button 
              onClick={() => {
                const initialInputs: Record<string, string> = {};
                selectedOrder.installments?.forEach(inst => {
                  initialInputs[inst.id] = inst.cvCode || '';
                });
                setCvInputs(initialInputs);
                setShowCVModal(true);
              }} 
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-all shadow-sm active:scale-95"
            >
              <DocIcon size={18} /> Informar CV
            </button>
          </div>
        </div>

        {/* Layout de Pedido (Visível na tela e usado para Impressão) */}
        <OrderContractPrint 
          ref={printRef}
          order={selectedOrder}
          customers={customers}
          sellers={sellers}
          products={products}
          technicalSheets={technicalSheets}
          showActions={true}
          isGenerating={isGenerating}
          onGeneratePayment={handleGeneratePaymentForInstallment}
          onWhatsAppShare={handleWhatsAppManualShare}
          onCopyValue={handleCopyValue}
        />



        {/* Modal de Edição */}
        {showEditModal && editingOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-900">Editar Detalhes do Pedido {editingOrder.id}</h3>
                <button onClick={() => setShowEditModal(false)} className="p-2 text-slate-400 hover:text-rose-500"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Pedido</h4>
                    <input
                      type="date"
                      value={new Date(editingOrder.createdAt).toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        newDate.setHours(12, 0, 0, 0);
                        setEditingOrder({ ...editingOrder, createdAt: newDate });
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg font-bold text-blue-600 px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <hr className="border-slate-100" />

                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade de Recebimento</h4>
                    <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">Total: R$ {(editingOrder.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 font-black text-slate-500 uppercase">Parc.</th>
                          <th className="px-4 py-2 font-black text-slate-500 uppercase text-right">Valor (R$)</th>
                          <th className="px-4 py-2 font-black text-slate-500 uppercase text-center">Pagamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {editingOrder.installments?.map((inst: Installment, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-bold text-slate-400">
                              {String(inst.number).padStart(2, '0')}/{String(editingOrder.installments?.length || 1).padStart(2, '0')}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <CurrencyInput
                                value={inst.value}
                                onChange={(val) => handleUpdateInstallment(idx, 'value', val)}
                                className="justify-end bg-blue-50/50 p-1.5 rounded-lg border border-transparent focus-within:border-blue-300 transition-all"
                              />
                            </td>
                            <td className="px-4 py-2 text-center text-[10px]">
                              <input
                                type="date"
                                value={inst.paymentDate || ''}
                                onChange={(e) => handleUpdateInstallment(idx, 'paymentDate', e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-600 px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200 text-[10px]">
                        <tr>
                          <td colSpan={1} className="px-4 py-2 text-right font-black text-slate-500 uppercase">Soma:</td>
                          <td className={`px-4 py-2 text-right font-black ${Math.abs((editingOrder.installments?.reduce((acc: number, curr: Installment) => acc + (parseFloat(curr.value.toString()) || 0), 0) || 0) - editingOrder.totalValue) > 0.01 ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                            R$ {(editingOrder.installments?.reduce((acc: number, curr: Installment) => acc + (parseFloat(curr.value.toString()) || 0), 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {Math.abs((editingOrder.installments?.reduce((acc: number, curr: Installment) => acc + (parseFloat(curr.value.toString()) || 0), 0) || 0) - editingOrder.totalValue) > 0.01 && (
                    <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-1 px-1">
                      <X size={12} /> A soma das parcelas deve ser R$ {(editingOrder.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preços dos Itens (Ajuste Estático)</h4>
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-200">
                      {orderItems.map((item: MeasurementItem) => (
                        <div key={item.id} className="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-blue-600 uppercase truncate">{item.environment}</p>
                            <p className="text-[11px] font-bold text-slate-900 truncate">
                              {products.find((p: Product) => p.id === item.productId)?.nome || 'Item Personalizado'}
                            </p>
                            <p className="text-[9px] text-slate-500 font-medium">
                              {item.width.toFixed(3)}m x {item.height.toFixed(3)}m {item.color ? ` | ${item.color}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <CurrencyInput
                              value={editingOrder.itemPrices?.[item.id] ?? calculateItemPrice(item)}
                              onChange={(val) => handleUpdateItemPrice(item.id, val)}
                              className="bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-inner focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all"
                            />
                            <span className="text-[8px] text-slate-400 font-bold uppercase">Preço Unitário</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pagamento</label>
                    <input
                      value={editingOrder.paymentMethod || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, paymentMethod: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status Operacional</label>
                    <select
                      value={editingOrder.status}
                      onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                    >
                      {Object.values(OrderStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Observações do Contrato (Impressão)</label>
                  <textarea
                    value={editingOrder.contractObservations || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, contractObservations: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none resize-none"
                    placeholder="Estas observações aparecerão no contrato impresso..."
                  />
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                  <button onClick={saveEdits} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all">Salvar Alterações</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Trocar Cliente - Movido para dentro do detalhe para funcionar */}
        {showCustomerChangeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[700] flex items-center justify-center p-4 no-print">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Trocar Cliente</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Pedido: {selectedOrder?.contractNumber || selectedOrder?.id}</p>
                </div>
                <button 
                  onClick={() => { setShowCustomerChangeModal(false); setSearchTermCustomers(''); }} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar novo cliente..."
                    value={searchTermCustomers}
                    onChange={(e) => setSearchTermCustomers(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                    autoFocus
                  />
                </div>

                <div className="overflow-y-auto max-h-[40vh] space-y-2 pr-2 custom-scrollbar">
                  {customers
                    .filter(c => 
                      c.name.toLowerCase().includes(searchTermCustomers.toLowerCase()) || 
                      c.document.includes(searchTermCustomers)
                    )
                    .slice(0, 20)
                    .map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => handleChangeCustomer(customer)}
                        className="w-full p-4 flex items-center justify-between bg-white border border-slate-100 rounded-2xl hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
                      >
                        <div>
                          <p className="font-black text-slate-800 group-hover:text-amber-700 transition-colors uppercase text-xs">{customer.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{customer.document}</p>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-amber-500 transition-all" size={18} />
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pedidos Confirmados</h2>
          <p className="text-slate-500">Gestão de contratos fechados e em andamento.</p>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div
          className="flex items-center justify-between cursor-pointer md:cursor-default"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-2 text-blue-600">
            <Filter size={18} />
            <h3 className="text-sm font-black uppercase tracking-widest">Filtros Avançados</h3>
          </div>
          <div className="md:hidden">
            <ChevronRight size={20} className={`text-slate-400 transition-transform ${showFilters ? 'rotate-90' : ''}`} />
          </div>
        </div>

        <div className={`${showFilters ? 'block' : 'hidden'} md:block space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="ID ou Cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
            </div>

            <select value={filterSellerId} onChange={(e) => setFilterSellerId(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium">
              <option value="">Todos os Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <input type="text" placeholder="Bairro..." value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
            <input type="text" placeholder="Endereço..." value={filterAddress} onChange={(e) => setFilterAddress(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="Telefone..." value={filterPhone} onChange={(e) => setFilterPhone(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
            <input type="text" placeholder="CPF/Documento..." value={filterCPF} onChange={(e) => setFilterCPF(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />

            <div className="flex items-center gap-2 md:col-span-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">De</span>
                <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-600" />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Até</span>
                <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-black uppercase tracking-widest text-[9px]">
                <th className="px-4 py-4">ID / Data</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Contato / Doc</th>
                <th className="px-4 py-4">Localização</th>
                <th className="px-4 py-4">Vendedor</th>
                <th className="px-4 py-4 text-right">Total</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 italic font-bold">
                    Nenhum pedido encontrado com estes filtros.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: Order) => {
                  const customer = customers.find((c: Customer) => c.id === order.customerId);
                  const seller = sellers.find((s: Seller) => s.id === order.sellerId);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedOrderId(order.id)}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="font-black text-blue-600">
                          {order.contractNumber || order.quoteNumber || order.id}
                        </p>
                        <p className="text-[10px] text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-4 font-black text-slate-900 uppercase">{customer?.name}</td>
                      <td className="px-4 py-4">
                        <p className="flex items-center gap-1.5"><Phone size={10} className="text-blue-500" /> {customer?.phone}</p>
                        <p className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold"><DocIcon size={10} /> {customer?.document}</p>
                      </td>
                      <td className="px-4 py-4 max-w-[200px]">
                        <p className="truncate"><PinIcon size={10} className="inline mr-1 text-slate-400" /> {customer?.address.neighborhood}</p>
                        <p className="truncate text-[10px] text-slate-400 font-bold">{customer?.address.street}, {customer?.address.number}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                            {seller?.name.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-700">{seller?.name || 'Vendedor RTC'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full uppercase tracking-tighter border border-emerald-100">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center items-center gap-2">
                          <button onClick={(e: React.MouseEvent) => openHistory(e, order)} className="p-2 text-slate-400 hover:text-blue-600 transition-all" title="Histórico PCP"><Activity size={16} /></button>
                          
                          {/* Quick Payment Action */}
                          {(() => {
                             const firstPending = order.installments?.find(i => i.status !== 'PAID' && (i.paymentMethod?.toUpperCase() === 'PIX'));
                             if (!firstPending) return null;
                             
                             if (firstPending.paymentLink || firstPending.pixCopyPaste) {
                                return (
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleWhatsAppManualShare(firstPending, order); }}
                                      className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                      title="Enviar cobrança via WhatsApp"
                                   >
                                      <MessageCircle size={16} />
                                   </button>
                                );
                             }
                             
                             return (
                                <button 
                                   onClick={(e) => { e.stopPropagation(); handleGeneratePaymentForInstallment(firstPending, order); }}
                                   disabled={isGenerating === `${order.id}-${firstPending.id}`}
                                   className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-50"
                                   title="Gerar PIX (Atalho)"
                                >
                                   {isGenerating === `${order.id}-${firstPending.id}` ? <RefreshCw size={14} className="animate-spin" /> : <CreditCardIcon size={16} />}
                                </button>
                             );
                          })()}

                          <ChevronRight className="text-slate-300 group-hover:text-blue-600" size={18} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 p-4">
          {filteredOrders.length === 0 ? (
            <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 italic px-4">
              Nenhum pedido encontrado.
            </div>
          ) : (
            filteredOrders.map((order: Order) => {
              const customer = customers.find((c: Customer) => c.id === order.customerId);
              const seller = sellers.find((s: Seller) => s.id === order.sellerId);
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3">
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                      {order.status}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase border border-blue-100">
                          {order.contractNumber || order.quoteNumber || order.id}
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={12} />
                          <span className="text-[11px] font-bold">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <h3 className="font-black text-slate-900 uppercase text-base leading-tight pr-20">{customer?.name}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <div className="p-1.5 bg-white text-blue-500 rounded-lg shadow-sm border border-slate-100">
                          <PinIcon size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bairro</p>
                          <p className="text-[11px] font-bold text-slate-700 truncate">{customer?.address.neighborhood || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                        <div className="p-1.5 bg-white text-emerald-500 rounded-lg shadow-sm border border-slate-100">
                          <Phone size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contato</p>
                          <p className="text-[11px] font-bold text-slate-700 truncate">{customer?.phone || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total do Pedido</p>
                        <p className="text-lg font-black text-slate-900 tracking-tight">R$ {(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick Payment Action Mobile */}
                        {(() => {
                           const firstPending = order.installments?.find(i => i.status !== 'PAID' && (i.paymentMethod?.toUpperCase() === 'PIX'));
                           if (!firstPending) return null;
                           
                           if (firstPending.paymentLink || firstPending.pixCopyPaste) {
                              return (
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppManualShare(firstPending, order); }}
                                    className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm active:scale-90 transition-transform"
                                    title="Enviar via WhatsApp"
                                 >
                                    <MessageCircle size={18} />
                                 </button>
                              );
                           }
                           
                           return (
                              <button 
                                 onClick={(e) => { e.stopPropagation(); handleGeneratePaymentForInstallment(firstPending, order); }}
                                 disabled={isGenerating === `${order.id}-${firstPending.id}`}
                                 className="w-10 h-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm active:scale-90 transition-transform disabled:opacity-50"
                                 title="Gerar PIX"
                              >
                                 {isGenerating === `${order.id}-${firstPending.id}` ? <RefreshCw size={16} className="animate-spin" /> : <CreditCardIcon size={18} />}
                              </button>
                           );
                        })()}

                        <button
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); openHistory(e, order); }}
                          className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm active:scale-90 transition-transform"
                          title="Ver PCP"
                        >
                          <Activity size={18} />
                        </button>
                        <div className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-2xl shadow-lg active:scale-90 transition-transform">
                          <ChevronRight size={20} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de Histórico de Produção (Linha do Tempo) */}
      {showHistoryModal && historyOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Histórico de Produção PCP</h3>
                  <p className="text-xs text-slate-500">
                    {historyOrder.contractNumber || historyOrder.quoteNumber || historyOrder.id}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-0 max-h-[70vh] overflow-y-auto">
              {historyOrder.productionHistory && historyOrder.productionHistory.length > 0 ? (
                <div className="space-y-0 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-100">
                  {historyOrder.productionHistory.map((entry: any, idx: number) => {
                    const nextEntry = historyOrder.productionHistory![idx + 1];
                    const duration = nextEntry
                      ? formatDuration(new Date(nextEntry.timestamp).getTime() - new Date(entry.timestamp).getTime())
                      : null;

                    return (
                      <div key={idx} className="relative pl-10 pb-8">
                        {/* Marcador Circular */}
                        <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-blue-600 z-10"></div>

                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-blue-100 hover:bg-white transition-all">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{entry.stage}</h4>
                            <span className="text-[10px] font-black text-blue-500 bg-white px-2 py-0.5 rounded-full border border-blue-100">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Início: {new Date(entry.timestamp).toLocaleTimeString()}</p>

                          {duration && (
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                              <Clock size={12} /> Tempo decorrido: {duration}
                            </div>
                          )}
                          {!nextEntry && historyOrder.status !== OrderStatus.FINISHED && (
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse">
                              <Clock size={12} /> Em andamento nesta etapa...
                            </div>
                          )}
                        </div>

                        {/* Seta de Transição */}
                        {nextEntry && (
                          <div className="absolute left-3.5 bottom-0 h-8 flex items-center justify-center -mb-4">
                            <ArrowDown size={14} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center opacity-40">
                  <Clock size={48} className="mx-auto mb-4 text-slate-200" />
                  <p className="font-medium italic text-slate-500">Nenhum histórico de produção registrado.</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors shadow-sm"
              >
                Fechar Histórico
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Cancelamento de NFe */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg">
                  <Ban size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Cancelar NF-e</h3>
                  <p className="text-xs text-slate-500">Nota Nº {selectedOrder.nfeNumber}</p>
                </div>
              </div>
              <button onClick={() => setShowCancelModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-700">
                <Info size={20} className="shrink-0" />
                <p className="text-xs font-medium">O cancelamento é irreversível. Certifique-se de que a justificativa seja clara e objetiva.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Justificativa (mín. 15 caracteres)</label>
                <textarea
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all resize-none"
                  placeholder="Ex: Erro nos valores dos produtos ou desistência do cliente conforme solicitação..."
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isProcessingAction || modalInput.length < 15}
                className="flex-[2] py-3 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessingAction ? <RefreshCw size={18} className="animate-spin" /> : <Ban size={18} />}
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carta de Correção (CC-e) */}
      {showCCeModal && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-lg">
                  <FileEdit size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Carta de Correção</h3>
                  <p className="text-xs text-slate-500">Nota Nº {selectedOrder.nfeNumber}</p>
                </div>
              </div>
              <button onClick={() => setShowCCeModal(false)} className="p-2 text-slate-400 hover:text-amber-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-blue-700">
                <Info size={20} className="shrink-0" />
                <p className="text-xs font-medium">Use a CC-e para corrigir erros pontuais que não alterem valores, datas ou dados do destinatário.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Correção (mín. 15 caracteres)</label>
                <textarea
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                  placeholder="Descreva aqui o que deve ser corrigido na nota..."
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowCCeModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleSendCorrection}
                disabled={isProcessingAction || modalInput.length < 15}
                className="flex-[2] py-3 bg-amber-500 text-white rounded-2xl text-sm font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessingAction ? <RefreshCw size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
                Enviar Correção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Informar CV */}
      {showCVModal && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-lg">
                  <DocIcon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Informar CV</h3>
                  <p className="text-xs text-slate-500">Contrato Nº {selectedOrder.contractNumber || selectedOrder.id}</p>
                </div>
              </div>
              <button onClick={() => setShowCVModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-700">
                <Info size={20} className="shrink-0" />
                <p className="text-xs font-medium">Informe o código CV (Comprovante de Venda) da maquininha para cada parcela paga fisicamente.</p>
              </div>
              
              <div className="space-y-3">
                {selectedOrder.installments?.map((inst, idx) => (
                  <div key={inst.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parcela {inst.number} - R$ {inst.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      {inst.status === 'PAID' && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">PAGA</span>}
                    </div>
                    <input
                      type="text"
                      value={cvInputs[inst.id] || ''}
                      onChange={(e) => setCvInputs({ ...cvInputs, [inst.id]: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                      placeholder="Digite o código CV..."
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setShowCVModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setIsProcessingAction(true);
                  try {
                    const updatedInstallments = selectedOrder.installments?.map(inst => ({
                      ...inst,
                      cvCode: cvInputs[inst.id]
                    }));
                    await onUpdateOrder({ ...selectedOrder, installments: updatedInstallments });
                    setShowCVModal(false);
                  } catch (e: any) {
                    alert("Erro ao salvar CVs: " + e.message);
                  } finally {
                    setIsProcessingAction(false);
                  }
                }}
                disabled={isProcessingAction}
                className="flex-[2] py-3 bg-rose-600 text-white rounded-2xl text-sm font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2"
              >
                {isProcessingAction ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                Salvar Códigos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
