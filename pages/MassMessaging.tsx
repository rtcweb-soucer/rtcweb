import React, { useState, useEffect, useMemo } from 'react';
import { Upload, Play, Pause, CheckCircle, XCircle, Clock, Trash2, X, RefreshCw, Search, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dataService } from '../services/dataService';
import { MassMessage } from '../types';

export default function MassMessaging() {
  const [messages, setMessages] = useState<MassMessage[]>([]);
  const [template, setTemplate] = useState(`Olá, {{nome}}! 👋\nSomos da RTC Toldos, Cortinas e Coberturas. Você já foi nosso cliente e guardamos isso com carinho.\n\nPassando pra saber se está precisando de manutenção, troca ou algo novo. Como forma de reencontro, estamos oferecendo 10% de desconto exclusivo para clientes antigos — válido até o final de junho.\n\nQuer que eu passe um orçamento? 😊\n\n*(Para não receber mais promoções, responda SAIR)*`);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estados para mapeamento de colunas
  const [parsedData, setParsedData] = useState<any[] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ name: '', phone: '' });
  const [isMappingOpen, setIsMappingOpen] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await dataService.getMassMessages();
      setMessages(data);
      setSelectedIds(new Set());
      setSearchTerm('');
    } catch (err) {
      console.error('Erro ao buscar mensagens', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws);

        if (json.length === 0) {
          alert('A planilha está vazia.');
          return;
        }

        const headers = Object.keys(json[0] as object);
        setFileHeaders(headers);
        setParsedData(json);

        // Tentar prever as colunas automaticamente
        let defaultName = '';
        let defaultPhone = '';
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('nome') || lower.includes('name')) defaultName = h;
          if (lower.includes('telef') || lower.includes('cel') || lower.includes('phone') || lower.includes('numero') || lower.includes('número')) defaultPhone = h;
        });

        setMapping({ name: defaultName, phone: defaultPhone });
        setIsMappingOpen(true);

      } catch (err) {
        console.error(err);
        alert('Erro ao ler o arquivo Excel. Verifique se o formato é válido.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmMapping = async () => {
    if (!parsedData) return;
    if (!mapping.phone) {
      alert('Você precisa selecionar qual coluna contém o Telefone.');
      return;
    }

    try {
      setLoading(true);
      const newMessages: any[] = parsedData.map((row: any) => {
        const name = mapping.name ? row[mapping.name] : '';
        let phone = row[mapping.phone];
        
        if (phone) {
          phone = String(phone).replace(/\D/g, '');

          // Se tiver 10 ou 11 dígitos, provavelmente é um número do Brasil sem DDI
          if (phone.length === 10 || phone.length === 11) {
            phone = '55' + phone;
          }
        }

        // Salva as outras colunas no metadata
        const metadata: Record<string, any> = {};
        Object.keys(row).forEach(key => {
          if (key !== mapping.name && key !== mapping.phone) {
            metadata[key] = row[key];
          }
        });

        return {
          name: name ? String(name).trim() : '',
          phone: phone || '',
          message_template: template,
          status: 'PAUSED', // Agora os contatos entram pausados por padrão, até o usuário ativar a campanha
          metadata
        };
      }).filter(m => m.phone && m.phone.length >= 12); // Pelo menos 12 dígitos com o 55

      // Deduplicar contatos com o mesmo telefone na própria planilha (o banco recusa upsert com duplicatas no mesmo array)
      const uniqueMessagesMap = new Map<string, any>();
      for (const msg of newMessages) {
        uniqueMessagesMap.set(msg.phone, msg);
      }
      const uniqueMessages = Array.from(uniqueMessagesMap.values());

      if (uniqueMessages.length === 0) {
        alert('Nenhum número válido foi encontrado após o mapeamento. Verifique se escolheu a coluna certa.');
        setIsMappingOpen(false);
        setParsedData(null);
        return;
      }

      // Chunk array to avoid payload too large errors
      const chunkSize = 50;
      for (let i = 0; i < uniqueMessages.length; i += chunkSize) {
        const chunk = uniqueMessages.slice(i, i + chunkSize);
        await dataService.saveMassMessages(chunk);
      }
      
      await loadMessages();
      
      const ignorados = parsedData.length - uniqueMessages.length;
      if (ignorados > 0) {
        alert(`${uniqueMessages.length} contatos importados com sucesso!\n\n(${ignorados} linhas foram ignoradas pois estavam sem número de telefone, repetidas ou em branco na planilha).`);
      } else {
        alert(`${uniqueMessages.length} contatos importados e atualizados com sucesso!`);
      }
    } catch (err: any) {
      console.error('Erro Supabase:', JSON.stringify(err, null, 2), err);
      alert('Erro detalhado: ' + (err.message || err.details || 'Verifique o console (F12)'));
    } finally {
      setLoading(false);
      setIsMappingOpen(false);
      setParsedData(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remover este contato da fila?')) {
      try {
        await dataService.deleteMassMessage(id);
        setMessages(prev => prev.filter(m => m.id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePauseAll = async () => {
    if (window.confirm('Pausar todos os envios pendentes?')) {
      try {
        await dataService.pauseAllMassMessages();
        await loadMessages();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleResumeAll = async () => {
    if (window.confirm('Retomar envios pausados?')) {
      try {
        await dataService.resumeAllMassMessages();
        await loadMessages();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleClearFinished = async () => {
    if (window.confirm('CUIDADO: Isso vai excluir os registros definitivamente. Se você quer manter os contatos para campanhas futuras, NÃO faça isso. Deseja realmente excluir os finalizados e com erro?')) {
      try {
        setLoading(true);
        const toDelete = messages.filter(m => m.status === 'SENT' || m.status === 'ERROR');
        for (const msg of toDelete) {
          await dataService.deleteMassMessage(msg.id);
        }
        await loadMessages();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleQueueSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Você está prestes a enfileirar ${selectedIds.size} contatos selecionados para receber a mensagem escrita no Template acima. Confirmar?`)) {
      try {
        setLoading(true);
        await dataService.queueSelectedMessages(Array.from(selectedIds), template);
        await loadMessages();
        setSelectedIds(new Set());
        alert(`${selectedIds.size} contatos foram reativados na fila com a nova mensagem!`);
      } catch (err) {
        console.error(err);
        alert('Erro ao enfileirar os contatos.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Status counters
  const today = new Date().toISOString().split('T')[0];
  const sentToday = messages.filter(m => m.status === 'SENT' && m.sent_at?.startsWith(today)).length;
  const pendingCount = messages.filter(m => m.status === 'PENDING').length;
  const pausedCount = messages.filter(m => m.status === 'PAUSED').length;

  // Filtro
  const filteredMessages = useMemo(() => {
    if (!searchTerm) return messages;
    const lowerTerm = searchTerm.toLowerCase();
    return messages.filter(m => {
      if (m.name?.toLowerCase().includes(lowerTerm)) return true;
      if (m.phone?.includes(lowerTerm)) return true;
      if (m.status?.toLowerCase().includes(lowerTerm)) return true;
      if (m.metadata) {
        for (const key in m.metadata) {
          if (String(m.metadata[key]).toLowerCase().includes(lowerTerm)) return true;
        }
      }
      return false;
    });
  }, [messages, searchTerm]);

  // Colunas dinâmicas (extraídas dos metadata dos filtrados ou todos)
  const dynamicColumns = useMemo(() => {
    const cols = new Set<string>();
    filteredMessages.forEach(m => {
      if (m.metadata) {
        Object.keys(m.metadata).forEach(k => cols.add(k));
      }
    });
    return Array.from(cols);
  }, [filteredMessages]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM de Campanhas & Ativação em Lote</h1>
          <p className="text-gray-500 mt-1">Importe contatos, filtre por bairro ou tag, e dispare mensagens em lote.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
            <Upload className="text-blue-500" size={24} />
          </div>
          <h3 className="font-medium text-gray-900">Importar / Atualizar Planilha</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">Envie um Excel/CSV. Ele guarda as novas colunas ou atualiza contatos existentes.</p>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors w-full">
            Selecionar Arquivo
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
          </label>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 md:col-span-2">
          <h3 className="font-medium text-gray-900 mb-2">Template da Mensagem</h3>
          <p className="text-sm text-gray-500 mb-4">Use {"{nome}"} para substituir pelo nome do cliente. Esta será a mensagem do próximo disparo.</p>
          <textarea
            className="w-full h-24 border rounded-lg p-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={template}
            onChange={e => setTemplate(e.target.value)}
            placeholder="Digite a mensagem da campanha..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
            <Clock className="text-yellow-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Fila de Espera</p>
            <p className="text-2xl font-bold text-gray-900">{pendingCount} <span className="text-xs text-gray-400 font-normal">({pausedCount} pausados)</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Enviados Hoje</p>
            <p className="text-2xl font-bold text-gray-900">{sentToday} / 50</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
            <XCircle className="text-red-600" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium">Histórico Geral</p>
            <div className="flex items-center gap-4 mt-1">
              <div className="text-sm">
                <span className="font-bold text-gray-900">{messages.filter(m => m.status === 'SENT').length}</span> <span className="text-gray-500">OK</span>
              </div>
              <div className="text-sm">
                <span className="font-bold text-gray-900">{messages.filter(m => m.status === 'ERROR').length}</span> <span className="text-gray-500">Erros (Sem WhatsApp)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
          
          {/* Barra de Pesquisa */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Pesquisar por nome, telefone, bairro, cidade, tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <button onClick={handleQueueSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm" title="Reativar contatos selecionados com a nova mensagem">
                <CheckSquare size={16} /> Ativar Selecionados ({selectedIds.size})
              </button>
            )}
            <button onClick={handlePauseAll} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors" title="Pausar Envios">
              <Pause size={16} /> Pausar Fila
            </button>
            <button onClick={handleResumeAll} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors" title="Retomar Envios">
              <Play size={16} /> Retomar Fila
            </button>
            <button onClick={loadMessages} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" title="Limpar Filtros e Atualizar">
              <RefreshCw size={16} /> Limpar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-medium sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-center w-12">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={handleSelectAll}
                    checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
                  />
                </th>
                <th className="px-6 py-3 whitespace-nowrap">Nome</th>
                <th className="px-6 py-3 whitespace-nowrap">Telefone</th>
                <th className="px-6 py-3 whitespace-nowrap">Status</th>
                {dynamicColumns.map(col => (
                  <th key={col} className="px-6 py-3 whitespace-nowrap capitalize">{col}</th>
                ))}
                <th className="px-6 py-3 whitespace-nowrap text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && messages.length === 0 ? (
                <tr>
                  <td colSpan={5 + dynamicColumns.length} className="px-6 py-8 text-center text-gray-500">
                    Carregando contatos...
                  </td>
                </tr>
              ) : filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={5 + dynamicColumns.length} className="px-6 py-8 text-center text-gray-500">
                    Nenhum contato encontrado na pesquisa.
                  </td>
                </tr>
              ) : (
                filteredMessages.map(msg => (
                  <tr key={msg.id} className={`hover:bg-blue-50 transition-colors ${selectedIds.has(msg.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.has(msg.id)}
                        onChange={(e) => handleSelectOne(msg.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">{msg.name || '-'}</td>
                    <td className="px-6 py-3">{msg.phone}</td>
                    <td className="px-6 py-3">
                      {msg.status === 'PENDING' && <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock size={12} /> Pendente</span>}
                      {msg.status === 'PAUSED' && <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><Pause size={12} /> Pausado</span>}
                      {msg.status === 'SENT' && <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle size={12} /> Enviado</span>}
                      {msg.status === 'ERROR' && <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={msg.error_log}><XCircle size={12} /> Erro</span>}
                    </td>
                    {dynamicColumns.map(col => (
                      <td key={col} className="px-6 py-3 whitespace-nowrap text-gray-500">
                        {msg.metadata && msg.metadata[col] !== undefined ? String(msg.metadata[col]) : '-'}
                      </td>
                    ))}
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => handleDelete(msg.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="Remover Contato Permanentemente">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Mapeamento */}
      {isMappingOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-6 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Mapear Colunas</h3>
              <button onClick={() => setIsMappingOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-gray-600">
              Identificamos <strong>{parsedData?.length || 0}</strong> linhas.
              As colunas não mapeadas aqui serão salvas automaticamente como <strong>Dados Adicionais</strong> para você filtrar no futuro!
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coluna de Nome (Opcional)</label>
                <select 
                  className="w-full border rounded-lg p-2.5 text-gray-700 focus:ring-2 focus:ring-blue-500"
                  value={mapping.name}
                  onChange={(e) => setMapping({...mapping, name: e.target.value})}
                >
                  <option value="">-- Não há coluna de nome --</option>
                  {fileHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coluna de Telefone (Obrigatório)</label>
                <select 
                  className="w-full border rounded-lg p-2.5 text-gray-700 focus:ring-2 focus:ring-blue-500"
                  value={mapping.phone}
                  onChange={(e) => setMapping({...mapping, phone: e.target.value})}
                >
                  <option value="">-- Selecione a coluna --</option>
                  {fileHeaders.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsMappingOpen(false)}
                className="flex-1 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmMapping}
                disabled={!mapping.phone || loading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
