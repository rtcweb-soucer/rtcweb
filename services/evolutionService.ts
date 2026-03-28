export const evolutionService = {
  async sendMessage(number: string, text: string) {
    try {
      const response = await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, text })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar WhatsApp');
      
      return data;
    } catch (err) {
      console.error('EvolutionService Error:', err);
      throw err;
    }
  }
};
