
import * as React from 'react';
import { useState } from 'react';
import { Product } from '../types';
import { Plus, Search, Package, Trash2, X, Edit3, Info, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProductsProps {
  products: Product[];
  onAdd: (p: Product) => void;
  onUpdate: (p: Product) => void;
  onDelete: (id: string) => void;
}

const Products = ({ products, onAdd, onUpdate, onDelete }: ProductsProps) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    tipo: 'Toldo',
    nome: '',
    valor: 0,
    custo: 0,
    unidade: 'UN',
    acessorio: false,
    dias_garantia: 365,
    obs: '',
    ncm: '',
    cst: '',
    cest: '',
    cfop: '',
    detalhamento_tecnico: ''
  });

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product });
    } else {
      setEditingProduct(null);
      setFormData({
        tipo: 'Toldo',
        nome: '',
        valor: 0,
        custo: 0,
        unidade: 'UN',
        acessorio: false,
        dias_garantia: 365,
        obs: '',
        ncm: '',
        cst: '',
        cest: '',
        cfop: '',
        detalhamento_tecnico: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      ...formData,
      valor: Number(formData.valor),
      custo: Number(formData.custo),
      dias_garantia: Number(formData.dias_garantia)
    } as Product;

    if (editingProduct) {
      onUpdate({ ...editingProduct, ...productData });
    } else {
      onAdd({
        ...productData,
        id: crypto.randomUUID()
      });
    }
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Catálogo de Produtos</h2>
          <p className="text-slate-500">Gestão completa de itens, preços e dados fiscais.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} />
          Novo Produto
        </button>
      </div>

      <div className="relative group max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
        <input
          type="text"
          placeholder="Buscar produto por nome ou tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">IdProduto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nome</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Valor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Unidade</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Garantia</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">NCM</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Acessório</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-400">#{product.id}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${product.tipo === 'Toldo' ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                      {product.tipo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                        <Package size={18} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{product.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">
                    R$ {product.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{product.unidade}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{product.dias_garantia} dias</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{product.ncm || '-'}</td>
                  <td className="px-6 py-4">
                    {product.acessorio ? (
                      <span className="text-emerald-500 flex items-center gap-1 text-xs font-bold"><CheckCircle2 size={14} /> Sim</span>
                    ) : (
                      <span className="text-slate-300 flex items-center gap-1 text-xs"><AlertCircle size={14} /> Não</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum produto cadastrado ou encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Cadastro/Edição Completo */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg">
                  <Package size={20} />
                </div>
                <h3 className="font-bold text-lg text-slate-900">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[85vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Seção Dados Básicos */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">Informações Gerais</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo *</label>
                      <input
                        type="text" required placeholder="Ex: Toldo, Cortina, Motor..."
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Produto *</label>
                      <input
                        type="text" required placeholder="Ex: Toldo Articulado"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Venda (R$)</label>
                      {/* Fix: Parse string input value to number for valor */}
                      <input
                        type="number" step="0.01" value={formData.valor}
                        onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo (R$)</label>
                      {/* Fix: Parse string input value to number for custo */}
                      <input
                        type="number" step="0.01" value={formData.custo}
                        onChange={(e) => setFormData({ ...formData, custo: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                      <select
                        value={formData.unidade}
                        onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                      >
                        <option value="UN">UN</option>
                        <option value="MT">MT</option>
                        <option value="M2">M2</option>
                        <option value="KIT">KIT</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhamento Técnico</label>
                    <textarea
                      rows={4} placeholder="Especificações de fabricação..."
                      value={formData.detalhamento_tecnico}
                      onChange={(e) => setFormData({ ...formData, detalhamento_tecnico: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Seção Fiscal e Extras */}
                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Dados Fiscais / Extras</h4>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 py-2">
                      <input
                        type="checkbox" id="acessorio"
                        checked={formData.acessorio}
                        onChange={(e) => setFormData({ ...formData, acessorio: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label htmlFor="acessorio" className="text-sm font-bold text-slate-700">É um Acessório?</label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Garantia (dias)</label>
                      {/* Fix: Parse string input value to number for dias_garantia */}
                      <input
                        type="number" value={formData.dias_garantia}
                        onChange={(e) => setFormData({ ...formData, dias_garantia: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">NCM</label>
                      <input
                        type="text" value={formData.ncm}
                        onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CST</label>
                        <input
                          type="text" value={formData.cst}
                          onChange={(e) => setFormData({ ...formData, cst: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CFOP</label>
                        <input
                          type="text" value={formData.cfop}
                          onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CEST</label>
                      <input
                        type="text" value={formData.cest}
                        onChange={(e) => setFormData({ ...formData, cest: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Observações Internas</label>
                      <input
                        type="text" value={formData.obs}
                        onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
