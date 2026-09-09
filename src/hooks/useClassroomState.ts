"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClassroomStudent,
  ClassroomRoutine,
  TaxConfig,
  CustomBundle,
  LedgerRecord,
  BoardTheme,
  NoticeFontSize,
  FreeCardData,
} from "@/types/classroom";
import { calculateTax, DEFAULT_TAX_CONFIG } from "@/lib/taxEngine";
import { DEFAULT_BUNDLES } from "@/lib/defaultBundles";
import { updateCurrencyName } from "@/app/actions";

export interface ClassroomStateOptions {
  initialCurrencyName?: string;
  initialClassName?: string;
}

export function useClassroomState(options?: ClassroomStateOptions) {
  const [isMounted, setIsMounted] = useState(false);
  const [className, setClassName] = useState(options?.initialClassName || "우리 반");
  const [currencyName, setCurrencyName] = useState(options?.initialCurrencyName || "원");
  const [students, setStudents] = useState<ClassroomStudent[]>([]);
  const [routines, setRoutines] = useState<ClassroomRoutine[]>([]);
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [totalTaxCollected, setTotalTaxCollected] = useState(0);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(DEFAULT_TAX_CONFIG);
  const [customBundles, setCustomBundles] = useState<CustomBundle[]>(DEFAULT_BUNDLES);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerRecord[]>([]);

  // Notice Board state
  const [noticeText, setNoticeText] = useState("");
  const [noticeTarget, setNoticeTarget] = useState<"today" | "tomorrow">("today");
  const [theme, setTheme] = useState<BoardTheme>("chalkboard");
  const [fontSize, setFontSize] = useState<NoticeFontSize>("42");
  const [freeCards, setFreeCards] = useState<FreeCardData[]>([]);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Update currency name and sync to server DB
  const handleSetCurrencyName = useCallback((newName: string) => {
    setCurrencyName(newName);
    try {
      updateCurrencyName(newName).catch(() => {});
    } catch {
      // Ignore background sync errors
    }
  }, []);

  // Load from localStorage on client mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedV3 = localStorage.getItem("classroom_os_state_v3");
      const savedV2 = localStorage.getItem("classroom_os_state_v2");
      const saved = savedV3 || savedV2;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.className) setClassName(parsed.className);
        // Prioritize server DB setting if local storage has old default '미소' or empty
        if (options?.initialCurrencyName && (parsed.currencyName === "미소" || !parsed.currencyName)) {
          setCurrencyName(options.initialCurrencyName);
        } else if (parsed.currencyName) {
          setCurrencyName(parsed.currencyName);
        } else if (options?.initialCurrencyName) {
          setCurrencyName(options.initialCurrencyName);
        }
        if (Array.isArray(parsed.students)) setStudents(parsed.students);
        if (Array.isArray(parsed.routines)) setRoutines(parsed.routines);
        if (typeof parsed.treasuryBalance === "number") setTreasuryBalance(parsed.treasuryBalance);
        if (typeof parsed.totalTaxCollected === "number") setTotalTaxCollected(parsed.totalTaxCollected);
        if (parsed.taxConfig) setTaxConfig({ ...DEFAULT_TAX_CONFIG, ...parsed.taxConfig });
        if (Array.isArray(parsed.customBundles)) {
          const MOCK_BUNDLE_IDS = ["bundle-basic-income", "bundle-job-salary", "bundle-seat-rent", "bundle-1", "bundle-2", "bundle-3"];
          setCustomBundles(parsed.customBundles.filter((b: CustomBundle) => !MOCK_BUNDLE_IDS.includes(b.id)));
        }
        if (Array.isArray(parsed.ledgerHistory)) setLedgerHistory(parsed.ledgerHistory);
        if (typeof parsed.noticeText === "string") setNoticeText(parsed.noticeText);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.fontSize) setFontSize(parsed.fontSize);
        if (Array.isArray(parsed.freeCards)) setFreeCards(parsed.freeCards);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage & Broadcast to student window
  useEffect(() => {
    if (!isMounted) return;
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
      noticeText,
      theme,
      fontSize,
      freeCards,
      noticeTarget,
    };
    try {
      localStorage.setItem("classroom_os_state_v3", JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }

    try {
      const channel = new BroadcastChannel("classroom_os_sync");
      channel.postMessage({
        className,
        noticeText,
        content: noticeText,
        fontSize,
        theme,
        targetLabel: noticeTarget === "today" ? "오늘" : "내일",
        routines,
        students,
        freeCards,
      });
      channel.close();
    } catch {
      // Ignore channel errors
    }
  }, [
    isMounted,
    className,
    students,
    routines,
    treasuryBalance,
    totalTaxCollected,
    taxConfig,
    customBundles,
    ledgerHistory,
    noticeText,
    theme,
    fontSize,
    freeCards,
    noticeTarget,
  ]);

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
    },
    []
  );

  // 1. Student Actions
  const addStudents = useCallback(
    (names: string[]) => {
      const added: string[] = [];
      const skipped: string[] = [];

      setStudents((prev) => {
        let maxNo = prev.length > 0 ? Math.max(...prev.map((s) => s.no)) : 0;
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
    (no: number) => {
      setStudents((prev) => {
        const target = prev.find((s) => s.no === no);
        if (!target) return prev;
        showToast(`'${target.name}' 학생이 명단에서 삭제되었습니다.`);
        return prev.filter((s) => s.no !== no);
      });
    },
    [showToast]
  );

  // 2. Routine Actions
  const addRoutine = useCallback(
    (newRoutine: Omit<ClassroomRoutine, "id" | "currentIdx">) => {
      const id = `routine-${Date.now()}`;
      setRoutines((prev) => [...prev, { ...newRoutine, id, currentIdx: 0 }]);
      showToast(`"${newRoutine.icon} ${newRoutine.name}" 루틴이 등록되었습니다.`);
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
    (id: string, customWorkerNames?: string[]) => {
      const r = routines.find((x) => x.id === id);
      if (!r || r.pay <= 0 || r.order.length === 0) return;

      const rawWorkers = Array.from(
        { length: r.slots },
        (_, i) => r.order[(r.currentIdx + i) % r.order.length]
      );

      const targetWorkers =
        customWorkerNames && customWorkerNames.length > 0
          ? customWorkerNames
          : r.pinchHitterStudent && r.pinchHitterStudent !== "none"
          ? [r.pinchHitterStudent, ...rawWorkers.slice(1)]
          : rawWorkers;

      // 소득세 원천징수 계산
      const applyIncomeTax = taxConfig.taxMethod !== "TAX_FREE" && taxConfig.incomeTaxValue > 0;
      const taxPerWorker = applyIncomeTax ? calculateTax("income", r.pay, taxConfig) : 0;
      const netPay = Math.max(0, r.pay - taxPerWorker);

      const paidNames: string[] = [];
      setStudents((prev) =>
        prev.map((s) => {
          if (targetWorkers.includes(s.name)) {
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
          "🏛️ 학급 국고",
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
        } 지급 완료`
      );
    },
    [routines, taxConfig, currencyName, addLedgerEntry, showToast]
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

      const fromName = fromVal === "treasury" ? "🏛️ 학급 국고" : `${fromVal}번 학생`;
      const toName = toVal === "treasury" ? "🏛️ 학급 국고" : `${toVal}번 학생`;
      addLedgerEntry("거래", fromName, toName, `${fromName} → ${toName}`, desc, amount, tax, [fromVal, toVal]);
      showToast(`[거래 완료] ${fromName} → ${toName}: ${amount.toLocaleString()} ${currencyName} (세금: ${tax} ${currencyName})`);
    },
    [students, treasuryBalance, taxConfig, currencyName, addLedgerEntry, showToast]
  );

  const executeBatchDeposit = useCallback(
    (targetNames: string[], amount: number, desc: string, applyTax: boolean) => {
      if (targetNames.length === 0 || amount === 0) return;

      let perStudentTax = 0;
      if (applyTax) {
        const taxType = amount > 0 ? "income" : "penalty";
        perStudentTax = calculateTax(taxType, Math.abs(amount), taxConfig);
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
          amount > 0 ? "🏛️ 학급 국고" : name,
          amount > 0
            ? name
            : (taxConfig.penaltyDisposition === "void" ? "🔥 화폐 소멸(소각)" : "🏛️ 학급 국고"),
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
        addLedgerEntry("입금", "외부 수입", "🏛️ 학급 국고(세수)", "🏛️ 학급 국고 세수", desc, amount, amount, ["treasury"]);
        showToast(`[세금 직접 입금] +${amount.toLocaleString()} ${currencyName} 편입`);
      } else {
        if (treasuryBalance < amount) throw new Error("국고 세수 잔고가 부족합니다.");
        setTreasuryBalance((prev) => prev - amount);
        setTotalTaxCollected((prev) => Math.max(0, prev - amount));

        if (refundStudentName) {
          setStudents((prev) =>
            prev.map((s) => (s.name === refundStudentName ? { ...s, balance: s.balance + amount } : s))
          );
          addLedgerEntry("입금", "🏛️ 학급 국고(세수)", refundStudentName, refundStudentName, desc, amount, 0, [refundStudentName, "treasury"]);
          showToast(`[세금 환급] ${refundStudentName} 학생에게 ${amount.toLocaleString()} ${currencyName} 환급`);
        } else {
          addLedgerEntry("차감", "🏛️ 학급 국고(세수)", "공동 지출처", "학급 공동 지출", desc, -amount, 0, ["treasury"]);
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

      for (const act of b.actions) {
        if (act.target === "treasury") {
          try {
            executeDirectTax(
              act.type === "deposit" ? "deposit" : "withdraw",
              act.amount,
              `[${b.name}] ${act.desc}`
            );
          } catch (err) {
            showToast(`국고 정산 실패: ${err instanceof Error ? err.message : "오류 발생"}`);
          }
        } else {
          let targets: string[] = [];
          if (act.target === "selected") {
            targets = selectedNames || [];
            if (targets.length === 0) {
              showToast(`선택된 학생이 없어 '[${b.name}]' 액션이 제외되었습니다.`);
              continue;
            }
          } else if (act.target === "specific") {
            targets = act.specificTargets || [];
            if (targets.length === 0) {
              showToast(`지정된 학생이 없어 '[${b.name}]' 액션이 제외되었습니다.`);
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
          }
        }
      }
      showToast(`[복합 정산 완료] '${b.name}' 실행되었습니다.`);
    },
    [customBundles, students, executeBatchDeposit, executeDirectTax, showToast]
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

  return {
    isMounted,
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
    noticeText,
    setNoticeText,
    noticeTarget,
    setNoticeTarget,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    freeCards,
    setFreeCards,
    toastMessage,
    showToast,
    addStudents,
    deleteStudent,
    addRoutine,
    deleteRoutine,
    advanceRoutine,
    advanceAllRoutines,
    updateRoutineOrder,
    updateRoutine,
    payRoutineToday,
    executeTransaction,
    executeBatchDeposit,
    executeDirectTax,
    executeBundle,
    addCustomBundle,
    updateCustomBundle,
    deleteCustomBundle,
  };
}
