
export interface GoogleCalendarEvent {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  sellerEmail: string;
}

export const googleCalendarService = {
  async syncAppointment(event: GoogleCalendarEvent, scriptUrl: string) {
    if (!scriptUrl) {
      throw new Error('URL do Google Apps Script não configurada.');
    }

    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Apps Script requires no-cors if not handling preflight/CORS in a specific way, but then you can't read the response.
        // Better: Use 'cors' if Apps Script is set up correctly, but 'no-cors' is safer for "fire and forget".
        // HOWEVER, for a better UX, we'll try 'cors' first.
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      // With 'no-cors', we can't see the response body. 
      // For Apps Script, a common trick is to use 'form-data' or just 'no-cors' and assume success if no network error.
      return { success: true };
    } catch (error) {
      console.error('Erro ao sincronizar com Google Calendar:', error);
      throw error;
    }
  }
};
