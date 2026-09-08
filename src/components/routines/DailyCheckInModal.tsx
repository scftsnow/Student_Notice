"use client";

import { useState } from "react";
import { confirmDailyRoutine } from "@/app/actions";
import { CheckCircle2, AlertCircle, UserCheck, X, UserMinus } from "lucide-react";

interface StudentInfo {
  id: string;
  studentNumber: number;
  name: string;
  isAbsent?: boolean;
}

interface DailyCheckInModalProps {
  routine: {
    id: string;
    title: string;
    salaryAmount: number;
  };
  date: string;
  assignedStudents: StudentInfo[];
  allActiveStudents: StudentInfo[];
  isConfirmed: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export type AbsencePolicyChoice = "PINCH_HITTER" | "DEFER" | "PASS";

export default function DailyCheckInModal({
  routine,
  date,
  assignedStudents,
  allActiveStudents,
  isConfirmed,
  onClose,
  onSuccess,
}: DailyCheckInModalProps) {
  // Mapping: studentId -> boolean (isAbsent)
  const [absenceMap, setAbsenceMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    assignedStudents.forEach((s) => {
      map[s.id] = !!s.isAbsent;
    });
    return map;
  });

  // Policy per absent student: "PINCH_HITTER" | "DEFER" | "PASS" (스펙 1-2 반영)
  const [policyMap, setPolicyMap] = useState<Record<string, AbsencePolicyChoice>>(() => {
    const map: Record<string, AbsencePolicyChoice> = {};
    assignedStudents.forEach((s) => {
      map[s.id] = "PINCH_HITTER";
    });
    return map;
  });

  // Substitute student ID per absent student
  const [substituteMap, setSubstituteMap] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    assignedStudents.forEach((s) => {
      // Pick first eligible active student not in assigned
      const candidate = allActiveStudents.find(
        (cand) => !assignedStudents.some((a) => a.id === cand.id)
      );
      map[s.id] = candidate ? candidate.id : "";
    });
    return map;
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleAbsent = (studentId: string) => {
    setAbsenceMap((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handlePolicyChange = (studentId: string, policy: AbsencePolicyChoice) => {
    setPolicyMap((prev) => ({ ...prev, [studentId]: policy }));
  };

  const handleSubstituteChange = (studentId: string, subId: string) => {
    setSubstituteMap((prev) => ({ ...prev, [studentId]: subId }));
  };

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // Calculate actual student IDs who worked today
      const actualIds: string[] = [];

      for (const s of assignedStudents) {
        const isAbsent = absenceMap[s.id];
        if (!isAbsent) {
          // Present -> performs duty
          actualIds.push(s.id);
        } else {
          // Absent -> check policy choice (스펙 1-2)
          const policy = policyMap[s.id] || "PINCH_HITTER";
          if (policy === "PINCH_HITTER") {
            const subId = substituteMap[s.id];
            if (subId) {
              actualIds.push(subId);
            }
          }
          // If DEFER or PASS, no student takes this turn today (or shifted)
        }
      }

      await confirmDailyRoutine({
        routineId: routine.id,
        date,
        assignedStudentIds: assignedStudents.map((s) => s.id),
        actualStudentIds: actualIds,
        salaryAmount: routine.salaryAmount,
      });

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "확정 처리 중 오류가 발생했습니다.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              스펙 1-2 선택권: 매일 1회 당번 점검
            </span>
            <h3 className="text-lg font-black text-slate-800 mt-1">{routine.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">점검 일자: {date}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">결석생 발생 시 교사 선택권 (스펙 1-2)</p>
              <p className="mt-0.5 text-amber-700">
                결석 학생 체크 시 <strong>[대타 투입]</strong>, <strong>[순번 이월]</strong>, <strong>[업무 패스]</strong> 3가지 중 교실 상황에 맞추어 선택할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              배정 당번 ({assignedStudents.length}명)
            </h4>

            {assignedStudents.map((s) => {
              const isAbsent = absenceMap[s.id];
              const policy = policyMap[s.id] || "PINCH_HITTER";
              const currentSubId = substituteMap[s.id];

              return (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isAbsent
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-slate-50 border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                        {s.studentNumber}
                      </span>
                      <span className="font-bold text-sm text-slate-800">{s.name}</span>
                      {isAbsent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                          결석
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleAbsent(s.id)}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium border flex items-center gap-1 transition-colors ${
                        isAbsent
                          ? "bg-white border-rose-300 text-rose-700 hover:bg-rose-100"
                          : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {isAbsent ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" /> 출석 복원
                        </>
                      ) : (
                        <>
                          <UserMinus className="w-3.5 h-3.5 text-rose-500" /> 결석 체크
                        </>
                      )}
                    </button>
                  </div>

                  {/* If absent, present the 3 selectable choices (스펙 1-2) */}
                  {isAbsent && (
                    <div className="mt-3 pt-3 border-t border-rose-100 space-y-2 bg-white p-3 rounded-xl border border-rose-200/80">
                      <span className="font-bold text-slate-700 block">결석생 처리 정책 선택:</span>

                      {/* Policy 1: Pinch Hitter */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`policy-${s.id}`}
                          value="PINCH_HITTER"
                          checked={policy === "PINCH_HITTER"}
                          onChange={() => handlePolicyChange(s.id, "PINCH_HITTER")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-bold text-indigo-700">자원/지정 대타 투입</span>
                          <p className="text-slate-500 text-[11px]">
                            대타 학생이 대신 수행하고 당일 급여({routine.salaryAmount}원)는 대타 학생에게 지급됩니다.
                          </p>
                        </div>
                      </label>

                      {policy === "PINCH_HITTER" && (
                        <div className="pl-5 pt-1">
                          <select
                            value={currentSubId}
                            onChange={(e) => handleSubstituteChange(s.id, e.target.value)}
                            className="w-full text-xs border border-indigo-200 rounded-xl p-1.5 bg-indigo-50/40 text-slate-800 font-bold focus:outline-none"
                          >
                            <option value="">-- 대타 학생 선택 --</option>
                            {allActiveStudents
                              .filter((cand) => cand.id !== s.id)
                              .map((cand) => (
                                <option key={cand.id} value={cand.id}>
                                  {cand.studentNumber}번 {cand.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Policy 2: Defer */}
                      <label className="flex items-start gap-2 cursor-pointer pt-1">
                        <input
                          type="radio"
                          name={`policy-${s.id}`}
                          value="DEFER"
                          checked={policy === "DEFER"}
                          onChange={() => handlePolicyChange(s.id, "DEFER")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-bold text-slate-800">순번 연기 (이월)</span>
                          <p className="text-slate-500 text-[11px]">
                            결석생 순번을 다음 등교일로 이월합니다.
                          </p>
                        </div>
                      </label>

                      {/* Policy 3: Pass */}
                      <label className="flex items-start gap-2 cursor-pointer pt-1">
                        <input
                          type="radio"
                          name={`policy-${s.id}`}
                          value="PASS"
                          checked={policy === "PASS"}
                          onChange={() => handlePolicyChange(s.id, "PASS")}
                          className="mt-0.5"
                        />
                        <div>
                          <span className="font-bold text-slate-800">업무 패스 (소멸)</span>
                          <p className="text-slate-500 text-[11px]">
                            해당 차례를 무효 처리(급여 없음)하고 다음 순번으로 영구 전진합니다.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/70 text-xs text-slate-600 flex justify-between items-center">
            <span>회당 기준 급여:</span>
            <span className="font-bold text-slate-800 font-mono">
              {routine.salaryAmount.toLocaleString()} 화폐
            </span>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {loading ? "처리 중..." : isConfirmed ? "당번 재확정 및 저장" : "당번 확정 완료"}
          </button>
        </div>

      </div>
    </div>
  );
}
