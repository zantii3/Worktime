import { useEffect, useState } from "react";

export type TimeRecord = {
  date: string;
  timeIn: string | null;
  lunchOut?: string | null;
  lunchIn?: string | null;
  timeOut?: string | null;
  device?: string;
  hours?: number;
};

export function useAttendance(userId?: string) {
  const today = new Date().toLocaleDateString("en-CA");

  const detectDevice = () => {
    if (typeof navigator === "undefined" || typeof window === "undefined") return "Desktop";
    const ua = navigator.userAgent.toLowerCase();
    const screenWidth = window.innerWidth;
    const isMobileUA = /android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
    const isTabletUA = /ipad|tablet|playbook|silk/.test(ua);
    const isMobileViewport = screenWidth <= 768;
    const isTabletViewport = screenWidth > 768 && screenWidth <= 1024;
    const hasTouch = () => "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isMobileUA || (isMobileViewport && hasTouch())) return "Mobile";
    if (isTabletUA || isTabletViewport) return "Tablet";
    return "Desktop";
  };

  const storageKey = `attendance_${userId || "user"}_${today}`;

  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored) as TimeRecord;
    return {
      date: today,
      timeIn: null,
      lunchOut: null,
      lunchIn: null,
      timeOut: null,
      device: detectDevice(),
      hours: 0,
    };
  });

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (todayRecord) {
      localStorage.setItem(storageKey, JSON.stringify(todayRecord));
    }
  }, [todayRecord, storageKey]);

  const handleTimeIn = () => {
    if (todayRecord?.timeIn) return;
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 800);
    const now = new Date();
    setTodayRecord({
      ...todayRecord!,
      timeIn: now.toISOString(),
      device: detectDevice(),
    });
  };

  const handleLunchOut = () => {
    if (!todayRecord?.timeIn || todayRecord.lunchOut) return;
    const now = new Date();
    setTodayRecord({ ...todayRecord, lunchOut: now.toISOString() });
  };

  const handleLunchIn = () => {
    if (!todayRecord?.lunchOut || todayRecord.lunchIn) return;
    const now = new Date();
    setTodayRecord({ ...todayRecord, lunchIn: now.toISOString() });
  };

  const handleTimeOut = () => {
    if (!todayRecord?.timeIn || todayRecord.timeOut) return;
    const now = new Date();
    const timeInDate = new Date(todayRecord.timeIn as string);
    let totalMilliseconds = now.getTime() - timeInDate.getTime();
    if (todayRecord.lunchOut && todayRecord.lunchIn) {
      const lunchOutDate = new Date(todayRecord.lunchOut as string);
      const lunchInDate = new Date(todayRecord.lunchIn as string);
      totalMilliseconds -= lunchInDate.getTime() - lunchOutDate.getTime();
    }
    const hours = totalMilliseconds / 1000 / 60 / 60;
    setTodayRecord({ ...todayRecord, timeOut: now.toISOString(), hours: parseFloat(hours.toFixed(2)) });
  };

  const getStatus = () => {
    if (!todayRecord?.timeIn) return "Not Clocked In";
    if (todayRecord.timeOut) return "Clocked Out";
    return "Clocked In";
  };

  const calculateElapsedTime = () => {
    if (!todayRecord?.timeIn) return "0h 0m";
    const timeInDate = new Date(todayRecord.timeIn as string);
    const now = todayRecord.timeOut ? new Date(todayRecord.timeOut) : new Date();
    const diff = now.getTime() - timeInDate.getTime();
    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    return `${hours}h ${minutes}m`;
  };

  return {
    todayRecord,
    setTodayRecord,
    isAnimating,
    handleTimeIn,
    handleLunchOut,
    handleLunchIn,
    handleTimeOut,
    getStatus,
    calculateElapsedTime,
  } as const;
}
