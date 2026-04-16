import { Product } from '../types';

interface PriceDimensions {
  width: number;
  height: number;
  qty: number;
}

/**
 * Calculates the total price of a product based on its configuration,
 * dimensions, and optional formula.
 */
export const calculateProductPrice = (
  product: Product,
  dimensions: PriceDimensions
): number => {
  const { width, height, qty } = dimensions;
  const valor = product.valor || 0;

  // 1. If product has a custom formula, use it
  if (product.priceFormula && product.priceFormula.trim() !== '') {
    try {
      let formula = product.priceFormula;

      // Substituir variáveis (case-insensitive for convenience but using specific tokens)
      // Usamos regex com \b para garantir que não substitua partes de palavras
      formula = formula.replace(/\bLarg\b/gi, width.toString());
      formula = formula.replace(/\bAlt\b/gi, height.toString());
      formula = formula.replace(/\bQtd\b/gi, qty.toString());
      formula = formula.replace(/\bValor\b/gi, valor.toString());

      // Sanitização rigorosa: permitir apenas números, operadores básicos, pontos e parênteses
      // Remove qualquer caractere que não seja 0-9, +, -, *, /, ., (, ) ou espaço
      const sanitizedFormula = formula.replace(/[^0-9+\-*/.() ]/g, '');

      // Avaliação segura da expressão matemática
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitizedFormula}`)();
      
      const totalPrice = Number(result);
      if (isNaN(totalPrice)) throw new Error('Resultado não é um número');
      
      return totalPrice;
    } catch (error) {
      console.error(`Erro ao calcular fórmula para o produto ${product.nome}:`, error);
      // Fallback para o cálculo padrão em caso de erro na fórmula
    }
  }

  // 2. Standard Logic
  if (product.unidade === 'M2') {
    return valor * width * height * qty;
  }
  
  // Default is unitary: Valor * Qtd
  return valor * qty;
};
