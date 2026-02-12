
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
  ATTENDANT = 'ATTENDANT',
  PRODUCTION = 'PRODUCTION'
}

export enum OrderStatus {
  PENDING_MEASUREMENT = 'PENDING_MEASUREMENT',
  TECHNICAL_SHEET_CREATED = 'TECHNICAL_SHEET_CREATED',
  QUOTE_SENT = 'QUOTE_SENT',
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  FINISHED = 'FINISHED',
  DELIVERED = 'DELIVERED'
}

export enum ProductionStage {
  NEW_ORDER = 'Novos Pedidos',
  PREPARATION = 'Em Preparação',
  PROVISIONING = 'Provisionamento',
  CUTTING_WELDING = 'Cortes ou Soldas',
  ASSEMBLY = 'Montagem',
  INSTALLATION = 'Instalações',
  READY = 'Finalizado'
}

export interface SystemUser {
  id: string;
  name: string;
  login: string;
  password?: string;
  role: UserRole;
  active: boolean;
  sellerId?: string; // Vincula o usuário a um vendedor específico se o role for SELLER
  permissions?: string[]; // IDs das telas que o usuário pode acessar
}

export interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string;
  login?: string;
  password?: string;
}

export interface Installer {
  id: string;
  name: string;
  dailyRate: number;
  phone?: string;
  active: boolean;
}

export interface Product {
  id: string; // IdProduto
  tipo: string;
  nome: string;
  valor: number;
  custo: number;
  obs?: string;
  ncm?: string;
  cst?: string;
  cest?: string;
  unidade: string;
  cfop?: string;
  acessorio: boolean;
  detalhamento_tecnico?: string;
  dias_garantia: number;
}

export interface Customer {
  id: string;
  type: 'CPF' | 'CNPJ';
  document: string;
  name: string;
  tradeName?: string;
  email: string;
  phone: string;
  phone2?: string;
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

// Interfaces para campos específicos por tipo de produto
export interface ProductionSheetCortina {
  id: string;
  productionSheetId: string;
  comando?: 'Central' | 'Direita' | 'Esquerda' | 'Invertido' | 'Junção' | 'Motorizado D' | 'Motorizado E';
  vao?: 'Altura' | 'Largura' | 'Largura x Altura' | 'Fora de Vão';
  varaoCor?: 'Aço' | 'Branco' | 'Cromado' | 'Escovado' | 'Madeira' | 'Ouro Velho';
  instalacao?: 'Parede Alumínio' | 'Parede Concreto' | 'Parede Gesso' | 'Parede Madeira' | 'Teto Alumínio' | 'Teto Concreto' | 'Teto Gesso' | 'Teto Madeira';
  trilho?: '1 Via' | '2 Vias' | '3 Vias' | '4 Vias';
  posicionamento?: 'Transpasse' | 'Lado a Lado' | 'Modulo Inteiro/Individuais';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionSheetToldo {
  id: string;
  productionSheetId: string;
  modelo?: string;
  comando?: 'Direita' | 'Esquerda' | 'Mola' | 'Motorizado D' | 'Motorizado E';
  bambinela?: 'Colonial' | 'Meia Lua' | 'Reta';
  vies?: 'Mesma Cor' | 'Branca' | 'Marrom';
  entreVao?: 'Largura' | 'Altura' | 'Larg x Alt' | 'Fora de Vão';
  corFerragem?: string;
  bracos?: 'Standard 1 Ponteira' | 'Standard 2 Ponteiras' | 'Top-Line' | 'Sem Braços';
  medidasBraco?: string;
  fixacao?: 'Correia Branca' | 'Correia Preta' | 'Corrente Comum' | 'Corrente Grossa' | 'Outro';
  medidaFixacao?: string;
  trava?: 'Mosquetão Simples' | 'Mosquetão Latão' | 'Argola Dupla' | 'Gancho';
  manivelaQtd?: number;
  medidaManivela?: string;
  parapeito?: 'Vidro' | 'Grade' | 'Muro' | 'Outro';
  larguraBeiral?: string;
  caida?: string;
  alturaInstalacao?: string;
  instalacao?: 'Parede Concreto' | 'Parede Madeira' | 'Parede Ferro' | 'Teto Concreto' | 'Teto Madeira' | 'Teto Ferro';
  corredica?: boolean;
  posicionamento?: 'Transpasse' | 'Lado a Lado' | 'Modulo';
  obs?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionSheetCobertura {
  id: string;
  productionSheetId: string;
  corFerragem?: string;
  alturaInstalacao?: string;
  caida?: string;
  calhaSaida?: '40' | '70' | '100';
  createdAt: Date;
  updatedAt: Date;
}

// Interface principal atualizada
export interface ProductionInstallationSheet {
  id: string;
  measurementItemId: string;
  videoLink?: string;
  observacoesGerais?: string;
  // Campos específicos por tipo (apenas um será preenchido)
  cortina?: Partial<ProductionSheetCortina>;
  toldo?: Partial<ProductionSheetToldo>;
  cobertura?: Partial<ProductionSheetCobertura>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeasurementItem {
  id: string;
  environment: string;
  productId: string;
  color?: string; // Campo Cor
  parentItemId?: string; // ID do item pai para agrupamento de acessórios
  width: number;
  height: number;
  productType: string;
  notes?: string;
  productionSheet?: ProductionInstallationSheet;
}

export interface TechnicalSheet {
  id: string;
  customerId: string;
  sellerId: string;
  items: MeasurementItem[];
  createdAt: Date;
}

export interface Appointment {
  id: string;
  customerId: string;
  orderId?: string; // Vinculado a um pedido para instalações
  sellerId: string;
  technicianName?: string; // Nome do instalador
  date: string;
  time: string;
  type: 'MEASUREMENT' | 'INSTALLATION';
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  installerIds?: string[]; // IDs dos instaladores vinculados (múltiplos)
}

export interface Installment {
  id: string;
  number: number;
  value: number;
  dueDate: string;
  paymentDate?: string;
  status: 'PENDING' | 'PAID';
  nfe?: string; // New: Nota Fiscal
  netValue?: number; // New: Valor líquido recebido
  paymentMethod?: string; // New: Forma de pagamento da parcela
}

export interface Expense {
  id: string;
  orderId: string;
  installmentId: string;
  description: string;
  value: number;
  date: string;
  category: 'TAX' | 'FEE' | 'DISCOUNT' | 'OTHER';
}

export interface ProductionHistoryEntry {
  stage: ProductionStage | string;
  timestamp: Date | string;
}

export interface Order {
  id: string;
  customerId: string;
  technicalSheetId: string;
  sellerId: string;
  itemIds?: string[];
  status: OrderStatus;
  productionStage?: ProductionStage;
  productionHistory?: ProductionHistoryEntry[];
  totalValue: number;
  paymentMethod?: string; // Forma de Pagamento
  paymentConditions?: string; // Tabela/Condições de Pagamento
  installments?: Installment[]; // Detalhamento das parcelas
  itemPrices?: Record<string, number>; // New: Preços manuais por item
  installationDate?: string;
  installationTime?: string;
  technician?: string;
  installerIds?: string[];
  deliveryDays?: number; // Prazo de entrega em dias úteis
  deliveryDeadline?: string; // Data limite de entrega calculada
  createdAt: Date;
}

export interface ProductionTracking {
  orderId: string;
  stage: ProductionStage;
  history: ProductionHistoryEntry[];
  updatedAt: Date;
}

export interface SellerBlockedSlot {
  id: string;
  sellerId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  reason: string;
  createdAt?: string;
}
