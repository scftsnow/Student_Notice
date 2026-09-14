"use client";

import { useState } from "react";
import { Save, FolderOpen, Trash2 } from "lucide-react";

interface SaveBarProps {
  items: { id: string; name: string }[];
  placeholder: string;
  defaultName: string;
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SaveBar({
  items,
  placeholder,
  defaultName,
  onSave,
  onLoad,
  onDelete,
}: SaveBarProps) {
  const [name, setName] = useState(defaultName);
  const [selectedId, setSelectedId] = useState("");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    const target = items.find((i) => i.id === selectedId);
    if (!target) return;
    if (!confirm(`'${target.name}'을(를) 삭제하시겠습니까?`)) return;
    onDelete(selectedId);
    setSelectedId("");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          <Save className="w-3.5 h-3.5" />
          저장
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">불러올 항목 선택 ({items.length})</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => selectedId && onLoad(selectedId)}
          disabled={!selectedId}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          열기
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!selectedId}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
          title="삭제"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
