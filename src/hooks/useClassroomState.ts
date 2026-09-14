"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ClassroomStudent,
  ClassroomRoutine,
  TaxConfig,
  CustomBundle,
  LedgerRecord,
  BoardTheme,
  NoticeFontSize,
  FreeCardData,
  BoardElementLayouts,
} from "@/types/classroom";
import { calculateTax, DEFAULT_TAX_CONFIG } from "@/lib/taxEngine";
import { DEFAULT_BUNDLES } from "@/lib/defaultBundles";
import { DEFAULT_LAYOUTS, DEFAULT_NOTICE_CARD } from "@/lib/boardDefaults";
import { parsePinchHitters, parsePinchHitterDetails, serializePinchHitters, resolveStudentName } from "@/lib/routineUtils";
import { updateCurrencyName, saveClassroomSnapshot, loadClassroomSnapshot } from "@/app/actions";
import { checkStudentRoutinePaid } from "@/lib/routinePayStatus";

export interface ClassroomStateOptions {
  initialCurrencyName?: string;
  initialClassName?: string;
}

export function useClassroomState(options?: ClassroomStateOptions) {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [className, setClassName] = useState(options?.initialClassName || "우리 반");
  const [currencyName, setCurrencyName] = useState(options?.initialCurrencyName || "원");
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [routines, setRoutines] = useState<ClassroomRoutine[]>([]);
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [totalTaxCollected, setTotalTaxCollected] = useState(0);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(DEFAULT_TAX_CONFIG);
  const [customBundles, setCustomBundles] = useState<CustomBundle[]>(DEFAULT_BUNDLES);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerRecord[]>([]);
  const [undoneLedgerHistory, setUndoneLedgerHistory] = useState<LedgerRecord[]>([]);

  // Notice Board state
  const [noticeTarget, setNoticeTarget] = useState<"today" | "tomorrow">("today");
  const [theme, setTheme] = useState<BoardTheme>("chalkboard");
  const [fontSize, setFontSize] = useState<NoticeFontSize>("42");
  const [freeCards, setFreeCards] = useState<FreeCardData[]>([DEFAULT_NOTICE_CARD]);
  const [layouts, setLayouts] = useState<BoardElementLayouts>(DEFAULT_LAYOUTS);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Debounce timer ref for background DB sync (does NOT affect UI reactivity)
  const dbSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper: apply parsed snapshot object to state
  const applyParsedState = useCallback((parsed: Record<string, unknown>, initialCurrencyName?: string) => {
    const MOCK_BUNDLE_IDS = ["bundle-basic-income", "bundle-job-salary", "bundle-seat-rent", "bundle-1", "bundle-2", "bundle-3"];
    if (parsed.className) setClassName(parsed.className as string);
    if (initialCurrencyName && (parsed.currencyName === "미소" || !parsed.currencyName)) {
      setCurrencyName(initialCurrencyName);
    } else if (parsed.currencyName) {
      setCurrencyName(parsed.currencyName as string);
    } else if (initialCurrencyName) {
      setCurrencyName(initialCurrencyName);
    }
    if (Array.isArray(parsed.students)) setStudents(parsed.students as ClassroomStudent[]);
    if (Array.isArray(parsed.routines)) setRoutines(parsed.routines as ClassroomRoutine[]);
    if (typeof parsed.treasuryBalance === "number") setTreasuryBalance(parsed.treasuryBalance);
    if (typeof parsed.totalTaxCollected === "number") setTotalTaxCollected(parsed.totalTaxCollected);
    if (parsed.taxConfig) setTaxConfig({ ...DEFAULT_TAX_CONFIG, ...(parsed.taxConfig as TaxConfig) });
    if (Array.isArray(parsed.customBundles)) {
      setCustomBundles((parsed.customBundles as CustomBundle[]).filter((b) => !MOCK_BUNDLE_IDS.includes(b.id)));
    }
    if (Array.isArray(parsed.ledgerHistory)) setLedgerHistory(parsed.ledgerHistory as LedgerRecord[]);
    if (parsed.theme) setTheme(parsed.theme as BoardTheme);
    if (parsed.fontSize) setFontSize(parsed.fontSize as NoticeFontSize);
    if (Array.isArray(parsed.freeCards)) {
      const loaded = parsed.freeCards as FreeCardData[];
      const hasNoticeBox = loaded.some((c) => c.id === "noticeBox");
      if (!hasNoticeBox) {
        const oldLayout = (parsed.layouts as Record<string, unknown> | undefined)?.noticeBox as Partial<FreeCardData> | undefined;
        const migratedCard: FreeCardData = {
          ...DEFAULT_NOTICE_CARD,
          html: typeof parsed.noticeText === "string" ? parsed.noticeText : "",
          ...(oldLayout ? {
            left: (oldLayout.left as string) || DEFAULT_NOTICE_CARD.left,
            top: (oldLayout.top as string) || DEFAULT_NOTICE_CARD.top,
            width: (oldLayout.width as string) || DEFAULT_NOTICE_CARD.width,
            height: (oldLayout.height as string) || DEFAULT_NOTICE_CARD.height,
            fontSize: (oldLayout.fontSize as number) || DEFAULT_NOTICE_CARD.fontSize,
            color: oldLayout.color as string | undefined,
            align: oldLayout.align as FreeCardData["align"],
            fontFamily: oldLayout.fontFamily as string | undefined,
            lineHeight: oldLayout.lineHeight as number | undefined,
            visible: oldLayout.visible !== false,
            visibleDays: oldLayout.visibleDays as number[] | undefined,
          } : {}),
        };
        setFreeCards([migratedCard, ...loaded]);
      } else {
        setFreeCards(loaded);
      }
    } else if (typeof parsed.noticeText === "string") {
      setFreeCards([{ ...DEFAULT_NOTICE_CARD, html: parsed.noticeText }]);
    }
    if (parsed.layouts) setLayouts(parsed.layouts as BoardElementLayouts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load from localStorage on client mount; DB fallback if localStorage is empty
  useEffect(() => {
    setIsMounted(true);
    const doLoad = async () => {
      try {
        const savedLayouts = localStorage.getItem("classroom_board_layouts");
        if (savedLayouts) {
          const parsedLayouts = JSON.parse(savedLayouts);
          if (parsedLayouts.dateBox && parsedLayouts.clockBox && parsedLayouts.routineBox) {
            setLayouts({ ...DEFAULT_LAYOUTS, ...parsedLayouts, accountBox: parsedLayouts.accountBox || DEFAULT_LAYOUTS.accountBox });
          }
        }
      } catch {
        // noop
      }
      try {
        const savedV3 = localStorage.getItem("classroom_os_state_v3");
        const savedV2 = localStorage.getItem("classroom_os_state_v2");
        const saved = savedV3 || savedV2;
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, unknown>;
          applyParsedState(parsed, options?.initialCurrencyName);
          // If migrated from v2, immediately persist into v3
          if (!savedV3 && savedV2) {
            try { localStorage.setItem("classroom_os_state_v3", savedV2); } catch { /* noop */ }
          }
          setIsLoaded(true);
          return;
        }
      } catch {
        // localStorage parse error — fall through to DB
      }
      // DB fallback: localStorage was empty or parse failed
      try {
        const dbData = await loadClassroomSnapshot();
        if (dbData) {
          const parsed = JSON.parse(dbData) as Record<string, unknown>;
          applyParsedState(parsed, options?.initialCurrencyName);
          // Repopulate localStorage from DB so next load is fast
          try { localStorage.setItem("classroom_os_state_v3", dbData); } catch { /* noop */ }
        }
      } catch {
        // DB also unavailable — start fresh
      } finally {
        setIsLoaded(true);
      }
    };
    doLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup DB sync timer on unmount
  useEffect(() => {
    return () => {
      if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
    };
  }, []);

  // Save to localStorage (instant) & schedule debounced DB save & Broadcast to student window
  useEffect(() => {
    if (!isMounted) return;
    const primaryNoticeHtml = freeCards.find((c) => c.id === "noticeBox")?.html || "";
    const payload = {
      className,
      currencyName,
      students,
      routines,
      treasuryBalance,
      totalTaxCollected,
      taxConfig,
      customBundles,
      ledgerHistory,
      theme,
      fontSize,
      freeCards,
      noticeTarget,
      layouts,
    };
    const json = JSON.stringify(payload);

    // 1) Instant: localStorage for zero-latency UI
    try { localStorage.setItem("classroom_os_state_v3", json); } catch { /* noop */ }

    // 2) Debounced: DB write 1.5s after last state change (Write-through cache)
    if (dbSyncTimerRef.current) clearTimeout(dbSyncTimerRef.current);
    dbSyncTimerRef.current = setTimeout(() => {
      saveClassroomSnapshot(json).catch(() => { /* silent background failure */ });
    }, 1500);

    // 3) Instant: BroadcastChannel to student window & navbar
    try {
      const channel = new BroadcastChannel("classroom_os_sync");
      channel.postMessage({
        className,
        currencyName,
        treasuryBalance,
        totalTaxCollected,
        noticeText: primaryNoticeHtml,
        content: primaryNoticeHtml,
        fontSize,
        theme,
        targetLabel: noticeTarget === "today" ? "오늘" : "내일",
        routines,
        students,
        freeCards,
        layouts,
        ledgerHistory,
        undoneLedgerHistory,
      });
      channel.close();
    } catch { /* noop */ }

    // 4) Instant: window CustomEvent for same-tab instant sync
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("classroom_state_sync", {
            detail: { treasuryBalance, currencyName, className, ledgerHistory, undoneLedgerHistory, students },
          })
        );
      }
    } catch { /* noop */ }
  }, [
    isMounted,
    className,
    currencyName,
    students,
    routines,
    treasuryBalance,
    totalTaxCollected,
    taxConfig,
    customBundles,
    ledgerHistory,
    theme,
    fontSize,
    freeCards,
    noticeTarget,
    layouts,
  ]);

  const updateLayouts = useCallback(
    (updater: (prev: BoardElementLayouts) => BoardElementLayouts) => {
      setLayouts((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        try {
          localStorage.setItem("classroom_board_layouts", JSON.stringify(next));
          const channel = new BroadcastChannel("classroom_os_sync");
          channel.postMessage({ layouts: next });
          channel.close();
        } catch {
          // noop
        }
        return next;
      });
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // 설정 탭 등 타 탭의 리셋 및 브로드캐스트 동기화 리스너
  useEffect(() => {
    const handleBroadcast = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;
      if (data.resetType === "economy") {
        setStudents((prev) => prev.map((s) => ({ ...s, balance: 0 })));
        setTreasuryBalance(0);
        setTotalTaxCollected(0);
        setLedgerHistory([]);
        showToast("학급 화폐 및 잔액이 초기화되었습니다.");
      } else if (data.resetType === "students") {
        setStudents([]);
        setRoutines((prev) =>
          prev.map((r) => ({ ...r, order: [], currentIdx: 0, pinchHitterStudent: undefined }))
        );
        setTreasuryBalance(0);
        setTotalTaxCollected(0);
        setLedgerHistory([]);
        showToast("학생 명단이 초기화되었습니다.");
      } else if (data.resetType === "routines") {
        setRoutines([]);
        showToast("학생 업무가 초기화되었습니다.");
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_os_sync");
      channel.addEventListener("message", handleBroadcast);
    } catch {
      // ignore
    }

    return () => {
      if (channel) {
        channel.removeEventListener("message", handleBroadcast);
        channel.close();
      }
    };
  }, [showToast]);

  // --- 전역 칠판 상태 히스토리 (통합 Undo / Redo) ---
  interface BoardHistorySnapshot {
    freeCards: FreeCardData[];
    layouts: BoardElementLayouts;
    routines: ClassroomRoutine[];
    theme: BoardTheme;
    fontSize: NoticeFontSize;
  }

  const historyRef = useRef<BoardHistorySnapshot[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const isUndoingRef = useRef<boolean>(false);
  const lastSnapshotJsonRef = useRef<string>("");
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // 칠판 시각 상태(카드 내용/위치/크기/서식, 레이아웃, 루틴 순환, 테마, 폰트) 변경 시 스냅샷 기록
  useEffect(() => {
    if (!isLoaded || isUndoingRef.current) return;

    const snapshot: BoardHistorySnapshot = {
      freeCards: JSON.parse(JSON.stringify(freeCards)),
      layouts: JSON.parse(JSON.stringify(layouts)),
      routines: JSON.parse(JSON.stringify(routines)),
      theme,
      fontSize,
    };
    const json = JSON.stringify(snapshot);
    if (json === lastSnapshotJsonRef.current) return;

    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    // 첫 로드 시 즉시 기록(0ms), 텍스트 타이핑 및 연속 드래그는 400ms 디바운스
    const delay = historyIdxRef.current === -1 ? 0 : 400;

    historyTimerRef.current = setTimeout(() => {
      lastSnapshotJsonRef.current = json;
      const nextStack = historyRef.current.slice(0, historyIdxRef.current + 1);
      nextStack.push(snapshot);
      if (nextStack.length > 30) nextStack.shift();
      historyRef.current = nextStack;
      historyIdxRef.current = nextStack.length - 1;
      setCanUndo(historyIdxRef.current > 0);
      setCanRedo(false);
    }, delay);

    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, [isLoaded, freeCards, layouts, routines, theme, fontSize]);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) {
      showToast("더 이상 실행 취소할 내역이 없습니다.");
      return;
    }
    historyIdxRef.current -= 1;
    const target = historyRef.current[historyIdxRef.current];
    if (!target) return;

    isUndoingRef.current = true;
    lastSnapshotJsonRef.current = JSON.stringify(target);
    setFreeCards(target.freeCards);
    setLayouts(target.layouts);
    setRoutines(target.routines);
    setTheme(target.theme);
    setFontSize(target.fontSize);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
    showToast("실행 취소되었습니다.");
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 150);
  }, [showToast]);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) {
      showToast("더 이상 다시 실행할 내역이 없습니다.");
      return;
    }
    historyIdxRef.current += 1;
    const target = historyRef.current[historyIdxRef.current];
    if (!target) return;

    isUndoingRef.current = true;
    lastSnapshotJsonRef.current = JSON.stringify(target);
    setFreeCards(target.freeCards);
    setLayouts(target.layouts);
    setRoutines(target.routines);
    setTheme(target.theme);
    setFontSize(target.fontSize);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
    showToast("다시 실행되었습니다.");
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 150);
  }, [showToast]);

  // Update currency name and sync to server DB
  const handleSetCurrencyName = useCallback((newName: string) => {
    setCurrencyName(newName);
    try {
      updateCurrencyName(newName).catch(() => {});
    } catch {
      // Ignore background sync errors
    }
  }, []);


  // Helper to add ledger record

  const addLedgerEntry = useCallback(
    (
      type: string,
      from: string,
      to: string,
      targetDisplay: string,
      desc: string,
      amount: number,
      tax: number,
      targets: string[]
    ) => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const newRecord: LedgerRecord = {
        id: Date.now() + Math.random(),
        date: dateStr,
        type,
        from,
        to,
        targetDisplay,
        desc,
        amount,
        tax: tax || 0,
        targets,
      };

      setLedgerHistory((prev) => [newRecord, ...prev]);
      setUndoneLedgerHistory([]);
    },
    []
  );

  // 1. Student Actions
  const addStudents = useCallback(
    (names: string[]) => {
      const added: string[] = [];
      const skipped: string[] = [];

      setStudents((prev) => {
        let maxNo = prev.length > 0 ? Math.max(...prev.map((s) => s.no || 0)) : 0;
        const nextList = [...prev];

        for (const name of names) {
          if (nextList.some((s) => s.name === name)) {
            skipped.push(name);
          } else {
            maxNo += 1;
            nextList.push({ no: maxNo, name, balance: 0 });
            added.push(name);
          }
        }
        return nextList;
      });

      if (added.length === 1) {
        showToast(`'${added[0]}' 학생이 명단에 등록되었습니다.`);
      } else if (added.length > 1) {
        showToast(`총 ${added.length}명(${added.join(", ")}) 학생이 연속 등록되었습니다.`);
      }
      if (skipped.length > 0) {
        showToast(`이미 명단에 있는 이름 제외됨: ${skipped.join(", ")}`);
      }
    },
    [currencyName, showToast]
  );

  const deleteStudent = useCallback(
    (identifier: string | number) => {
      setStudents((prev) => {
        const target = prev.find((s) => s.name === identifier || s.no === identifier);
        if (!target) return prev;
        showToast(`'${target.name}' 학생이 명단에서 삭제되었습니다.`);
        return prev.filter((s) => s.name !== target.name && s.no !== target.no);
      });
    },
    [showToast]
  );

  // 2. Routine Actions
  const addRoutine = useCallback(
    (newRoutine: Omit<ClassroomRoutine, "id" | "currentIdx">) => {
      const id = `routine-${Date.now()}`;
      setRoutines((prev) => {
        const count = prev.length;
        const defaultLeft = `${2.5 + ((count * 26.0) % 75)}%`;
        const defaultTop = `${82.0 + Math.floor((count * 26.0) / 75) * 8.0}%`;
        const routineWithLayout: ClassroomRoutine = {
          ...newRoutine,
          id,
          currentIdx: 0,
          layout: newRoutine.layout || {
            left: defaultLeft,
            top: defaultTop,
            width: "auto",
            height: "auto",
          },
        };
        return [...prev, routineWithLayout];
      });
      showToast(`"${newRoutine.icon} ${newRoutine.name}" 업무가 새 요소로 등록되었습니다.`);
    },
    [showToast]
  );

  const deleteRoutine = useCallback(
    (id: string) => {
      setRoutines((prev) => {
        const r = prev.find((x) => x.id === id);
        if (r) showToast(`"${r.name}" 루틴이 삭제되었습니다.`);
        return prev.filter((x) => x.id !== id);
      });
    },
    [showToast]
  );

  const advanceRoutine = useCallback(
    (id: string) => {
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          if (r.order.length === 0) return r;
          const nextIdx = (r.currentIdx + r.slots) % r.order.length;
          return { ...r, currentIdx: nextIdx, pinchHitterStudent: undefined };
        })
      );
      showToast("업무 순환이 진행되었습니다. (당일 대타 설정 초기화)");
    },
    [showToast]
  );

  const rewindRoutine = useCallback(
    (id: string) => {
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          if (r.order.length === 0) return r;
          const prevIdx = (r.currentIdx - r.slots + r.order.length) % r.order.length;
          return { ...r, currentIdx: prevIdx, pinchHitterStudent: undefined };
        })
      );
      showToast("이전 순번으로 돌아갔습니다. (당일 대타 설정 초기화)");
    },
    [showToast]
  );

  const skipRoutineWorker = useCallback(
    (id: string) => {
      let skippedName = "";
      let nextName = "";
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== id || r.order.length <= 1) return r;
          const currentWorker = r.order[r.currentIdx % r.order.length];
          skippedName = resolveStudentName(currentWorker, students);
          const nextIdx = (r.currentIdx + 1) % r.order.length;
          nextName = resolveStudentName(r.order[nextIdx], students);
          return {
            ...r,
            currentIdx: nextIdx,
            prevIdxBeforeSkip: r.currentIdx,
            pinchHitterStudent: undefined,
          };
        })
      );
      if (skippedName && nextName) {
        showToast(`[건너뛰기] ${skippedName} 학생을 건너뛰고 ${nextName} 학생으로 순번이 1칸 밀렸습니다.`);
      }
    },
    [students, showToast]
  );

  const cancelSkipRoutineWorker = useCallback(
    (id: string) => {
      let restoredName = "";
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== id || r.order.length === 0 || r.prevIdxBeforeSkip === undefined) return r;
          const restoredIdx = r.prevIdxBeforeSkip;
          restoredName = resolveStudentName(r.order[restoredIdx % r.order.length], students);
          return {
            ...r,
            currentIdx: restoredIdx,
            prevIdxBeforeSkip: undefined,
          };
        })
      );
      if (restoredName) {
        showToast(`[건너뛰기 취소] 이전 순번(${restoredName})으로 복원되었습니다.`);
      }
    },
    [students, showToast]
  );

  const advanceAllRoutines = useCallback(() => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.order.length === 0) return r;
        const nextIdx = (r.currentIdx + r.slots) % r.order.length;
        return { ...r, currentIdx: nextIdx, pinchHitterStudent: undefined };
      })
    );
    showToast("전체 학생 업무 순환이 진행되었습니다.");
  }, [showToast]);

  const updateRoutineOrder = useCallback(
    (id: string, newOrder: string[]) => {
      setRoutines((prev) =>
        prev.map((r) => (r.id === id ? { ...r, order: newOrder, currentIdx: 0 } : r))
      );
      showToast("순환 순서가 저장되었습니다.");
    },
    [showToast]
  );

  const updateRoutine = useCallback(
    (id: string, patch: Partial<ClassroomRoutine>) => {
      setRoutines((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const payRoutineToday = useCallback(
    (id: string, customWorkerNames?: string[], applyTax: boolean = false) => {
      const r = routines.find((x) => x.id === id);
      if (!r || r.pay <= 0 || r.order.length === 0) return;

      const rawWorkers = Array.from(
        { length: r.slots },
        (_, i) => r.order[(r.currentIdx + i) % r.order.length]
      );

      const pinchMap = parsePinchHitters(r.pinchHitterStudent);
      const targetWorkers =
        customWorkerNames && customWorkerNames.length > 0
          ? customWorkerNames
          : rawWorkers.map((raw, idx) => {
              const sub = pinchMap[idx];
              return sub && sub !== "none" ? resolveStudentName(sub, students) : raw;
            });

      // 세금 공제: applyTax가 true이고 비과세가 아닐 때 단일 세율 적용
      const shouldDeductTax = applyTax && taxConfig.taxMethod !== "TAX_FREE";
      const taxPerWorker = shouldDeductTax ? calculateTax("income", r.pay, taxConfig) : 0;
      const netPay = Math.max(0, r.pay - taxPerWorker);

      // 이미 해당 주기(오늘 등)에 지급받은 학생 제외
      const payableWorkers = targetWorkers.filter(
        (wName) => !checkStudentRoutinePaid(r, wName, ledgerHistory).isPaid
      );
      const alreadyPaidWorkers = targetWorkers.filter(
        (wName) => checkStudentRoutinePaid(r, wName, ledgerHistory).isPaid
      );

      if (payableWorkers.length === 0) {
        showToast(`[급여 지급] ${r.name} 당번(${targetWorkers.join(", ")})이 이미 모두 급여를 받았습니다.`);
        return;
      }

      const paidNames: string[] = [];
      setStudents((prev) =>
        prev.map((s) => {
          if (payableWorkers.includes(s.name)) {
            paidNames.push(s.name);
            return { ...s, balance: s.balance + netPay };
          }
          return s;
        })
      );

      const totalTaxCollectedNow = taxPerWorker * paidNames.length;
      if (totalTaxCollectedNow > 0) {
        setTreasuryBalance((prev) => prev + totalTaxCollectedNow);
        setTotalTaxCollected((prev) => prev + totalTaxCollectedNow);
      }

      for (const name of paidNames) {
        addLedgerEntry(
          "입금",
          "학급 국고",
          name,
          name,
          `${r.name} 당번 급여 (${r.payCycle || "1회"})`,
          r.pay,
          taxPerWorker,
          [name]
        );
      }
      showToast(
        `[급여 지급] ${r.name} 담당 ${paidNames.join(", ")}에게 실지급 ${netPay.toLocaleString()} ${currencyName}${
          taxPerWorker > 0 ? ` (세금 ${taxPerWorker.toLocaleString()} ${currencyName} 원천징수)` : ""
        } 지급 완료${alreadyPaidWorkers.length > 0 ? ` (이미 지급된 ${alreadyPaidWorkers.join(", ")} 제외)` : ""}`
      );
    },
    [routines, taxConfig, currencyName, addLedgerEntry, showToast, ledgerHistory]
  );

  const payAllRoutinesToday = useCallback(
    (applyTax: boolean = false) => {
      const payable = routines.filter((r) => r.pay > 0 && r.order.length > 0);
      if (payable.length === 0) {
        showToast("지급할 급여가 책정된 학생 업무가 없습니다.");
        return;
      }

      const shouldDeductTax = applyTax && taxConfig.taxMethod !== "TAX_FREE";
      let totalTaxCollectedNow = 0;
      let totalWorkersCount = 0;
      let totalExcludedCount = 0;
      const paidRoutineNames: string[] = [];

      setStudents((prev) => {
        const nextStudents = [...prev];

        for (const r of payable) {
          const rawWorkers = Array.from(
            { length: r.slots },
            (_, i) => r.order[(r.currentIdx + i) % r.order.length]
          );
          const pinchMap = parsePinchHitters(r.pinchHitterStudent);
          const targetWorkers = rawWorkers.map((raw, idx) => {
            const sub = pinchMap[idx];
            return sub && sub !== "none" ? resolveStudentName(sub, students) : raw;
          });

          // 이미 지급된 당번 제외
          const unpaidWorkers = targetWorkers.filter(
            (wName) => !checkStudentRoutinePaid(r, wName, ledgerHistory).isPaid
          );
          totalExcludedCount += (targetWorkers.length - unpaidWorkers.length);
          if (unpaidWorkers.length === 0) continue;

          const taxPerWorker = shouldDeductTax ? calculateTax("income", r.pay, taxConfig) : 0;
          const netPay = Math.max(0, r.pay - taxPerWorker);

          let countForRoutine = 0;
          for (let i = 0; i < nextStudents.length; i++) {
            const s = nextStudents[i];
            if (unpaidWorkers.includes(s.name)) {
              nextStudents[i] = { ...s, balance: s.balance + netPay };
              totalTaxCollectedNow += taxPerWorker;
              countForRoutine++;
              addLedgerEntry(
                "입금",
                "학급 국고",
                s.name,
                s.name,
                `${r.name} 당번 급여 (${r.payCycle || "1회"})`,
                r.pay,
                taxPerWorker,
                [s.name]
              );
            }
          }
          if (countForRoutine > 0) {
            paidRoutineNames.push(r.name);
            totalWorkersCount += countForRoutine;
          }
        }

        return nextStudents;
      });

      if (totalTaxCollectedNow > 0) {
        setTreasuryBalance((prev) => prev + totalTaxCollectedNow);
        setTotalTaxCollected((prev) => prev + totalTaxCollectedNow);
      }

      if (totalWorkersCount === 0 && totalExcludedCount > 0) {
        showToast("모든 업무 당번이 이미 급여를 수령하여 추가 지급할 대상이 없습니다.");
      } else {
        showToast(
          `전체 ${paidRoutineNames.length}개 업무 (${totalWorkersCount}명) 당번 급여 지급 완료${
            totalExcludedCount > 0 ? ` (기지급 ${totalExcludedCount}명 제외)` : ""
          }`
        );
      }
    },
    [routines, taxConfig, addLedgerEntry, showToast, ledgerHistory]
  );

  // 3. Economy Actions
  const executeTransaction = useCallback(
    (fromVal: string, toVal: string, amount: number, desc: string, applyTax: boolean) => {
      if (fromVal === toVal) throw new Error("송금인과 수취인이 동일할 수 없습니다.");
      if (amount <= 0) throw new Error("올바른 거래 금액을 입력하세요.");

      let tax = 0;
      if (applyTax && toVal !== "treasury") {
        tax = calculateTax("transaction", amount, taxConfig);
      }
      const netAmount = amount - tax;

      // Validate & deduct
      if (fromVal === "treasury") {
        if (treasuryBalance < amount) throw new Error("학급 국고 잔고가 부족합니다.");
        setTreasuryBalance((prev) => prev - amount + tax);
      } else {
        const fromStudent = students.find((s) => String(s.no) === fromVal || s.name === fromVal);
        if (!fromStudent) throw new Error("송금 학생을 찾을 수 없습니다.");
        if (fromStudent.balance < amount) throw new Error(`${fromStudent.name} 학생의 잔액이 부족합니다.`);
        setStudents((prev) =>
          prev.map((s) => (s.no === fromStudent.no ? { ...s, balance: s.balance - amount } : s))
        );
        if (tax > 0) {
          setTreasuryBalance((prev) => prev + tax);
          setTotalTaxCollected((prev) => prev + tax);
        }
      }

      // Credit receiver
      if (toVal === "treasury") {
        setTreasuryBalance((prev) => prev + amount);
      } else {
        const toStudent = students.find((s) => String(s.no) === toVal || s.name === toVal);
        if (!toStudent) throw new Error("수취 학생을 찾을 수 없습니다.");
        setStudents((prev) =>
          prev.map((s) => (s.no === toStudent.no ? { ...s, balance: s.balance + netAmount } : s))
        );
      }

      const fromName = fromVal === "treasury" ? "학급 국고" : `${fromVal}번 학생`;
      const toName = toVal === "treasury" ? "학급 국고" : `${toVal}번 학생`;
      addLedgerEntry("거래", fromName, toName, `${fromName} → ${toName}`, desc, amount, tax, [fromVal, toVal]);
      showToast(`[거래 완료] ${fromName} → ${toName}: ${amount.toLocaleString()} ${currencyName} (세금: ${tax} ${currencyName})`);
    },
    [students, treasuryBalance, taxConfig, currencyName, addLedgerEntry, showToast]
  );

  const executeBatchDeposit = useCallback(
    (targetNames: string[], amount: number, desc: string, applyTax: boolean) => {
      if (targetNames.length === 0 || amount === 0) return;

      // 세금 부과는 양수(+) 입금일 때만 부과 (차감 시에는 비과세)
      let perStudentTax = 0;
      if (applyTax && amount > 0) {
        perStudentTax = calculateTax("income", amount, taxConfig);
      }
      const netPerStudent = amount > 0 ? amount - perStudentTax : amount;

      setStudents((prev) =>
        prev.map((s) => {
          if (targetNames.includes(s.name)) {
            return { ...s, balance: Math.max(0, s.balance + netPerStudent) };
          }
          return s;
        })
      );

      const totalTax = perStudentTax * targetNames.length;
      if (totalTax > 0) {
        setTreasuryBalance((prev) => prev + totalTax);
        setTotalTaxCollected((prev) => prev + totalTax);
      }

      for (const name of targetNames) {
        addLedgerEntry(
          amount > 0 ? "입금" : "차감",
          amount > 0 ? "학급 국고" : name,
          amount > 0
            ? name
            : (taxConfig.penaltyDisposition === "void" ? "화폐 소멸(소각)" : "학급 국고"),
          name,
          desc,
          amount,
          perStudentTax,
          [name]
        );
      }
      showToast(
        `총 ${targetNames.length}명에게 ${Math.abs(amount).toLocaleString()} ${currencyName} ${amount > 0 ? "지급" : "차감"} 완료`
      );
    },
    [taxConfig, currencyName, addLedgerEntry, showToast]
  );

  const executeDirectTax = useCallback(
    (mode: "deposit" | "withdraw", amount: number, desc: string, refundStudentName?: string) => {
      if (amount <= 0) throw new Error("금액을 올바르게 입력하세요.");

      if (mode === "deposit") {
        setTreasuryBalance((prev) => prev + amount);
        setTotalTaxCollected((prev) => prev + amount);
        addLedgerEntry("입금", "외부 수입", "학급 국고(세수)", "학급 국고 세수", desc, amount, amount, ["treasury"]);
        showToast(`[세금 직접 입금] +${amount.toLocaleString()} ${currencyName} 편입`);
      } else {
        if (treasuryBalance < amount) throw new Error("국고 세수 잔고가 부족합니다.");
        setTreasuryBalance((prev) => prev - amount);
        setTotalTaxCollected((prev) => Math.max(0, prev - amount));

        if (refundStudentName) {
          setStudents((prev) =>
            prev.map((s) => (s.name === refundStudentName ? { ...s, balance: s.balance + amount } : s))
          );
          addLedgerEntry("입금", "학급 국고(세수)", refundStudentName, refundStudentName, desc, amount, 0, [refundStudentName, "treasury"]);
          showToast(`[세금 환급] ${refundStudentName} 학생에게 ${amount.toLocaleString()} ${currencyName} 환급`);
        } else {
          addLedgerEntry("차감", "학급 국고(세수)", "공동 지출처", "학급 공동 지출", desc, -amount, 0, ["treasury"]);
          showToast(`[세금 출금] 학급 공동 지출 ${amount.toLocaleString()} ${currencyName} 집행`);
        }
      }
    },
    [treasuryBalance, currencyName, addLedgerEntry, showToast]
  );

  const executeBundle = useCallback(
    (bundleId: string, selectedNames?: string[]) => {
      const b = customBundles.find((x) => x.id === bundleId);
      if (!b) return;

      let executedCount = 0;
      const summaryDetails: string[] = [];

      for (const act of b.actions) {
        if (act.target === "treasury") {
          try {
            executeDirectTax(
              act.type === "deposit" ? "deposit" : "withdraw",
              act.amount,
              `[${b.name}] ${act.desc}`
            );
            executedCount++;
            summaryDetails.push(`국고 ${act.type === "deposit" ? "+" : "-"}${act.amount.toLocaleString()}${currencyName}`);
          } catch (err) {
            showToast(`국고 정산 실패: ${err instanceof Error ? err.message : "오류 발생"}`);
          }
        } else {
          let targets: string[] = [];
          if (act.target === "selected") {
            targets = selectedNames || [];
            if (targets.length === 0) {
              continue;
            }
          } else if (act.target === "unselected") {
            const selSet = new Set(selectedNames || []);
            targets = students.map((s) => s.name).filter((n) => !selSet.has(n));
            if (targets.length === 0) {
              continue;
            }
          } else if (act.target === "specific") {
            targets = act.specificTargets || [];
            if (targets.length === 0) {
              continue;
            }
          } else {
            targets = students.map((s) => s.name);
          }

          if (targets.length > 0) {
            const amt = act.type === "deposit" ? act.amount : -act.amount;
            executeBatchDeposit(
              targets,
              amt,
              `[${b.name}] ${act.desc}`,
              act.type === "deposit" ? act.applyTax : false
            );
            executedCount++;
            summaryDetails.push(`${targets.length}명 ${amt > 0 ? "+" : ""}${amt.toLocaleString()}${currencyName}`);
          }
        }
      }

      if (executedCount === 0) {
        showToast(`[복합 정산] 대상 학생이 없어 '${b.name}'이(가) 실행되지 않았습니다.`);
      } else {
        const detailStr = summaryDetails.length > 0 ? ` (${summaryDetails.join(", ")})` : "";
        showToast(`[복합 정산 완료] '${b.name}'${detailStr} 처리 완료`);
      }
    },
    [customBundles, students, currencyName, executeBatchDeposit, executeDirectTax, showToast]
  );

  const addCustomBundle = useCallback(
    (bundle: CustomBundle) => {
      setCustomBundles((prev) => [...prev, bundle]);
      showToast(`새 복합 정산 '${bundle.name}'이 등록되었습니다.`);
    },
    [showToast]
  );

  const updateCustomBundle = useCallback(
    (bundle: CustomBundle) => {
      setCustomBundles((prev) => prev.map((b) => (b.id === bundle.id ? bundle : b)));
      showToast(`복합 정산 '${bundle.name}'이(가) 수정되었습니다.`);
    },
    [showToast]
  );

  const deleteCustomBundle = useCallback(
    (id: string) => {
      setCustomBundles((prev) => {
        const target = prev.find((b) => b.id === id);
        const name = target ? target.name : "선택 항목";
        showToast(`복합 정산 '${name}'이(가) 삭제되었습니다.`);
        return prev.filter((b) => b.id !== id);
      });
    },
    [showToast]
  );

  const updateTaxConfig = useCallback(
    (newConfig: TaxConfig) => {
      setTaxConfig(newConfig);
      showToast("학급 세무 및 급여 정책이 저장되었습니다.");
    },
    [showToast]
  );

  // 최근 지급 취소: 특정 원장 레코드의 금융 효과를 역전 후 undoneLedgerHistory로 이동
  const undoLedgerEntry = useCallback(
    (id?: number | string) => {
      const targetId = id ?? ledgerHistory[0]?.id;
      if (targetId === undefined) return;

      const record = ledgerHistory.find((r) => r.id === targetId);
      if (!record) return;

      if (record.type === "입금") {
        const netPerStudent = record.amount - (record.tax || 0);
        setStudents((prev) =>
          prev.map((s) =>
            record.targets.includes(s.name)
              ? { ...s, balance: Math.max(0, s.balance - netPerStudent) }
              : s
          )
        );
        const totalTax = (record.tax || 0) * record.targets.length;
        if (totalTax > 0) {
          setTreasuryBalance((prev) => Math.max(0, prev - totalTax));
          setTotalTaxCollected((prev) => Math.max(0, prev - totalTax));
        }
      } else if (record.type === "차감") {
        const absAmt = Math.abs(record.amount);
        setStudents((prev) =>
          prev.map((s) =>
            record.targets.includes(s.name)
              ? { ...s, balance: s.balance + absAmt }
              : s
          )
        );
      } else if (record.type === "거래") {
        const absAmt = Math.abs(record.amount);
        setStudents((prev) =>
          prev.map((s) => {
            if (s.name === record.from) return { ...s, balance: s.balance + absAmt };
            if (s.name === record.to) return { ...s, balance: Math.max(0, s.balance - absAmt) };
            return s;
          })
        );
      }

      setLedgerHistory((prev) => prev.filter((r) => r.id !== targetId));
      setUndoneLedgerHistory((prev) => [record, ...prev].slice(0, 20));
      showToast(`지급 취소: ${record.desc || record.targetDisplay}`);
    },
    [ledgerHistory, showToast]
  );

  // 최근 취소건 다시실행: undoneLedgerHistory에서 복원 후 금융 효과 재적용
  const redoLedgerEntry = useCallback(
    (id?: number | string) => {
      const targetId = id ?? undoneLedgerHistory[0]?.id;
      if (targetId === undefined) return;

      const record = undoneLedgerHistory.find((r) => r.id === targetId);
      if (!record) return;

      if (record.type === "입금") {
        const netPerStudent = record.amount - (record.tax || 0);
        setStudents((prev) =>
          prev.map((s) =>
            record.targets.includes(s.name)
              ? { ...s, balance: s.balance + netPerStudent }
              : s
          )
        );
        const totalTax = (record.tax || 0) * record.targets.length;
        if (totalTax > 0) {
          setTreasuryBalance((prev) => prev + totalTax);
          setTotalTaxCollected((prev) => prev + totalTax);
        }
      } else if (record.type === "차감") {
        const absAmt = Math.abs(record.amount);
        setStudents((prev) =>
          prev.map((s) =>
            record.targets.includes(s.name)
              ? { ...s, balance: Math.max(0, s.balance - absAmt) }
              : s
          )
        );
      } else if (record.type === "거래") {
        const absAmt = Math.abs(record.amount);
        setStudents((prev) =>
          prev.map((s) => {
            if (s.name === record.from) return { ...s, balance: Math.max(0, s.balance - absAmt) };
            if (s.name === record.to) return { ...s, balance: s.balance + absAmt };
            return s;
          })
        );
      }

      setUndoneLedgerHistory((prev) => prev.filter((r) => r.id !== targetId));
      setLedgerHistory((prev) => [record, ...prev]);
      showToast(`다시실행: ${record.desc || record.targetDisplay}`);
    },
    [undoneLedgerHistory, showToast]
  );

  // 상단바 등 외부 컴포넌트의 지급 취소/다시실행 요청 청취
  useEffect(() => {
    const handleUndoEvt = (e: Event) => {
      const ce = e as CustomEvent<{ id?: number | string }>;
      undoLedgerEntry(ce.detail?.id);
    };
    const handleRedoEvt = (e: Event) => {
      const ce = e as CustomEvent<{ id?: number | string }>;
      redoLedgerEntry(ce.detail?.id);
    };
    const handleChannel = (e: MessageEvent) => {
      if (e.data?.action === "undo_ledger") {
        undoLedgerEntry(e.data.id);
      } else if (e.data?.action === "redo_ledger") {
        redoLedgerEntry(e.data.id);
      }
    };

    window.addEventListener("classroom_undo_ledger", handleUndoEvt);
    window.addEventListener("classroom_redo_ledger", handleRedoEvt);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("classroom_os_sync");
      channel.addEventListener("message", handleChannel);
    } catch { /* noop */ }

    return () => {
      window.removeEventListener("classroom_undo_ledger", handleUndoEvt);
      window.removeEventListener("classroom_redo_ledger", handleRedoEvt);
      channel?.removeEventListener("message", handleChannel);
      channel?.close();
    };
  }, [undoLedgerEntry, redoLedgerEntry]);

  return {
    isMounted,
    isLoaded,
    className,
    setClassName,
    currencyName,
    setCurrencyName: handleSetCurrencyName,
    students,
    routines,
    treasuryBalance,
    totalTaxCollected,
    taxConfig,
    setTaxConfig,
    updateTaxConfig,
    customBundles,
    ledgerHistory,
    undoneLedgerHistory,
    noticeTarget,
    setNoticeTarget,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    freeCards,
    setFreeCards,
    layouts,
    setLayouts,
    updateLayouts,
    toastMessage,
    showToast,
    addStudents,
    deleteStudent,
    addRoutine,
    deleteRoutine,
    advanceRoutine,
    rewindRoutine,
    advanceAllRoutines,
    skipRoutineWorker,
    cancelSkipRoutineWorker,
    updateRoutineOrder,
    updateRoutine,
    payRoutineToday,
    payAllRoutinesToday,
    executeTransaction,
    executeBatchDeposit,
    executeDirectTax,
    executeBundle,
    addCustomBundle,
    updateCustomBundle,
    deleteCustomBundle,
    undo,
    redo,
    canUndo,
    canRedo,
    undoLedgerEntry,
    redoLedgerEntry,
  };
}
