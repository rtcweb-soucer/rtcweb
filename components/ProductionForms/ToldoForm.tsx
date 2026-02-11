import * as React from 'react';
import { ProductionSheetToldo } from '../../types';

interface ToldoFormProps {
    data: Partial<ProductionSheetToldo>;
    onChange: (data: Partial<ProductionSheetToldo>) => void;
}

export const ToldoForm: React.FC<ToldoFormProps> = ({ data, onChange }) => {
    const updateField = (field: keyof ProductionSheetToldo, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">📊 Especificações do Toldo</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Modelo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        MODELO (Caso Gaviota)
                    </label>
                    <input
                        type="text"
                        value={data.modelo || ''}
                        onChange={(e) => updateField('modelo', e.target.value)}
                        placeholder="Digite o modelo"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Comando */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        COMANDO
                    </label>
                    <select
                        value={data.comando || ''}
                        onChange={(e) => updateField('comando', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Direita">Direita</option>
                        <option value="Esquerda">Esquerda</option>
                        <option value="Mola">Mola</option>
                        <option value="Motorizado D">Motorizado D</option>
                        <option value="Motorizado E">Motorizado E</option>
                    </select>
                </div>

                {/* Bambinela */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        BAMBINELA
                    </label>
                    <select
                        value={data.bambinela || ''}
                        onChange={(e) => updateField('bambinela', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Colonial">Colonial</option>
                        <option value="Meia Lua">Meia Lua</option>
                        <option value="Reta">Reta</option>
                    </select>
                </div>

                {/* Viés */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        VIÉS
                    </label>
                    <select
                        value={data.vies || ''}
                        onChange={(e) => updateField('vies', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Mesma Cor">Mesma Cor</option>
                        <option value="Branca">Branca</option>
                        <option value="Marrom">Marrom</option>
                    </select>
                </div>

                {/* Entre Vão */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        ENTRE VÃO
                    </label>
                    <select
                        value={data.entreVao || ''}
                        onChange={(e) => updateField('entreVao', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Largura">Largura</option>
                        <option value="Altura">Altura</option>
                        <option value="Larg x Alt">Larg x Alt</option>
                        <option value="Fora de Vão">Fora de Vão</option>
                    </select>
                </div>

                {/* Cor da Ferragem */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        COR DA FERRAGEM
                    </label>
                    <input
                        type="text"
                        value={data.corFerragem || ''}
                        onChange={(e) => updateField('corFerragem', e.target.value)}
                        placeholder="Digite a cor"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Braços */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        BRAÇOS
                    </label>
                    <select
                        value={data.bracos || ''}
                        onChange={(e) => updateField('bracos', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Standard 1 Ponteira">Standard 1 Ponteira</option>
                        <option value="Standard 2 Ponteiras">Standard 2 Ponteiras</option>
                        <option value="Top-Line">Top-Line</option>
                        <option value="Sem Braços">Sem Braços</option>
                    </select>
                </div>

                {/* Medidas Braço */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        MEDIDAS BRAÇO
                    </label>
                    <input
                        type="text"
                        value={data.medidasBraco || ''}
                        onChange={(e) => updateField('medidasBraco', e.target.value)}
                        placeholder="Digite a medida"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Fixação */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        FIXAÇÃO
                    </label>
                    <select
                        value={data.fixacao || ''}
                        onChange={(e) => updateField('fixacao', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Correia Branca">Correia Branca</option>
                        <option value="Correia Preta">Correia Preta</option>
                        <option value="Corrente Comum">Corrente Comum</option>
                        <option value="Corrente Grossa">Corrente Grossa</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                {/* Medida Fixação */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        MEDIDA FIXAÇÃO
                    </label>
                    <input
                        type="text"
                        value={data.medidaFixacao || ''}
                        onChange={(e) => updateField('medidaFixacao', e.target.value)}
                        placeholder="Digite a medida"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Trava */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        TRAVA
                    </label>
                    <select
                        value={data.trava || ''}
                        onChange={(e) => updateField('trava', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Mosquetão Simples">Mosquetão Simples</option>
                        <option value="Mosquetão Latão">Mosquetão Latão</option>
                        <option value="Argola Dupla">Argola Dupla</option>
                        <option value="Gancho">Gancho</option>
                    </select>
                </div>

                {/* Manivela Qtd */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        MANIVELA QTD
                    </label>
                    <input
                        type="number"
                        value={data.manivelaQtd || ''}
                        onChange={(e) => updateField('manivelaQtd', parseInt(e.target.value) || undefined)}
                        placeholder="Digite a quantidade"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Medida Manivela */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        MEDIDA MANIVELA
                    </label>
                    <input
                        type="text"
                        value={data.medidaManivela || ''}
                        onChange={(e) => updateField('medidaManivela', e.target.value)}
                        placeholder="Digite a medida"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Parapeito */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        PARAPEITO
                    </label>
                    <select
                        value={data.parapeito || ''}
                        onChange={(e) => updateField('parapeito', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Vidro">Vidro</option>
                        <option value="Grade">Grade</option>
                        <option value="Muro">Muro</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                {/* Largura do Beiral */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        LARGURA DO BEIRAL
                    </label>
                    <input
                        type="text"
                        value={data.larguraBeiral || ''}
                        onChange={(e) => updateField('larguraBeiral', e.target.value)}
                        placeholder="Digite a medida"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Caída */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        CAÍDA
                    </label>
                    <input
                        type="text"
                        value={data.caida || ''}
                        onChange={(e) => updateField('caida', e.target.value)}
                        placeholder="Digite a medida"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Altura da Instalação */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        ALTURA DA INSTALAÇÃO
                    </label>
                    <input
                        type="text"
                        value={data.alturaInstalacao || ''}
                        onChange={(e) => updateField('alturaInstalacao', e.target.value)}
                        placeholder="Digite a altura"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Instalação */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        INSTALAÇÃO
                    </label>
                    <select
                        value={data.instalacao || ''}
                        onChange={(e) => updateField('instalacao', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Parede Concreto">Parede Concreto</option>
                        <option value="Parede Madeira">Parede Madeira</option>
                        <option value="Parede Ferro">Parede Ferro</option>
                        <option value="Teto Concreto">Teto Concreto</option>
                        <option value="Teto Madeira">Teto Madeira</option>
                        <option value="Teto Ferro">Teto Ferro</option>
                    </select>
                </div>

                {/* Posicionamento */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        POSICIONAMENTO
                    </label>
                    <select
                        value={data.posicionamento || ''}
                        onChange={(e) => updateField('posicionamento', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="Transpasse">Transpasse</option>
                        <option value="Lado a Lado">Lado a Lado</option>
                        <option value="Modulo">Modulo</option>
                    </select>
                </div>
            </div>

            {/* Corrediça (Radio buttons) */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    CORREDIÇA
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={data.corredica === true}
                            onChange={() => updateField('corredica', true)}
                            className="mr-2"
                        />
                        Sim
                    </label>
                    <label className="flex items-center">
                        <input
                            type="radio"
                            checked={data.corredica === false}
                            onChange={() => updateField('corredica', false)}
                            className="mr-2"
                        />
                        Não
                    </label>
                </div>
            </div>

            {/* OBS (Características gerais) */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    OBS (Características gerais)
                </label>
                <textarea
                    value={data.obs || ''}
                    onChange={(e) => updateField('obs', e.target.value)}
                    placeholder="Detalhes adicionais sobre o toldo..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
            </div>
        </div>
    );
};
