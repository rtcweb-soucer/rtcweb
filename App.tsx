
import * as React from 'react';
import { useState, useEffect } from 'react';
import { UserRole, Seller, Customer, Appointment, TechnicalSheet, Order, OrderStatus, ProductionStage, Product, SystemUser } from './types';
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
import { Search, LogOut, User as UserIcon, Menu as MenuIcon } from 'lucide-react';
import { dataService } from './services/dataService';

const App = () => {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [technicalSheets, setTechnicalSheets] = useState<TechnicalSheet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState<TechnicalSheet | null>(null);
  const [lastGeneratedQuoteId, setLastGeneratedQuoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load initial data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [dbSellers, dbCustomers, dbProducts, dbAppointments, dbOrders, dbUsers, dbTechnicalSheets] = await Promise.all([
          dataService.getSellers(),
          dataService.getCustomers(),
          dataService.getProducts(),
          dataService.getAppointments(),
          dataService.getOrders(),
          dataService.getSystemUsers(),
          dataService.getTechnicalSheets()
        ]);

        setSellers(dbSellers);
        setCustomers(dbCustomers);
        setProducts(dbProducts);
        setSystemUsers(dbUsers);
        setAppointments(dbAppointments);
        setOrders(dbOrders);
        setTechnicalSheets(dbTechnicalSheets);

        // Se ainda não houver usuários (primeiro acesso), criar o MASTER
        if (dbUsers.length === 0) {
          const master: SystemUser = { id: 'm1', name: 'Administrador Master', login: 'Master', password: '123', role: UserRole.ADMIN, active: true };
          dataService.saveSystemUser(master).then((saved: SystemUser) => setSystemUsers([saved]));
        }
      } catch (err) {
        console.error("Failed to load data from Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredMenu = MENU_ITEMS.filter((item: any) => {
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

  useEffect(() => {
    if (currentUser && !filteredMenu.some((item: any) => item.id === activeTab)) {
      setActiveTab(filteredMenu[0]?.id || 'dashboard');
    }
  }, [currentUser, activeTab, filteredMenu]);

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} systemUsers={systemUsers} />;
  }

  const handleAddUser = async (user: SystemUser) => {
    try {
      const saved = await dataService.saveSystemUser(user);
      setSystemUsers([...systemUsers, saved]);
    } catch (err: any) {
      alert("Erro ao salvar usuário: " + (err.message || err));
    }
  };

  const handleUpdateUser = async (user: SystemUser) => {
    try {
      await dataService.saveSystemUser(user);
      setSystemUsers((prev: SystemUser[]) => prev.map((u: SystemUser) => u.id === user.id ? user : u));
    } catch (err) {
      alert("Erro ao atualizar usuário");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm("Remover este acesso?")) {
      try {
        await dataService.deleteSystemUser(id);
        setSystemUsers((prev: SystemUser[]) => prev.filter((u: SystemUser) => u.id !== id));
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
        permissions: ['quick-quote', 'my-schedule', 'measurements', 'quotes', 'orders']
      };
      const savedUser = await dataService.saveSystemUser(newUser);
      setSystemUsers((prev: SystemUser[]) => [...prev, savedUser]);
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
      setTimeout(() => {
        setLastGeneratedQuoteId(quoteId);
        setActiveTab('quotes');
      }, 50);
    }).catch(err => alert("Erro ao gerar orçamento"));
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    try {
      await dataService.saveOrder(updatedOrder);
      setOrders((prev: Order[]) => prev.map((o: Order) => o.id === updatedOrder.id ? updatedOrder : o));
    } catch (err: any) {
      alert("Erro ao atualizar pedido: " + (err.message || err));
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm("Remover este pedido?")) {
      try {
        await dataService.deleteOrder(orderId);
        setOrders((prev: Order[]) => prev.filter((o: Order) => o.id !== orderId));
      } catch (err) {
        alert("Erro ao remover pedido");
      }
    }
  };

  const handleAddProduct = async (p: Product) => {
    try {
      const saved = await dataService.saveProduct(p);
      setProducts([...products, saved]);
    } catch (err: any) {
      alert("Erro ao salvar produto: " + (err.message || err));
    }
  };

  const handleUpdateProduct = async (p: Product) => {
    try {
      await dataService.saveProduct(p);
      setProducts((prev: Product[]) => prev.map((item: Product) => item.id === p.id ? p : item));
    } catch (err) {
      alert("Erro ao atualizar produto");
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await dataService.deleteProduct(id);
      setProducts((prev: Product[]) => prev.filter((p: Product) => p.id !== id));
    } catch (err) {
      alert("Erro ao deletar produto");
    }
  };

  const handleAddCustomer = async (c: Customer) => {
    try {
      const saved = await dataService.saveCustomer(c);
      setCustomers([...customers, saved]);
    } catch (err: any) {
      alert("Erro ao salvar cliente: " + (err.message || err));
    }
  };

  const handleUpdateCustomer = async (c: Customer) => {
    try {
      await dataService.saveCustomer(c);
      setCustomers((prev: Customer[]) => prev.map((item: Customer) => item.id === c.id ? c : item));
    } catch (err) {
      alert("Erro ao atualizar cliente");
    }
  };

  const handleAddAppointment = async (a: Appointment) => {
    try {
      const saved = await dataService.saveAppointment(a);
      setAppointments([...appointments, saved]);
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
    } catch (err: any) {
      alert("Erro ao salvar ficha técnica: " + (err.message || err));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard orders={orders} appointments={appointments} products={products} technicalSheets={technicalSheets} />;
      case 'quick-quote':
        return <QuickQuote products={products} />;
      case 'sellers':
        return <Sellers
          sellers={sellers} appointments={appointments} customers={customers} technicalSheets={technicalSheets}
          orders={orders}
          onAdd={handleAddSeller} onUpdate={handleUpdateSeller} onEditTechnicalSheet={handleEditSheet}
          onGenerateQuote={handleGenerateQuote} onStartMeasurement={handleStartMeasurement}
        />;
      case 'customers':
        return <Customers
          customers={customers} onAdd={handleAddCustomer} onUpdate={handleUpdateCustomer}
          appointments={appointments} orders={orders} sellers={sellers} technicalSheets={technicalSheets} onAddAppointment={handleAddAppointment}
          preselectedCustomerId={preselectedCustomerId}
        />;
      case 'products':
        return <Products products={products} onAdd={handleAddProduct} onUpdate={handleUpdateProduct} onDelete={handleDeleteProduct} />;
      case 'schedule':
      case 'my-schedule':
        return <Schedule
          appointments={appointments} sellers={sellers} customers={customers} technicalSheets={technicalSheets} products={products}
          onAdd={handleAddAppointment}
          onStartMeasurement={handleStartMeasurement}
          onEditTechnicalSheet={handleEditSheet}
          onGenerateQuote={handleGenerateQuote}
          role={currentUser?.role || UserRole.SELLER}
          currentUser={currentUser}
        />;
      case 'measurements':
        return <MeasurementForm
          customers={customers} products={products} technicalSheets={technicalSheets}
          initialCustomerId={preselectedCustomerId || undefined} editingSheet={editingSheet || undefined}
          currentUser={currentUser}
          onSave={handleSaveTechnicalSheet} onGenerateQuote={handleGenerateQuote}
        />;
      case 'quotes':
        return <Quotes
          orders={orders} customers={customers} technicalSheets={technicalSheets} products={products} sellers={sellers}
          onUpdateOrder={handleUpdateOrder} initialSelectedId={lastGeneratedQuoteId || undefined}
          onClearSelection={() => setLastGeneratedQuoteId(null)} onNavigateToOrders={() => setActiveTab('orders')}
        />;
      case 'orders':
        return <Orders
          orders={orders} customers={customers} technicalSheets={technicalSheets} products={products} sellers={sellers}
          onUpdateOrder={handleUpdateOrder} onDeleteOrder={handleDeleteOrder}
        />;
      case 'pcp':
        return <PCP orders={orders} products={products} sellers={sellers} customers={customers} onUpdateOrder={handleUpdateOrder} onSelectCustomer={handleSelectCustomer} />;
      case 'installations':
        return <Installations
          orders={orders} customers={customers} technicalSheets={technicalSheets} products={products}
          onUpdateOrder={handleUpdateOrder} onAddAppointment={handleAddAppointment}
        />;
      case 'finance':
        return <Finance orders={orders} customers={customers} onUpdateOrder={handleUpdateOrder} />;
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
      default:
        return <div className="flex items-center justify-center h-full text-slate-400">Funcionalidade em desenvolvimento</div>;
    }
  };

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
