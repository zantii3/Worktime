export const daysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

export const firstDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 1).getDay();
