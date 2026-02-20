// Format a date/time string into "HH:MM" or return "--:--" if undefined
export const formatTime = (date?: string | number | Date) => {
  if (!date) return "--:--";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Calculate elapsed time from timeIn to timeOut (or now)
export const calculateElapsedTime = (record: {
  timeIn?: string;
  lunchOut?: string;
  lunchIn?: string;
  timeOut?: string;
}) => {
  if (!record.timeIn) return "--:--:--";
  const start = new Date(record.timeIn).getTime();
  const end = record.timeOut ? new Date(record.timeOut).getTime() : Date.now();

  const elapsed = end - start;
  const hours = Math.floor(elapsed / 1000 / 60 / 60);
  const minutes = Math.floor((elapsed / 1000 / 60) % 60);
  const seconds = Math.floor((elapsed / 1000) % 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
