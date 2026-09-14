"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  UserCheck,
  UserMinus,
  Wallet,
  X,
  Plus,
} from "lucide-react";
import { createStudent, updateStudent, deleteStudent, toggleStudentStatus } from "@/app/actions";
import type { Student } from "@/types";

interface StudentManagementClientProps {
  initialStudents: Student[];
  currencyName: string;
}

export default function StudentManagementClient({
  initialStudents,
  currencyName,
}: StudentManagementClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ABSENT">("ALL");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "남" | "여" | "NONE">("ALL");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form states
  const [studentNumber, setStudentNumber] = useState<number>(
    initialStudents.length > 0
      ? Math.max(...initialStudents.map((s) => s.studentNumber)) + 1
      : 1
  );
  const [name, setName] = useState("");
  const [gender, setGender] = useState("남");
  const [memo, setMemo] = useState("");
  const [initialBalance, setInitialBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredStudents = initialStudents.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(s.studentNumber).includes(searchTerm);
    const matchesFilter =
      statusFilter === "ALL" ? true : s.status === statusFilter;
    const matchesGender =
      genderFilter === "ALL"
        ? true
        : genderFilter === "NONE"
          ? s.gender !== "남" && s.gender !== "여"
          : s.gender === genderFilter;
    return matchesSearch && matchesFilter && matchesGender;
  });

  const handleOpenAddModal = () => {
    const nextNum =
      initialStudents.length > 0
        ? Math.max(...initialStudents.map((s) => s.studentNumber)) + 1
        : 1;
    setStudentNumber(nextNum);
    setName("");
    setGender("남");
    setMemo("");
    setInitialBalance(0);
    setErrorMsg("");
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student);
    setStudentNumber(student.studentNumber);
    setName(student.name);
    setGender(student.gender || "남");
    setMemo(student.memo || "");
    setErrorMsg("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("학생 이름을 입력해 주세요.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      await createStudent({
        studentNumber,
        name: name.trim(),
        gender,
        memo: memo.trim(),
        initialBalance,
      });
      setIsAddModalOpen(false);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "학생 추가 중 오류가 발생했습니다.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("학생 이름을 입력해 주세요.");
      return;
    }
    if (!editingStudent) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await updateStudent(editingStudent.id, {
        studentNumber,
        name: name.trim(),
        gender,
        memo: memo.trim(),
      });
      setEditingStudent(null);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "학생 정보 수정 중 오류가 발생했습니다.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, sName: string) => {
    if (!confirm(`정말로 ${sName} 학생을 삭제하시겠습니까? 관련 계좌와 데이터도 함께 삭제됩니다.`)) {
      return;
    }
    try {
      await deleteStudent(id);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "삭제 실패";
      alert(msg);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "ABSENT" : "ACTIVE";
    try {
      await toggleStudentStatus(id, nextStatus);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "상태 변경 실패";
      alert(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            학생 명단 관리
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            재적 학생 명단 등록, 당일 결석 여부 토글, 계좌 잔액 현황을 관리합니다.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-200 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          학생 등록
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="이름 또는 번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "ALL" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
            }`}
          >
            전체 ({initialStudents.length})
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "ACTIVE" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600"
            }`}
          >
            출석 ({initialStudents.filter((s) => s.status === "ACTIVE").length})
          </button>
          <button
            onClick={() => setStatusFilter("ABSENT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "ABSENT" ? "bg-white text-rose-700 shadow-sm" : "text-slate-600"
            }`}
          >
            결석 ({initialStudents.filter((s) => s.status === "ABSENT").length})
          </button>
        </div>

        {/* Gender Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { v: "ALL", label: "전체 성별" },
              { v: "남", label: "남" },
              { v: "여", label: "여" },
              { v: "NONE", label: "미지정" },
            ] as { v: "ALL" | "남" | "여" | "NONE"; label: string }[]
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setGenderFilter(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === o.v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-3.5 px-4 w-16 text-center">번호</th>
                <th className="py-3.5 px-4">이름</th>
                <th className="py-3.5 px-4">성별</th>
                <th className="py-3.5 px-4">출석 상태 (클릭 변경)</th>
                <th className="py-3.5 px-4 text-right">계좌 잔액</th>
                <th className="py-3.5 px-4">메모</th>
                <th className="py-3.5 px-4 text-center w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    해당 조건의 학생이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const isAbsent = student.status === "ABSENT";
                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isAbsent ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {student.studentNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {student.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {student.gender || "-"}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(student.id, student.status)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            isAbsent
                              ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                              : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          }`}
                        >
                          {isAbsent ? (
                            <>
                              <UserMinus className="w-3.5 h-3.5" /> 결석 중
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" /> 정상 출석
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                        {student.account?.balance?.toLocaleString() ?? 0} {currencyName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs truncate max-w-xs">
                        {student.memo || "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(student.id, student.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(isAddModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingStudent ? "학생 정보 수정" : "신규 학생 등록"}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingStudent(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingStudent ? handleUpdate : handleCreate} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    출석 번호
                  </label>
                  <input
                    type="number"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(Number(e.target.value))}
                    required
                    min={1}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="예: 홍길동"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  성별
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="남"
                      checked={gender === "남"}
                      onChange={(e) => setGender(e.target.value)}
                    />
                    남학생
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="여"
                      checked={gender === "여"}
                      onChange={(e) => setGender(e.target.value)}
                    />
                    여학생
                  </label>
                </div>
              </div>

              {!editingStudent && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    초기 지급 계좌 잔액 ({currencyName})
                  </label>
                  <input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(Number(e.target.value))}
                    min={0}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    계좌 개설과 함께 기본 지급될 금액입니다.
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  메모 (특이사항)
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={2}
                  placeholder="특이사항이나 역할 등 메모"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {errorMsg}
                </p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? "저장 중..." : editingStudent ? "수정 완료" : "학생 추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
