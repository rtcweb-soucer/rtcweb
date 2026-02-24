import * as React from 'react';
import { ProductionSheetCobertura } from '../../types';
import ThreeDecimalInput from '../ThreeDecimalInput';

interface CoberturaFormProps {
    data: Partial<ProductionSheetCobertura>;
    onChange: (data: Partial<ProductionSheetCobertura>) => void;
}

export const CoberturaForm: React.FC<CoberturaFormProps> = ({ data, onChange }) => {
    const updateField = (field: keyof ProductionSheetCobertura, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">🏠 Especificações da Cobertura</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {/* Altura da Instalação */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        ALTURA DA INSTALAÇÃO
                    </label>
                    <ThreeDecimalInput
                        value={parseFloat(data.alturaInstalacao?.toString() || '0') || 0}
                        onChange={(val) => updateField('alturaInstalacao', val)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Caída */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        CAÍDA
                    </label>
                    <ThreeDecimalInput
                        value={parseFloat(data.caida?.toString() || '0') || 0}
                        onChange={(val) => updateField('caida', val)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Calha Saída */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        CALHA SAÍDA
                    </label>
                    <select
                        value={data.calhaSaida || ''}
                        onChange={(e) => updateField('calhaSaida', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Selecione...</option>
                        <option value="40">40</option>
                        <option value="70">70</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
