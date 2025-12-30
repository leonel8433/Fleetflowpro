
/**
 * Verifica se um veículo está no rodízio de São Paulo em uma determinada data.
 * Regras:
 * Seg: 1 e 2 | Ter: 3 e 4 | Qua: 5 e 6 | Qui: 7 e 8 | Sex: 9 e 0
 * Horários: 7h-10h e 17h-20h (Aqui validamos apenas o dia)
 */
export const checkSPRodizio = (plate: string, date: Date = new Date()) => {
  const dayOfWeek = date.getDay(); // 0 (Dom) a 6 (Sab)
  
  // Limpa a placa e pega o último caractere
  const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '');
  const lastDigit = parseInt(cleanPlate.slice(-1));

  if (isNaN(lastDigit)) return false;

  const rules: Record<number, number[]> = {
    1: [1, 2], // Segunda
    2: [3, 4], // Terça
    3: [5, 6], // Quarta
    4: [7, 8], // Quinta
    5: [9, 0], // Sexta
  };

  const restrictedDigits = rules[dayOfWeek];
  return restrictedDigits ? restrictedDigits.includes(lastDigit) : false;
};

export const getRodizioDayLabel = (plate: string) => {
  const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '');
  const lastDigit = parseInt(cleanPlate.slice(-1));
  
  if (lastDigit === 1 || lastDigit === 2) return "Segunda-feira";
  if (lastDigit === 3 || lastDigit === 4) return "Terça-feira";
  if (lastDigit === 5 || lastDigit === 6) return "Quarta-feira";
  if (lastDigit === 7 || lastDigit === 8) return "Quinta-feira";
  if (lastDigit === 9 || lastDigit === 0) return "Sexta-feira";
  return "";
};
