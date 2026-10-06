"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  ClipboardList,
  CheckCircle2,
  Clock,
  X,
  Pencil,
  UserMinus,
} from "lucide-react";
import type { ClassroomStudent, Homework } from "@/types/classroom";
import { homeworkTargets, homeworkUnsubmitted, resolveHomeworkStatus } from "@/types/classroom";
import HomeworkEditModal from "./HomeworkEditModal";

interface HomeworkTabProps {
  homeworks: Homework[];
  students: ClassroomStudent[];
  onAdd: (hw: { title: string; dueDate: string }) => void;
  onUpdate: (id: string, patch: Partial<Homework>) => void;
  onToggleSubmitted: (id: string, name: string) => void;
  onToggleExempt: (id: string, name: string) => void;
  onSetAllSubmitted: (id: string, value: boolean) => void;
  onDelete: (id: string) => void;
}

const emptyForm = { title: "", dueDate: "" };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 전체 제출/해제 체크박스 (일부만 제출된 경우 indeterminate) */
function AllSubmitCheck({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (next: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-indigo-600 cursor-pointer"
      />
      <span className="text-xs font-bold text-slate-700">전체 제출 / 해제</span>
    </label>
  );
}

export default function HomeworkTab({
  homeworks,
  students,
  onAdd,
  onUpdate,
  onToggleSubmitted,
  onToggleExempt,
  onSetAllSubmitted,
  onDelete,
}: HomeworkTabProps) {
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState<"ACTIVE" | "DONE">("ACTIVE");
  const [exemptFor, setExemptFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<Homework | null>(null);

  const today = todayStr();
  const activeList = useMemo(
    () => homeworks.filter((h) => resolveHomeworkStatus(h, today) === "ACTIVE"),
    [homeworks, today]
  );
  const doneList = useMemo(
    () => homeworks.filter((h) => resolveHomeworkStatus(h, today) === "DONE"),
    [homeworks, today]
  );
  const shown = tab === "ACTIVE" ? activeList : doneList;

  const submitForm = () => {
    const title = form.title.trim();
    if (!title) return;
    onAdd({ title, dueDate: form.dueDate });
    setForm(emptyForm);
  };

  return (
    <div className="space-y-4 text-sm">
      {/* 액션 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 text-base">학급 과제 제출 관리</span>
          <span className="text-slate-400 text-xs">
            (진행 <span className="font-bold text-indigo-600">{activeList.length}</span>개 · 완료{" "}
            <span className="font-bold text-slate-500">{doneList.length}</span>개)
          </span>
        </div>
      </div>

      {/* 과제 등록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">과제 제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitForm();
              }}
              placeholder="예: 3단원 산술 문제 1~20번"
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">마감일</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={submitForm}
            disabled={!form.title.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-sm hover:bg-indigo-700 flex items-center gap-1.5 transition-all text-xs disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>과제 등록</span>
          </button>
        </div>
      </div>

      {/* 탭: 진행 중 / 완료 */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(
          [
            { v: "ACTIVE", label: `진행 중 (${activeList.length})` },
            { v: "DONE", label: `완료 (${doneList.length})` },
          ] as { v: "ACTIVE" | "DONE"; label: string }[]
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setTab(o.v)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              tab === o.v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 과제 카드 목록 */}
      {shown.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="font-semibold text-base">
            {tab === "ACTIVE" ? "진행 중인 과제가 없습니다." : "완료된 과제가 없습니다."}
          </div>
          <div className="text-xs mt-1">
            {tab === "ACTIVE"
              ? "위에서 과제를 등록하면 학생별 제출 현황을 관리할 수 있습니다."
              : "마감일이 지나면 자동으로 완료 처리됩니다."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((h) => {
            const targets = homeworkTargets(h, students);
            const unsubmitted = homeworkUnsubmitted(h, students);
            const isActive = resolveHomeworkStatus(h, today) === "ACTIVE";
            return (
              <div
                key={h.id}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                {/* 헤더: 제목 · 마감일 · 제출 현황 배지 (한 줄) */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="font-extrabold text-slate-800 text-sm">{h.title}</span>
                    {h.dueDate && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] border inline-flex items-center gap-1 shrink-0 ${
                          isActive
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : "text-slate-500 bg-slate-100 border-slate-200"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {h.dueDate} 마감
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200 bg-slate-50 text-slate-600">
                      대상 {targets.length}명
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold border border-emerald-300 bg-emerald-50 text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      제출 {targets.length - unsubmitted.length}명
                    </span>
                    {unsubmitted.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold border border-rose-300 bg-rose-50 text-rose-700">
                        미제출 {unsubmitted.length}명
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold border border-lime-300 bg-lime-50 text-lime-700">
                        전원 제출
                      </span>
                    )}
                    {h.exempt.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditFor(h)}
                        title="제외 대상 수정"
                        className="px-2 py-0.5 rounded-md text-[11px] font-bold border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors inline-flex items-center gap-1"
                      >
                        <UserMinus className="w-3 h-3" />
                        제외 {h.exempt.length}명
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => onUpdate(h.id, { status: "DONE" })}
                        title="지금 완료 처리"
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-[11px] font-bold transition-colors"
                      >
                        완료 처리
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditFor(h)}
                      title="과제 수정 (제목 · 마감일 · 제외 대상)"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${h.title}" 과제를 삭제하시겠습니까?`)) onDelete(h.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="과제 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 제출 현황 */}
                {/* 학생별 토글 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <AllSubmitCheck
                      checked={targets.length > 0 && unsubmitted.length === 0}
                      indeterminate={
                        unsubmitted.length > 0 && targets.length - unsubmitted.length > 0
                      }
                      onChange={(next) => onSetAllSubmitted(h.id, next)}
                    />
                    <button
                      type="button"
                      onClick={() => setExemptFor(exemptFor === h.id ? null : h.id)}
                      title="제출 제외 대상 관리 (여행·결석 등)"
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors inline-flex items-center gap-1 ${
                        exemptFor === h.id
                          ? "bg-amber-100 border-amber-400 text-amber-800"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700"
                      }`}
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      제출 제외 대상 {h.exempt.length}명
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {targets.map((name) => {
                      const done = h.submitted.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onToggleSubmitted(h.id, name)}
                          title={done ? "제출 취소" : "제출 처리"}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                            done
                              ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                              : "bg-white border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600"
                          }`}
                        >
                          {name}
                          {done && <CheckCircle2 className="w-3 h-3 inline ml-1 -mt-0.5" />}
                        </button>
                      );
                    })}
                    {targets.length === 0 && (
                      <span className="text-xs text-slate-400">
                        제출 대상 학생이 없습니다 (모두 제외됨).
                      </span>
                    )}
                  </div>

                  {exemptFor === h.id && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {students.map((s) => {
                          const isExempt = h.exempt.includes(s.name);
                          return (
                            <button
                              key={s.name}
                              type="button"
                              onClick={() => onToggleExempt(h.id, s.name)}
                              title={isExempt ? "제출 대상으로 복원" : "제출 대상에서 제외"}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors inline-flex items-center gap-1 ${
                                isExempt
                                  ? "bg-slate-200 border-slate-300 text-slate-600"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:text-amber-700"
                              }`}
                            >
                              {s.name}
                              {isExempt && <X className="w-3 h-3" />}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        제외한 학생은 제출 대상과 미제출자 목록에서 빠집니다 (여행·결석 등).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 과제 수정 팝업 (제목 · 마감일 · 제출 제외 대상) */}
      <HomeworkEditModal
        homework={editFor}
        students={students}
        onClose={() => setEditFor(null)}
        onSave={onUpdate}
      />
    </div>
  );
}
