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
  const [attendanceData, setAttendanceData] = useState<TimeRecord[]>([]);
  const isClient = typeof window !== "undefined" && typeof navigator !== "undefined";

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
    if (!isClient) return null;
    const stored = window.localStorage.getItem(storageKey);
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
    if (!isClient) return;
    if (todayRecord) {
      window.localStorage.setItem(storageKey, JSON.stringify(todayRecord));
    }
  }, [todayRecord, storageKey, isClient]);

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
    if (!todayRecord?.timeIn) return "00:00:00";
    const start = new Date(todayRecord.timeIn as string).getTime();
    const end = todayRecord.timeOut
      ? new Date(todayRecord.timeOut as string).getTime()
      : Date.now();

    const diff = end - start;
    const hrs = Math.floor(diff / 1000 / 60 / 60);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!userId) return;
    if (!isClient) return;

    const loadAllRecords = () => {
      const records: TimeRecord[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);

        if (key?.startsWith(`attendance_${userId}_`)) {
          try {
            const raw = window.localStorage.getItem(key) || "{}";
            const record = JSON.parse(raw) as TimeRecord;
            if (record && record.date) records.push(record);
          } catch {
            // ignore bad record
          }
        }
      }

      const uniqueRecords = Array.from(
        new Map(records.map((r) => [r.date, r])).values()
      );

      setAttendanceData(uniqueRecords);
    };

    loadAllRecords();
  }, [userId, todayRecord, isClient]);


  // add standard shift constant inside module scope
  const STANDARD_SHIFT_MINUTES = 9 * 60; // 9 hours including lunch

  const calculateWorkDetails = () => {
    if (!todayRecord?.timeIn) {
      return {
        totalMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        progressPct: 0,
      };
    }

    const start = new Date(todayRecord.timeIn as string);
    const end = todayRecord.timeOut
      ? new Date(todayRecord.timeOut as string)
      : new Date();

    // TOTAL shift time (NO lunch deduction)
    const totalMinutes = Math.floor(
      (end.getTime() - start.getTime()) / 60000
    );

    const regularMinutes = Math.min(
      totalMinutes,
      STANDARD_SHIFT_MINUTES
    );

    const overtimeMinutes =
      totalMinutes > STANDARD_SHIFT_MINUTES
        ? totalMinutes - STANDARD_SHIFT_MINUTES
        : 0;

    const progressPct = Math.min(
      (regularMinutes / STANDARD_SHIFT_MINUTES) * 100,
      100
    );

    return {
      totalMinutes,
      regularMinutes,
      overtimeMinutes,
      progressPct,
    };
  };

  return {
    todayRecord,
    attendanceData,
    setTodayRecord,
    isAnimating,
    handleTimeIn,
    handleLunchOut,
    handleLunchIn,
    handleTimeOut,
    getStatus,
    calculateElapsedTime,
    calculateWorkDetails,
  } as const;
}
