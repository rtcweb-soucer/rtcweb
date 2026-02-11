import * as React from 'react';
import { ProductionSheetCortina } from '../../types';

interface CortinaFormProps {
    data: Partial<ProductionSheetCortina>;
    onChange: (data: Partial<ProductionSheetCortina>) => void;
}

export const CortinaForm: React.FC<CortinaFormProps> = ({ data, onChange }) => {
    const updateField = (field: keyof ProductionSheetCortina, value: any) => {
        onChange({ ...data, [field]: value });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">📋 Especificações da Cortina</h3>

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
                    <option value="Central">Central</option>
                    <option value="Direita">Direita</option>
                    <option value="Esquerda">Esquerda</option>
                    <option value="Invertido">Invertido</option>
                    <option value="Junção">Junção</option>
                    <option value="Motorizado D">Motorizado D</option>
                    <option value="Motorizado E">Motorizado E</option>
                </select>
            </div>

            {/* Vão */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    VÃO
                </label>
                <select
                    value={data.vao || ''}
                    onChange={(e) => updateField('vao', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">Selecione...</option>
                    <option value="Altura">Altura</option>
                    <option value="Largura">Largura</option>
                    <option value="Largura x Altura">Largura x Altura</option>
                    <option value="Fora de Vão">Fora de Vão</option>
                </select>
            </div>

            {/* Varão Cor */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    VARÃO COR
                </label>
                <select
                    value={data.varaoCor || ''}
                    onChange={(e) => updateField('varaoCor', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">Selecione...</option>
                    <option value="Aço">Aço</option>
                    <option value="Branco">Branco</option>
                    <option value="Cromado">Cromado</option>
                    <option value="Escovado">Escovado</option>
                    <option value="Madeira">Madeira</option>
                    <option value="Ouro Velho">Ouro Velho</option>
                </select>
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
                    <option value="Parede Alumínio">Parede Alumínio</option>
                    <option value="Parede Concreto">Parede Concreto</option>
                    <option value="Parede Gesso">Parede Gesso</option>
                    <option value="Parede Madeira">Parede Madeira</option>
                    <option value="Teto Alumínio">Teto Alumínio</option>
                    <option value="Teto Concreto">Teto Concreto</option>
                    <option value="Teto Gesso">Teto Gesso</option>
                    <option value="Teto Madeira">Teto Madeira</option>
                </select>
            </div>

            {/* Trilho */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    TRILHO
                </label>
                <select
                    value={data.trilho || ''}
                    onChange={(e) => updateField('trilho', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">Selecione...</option>
                    <option value="1 Via">1 Via</option>
                    <option value="2 Vias">2 Vias</option>
                    <option value="3 Vias">3 Vias</option>
                    <option value="4 Vias">4 Vias</option>
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
                    <option value="Modulo Inteiro/Individuais">Modulo Inteiro/Individuais</option>
                </select>
            </div>
        </div>
    );
};
