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
    const [isFocused, setIsFocused] = useState(false);

    // Sincroniza o valor externo com o estado local formatado
    useEffect(() => {
        if (isFocused) return; // Não atualiza enquanto o usuário está digitando

        if (value === 0) {
            setDisplayValue("");
        } else {
            // Formata o número para 3 casas decimais com vírgula
            setDisplayValue(value.toLocaleString('pt-BR', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            }));
        }
    }, [value, isFocused]);

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

        // Se é o primeiro caractere após o foco, começamos do zero 
        // a menos que o valor já fosse zero e o usuário esteja apenas continuando
        let digits = "";

        // Se já tiver algo no display ou se o valor for diferente de zero, 
        // e ele NÃO acabou de focar (ou seja, já começou a digitar), pegamos os dígitos atuais.
        // Mas a regra do usuário é: clicou -> limpa -> começa do zero.
        if (displayValue !== "") {
            digits = displayValue.replace(/\D/g, "");
        }

        if (isNumber) {
            digits += e.key;
        } else if (isBackspace) {
            digits = digits.slice(0, -1);
        }

        // Se estiver vazio, o valor é zero e mostramos vazio no foco
        if (digits === "" || digits === "000") {
            setDisplayValue("");
            onChange(0);
            return;
        }

        // Converte de volta para número (tratando como milésimos)
        const newValue = parseInt(digits, 10) / 1000;

        // Atualiza o display local imediatamente para feedback visual
        setDisplayValue(newValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }));

        onChange(newValue);
    };

    const handleFocus = () => {
        setIsFocused(true);
        setDisplayValue(""); // Limpa ao focar
    };

    const handleBlur = () => {
        setIsFocused(false);
        // O useEffect vai cuidar de restaurar o valor formatado se o valor for > 0
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={() => { }}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={`text-right ${className}`}
        />
    );
};

export default ThreeDecimalInput;
