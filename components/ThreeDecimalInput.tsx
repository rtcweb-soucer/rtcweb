import * as React from 'react';
import { useState, useEffect } from 'react';

interface ThreeDecimalInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    placeholder?: string;
}

const ThreeDecimalInput = ({
    value,
    onChange,
    className = "",
    placeholder = "0,000"
}: ThreeDecimalInputProps) => {
    const [displayValue, setDisplayValue] = useState("");

    // Sincroniza o valor externo com o estado local formatado
    useEffect(() => {
        if (value === 0 && !displayValue) {
            setDisplayValue("");
        } else {
            // Formata o número para 3 casas decimais com vírgula
            setDisplayValue(value.toLocaleString('pt-BR', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            }));
        }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Permite apenas números e Backspace
        const isNumber = /^[0-9]$/.test(e.key);
        const isBackspace = e.key === 'Backspace';

        if (!isNumber && !isBackspace && e.key !== 'Tab') {
            e.preventDefault();
            return;
        }

        if (e.key === 'Tab') return;

        e.preventDefault();

        // Pega apenas os dígitos do valor atual
        let digits = value.toFixed(3).replace(/\D/g, "");

        // Remove zeros à esquerda (exceto se for apenas zero)
        digits = digits.replace(/^0+/, "");
        if (digits === "") digits = "";

        if (isNumber) {
            digits += e.key;
        } else if (isBackspace) {
            digits = digits.slice(0, -1);
        }

        // Se estiver vazio, o valor é zero
        if (digits === "") {
            onChange(0);
            return;
        }

        // Converte de volta para número (tratando como milésimos)
        const newValue = parseInt(digits, 10) / 1000;
        onChange(newValue);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={() => { }} // Controlado via handleKeyDown
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`text-right ${className}`}
        />
    );
};

export default ThreeDecimalInput;
