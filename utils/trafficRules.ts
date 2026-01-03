
/**
 * Verifica se um veículo está no rodízio de São Paulo em uma determinada data.
 * Regras SP:
 * Seg: 1 e 2 | Ter: 3 e 4 | Qua: 5 e 6 | Qui: 7 e 8 | Sex: 9 e 0
 * @param plate Placa do veículo (ex: ABC-1234 ou ABC1D23)
 * @param date Objeto Date para validação
 */
export const checkSPRodizio = (plate: string, date: Date): boolean => {
  // 0: Domingo, 1: Segunda, ..., 5: Sexta, 6: Sábado
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sem rodízio fins de semana

  // Captura o último caractere da placa (dígito final)
  const lastChar = plate.trim().slice(-1);
  const lastDigit = parseInt(lastChar);
  
  if (isNaN(lastDigit)) return false;

  const restrictions: Record<number, number[]> = {
    1: [1, 2], // Segunda
    2: [3, 4], // Terça
    3: [5, 6], // Quarta
    4: [7, 8], // Quinta
    5: [9, 0], // Sexta
  };

  return restrictions[day]?.includes(lastDigit) || false;
};

/**
 * Identifica se uma localidade refere-se a São Paulo (Cidade ou Estado)
 */
export const isLocationSaoPaulo = (city?: string, state?: string, destination?: string): boolean => {
  const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const c = norm(city);
  const s = norm(state);
  const d = norm(destination);

  // Verifica cidade, UF ou se o destino termina com " SP" ou contém "sao paulo"
  return c.includes('sao paulo') || 
         c === 'sp' || 
         s === 'sp' || 
         s.includes('sao paulo') || 
         d.includes('sao paulo') || 
         d.endsWith(' sp');
};

/**
 * Retorna o nome do dia da semana em que o veículo possui restrição de rodízio.
 */
export const getRodizioDayLabel = (plate: string): string => {
  const lastChar = plate.trim().slice(-1);
  const lastDigit = parseInt(lastChar);
  
  if (isNaN(lastDigit)) return 'Placa Inválida';

  if (lastDigit === 1 || lastDigit === 2) return 'Segunda-feira';
  if (lastDigit === 3 || lastDigit === 4) return 'Terça-feira';
  if (lastDigit === 5 || lastDigit === 6) return 'Quarta-feira';
  if (lastDigit === 7 || lastDigit === 8) return 'Quinta-feira';
  if (lastDigit === 9 || lastDigit === 0) return 'Sexta-feira';
  
  return 'Sem restrição';
};
