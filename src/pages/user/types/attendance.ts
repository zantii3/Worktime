export interface TimeRecord {
  date: string;
  timeIn: string | null;
  lunchOut: string | null
  lunchIn: string | null;
  timeOut: string | null;
  device: string;
  hours: number;
}