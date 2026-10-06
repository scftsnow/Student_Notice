"use client";

import { useEffect, useState } from "react";
import { X, Pencil, Clock } from "lucide-react";
import type { ClassroomStudent, Homework } from "@/types/classroom";
import { homeworkTargets } from "@/types/classroom";

interface HomeworkEditModalProps {
  homework: Homework | null;
  students: ClassroomStudent[];
  onClose: () => void;
  onSave: (id: string, patch: Partial<Homework>) => void;
}

/**
 * 과제 수정 팝업 (제목 · 마감일 · 제출 제외 학생).
 * DirectTaxModal과 같은 컨테이너/헤더/푸터 스타일을 공유한다.
 */
export default function HomeworkEditModal({
  homework,
  students,
  onClose,
  onSave,
}: HomeworkEditModalProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [exempt, setExempt] = useState<string[]>([]);

  // 과제를 열 때마다 현재 값으로 초기화
  useEffect(() => {
    if (!homework) return;
    setTitle(homework.title);
    setDueDate(homework.dueDate ?? "");
    setExempt(homework.exempt ?? []);
  }, [homework]);

  if (!homework) return null;

  const dirty =
    title.trim() !== homework.title ||
    dueDate !== (homework.dueDate ?? "") ||
    exempt.join(",") !== (homework.exempt ?? []).join(",");

  const save = () => {
    const t = title.trim();
    if (!t) return;
    onSave(homework.id, { title: t, dueDate, exempt });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="과제 수정"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-600" />
            <h2 className="font-extrabold text-slate-800 text-base">과제 수정</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">과제 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="예: 3단원 산술 문제 1~20번"
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">마감일</label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
                >
                  마감일 없음
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              마감일이 지나면 자동으로 완료 처리되어 진행 중 목록에서 빠집니다.
              <br />
              마감일을 바꾸면 완료/진행 중이 <b>새 마감일로 다시 계산</b>돼요. (미래 날짜로 바꾸면 진행
              중으로 되돌아갑니다)
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-semibold text-slate-600">
              제출 제외 대상{" "}
              <span className="text-slate-400 font-normal">
                (여행·결석 등 {exempt.length}명)
              </span>
            </label>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-wrap gap-1.5">
                {students.map((s) => {
                  const on = exempt.includes(s.name);
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() =>
                        setExempt((prev) =>
                          on ? prev.filter((n) => n !== s.name) : [...prev, s.name]
                        )
                      }
                      title={on ? "제출 대상으로 복원" : "제출 대상에서 제외"}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors inline-flex items-center gap-1 ${
                        on
                          ? "bg-slate-200 border-slate-300 text-slate-600"
                          : "bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700"
                      }`}
                    >
                      {s.name}
                      {on && <X className="w-3 h-3" />}
                    </button>
                  );
                })}
                {students.length === 0 && (
                  <span className="text-[11px] text-slate-400">
                    등록된 학생이 없습니다.
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                제외한 학생은 제출 대상과 미제출자 목록에서 빠집니다.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            저장 후 제출 대상{" "}
            <span className="font-bold text-slate-600">
              {homeworkTargets({ ...homework, title, dueDate, exempt }, students).length}명
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!title.trim() || !dirty}
              className="px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
