import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UserRole, Seller, Customer, Appointment, TechnicalSheet, Order, OrderStatus, ProductionStage, Product, SystemUser, SellerBlockedSlot, Installer, FinancialTransaction, AccountCategory, TimeEntry, RawMaterial, RawMaterialMovement } from './types';
import { MENU_ITEMS } from './constants';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Sellers from './pages/Sellers';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Schedule from './pages/Schedule';
import PCP from './pages/PCP';
import MeasurementForm from './pages/MeasurementForm';
import Quotes from './pages/Quotes';
import Orders from './pages/Orders';
import Installations from './pages/Installations';
import Finance from './pages/Finance';
import QuickQuote from './pages/QuickQuote';
import Commissions from './pages/Commissions';
import Expenses from './pages/Expenses';
import Login from './pages/Login';
import TeamRegistration from './pages/TeamRegistration';
import Agenda from './pages/Agenda';
import Installers from './pages/Installers';
import NFeManagement from './pages/NFeManagement';
import Buyer from './pages/Buyer';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';
import SalesReport from './pages/SalesReport';
import ApiConfig from './pages/ApiConfig';
import InstallerPortal from './pages/InstallerPortal';
import RawMaterialStock from './pages/RawMaterialStock';
import IAManager from './pages/IAManager';

import { Search, LogOut, User as UserIcon, Menu as MenuIcon, RefreshCw, ShoppingCart, Clock } from 'lucide-react';
import { dataService } from './services/dataService';
import { googleCalendarService, GoogleCalendarEvent } from './services/googleCalendarService';

const getLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Singleton lock para evitar loops globais em dev e prod
let isGlobalSyncing = false;
let lastGlobalSyncTime = 0;

const App = () => {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(() => {
    const saved = localStorage.getItem('rtc_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [technicalSheets, setTechnicalSheets] = useState<TechnicalSheet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<SellerBlockedSlot[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [financialTransactions, setFinancialTransactions] = useState<FinancialTransaction[]>([]);
  const [accountCategories, setAccountCategories] = useState<AccountCategory[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [systemSettings, setSystemSettings] = useState<{ id: string, key: string, value: string }[]>([]);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState<TechnicalSheet | null>(null);
  const [lastGeneratedQuoteId, setLastGeneratedQuoteId] = useState<string | null>(null);
  const [selectedOrderIdForTab, setSelectedOrderIdForTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load initial data from Supabase
  const loadData = useCallback(async (isAuto = false) => {
    if (isGlobalSyncing) return;

    // Bloqueia múltiplas chamadas rápidas (proteção contra loops de foco/mount)
    const now = Date.now();
    if (now - lastGlobalSyncTime < 10000) return;

    isGlobalSyncing = true;
    lastGlobalSyncTime = now;

    if (isAuto) setIsSyncing(true);

    try {
      const [dbSellers, dbCustomers, dbProducts, dbAppointments, dbOrders, dbUsers, dbTechnicalSheets, dbBlockedSlots, dbInstallers, dbFinancialTransactions, dbAccountCategories, dbSystemSettings, dbTimeEntries, dbRawMaterials] = await Promise.all([
        dataService.getSellers(),
        dataService.getCustomers(),
        dataService.getProducts(),
        dataService.getAppointments(),
        dataService.getOrders(),
        dataService.getSystemUsers(),
        dataService.getTechnicalSheets(),
        dataService.getBlockedSlots(),
        dataService.getInstallers(),
        dataService.getFinancialTransactions(),
        dataService.getAccountCategories(),
        dataService.getSystemSettings(),
        dataService.getTimeEntries(),
        dataService.getRawMaterials()
      ]);

      setSellers(dbSellers);
      setCustomers(dbCustomers);
      setProducts(dbProducts);
      setSystemUsers(dbUsers);
      setAppointments(dbAppointments);
      setOrders(dbOrders);
      setTechnicalSheets(dbTechnicalSheets);
      setBlockedSlots(dbBlockedSlots);
      setInstallers(dbInstallers);
      setTimeEntries(dbTimeEntries);
      setFinancialTransactions(dbFinancialTransactions);
      setAccountCategories(dbAccountCategories);
      setSystemSettings(dbSystemSettings);
      setRawMaterials(dbRawMaterials);
      setLastSync(new Date());

      // Se ainda não houver usuários (primeiro acesso), criar o MASTER
      if (dbUsers.length === 0) {
        const master: SystemUser = { id: crypto.randomUUID(), name: 'Administrador Master', login: 'Master', password: '123', role: UserRole.ADMIN, active: true };
        dataService.saveSystemUser(master).then((saved: SystemUser) => setSystemUsers([saved]));
      }
    } catch (err) {
      console.error("Failed to load data from Supabase:", err);
    } finally {
      isGlobalSyncing = false;
      setIsSyncing(false);
      setLoading(false);
    }
  }, []);

  const handleUpdateSystemSetting = async (key: string, value: string) => {
    try {
      await dataService.updateSystemSetting(key, value);
      loadData(true);
    } catch (err) {
      alert("Erro ao atualizar configuração");
    }
  };

  useEffect(() => {
    // Fix legacy non-UUID IDs if they persist in localStorage
    if (currentUser?.id === 'm1' || currentUser?.id === 'admin-master') {
      setCurrentUser(null);
      localStorage.removeItem('rtc_user');
    }
    loadData();
  }, [loadData, currentUser?.id]);

  // Persistir usuário logado
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('rtc_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('rtc_user');
    }
  }, [currentUser]);

  // Auto-Sync: Intervalo (Sincronização em segundo plano)
  useEffect(() => {
    if (!currentUser) return;

    // Refresh a cada 5 minutos
    const interval = setInterval(() => {
      loadData(true);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [currentUser, loadData]);

  const filteredMenu = useMemo(() => {
    return MENU_ITEMS.filter((item: any) => {
      if (!currentUser) return false;

      // Usuário MASTER tem acesso a tudo sempre
      if (currentUser.login === 'Master') return true;

      // Se o usuário tiver permissões específicas definidas no cadastro dele
      if (currentUser.permissions && currentUser.permissions.length > 0) {
        return currentUser.permissions.includes(item.id);
      }

      // Fallback: Se for antigo e não tiver array de permissions, usa a ROLE
      return item.roles.includes(currentUser.role);
    });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && !filteredMenu.some((item: any) => item.id === activeTab)) {
      setActiveTab(filteredMenu[0]?.id || 'dashboard');
    }
  }, [currentUser, activeTab, filteredMenu]);

  const handleAddUser = async (user: SystemUser) => {
    try {
      const saved = await dataService.saveSystemUser(user);
      setSystemUsers([...systemUsers, saved]);
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar usuário: " + (err.message || err));
    }
  };

  const handleUpdateUser = async (user: SystemUser) => {
    try {
      await dataService.saveSystemUser(user);
      setSystemUsers((prev: SystemUser[]) => prev.map((u: SystemUser) => u.id === user.id ? user : u));
      loadData(true);
    } catch (err) {
      alert("Erro ao atualizar usuário");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm("Remover este acesso?")) {
      try {
        await dataService.deleteSystemUser(id);
        setSystemUsers((prev: SystemUser[]) => prev.filter((u: SystemUser) => u.id !== id));
        loadData(true);
      } catch (err) {
        alert("Erro ao remover usuário");
      }
    }
  };

  // Sincronização de Vendedor -> Usuário do Sistema
  const handleAddSeller = async (s: Seller) => {
    try {
      const saved = await dataService.saveSeller(s);
      setSellers([...sellers, saved]);
      const newUser: SystemUser = {
        id: crypto.randomUUID(),
        name: s.name,
        login: s.login || '',
        password: s.password || '',
        role: UserRole.SELLER,
        active: true,
        sellerId: s.id,
        permissions: ['quick-quote', 'my-schedule', 'measurements', 'quotes', 'orders', 'tarefas', 'gerente-ia']
      };
      const savedUser = await dataService.saveSystemUser(newUser);
      setSystemUsers((prev: SystemUser[]) => [...prev, savedUser]);
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar vendedor: " + (err.message || err));
    }
  };

  const handleUpdateSeller = async (s: Seller) => {
    try {
      await dataService.saveSeller(s);
      setSellers((prev: Seller[]) => prev.map((item: Seller) => item.id === s.id ? s : item));
      setSystemUsers((prev: SystemUser[]) => prev.map((u: SystemUser) => {
        if (u.sellerId === s.id) {
          return { ...u, name: s.name, login: s.login || u.login, password: s.password || u.password };
        }
        return u;
      }));
      loadData(true);
    } catch (err) {
      alert("Erro ao atualizar vendedor");
    }
  };

  const handleStartMeasurement = (customerId: string) => {
    setPreselectedCustomerId(customerId);
    setEditingSheet(null);
    setActiveTab('measurements');
  };

  const handleEditSheet = (sheet: TechnicalSheet) => {
    setEditingSheet(sheet);
    setPreselectedCustomerId(sheet.customerId);
    setActiveTab('measurements');
  };

  const handleSelectCustomer = (customerId: string) => {
    setPreselectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleGenerateQuote = (sheet: TechnicalSheet, selectedItemIds?: string[]) => {
    if (!sheet || !sheet.items || sheet.items.length === 0) return;
    const activeItems = selectedItemIds ? sheet.items.filter((item: any) => selectedItemIds.includes(item.id)) : sheet.items;
    if (activeItems.length === 0) return;

    const total = activeItems.reduce((acc: number, item: any) => {
      const p = products.find((prod: Product) => prod.id === item.productId);
      if (!p) return acc;
      const area = (item.width * item.height) || 1;
      return acc + (p.unidade === 'M2' ? p.valor * area : p.valor);
    }, 0);

    const quoteId = `PROP-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: quoteId, customerId: sheet.customerId, technicalSheetId: sheet.id, sellerId: sheet.sellerId,
      itemIds: selectedItemIds, status: OrderStatus.QUOTE_SENT, totalValue: total, createdAt: new Date()
    };

    dataService.saveOrder(newOrder).then(saved => {
      setOrders((prev: Order[]) => [...prev, saved]);
      loadData(true);
      setTimeout(() => {
        setLastGeneratedQuoteId(quoteId);
        setActiveTab('quotes');
      }, 50);
    }).catch(err => alert("Erro ao gerar orçamento"));
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    try {
      const saved = await dataService.saveOrder(updatedOrder);
      setOrders((prev: Order[]) => {
        const exists = prev.some((o: Order) => o.id === saved.id);
        if (exists) {
          return prev.map((o: Order) => o.id === saved.id ? saved : o);
        }
        return [...prev, saved];
      });
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar/atualizar pedido: " + (err.message || err));
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm("Remover este pedido?")) {
      try {
        await dataService.deleteOrder(orderId);
        setOrders((prev: Order[]) => prev.filter((o: Order) => o.id !== orderId));
        loadData(true);
      } catch (err) {
        alert("Erro ao remover pedido");
      }
    }
  };

  const handleAddProduct = async (p: Product) => {
    try {
      const saved = await dataService.saveProduct(p);
      setProducts([...products, saved]);
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar produto: " + (err.message || err));
    }
  };

  const handleUpdateProduct = async (p: Product) => {
    try {
      await dataService.saveProduct(p);
      setProducts((prev: Product[]) => prev.map((item: Product) => item.id === p.id ? p : item));
      loadData(true);
    } catch (err) {
      alert("Erro ao atualizar produto");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await dataService.deleteProduct(id);
      setProducts((prev: Product[]) => prev.filter((p: Product) => p.id !== id));
      loadData(true);
    } catch (err) {
      alert("Erro ao deletar produto");
    }
  };

  const handleAddCustomer = async (c: Customer): Promise<Customer | null> => {
    try {
      if (currentUser) {
        c.createdBy = currentUser.id;
      }
      const saved = await dataService.saveCustomer(c);
      setCustomers([...customers, saved]);
      loadData(true);
      return saved;
    } catch (err: any) {
      alert("Erro ao salvar cliente: " + (err.message || err));
      return null;
    }
  };

  const handleUpdateCustomer = async (c: Customer) => {
    try {
      await dataService.saveCustomer(c);
      setCustomers((prev: Customer[]) => prev.map((item: Customer) => item.id === c.id ? c : item));
      loadData(true);
    } catch (err) {
      alert("Erro ao atualizar cliente");
    }
  };

  const handleAddAppointment = async (a: Appointment) => {
    try {
      const saved = await dataService.saveAppointment(a);
      setAppointments([...appointments, saved]);
      loadData(true);

      // --- Auto Google Calendar Sync ---
      const scriptUrl = systemSettings.find(s => s.key === 'google_apps_script_url')?.value;
      if (scriptUrl && saved.type !== 'INSTALLATION') {
        const customer = customers.find(c => c.id === saved.customerId);
        const seller = sellers.find(s => s.id === saved.sellerId);

        if (seller?.email) {
          const startDateTime = new Date(`${saved.date}T${saved.time}:00`);
          const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1h default

          const event: GoogleCalendarEvent = {
            title: `${saved.type === 'MEASUREMENT' ? 'MEDIÇÃO' : 'VISITA'}: ${customer?.name || 'Cliente'}`,
            description: `Agendamento via RTC\nCliente: ${customer?.name}\nTelefone: ${customer?.phone}\nEndereço: ${customer?.address ? `${customer.address.street}, ${customer.address.number}${customer.address.complement ? ` - ${customer.address.complement}` : ''} - ${customer.address.neighborhood}, ${customer.address.city}` : 'Não informado'}\nObservações: ${saved.notes || 'Nenhuma'}`,
            location: customer?.address ? `${customer.address.street}, ${customer.address.number}${customer.address.complement ? ` - ${customer.address.complement}` : ''} - ${customer.address.neighborhood}, ${customer.address.city}` : '',
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            sellerEmail: seller.email
          };

          googleCalendarService.syncAppointment(event, scriptUrl).catch(err => {
            console.error("Erro na auto-sincronização Google:", err);
          });
        }
      }
    } catch (err) {
      alert("Erro ao salvar agendamento");
    }
  };

  const handleSaveTechnicalSheet = async (sheet: TechnicalSheet) => {
    try {
      const saved = await dataService.saveTechnicalSheet(sheet);
      setTechnicalSheets((prev: TechnicalSheet[]) => {
        const exists = prev.some((s: TechnicalSheet) => s.id === saved.id);
        return exists ? prev.map((s: TechnicalSheet) => s.id === saved.id ? saved : s) : [...prev, saved];
      });
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar ficha técnica: " + (err.message || err));
    }
  };

  const handleDeleteTechnicalSheet = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta medição? Todos os itens dela serão removidos.")) {
      try {
        await dataService.deleteTechnicalSheet(id);
        setTechnicalSheets((prev: TechnicalSheet[]) => prev.filter((s: TechnicalSheet) => s.id !== id));
        loadData(true);
      } catch (err: any) {
        alert("Erro ao excluir medição: " + (err.message || err));
      }
    }
  };

  const handleAddInstaller = async (i: Installer) => {
    try {
      const saved = await dataService.saveInstaller(i);
      setInstallers([...installers, saved]);
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar instalador: " + (err.message || err));
    }
  };

  const handleUpdateInstaller = async (i: Installer) => {
    try {
      await dataService.saveInstaller(i);
      setInstallers((prev: Installer[]) => prev.map((item: Installer) => item.id === i.id ? i : item));
      loadData(true);
    } catch (err: any) {
      console.error("Failed to update installer:", err);
      alert("Erro ao atualizar instalador: " + (err.message || err));
    }
  };

  const handleDeleteInstaller = async (id: string) => {
    try {
      await dataService.deleteInstaller(id);
      setInstallers((prev: Installer[]) => prev.filter((i: Installer) => i.id !== id));
      loadData(true);
    } catch (err) {
      alert("Erro ao excluir instalador");
    }
  };

  const handleAddBlockedSlot = async (slot: SellerBlockedSlot) => {
    try {
      const saved = await dataService.saveBlockedSlot(slot);
      setBlockedSlots((prev) => [...prev, saved]);
      loadData(true);
    } catch (err) {
      alert("Erro ao salvar bloqueio de horário");
    }
  };

  const handleDeleteBlockedSlot = async (id: string) => {
    try {
      await dataService.deleteBlockedSlot(id);
      setBlockedSlots((prev) => prev.filter(s => s.id !== id));
      loadData(true);
    } catch (err) {
      alert("Erro ao remover bloqueio de horário");
    }
  };

  const handleSaveFinancialTransaction = async (t: FinancialTransaction) => {
    try {
      await dataService.saveFinancialTransaction(t);
      loadData(true);
    } catch (err: any) {
      alert("Erro ao salvar transação financeira: " + (err.message || err));
    }
  };

  const handleDeleteFinancialTransaction = async (id: string) => {
    if (window.confirm("Remover este lançamento permanentemente?")) {
      try {
        await dataService.deleteFinancialTransaction(id);
        loadData(true);
      } catch (err) {
        alert("Erro ao remover lançamento");
      }
    }
  };

  // --- Filtering Logic for Roles ---
  const getFilteredData = () => {
    // Admin, Attendant, Production sees everything
    const rolesWithFullAccess = [UserRole.ADMIN, UserRole.ATTENDANT, UserRole.FINANCE, UserRole.PRODUCTION, UserRole.BUYER];
    if (!currentUser || rolesWithFullAccess.includes(currentUser.role) || !currentUser.sellerId) {
      return {
        viewOrders: orders,
        viewTechnicalSheets: technicalSheets,
        viewAppointments: appointments,
        viewCustomers: customers
      };
    }

    // Role == SELLER: Filter by sellerId
    let sellerId = currentUser.sellerId;

    // Fallback: Try to find seller by name/login if sellerId is missing (Legacy Data Fix)
    if (!sellerId) {
      const found = sellers.find(s => s.name === currentUser.name || (s.login && s.login === currentUser.login));
      if (found) {
        sellerId = found.id;
      }
    }

    if (!sellerId) {
      return { viewOrders: [], viewTechnicalSheets: [], viewAppointments: [], viewCustomers: [] };
    }

    const viewOrders = orders.filter(o => o.sellerId === sellerId);
    const viewTechnicalSheets = technicalSheets.filter(t => t.sellerId === sellerId);
    const viewAppointments = appointments.filter(a => a.sellerId === sellerId);

    // Customers: anyone who has a Quote, Order or Appointment with this seller, OR they registered
    const customerIds = new Set<string>();
    viewOrders.forEach(o => customerIds.add(o.customerId));
    viewTechnicalSheets.forEach(t => customerIds.add(t.customerId));
    viewAppointments.forEach(a => customerIds.add(a.customerId));

    const todayStr = new Date().toISOString().split('T')[0];

    const viewCustomers = customers.filter(c => {
      // Rule 1: Assigned to seller via Order/Appointment
      if (customerIds.has(c.id)) return true;
      
      // Rule 2: Registered by this seller
      if (c.createdBy === currentUser.id) return true;

      // Rule 3: Created today (fallback/new lead)
      const dateRaw = c.createdAt || (c as any).created_at;
      if (dateRaw) {
        const createdDateStr = typeof dateRaw === 'string' ? dateRaw.substring(0, 10) : getLocalISODate(dateRaw as Date);
        if (createdDateStr === todayStr) return true;
      }
      return false;
    });

    return { viewOrders, viewTechnicalSheets, viewAppointments, viewCustomers };
  };

  const { viewOrders, viewTechnicalSheets, viewAppointments, viewCustomers } = getFilteredData();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard
          orders={viewOrders}
          appointments={viewAppointments}
          products={products}
          technicalSheets={viewTechnicalSheets}
          transactions={financialTransactions}
        />;
      case 'quick-quote':
        return <QuickQuote products={products} />;
      case 'sellers':
        return <Sellers
          sellers={sellers} appointments={viewAppointments} customers={viewCustomers} technicalSheets={viewTechnicalSheets}
          orders={viewOrders}
          onAdd={handleAddSeller} onUpdate={handleUpdateSeller} onEditTechnicalSheet={handleEditSheet}
          onGenerateQuote={handleGenerateQuote} onStartMeasurement={handleStartMeasurement}
          currentUser={currentUser!}
        />;
      case 'customers':
        return <Customers
          customers={viewCustomers} onAdd={handleAddCustomer} onUpdate={handleUpdateCustomer}
          appointments={viewAppointments} orders={viewOrders} sellers={sellers} technicalSheets={viewTechnicalSheets} onAddAppointment={handleAddAppointment}
          preselectedCustomerId={preselectedCustomerId}
          currentUser={currentUser!}
        />;
      case 'products':
        return <Products products={products} onAdd={handleAddProduct} onUpdate={handleUpdateProduct} onDelete={handleDeleteProduct} />;
      case 'schedule':
      case 'my-schedule':
        return <Schedule
          appointments={viewAppointments}
          sellers={sellers}
          customers={viewCustomers}
          technicalSheets={viewTechnicalSheets}
          products={products}
          blockedSlots={blockedSlots}
          installers={installers}
          onAdd={handleAddAppointment}
          onStartMeasurement={handleStartMeasurement}
          onEditTechnicalSheet={handleEditSheet}
          onGenerateQuote={handleGenerateQuote}
          role={currentUser?.role || UserRole.SELLER}
          currentUser={currentUser!}
        />;
      case 'measurements':
        return <MeasurementForm
          customers={viewCustomers} products={products} technicalSheets={viewTechnicalSheets}
          initialCustomerId={preselectedCustomerId || undefined} editingSheet={editingSheet || undefined}
          currentUser={currentUser!}
          onSave={handleSaveTechnicalSheet}
          onGenerateQuote={handleGenerateQuote}
          onEditSheet={handleEditSheet}
          onDeleteSheet={handleDeleteTechnicalSheet}
        />;
      case 'quotes':
        return <Quotes
          orders={viewOrders} customers={customers} technicalSheets={viewTechnicalSheets} products={products} sellers={sellers}
          installers={installers}
          onUpdateOrder={handleUpdateOrder} initialSelectedId={lastGeneratedQuoteId || undefined}
          onClearSelection={() => setLastGeneratedQuoteId(null)} onNavigateToOrders={() => setActiveTab('orders')}
          currentUser={currentUser!}
          onAddCustomer={handleAddCustomer}
          onAddAppointment={handleAddAppointment}
          onAddTechnicalSheet={handleSaveTechnicalSheet}
          onDeleteOrder={handleDeleteOrder}
        />;
      case 'agenda':
        return <Agenda
          appointments={viewAppointments}
          blockedSlots={blockedSlots}
          sellers={sellers}
          customers={viewCustomers}
          technicalSheets={viewTechnicalSheets}
          products={products}
          installers={installers}
          currentUser={currentUser!}
          onAddBlockedSlot={handleAddBlockedSlot}
          onDeleteBlockedSlot={handleDeleteBlockedSlot}
          onStartMeasurement={handleStartMeasurement}
          onEditTechnicalSheet={handleEditSheet}
          onGenerateQuote={handleGenerateQuote}
          systemSettings={systemSettings}
        />;
      case 'settings':
        return <Settings
          settings={systemSettings}
          onUpdateSetting={handleUpdateSystemSetting}
        />;
      case 'orders':
        return <Orders
          orders={viewOrders}
          customers={viewCustomers}
          technicalSheets={viewTechnicalSheets}
          products={products}
          sellers={sellers}
          onUpdateOrder={handleUpdateOrder}
          onDeleteOrder={handleDeleteOrder}
          currentUser={currentUser!}
          initialOrderId={selectedOrderIdForTab || undefined}
          onClearInitialOrder={() => setSelectedOrderIdForTab(null)}
        />;
      case 'pcp':
        return <PCP 
          orders={orders} 
          products={products} 
          sellers={sellers} 
          customers={customers} 
          systemUsers={systemUsers}
          currentUser={currentUser!}
          onUpdateOrder={handleUpdateOrder} 
          onSelectCustomer={handleSelectCustomer} 
        />;
      case 'buyer':
        return <Buyer orders={orders} customers={customers} />;
      case 'raw-material-stock':
        return <RawMaterialStock currentUser={currentUser!} />;
      case 'installations':
        return <Installations
          orders={orders} customers={customers} technicalSheets={technicalSheets} products={products}
          installers={installers}
          onUpdateOrder={handleUpdateOrder} onAddAppointment={handleAddAppointment}
        />;
      case 'finance':
        return (
          <Finance
            orders={orders}
            customers={customers}
            products={products}
            sellers={sellers}
            technicalSheets={technicalSheets}
            transactions={financialTransactions}
            categories={accountCategories}
            onUpdateOrder={handleUpdateOrder}
            onSaveTransaction={handleSaveFinancialTransaction}
            onDeleteTransaction={handleDeleteFinancialTransaction}
          />
        );
      case 'commissions':
        return <Commissions
          orders={orders}
          customers={customers}
          products={products}
          sellers={sellers}
          technicalSheets={technicalSheets}
        />;
      case 'expenses':
        return <Expenses orders={orders} customers={customers} />;
      case 'system-users':
        return <TeamRegistration users={systemUsers} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
      case 'installers':
        return <Installers installers={installers} appointments={appointments} timeEntries={timeEntries} onAdd={handleAddInstaller} onUpdate={handleUpdateInstaller} onDelete={handleDeleteInstaller} />;
      case 'nfe-management':
        return (
          <NFeManagement
            orders={orders}
            customers={customers}
            products={products}
            technicalSheets={technicalSheets}
            currentUser={currentUser!}
            onUpdateOrder={handleUpdateOrder}
            onNavigateToOrder={(orderId) => {
              setSelectedOrderIdForTab(orderId);
              setActiveTab('orders');
            }}
          />
        );
      case 'sales-report':
        return (
          <SalesReport
            orders={orders}
            sellers={sellers}
            products={products}
            customers={customers}
            technicalSheets={technicalSheets}
            onUpdateOrder={handleUpdateOrder}
          />
        );
      case 'api-config':
        return <ApiConfig />;
      case 'tarefas':
        return <Tasks currentUser={currentUser!} />;
      case 'gerente-ia':
        return <IAManager 
          orders={orders} 
          sellers={sellers} 
          customers={customers} 
          appointments={viewAppointments}
          currentUser={currentUser!} 
        />;
      case 'ponto':
        const employeeInstaller = installers.find(i => i.login === currentUser?.login);
        if (employeeInstaller) {
          return (
            <InstallerPortal
              installer={employeeInstaller}
              orders={orders}
              customers={customers}
              technicalSheets={technicalSheets}
              products={products}
              appointments={appointments}
              onLogout={() => setActiveTab('dashboard')}
              onUpdateOrder={handleUpdateOrder}
            />
          );
        }
        return (
          <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-slate-100">
            <Clock size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">Configuração Pendente</h3>
            <p className="text-slate-500">O registro de ponto não foi configurado corretamente para o seu usuário. Por favor, contate o administrador.</p>
          </div>
        );
      default:

        return <div className="flex items-center justify-center h-full text-slate-400">Funcionalidade em desenvolvimento</div>;
    }
  };

  // Render logic triggered only AFTER functions are declared
  if (!currentUser) {
    return <Login onLogin={setCurrentUser} systemUsers={systemUsers} installers={installers} />;
  }

  if (currentUser.role === UserRole.INSTALLER) {
    const installer = installers.find(i => i.id === currentUser.id);
    if (!installer) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-8 text-center">
          <div>
            <h2 className="text-xl font-bold mb-2">Erro de Acesso</h2>
            <p className="text-slate-400 mb-4">Perfil de instalador não encontrado no banco de dados.</p>
            <button onClick={() => setCurrentUser(null)} className="px-6 py-2 bg-blue-600 rounded-xl">Voltar ao Login</button>
          </div>
        </div>
      );
    }

    return (
      <InstallerPortal
        installer={installer}
        orders={orders}
        customers={customers}
        technicalSheets={technicalSheets}
        products={products}
        appointments={appointments}
        onLogout={() => setCurrentUser(null)}
        onUpdateOrder={handleUpdateOrder}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
      {/* Backdrop for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[90] md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab: string) => {
          setActiveTab(tab);
          if (tab !== 'measurements' && tab !== 'customers') {
            setPreselectedCustomerId(null);
            setEditingSheet(null);
          }
          if (tab !== 'quotes') setLastGeneratedQuoteId(null);
        }}
        menuItems={filteredMenu}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 no-print">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <MenuIcon size={24} />
            </button>

            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input type="text" placeholder="Pesquisar..." className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-all" />
            </div>

            {/* Status de Sincronização */}
            <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-200">
              <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {isSyncing ? 'Sincronizando...' : `Sincronizado: ${lastSync ? lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}`}
              </p>
              <div className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">
                  BUILD: 230323.2320
                </p>
              </div>
              <button
                onClick={() => loadData(true)}
                disabled={isSyncing}
                className={`p-1.5 rounded-lg transition-all ${isSyncing ? 'text-blue-400 animate-spin' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                title="Sincronizar agora"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-900 leading-none">{currentUser.name}</p>
                <p className="text-[10px] text-blue-600 mt-1 uppercase font-black tracking-widest">{currentUser.role}</p>
              </div>
              <div className="h-10 w-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white">
                {currentUser.name.charAt(0)}
              </div>
              <button onClick={() => setCurrentUser(null)} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Sair do Sistema">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 print:p-0 min-w-0 w-full overflow-x-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
