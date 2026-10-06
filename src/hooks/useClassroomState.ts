"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  SavedOrderPreset,
  SavedGroupPreset,
  SavedSeatPreset,
  SeatPresetConfig,
  Homework,
} from "@/types/classroom";
import type { SeatCellState } from "@/types";
import { calculateTax, DEFAULT_TAX_CONFIG } from "@/lib/taxEngine";
import { DEFAULT_BUNDLES } from "@/lib/defaultBundles";
import { DEFAULT_LAYOUTS, DEFAULT_NOTICE_CARD } from "@/lib/boardDefaults";
import { parsePinchHitters, parsePinchHitterDetails, serializePinchHitters, resolveStudentName, getActiveRoutineWorkers } from "@/lib/routineUtils";
import { updateCurrencyName, saveClassroomSnapshot, loadClassroomSnapshot } from "@/app/actions";
import { countStudentRoutinePaid } from "@/lib/routinePayStatus";

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
  const [savedOrders, setSavedOrders] = useState<SavedOrderPreset[]>([]);
  const [savedGroups, setSavedGroups] = useState<SavedGroupPreset[]>([]);
  const [savedSeats, setSavedSeats] = useState<SavedSeatPreset[]>([]);
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
  /** 학생 과제 (숙제 제출 관리) */
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  /** 칠판(알림장)에 미제출자 요소로 표시 중인 과제 id 목록 */
  const [boardHomeworkIds, setBoardHomeworkIds] = useState<string[]>([]);

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
    if (Array.isArray(parsed.savedOrders)) {
      setSavedOrders(parsed.savedOrders as SavedOrderPreset[]);
    } else {
      try {
        const fallback = localStorage.getItem("classroom_saved_orders");
        if (fallback) setSavedOrders(JSON.parse(fallback));
      } catch {
        // noop
      }
    }
    if (Array.isArray(parsed.savedGroups)) {
      setSavedGroups(parsed.savedGroups as SavedGroupPreset[]);
    } else {
      try {
        const fallback = localStorage.getItem("classroom_saved_groups");
        if (fallback) setSavedGroups(JSON.parse(fallback));
      } catch {
        // noop
      }
    }
    if (Array.isArray(parsed.savedSeats)) {
      setSavedSeats(parsed.savedSeats as SavedSeatPreset[]);
    } else {
      try {
        const fallback = localStorage.getItem("classroom_saved_seats");
        if (fallback) setSavedSeats(JSON.parse(fallback));
      } catch {
        // noop
      }
    }
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
    if (Array.isArray(parsed.homeworks)) setHomeworks(parsed.homeworks as Homework[]);
    if (Array.isArray(parsed.boardHomeworkIds)) {
      setBoardHomeworkIds((parsed.boardHomeworkIds as string[]).filter((id) => typeof id === "string"));
    }
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
      savedOrders,
      savedGroups,
      savedSeats,
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
      homeworks,
      boardHomeworkIds,
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
        savedOrders,
        savedGroups,
        savedSeats,
        students,
        freeCards,
        layouts,
        ledgerHistory,
        undoneLedgerHistory,
        homeworks,
        boardHomeworkIds,
      });
      channel.close();
    } catch { /* noop */ }

    // 4) Instant: window CustomEvent for same-tab instant sync
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("classroom_state_sync", {
            detail: { treasuryBalance, currencyName, className, ledgerHistory, undoneLedgerHistory, students, savedOrders, savedGroups, savedSeats },
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
    savedOrders,
    savedGroups,
    savedSeats,
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
    // 과제 상태도 반드시 함께 관찰해야 저장된다.
    // 빠뜨리면 과제를 등록/수정해도 effect가 다시 돌지 않아
    // localStorage에 기록되지 않고, 다시 들어오면 초기화돼 보인다.
    homeworks,
    boardHomeworkIds,
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

  // 0. Homework Actions (숙제 제출 관리)
  const addHomework = useCallback((hw: Omit<Homework, "id" | "createdAt" | "submitted" | "exempt">) => {
    const now = new Date();
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setHomeworks((prev) => [
      { ...hw, id: `hw-${Date.now()}`, createdAt, submitted: [], exempt: [] },
      ...prev,
    ]);
  }, []);

  const updateHomework = useCallback((id: string, patch: Partial<Homework>) => {
    setHomeworks((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        // 마감일을 고치면 수동 완료 표시를 해제해 새 마감일로 완료/진행 중을 재판정한다.
        // (완료 탭에 있는 과제의 마감일을 미래로 옮기면 다시 진행 중으로 돌아간다)
        const dueChanged =
          patch.dueDate !== undefined && patch.dueDate !== h.dueDate && patch.status === undefined;
        if (!dueChanged) return { ...h, ...patch };
        const { status: _ignored, ...rest } = patch;
        return { ...h, ...rest, status: undefined };
      })
    );
  }, []);

  /** 과제에서 한 학생의 제출 상태 토글 */
  const toggleHomeworkSubmitted = useCallback((id: string, studentName: string) => {
    setHomeworks((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              submitted: h.submitted.includes(studentName)
                ? h.submitted.filter((n) => n !== studentName)
                : [...h.submitted, studentName],
            }
          : h
      )
    );
  }, []);

  /** 과제 제출 대상에서 한 학생 제외/복원 */
  const toggleHomeworkExempt = useCallback((id: string, studentName: string) => {
    setHomeworks((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              exempt: h.exempt.includes(studentName)
                ? h.exempt.filter((n) => n !== studentName)
                : [...h.exempt, studentName],
              // 제외한 학생은 제출 목록에서도 제거 (대상 복원 시 자동 재판정)
              submitted: h.exempt.includes(studentName)
                ? h.submitted
                : h.submitted.filter((n) => n !== studentName),
            }
          : h
      )
    );
  }, []);

  /** 알림장 글상자 표시 바에서 칠판 표시로 올리기 (기본 위치 자동 배치) */
  const addBoardHomework = useCallback((id: string) => {
    setHomeworks((prev) => {
      const next = prev.filter((h) => h.id === id).length;
      if (next === 0) return prev;
      const idx = prev.findIndex((h) => h.id === id);
      const target = prev[idx];
      // 위치가 이미 있으면 유지하고, 없을 때만 기본값을 준다
      if (target.left && target.top) return prev;
      return prev.map((h) =>
        h.id === id
          ? {
              ...h,
              width: h.width || "30%",
              height: h.height || "19%",
              left: h.left || `${3 + (next % 3) * 32}%`,
              top: h.top || `${78 + (next % 2) * 4}%`,
            }
          : h
      );
    });
    setBoardHomeworkIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  /** 칠판에 표시할 과제 목록 (마감/완료 과제는 렌더 단계에서 걸러짐) */
  const boardHomeworks = useMemo(
    () => homeworks.filter((h) => boardHomeworkIds.includes(h.id)),
    [homeworks, boardHomeworkIds]
  );

  /** 과제 제출 대상(전체 - 제외)을 한 번에 제출 / 해제 */
  const setAllHomeworkSubmitted = useCallback((id: string, value: boolean) => {
    setHomeworks((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const exempt = new Set(h.exempt);
        const targets = students.filter((s) => !exempt.has(s.name)).map((s) => s.name);
        if (value) {
          // 대상 전원을 제출 처리 (제외 대상은 제출 목록에 들어가지 않는다)
          return { ...h, submitted: targets };
        }
        // 해제: 대상 학생만 초기화하고 제외 대상 기록은 건드리지 않는다
        const targetSet = new Set(targets);
        return { ...h, submitted: h.submitted.filter((n) => !targetSet.has(n)) };
      })
    );
  }, [students]);

  const deleteHomework = useCallback((id: string) => {
    setHomeworks((prev) => prev.filter((h) => h.id !== id));
    setBoardHomeworkIds((prev) => prev.filter((x) => x !== id));
  }, []);

  /** 칠판에서 미제출자 요소를 내림 (과제 자체는 유지) */
  const removeBoardHomework = useCallback((id: string) => {
    setBoardHomeworkIds((prev) => prev.filter((x) => x !== id));
  }, []);

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

  const updateStudentGender = useCallback(
    (name: string, gender: "남" | "여" | null) => {
      setStudents((prev) =>
        prev.map((s) => {
          if (s.name !== name) return s;
          if (gender === null) {
            const next = { ...s };
            delete next.gender;
            return next;
          }
          return { ...s, gender };
        })
      );
    },
    []
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
          const skips = r.skipHistory?.length || 0;
          const step = Math.max(1, r.slots + skips);
          const nextIdx = (r.currentIdx + step) % r.order.length;
          return { ...r, currentIdx: nextIdx, pinchHitterStudent: undefined, skipHistory: undefined };
        })
      );
      showToast("업무 순환이 진행되었습니다. (당일 대타 및 건너뛰기 설정 초기화)");
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
          return { ...r, currentIdx: prevIdx, pinchHitterStudent: undefined, skipHistory: undefined };
        })
      );
      showToast("이전 순번으로 돌아갔습니다. (당일 대타 및 건너뛰기 설정 초기화)");
    },
    [showToast]
  );

  const skipRoutineWorker = useCallback(
    (id: string, workerIndex?: number) => {
      let skippedName = "";
      let remainingCount = 0;
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== id || r.order.length <= 1) return r;
          const activeWorkers = getActiveRoutineWorkers(r, students, false);
          if (activeWorkers.length === 0) return r;
          const targetIdx =
            workerIndex !== undefined && workerIndex >= 0 && workerIndex < activeWorkers.length
              ? workerIndex
              : 0;
          const targetStudent = activeWorkers[targetIdx];
          if (!targetStudent) return r;

          skippedName = targetStudent;
          const history = [...(r.skipHistory || []), targetStudent];
          remainingCount = history.length;
          return {
            ...r,
            skipHistory: history,
          };
        })
      );
      if (skippedName) {
        showToast(`[건너뛰기] ${skippedName} 학생을 건너뛰고 다음 순번으로 당겨졌습니다. (누적 ${remainingCount}회)`);
      }
    },
    [students, showToast]
  );

  const cancelSkipRoutineWorker = useCallback(
    (id: string) => {
      let restoredName = "";
      let remainingCount = 0;
      setRoutines((prev) =>
        prev.map((r) => {
          if (r.id !== id || !r.skipHistory || r.skipHistory.length === 0) return r;
          const history = [...r.skipHistory];
          const popped = history.pop()!;
          restoredName = resolveStudentName(
            typeof popped === "number" ? r.order[popped % r.order.length] : popped,
            students
          );
          remainingCount = history.length;
          return {
            ...r,
            skipHistory: history.length > 0 ? history : undefined,
          };
        })
      );
      if (restoredName) {
        showToast(
          remainingCount > 0
            ? `[건너뛰기 취소] 최근 건너뛴 ${restoredName} 학생으로 복원되었습니다. (남은 취소 가능: ${remainingCount}회)`
            : `[건너뛰기 취소] 건너뛴 ${restoredName} 학생이 복원되어 최초 순번으로 돌아왔습니다.`
        );
      }
    },
    [students, showToast]
  );

  const advanceAllRoutines = useCallback(() => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.order.length === 0) return r;
        const skips = r.skipHistory?.length || 0;
        const step = Math.max(1, r.slots + skips);
        const nextIdx = (r.currentIdx + step) % r.order.length;
        return { ...r, currentIdx: nextIdx, pinchHitterStudent: undefined, skipHistory: undefined };
      })
    );
    showToast("전체 학생 업무 순환이 진행되었습니다. (당일 대타 및 건너뛰기 설정 초기화)");
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

  const saveOrderPreset = useCallback(
    (name: string, order: string[]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("순서 이름을 입력해 주세요.");
        return;
      }
      if (order.length === 0) {
        showToast("순서에 포함할 학생이 없습니다.");
        return;
      }
      const newPreset: SavedOrderPreset = {
        id: `order-preset-${Date.now()}`,
        name: trimmed,
        order: [...order],
        createdAt: new Date().toISOString(),
      };
      setSavedOrders((prev) => {
        const next = [newPreset, ...prev.filter((p) => p.name !== trimmed)];
        try {
          localStorage.setItem("classroom_saved_orders", JSON.stringify(next));
        } catch {
          // noop
        }
        return next;
      });
      showToast(`'${trimmed}' 순서가 저장되었습니다.`);
    },
    [showToast]
  );

  const deleteOrderPreset = useCallback(
    (id: string) => {
      setSavedOrders((prev) => {
        const next = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem("classroom_saved_orders", JSON.stringify(next));
        } catch {
          // noop
        }
        return next;
      });
      showToast("저장된 순서가 삭제되었습니다.");
    },
    [showToast]
  );

  // 뽑기 실행 시 최근 기록 자동 보관 (최대 3개, 조용히 저장)
  const pushRecentOrder = useCallback((order: string[]) => {
    if (order.length === 0) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const autoName = `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 순서`;
    const newPreset: SavedOrderPreset = {
      id: `order-recent-${Date.now()}`,
      name: autoName,
      order: [...order],
      createdAt: new Date().toISOString(),
      auto: true,
    };
    setSavedOrders((prev) => {
      let autoCount = 0;
      const next = [newPreset, ...prev].filter((p) => {
        if (!p.auto) return true;
        autoCount += 1;
        return autoCount <= 3;
      });
      try {
        localStorage.setItem("classroom_saved_orders", JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
  }, []);

  // 프리셋 수정 (이름·순서 변경, 자동 저장은 이름 지정 시 프리셋으로 승격)
  const updateOrderPreset = useCallback(
    (id: string, name: string, order: string[]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("순서 이름을 입력해 주세요.");
        return;
      }
      if (order.length === 0) {
        showToast("순서에 포함할 학생이 없습니다.");
        return;
      }
      let wasAuto = false;
      setSavedOrders((prev) => {
        const next = prev.map((p) => {
          if (p.id !== id) return p;
          wasAuto = Boolean(p.auto);
          return { ...p, name: trimmed, order: [...order], auto: false };
        });
        try {
          localStorage.setItem("classroom_saved_orders", JSON.stringify(next));
        } catch {
          // noop
        }
        return next;
      });
      showToast(
        wasAuto
          ? `'${trimmed}' 순서가 프리셋으로 저장되었습니다.`
          : `'${trimmed}' 순서가 수정되었습니다.`
      );
    },
    [showToast]
  );

  // ---- 모둠 프리셋 (순서 프리셋과 동일 메커니즘, 업무 연동 없음) ----
  const persistSavedGroups = (next: SavedGroupPreset[]) => {
    try {
      localStorage.setItem("classroom_saved_groups", JSON.stringify(next));
    } catch {
      // noop
    }
  };

  const saveGroupPreset = useCallback(
    (name: string, groups: string[][]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("모둠 이름을 입력해 주세요.");
        return;
      }
      if (groups.length === 0) {
        showToast("저장할 모둠 결과가 없습니다.");
        return;
      }
      const newPreset: SavedGroupPreset = {
        id: `group-preset-${Date.now()}`,
        name: trimmed,
        groups: groups.map((g) => [...g]),
        createdAt: new Date().toISOString(),
      };
      setSavedGroups((prev) => {
        const next = [newPreset, ...prev.filter((p) => p.name !== trimmed)];
        persistSavedGroups(next);
        return next;
      });
      showToast(`'${trimmed}' 모둠이 저장되었습니다.`);
    },
    [showToast]
  );

  const deleteGroupPreset = useCallback(
    (id: string) => {
      setSavedGroups((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persistSavedGroups(next);
        return next;
      });
      showToast("저장된 모둠이 삭제되었습니다.");
    },
    [showToast]
  );

  const pushRecentGroups = useCallback((groups: string[][]) => {
    if (groups.length === 0) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const autoName = `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 모둠`;
    const newPreset: SavedGroupPreset = {
      id: `group-recent-${Date.now()}`,
      name: autoName,
      groups: groups.map((g) => [...g]),
      createdAt: new Date().toISOString(),
      auto: true,
    };
    setSavedGroups((prev) => {
      let autoCount = 0;
      const next = [newPreset, ...prev].filter((p) => {
        if (!p.auto) return true;
        autoCount += 1;
        return autoCount <= 3;
      });
      persistSavedGroups(next);
      return next;
    });
  }, []);

  const updateGroupPreset = useCallback(
    (id: string, name: string, groups: string[][]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("모둠 이름을 입력해 주세요.");
        return;
      }
      const cleaned = groups.map((g) => [...g]).filter((g) => g.length > 0);
      if (cleaned.length === 0) {
        showToast("모둠에 포함할 학생이 없습니다.");
        return;
      }
      let wasAuto = false;
      setSavedGroups((prev) => {
        const next = prev.map((p) => {
          if (p.id !== id) return p;
          wasAuto = Boolean(p.auto);
          return { ...p, name: trimmed, groups: cleaned, auto: false };
        });
        persistSavedGroups(next);
        return next;
      });
      showToast(
        wasAuto
          ? `'${trimmed}' 모둠이 프리셋으로 저장되었습니다.`
          : `'${trimmed}' 모둠이 수정되었습니다.`
      );
    },
    [showToast]
  );

  // ---- 자리 프리셋 (모둠 프리셋과 동일 메커니즘, 프리셋 자동 3개 유지) ----
  const persistSavedSeats = (next: SavedSeatPreset[]) => {
    try {
      localStorage.setItem("classroom_saved_seats", JSON.stringify(next));
    } catch {
      // noop
    }
  };

  /** 동기 조회용: 저장된 자리 프리셋 목록 (이름 중복 판정). state 갱신 타이밍과 무관. */
  const readSavedSeatsSync = (): SavedSeatPreset[] => {
    try {
      const raw = localStorage.getItem("classroom_saved_seats");
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) return arr as SavedSeatPreset[];
      }
    } catch {
      // fall through
    }
    try {
      const v3raw = localStorage.getItem("classroom_os_state_v3");
      if (v3raw) {
        const parsed = JSON.parse(v3raw) as { savedSeats?: unknown };
        if (Array.isArray(parsed.savedSeats)) return parsed.savedSeats as SavedSeatPreset[];
      }
    } catch {
      // fall through
    }
    return [];
  };

  const saveSeatPreset = useCallback(
    (name: string, cells: SeatCellState[], config?: SeatPresetConfig): string | undefined => {
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("자리 이름을 입력해 주세요.");
        return undefined;
      }
      if (cells.length === 0) {
        showToast("저장할 자리 결과가 없습니다.");
        return undefined;
      }
      // 같은 이름이 있으면 뒤에 (2), (3)... 자동 부여 (여러 건이면 숫자만 증가)
      let finalName = trimmed;
      const prev = readSavedSeatsSync();
      if (prev.some((p) => p.name === trimmed)) {
        const stem = trimmed.replace(/\s*\(\d+\)$/, "");
        const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`^${esc}(?: \\((\\d+)\\))?$`);
        let next = 2;
        for (const p of prev) {
          const m = re.exec(p.name);
          if (!m) continue;
          next = Math.max(next, m[1] ? Number(m[1]) + 1 : 2);
        }
        finalName = `${stem} (${next})`;
      }
      const newPreset: SavedSeatPreset = {
        id: `seat-preset-${Date.now()}`,
        name: finalName,
        cells: cells.map((c) => ({ ...c })),
        createdAt: new Date().toISOString(),
        ...(config ? { config: { ...config } } : {}),
      };
      setSavedSeats((prevSeats) => {
        const next = [newPreset, ...prevSeats];
        persistSavedSeats(next);
        return next;
      });
      showToast(`'${finalName}' 자리가 저장되었습니다.`);
      return finalName;
    },
    [showToast]
  );

  const deleteSeatPreset = useCallback(
    (id: string) => {
      setSavedSeats((prev) => {
        const next = prev.filter((p) => p.id !== id);
        persistSavedSeats(next);
        return next;
      });
      showToast("저장된 자리가 삭제되었습니다.");
    },
    [showToast]
  );

  // 그리드 생성/변경 시 최근 기록 자동 보관 (최대 3개, 조용히 저장)
  const pushRecentSeats = useCallback((cells: SeatCellState[], config?: SeatPresetConfig) => {
    if (cells.length === 0) return;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const autoName = `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 자리`;
    const newPreset: SavedSeatPreset = {
      id: `seat-recent-${Date.now()}`,
      name: autoName,
      cells: cells.map((c) => ({ ...c })),
      createdAt: new Date().toISOString(),
      auto: true,
      ...(config ? { config: { ...config } } : {}),
    };
    setSavedSeats((prev) => {
      let autoCount = 0;
      const next = [newPreset, ...prev].filter((p) => {
        if (!p.auto) return true;
        autoCount += 1;
        return autoCount <= 3;
      });
      persistSavedSeats(next);
      return next;
    });
  }, []);

  const updateSeatPreset = useCallback(
    (id: string, name: string, cells: SeatCellState[]) => {
      const trimmed = name.trim();
      if (!trimmed) {
        showToast("자리 이름을 입력해 주세요.");
        return;
      }
      if (cells.length === 0) {
        showToast("저장할 자리 결과가 없습니다.");
        return;
      }
      let wasAuto = false;
      setSavedSeats((prev) => {
        const next = prev.map((p) => {
          if (p.id !== id) return p;
          wasAuto = Boolean(p.auto);
          return { ...p, name: trimmed, cells: cells.map((c) => ({ ...c })), auto: false };
        });
        persistSavedSeats(next);
        return next;
      });
      showToast(
        wasAuto
          ? `'${trimmed}' 자리가 프리셋으로 저장되었습니다.`
          : `'${trimmed}' 자리가 수정되었습니다.`
      );
    },
    [showToast]
  );

  const payRoutineToday = useCallback(
    (id: string, customWorkerNames?: string[], applyTax: boolean = false) => {
      const r = routines.find((x) => x.id === id);
      if (!r || r.pay <= 0 || r.order.length === 0) return;

      const activeWorkers = getActiveRoutineWorkers(r, students, false);
      const targetWorkers =
        customWorkerNames && customWorkerNames.length > 0
          ? customWorkerNames
          : activeWorkers;

      // 세금 공제: applyTax가 true이고 비과세가 아닐 때 단일 세율 적용
      const shouldDeductTax = applyTax && taxConfig.taxMethod !== "TAX_FREE";
      const taxPerWorker = shouldDeductTax ? calculateTax("income", r.pay, taxConfig) : 0;
      const netPay = Math.max(0, r.pay - taxPerWorker);

      // 대타 중복 등 한 명이 여러 몫을 맡으면 그 횟수만큼 중복 지급.
      // 이미 받은 횟수(같은 주기 장부 기록 수)를 뺀 나머지만 지급한다.
      const rosterNames = new Set(students.map((s) => s.name));
      const occurrences = new Map<string, number>();
      for (const wName of targetWorkers) {
        if (!rosterNames.has(wName)) continue;
        occurrences.set(wName, (occurrences.get(wName) ?? 0) + 1);
      }
      const payPlan: { name: string; times: number }[] = [];
      const alreadyPaidWorkers: string[] = [];
      occurrences.forEach((count, name) => {
        const priorCount = countStudentRoutinePaid(r, name, ledgerHistory);
        const times = Math.max(0, count - priorCount);
        if (times > 0) payPlan.push({ name, times });
        else alreadyPaidWorkers.push(name);
      });

      if (payPlan.length === 0) {
        showToast(`[급여 지급] ${r.name} 당번(${targetWorkers.join(", ")})이 이미 모두 급여를 받았습니다.`);
        return;
      }

      const payTimesByName = new Map(payPlan.map((p) => [p.name, p.times]));
      setStudents((prev) =>
        prev.map((s) => {
          const times = payTimesByName.get(s.name);
          if (times) {
            return { ...s, balance: s.balance + netPay * times };
          }
          return s;
        })
      );

      const totalPayTimes = payPlan.reduce((n, p) => n + p.times, 0);
      const totalTaxCollectedNow = taxPerWorker * totalPayTimes;
      if (totalTaxCollectedNow > 0) {
        setTreasuryBalance((prev) => prev + totalTaxCollectedNow);
        setTotalTaxCollected((prev) => prev + totalTaxCollectedNow);
      }

      for (const p of payPlan) {
        for (let i = 0; i < p.times; i++) {
          addLedgerEntry(
            "입금",
            "학급 국고",
            p.name,
            p.name,
            `${r.name} 당번 급여 (${r.payCycle || "1회"})`,
            r.pay,
            taxPerWorker,
            [p.name]
          );
        }
      }
      const paidDisplay = payPlan.map((p) => (p.times > 1 ? `${p.name} ${p.times}회분` : p.name));
      showToast(
        `[급여 지급] ${r.name} 담당 ${paidDisplay.join(", ")}에게 실지급 ${netPay.toLocaleString()} ${currencyName}${
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
          const targetWorkers = getActiveRoutineWorkers(r, students, false);

          // 대타 중복 등 한 명이 여러 몫을 맡으면 그 횟수만큼 중복 지급
          const occurrences = new Map<string, number>();
          for (const wName of targetWorkers) {
            occurrences.set(wName, (occurrences.get(wName) ?? 0) + 1);
          }
          const payPlan = new Map<string, number>();
          occurrences.forEach((count, name) => {
            const priorCount = countStudentRoutinePaid(r, name, ledgerHistory);
            const times = Math.max(0, count - priorCount);
            totalExcludedCount += count - times;
            if (times > 0) payPlan.set(name, times);
          });
          if (payPlan.size === 0) continue;

          const taxPerWorker = shouldDeductTax ? calculateTax("income", r.pay, taxConfig) : 0;
          const netPay = Math.max(0, r.pay - taxPerWorker);

          let countForRoutine = 0;
          for (let i = 0; i < nextStudents.length; i++) {
            const s = nextStudents[i];
            const times = payPlan.get(s.name);
            if (times) {
              nextStudents[i] = { ...s, balance: s.balance + netPay * times };
              totalTaxCollectedNow += taxPerWorker * times;
              countForRoutine++;
              for (let k = 0; k < times; k++) {
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
        // [Bug 1 수정] 국고→학생 방향에서도 세금 누적 통계 반영
        if (tax > 0) {
          setTotalTaxCollected((prev) => prev + tax);
        }
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

      // [Bug 2 수정] 장부 이름: 번호(fromVal/toVal) → 실제 학생 이름으로 표시
      const fromStudentResolved = fromVal !== "treasury"
        ? (students.find((s) => String(s.no) === fromVal || s.name === fromVal)?.name ?? fromVal)
        : null;
      const toStudentResolved = toVal !== "treasury"
        ? (students.find((s) => String(s.no) === toVal || s.name === toVal)?.name ?? toVal)
        : null;
      const fromName = fromVal === "treasury" ? "학급 국고" : fromStudentResolved!;
      const toName   = toVal   === "treasury" ? "학급 국고" : toStudentResolved!;
      const fromTarget = fromVal === "treasury" ? "treasury" : fromStudentResolved!;
      const toTarget   = toVal   === "treasury" ? "treasury" : toStudentResolved!;
      addLedgerEntry("거래", fromName, toName, `${fromName} → ${toName}`, desc, amount, tax, [fromTarget, toTarget]);
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

      const descWithTax = perStudentTax > 0 ? `${desc} (세금 ${perStudentTax.toLocaleString()} ${currencyName} 원천징수)` : desc;
      for (const name of targetNames) {
        addLedgerEntry(
          amount > 0 ? "입금" : "차감",
          amount > 0 ? "학급 국고" : name,
          amount > 0
            ? name
            : (taxConfig.penaltyDisposition === "void" ? "화폐 소멸(소각)" : "학급 국고"),
          name,
          descWithTax,
          amount,
          perStudentTax,
          [name]
        );
      }
      const taxNotice = perStudentTax > 0 ? ` (세금 ${perStudentTax.toLocaleString()} ${currencyName} 원천징수)` : "";
      showToast(
        `총 ${targetNames.length}명에게 ${amount > 0 ? `실지급 ${netPerStudent.toLocaleString()} ${currencyName}${taxNotice}` : `${Math.abs(amount).toLocaleString()} ${currencyName} 차감`} 완료`
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
            const willApplyTax = act.type === "deposit" ? act.applyTax : false;
            executeBatchDeposit(
              targets,
              amt,
              `[${b.name}] ${act.desc}`,
              willApplyTax
            );
            executedCount++;
            let taxPerWorker = 0;
            if (willApplyTax && amt > 0) {
              taxPerWorker = calculateTax("income", amt, taxConfig);
            }
            const netAmt = amt > 0 ? amt - taxPerWorker : amt;
            const taxTag = taxPerWorker > 0 ? ` (세금 -${taxPerWorker.toLocaleString()})` : "";
            summaryDetails.push(`${targets.length}명 ${netAmt > 0 ? "+" : ""}${netAmt.toLocaleString()}${currencyName}${taxTag}`);
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
    [customBundles, students, currencyName, taxConfig, executeBatchDeposit, executeDirectTax, showToast]
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
    homeworks,
    boardHomeworkIds,
    setBoardHomeworkIds,
    boardHomeworks,
    addBoardHomework,
    addHomework,
    updateHomework,
    toggleHomeworkSubmitted,
    toggleHomeworkExempt,
    setAllHomeworkSubmitted,
    deleteHomework,
    removeBoardHomework,
    toastMessage,
    showToast,
    addStudents,
    deleteStudent,
    updateStudentGender,
    addRoutine,
    deleteRoutine,
    advanceRoutine,
    rewindRoutine,
    advanceAllRoutines,
    skipRoutineWorker,
    cancelSkipRoutineWorker,
    updateRoutineOrder,
    updateRoutine,
    savedOrders,
    setSavedOrders,
    saveOrderPreset,
    deleteOrderPreset,
    pushRecentOrder,
    updateOrderPreset,
    savedGroups,
    setSavedGroups,
    saveGroupPreset,
    deleteGroupPreset,
    pushRecentGroups,
    updateGroupPreset,
    savedSeats,
    setSavedSeats,
    saveSeatPreset,
    deleteSeatPreset,
    pushRecentSeats,
    updateSeatPreset,
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
