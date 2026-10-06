"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Copy, EyeOff } from "lucide-react";
import type { BoardTheme, ClassroomStudent, Homework } from "@/types/classroom";
import { homeworkUnsubmitted, resolveHomeworkStatus } from "@/types/classroom";
import {
  ALL_DONE_TEMPLATE,
  BOARD_NAME_SPAN_CLASS,
  HOMEWORK_COUNT_ATTR,
  boardNameColor,
  boardTextColor,
  buildHomeworkHtml,
  captureCaret,
  contextMenuPos,
  copyToClipboard,
  defaultHomeworkTemplate,
  editableKeyGuard,
  editablePasteGuard,
  extractTemplateFromDOM,
  nameSpanFromEvent,
  parseHomeworkTemplate,
  popupAnchorFrom,
  restoreCaret,
  BoardContextMenu,
  BoardElementShell,
  BoardItemPopup,
  BoardItemPopupHeader,
  useMounted,
  type ContextMenuItem,
  type PopupAnchor,
} from "@/components/classroom/canvas/boardElementShared";

/**
 * 칠판의 과제 미제출자 요소.
 *
 * 내용 편집은 업무 요소(RoutineElementInCanvas)와 같은 방식이다.
 *  - 편집 영역은 React 가 children 을 그리지 않고 innerHTML 로 직접 채운다.
 *  - html 이 바뀌면 편집 중이 아닐 때 useEffect 가 다시 써 넣는다.
 *  - handleInput 이 이름 토큰이 줄면 마지막 정상 HTML 로 되돌린다.
 * React 가 children 을 소유하면 툴바의 execCommand 가 끼워 넣은 노드 때문에
 * 다음 렌더에서 이름 토큰이 통째로 사라진다. 이 방식이면 그런 문제가 없다.
 *
 * 스펙이 다른 부분(내용/메뉴 항목)만 아래와 같다.
 *  - 이름 클릭 메뉴: [제출 처리]
 *  - 우클릭 메뉴: [모두 제출 처리] / [제출 초기화] / [내용 복사] / [칠판에서 빼기]
 */

const ZWSP = "\u200B";
/** 인원 수 토큰 속성 (extractTemplateFromDOM 이 `#` 로 되돌릴 때 사용) */
const COUNT_ATTR = HOMEWORK_COUNT_ATTR;

interface HomeworkBoardCardProps {
  homework: Homework;
  students: ClassroomStudent[];
  theme?: BoardTheme;
  onUpdateHomework?: (id: string, patch: Partial<Homework>) => void;
  onRemoveBoardHomework?: (id: string) => void;
  onSelect?: () => void;
}

export default function HomeworkBoardCard({
  homework,
  students,
  theme = "chalkboard",
  onUpdateHomework,
  onRemoveBoardHomework,
  onSelect,
}: HomeworkBoardCardProps) {
  const [activeNameIdx, setActiveNameIdx] = useState<number | null>(null);
  const [nameAnchor, setNameAnchor] = useState<PopupAnchor | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const mounted = useMounted();

  const editableRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const lastGoodHtmlRef = useRef<string>("");

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // 미제출자만 노출한다 (제출한 학생은 칩에 나타나지 않음)
  const unsubmitted = homeworkUnsubmitted(homework, students);

  // --- 본문 템플릿 (업무 요소의 displayFormat 과 같은 개념) ---
  // (early return 과 무관하게 훅 호출 순서를 유지하도록 여기까지 모두 훅을 먼저 둔다)
  const template = useMemo(
    () => homework.displayTemplate?.trim() || defaultHomeworkTemplate(unsubmitted.length),
    [homework.displayTemplate, unsubmitted.length]
  );

  const segments = useMemo(() => parseHomeworkTemplate(template), [template]);

  const expectedNameCount = segments.filter((s) => s.type === "name").length;

  // 툴바에서 지정한 색이 있으면 테마색 클래스를 빼고 직접 입힌다.
  // (업무 요소의 customColor 처리와 동일 — 테마색 클래스가 상속 색을 덮어쓰면 색이 안 보인다)
  const customColor = homework.layout?.color;
  const textColor = customColor ? "" : boardTextColor(theme);
  // 이름 토큰도 같은 색을 따라간다 (업무 요소의 당번 span 과 동일 처리)
  const nameColor = customColor ? "" : boardNameColor(theme);

  /** 편집 영역에 들어갈 HTML — 학생 화면(BoardClient)과 같은 빌더를 쓴다 */
  const html = useMemo(
    () =>
      buildHomeworkHtml({
        displayTemplate: homework.displayTemplate,
        unsubmitted,
        nameColorClass: nameColor,
        nameColor: customColor,
      }),
    [homework.displayTemplate, unsubmitted, nameColor, customColor]
  );

  // html 이 바뀌면(제출/제외/색/정렬 등) 편집 영역을 다시 써 넣는다.
  // 편집 중이어도 색·정렬 변경은 바로 보여야 하므로 커서를 복원한 뒤 항상 동기화한다.
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    if (!isFocusedRef.current) {
      el.innerHTML = html;
      lastGoodHtmlRef.current = html;
      return;
    }
    const caret = captureCaret(el);
    el.innerHTML = html;
    lastGoodHtmlRef.current = html;
    restoreCaret(el, caret);
  }, [html]);

  const closeAll = () => {
    setActiveNameIdx(null);
    setNameAnchor(null);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    closeAll();
    setContextMenu(contextMenuPos(e));
  };

  const handleSubmitName = (name: string) => {
    if (!onUpdateHomework || homework.submitted.includes(name)) return;
    onUpdateHomework(homework.id, { submitted: [...homework.submitted, name] });
    setActiveNameIdx(null);
    setNameAnchor(null);
  };

  /** 미제출자 전체 제출 — 각 학생을 따로 갱신하면 같은 스냅샷을 덮어써 마지막 1명만 반영된다 */
  const handleSubmitAll = () => {
    if (!onUpdateHomework) return;
    onUpdateHomework(homework.id, { submitted: [...homework.submitted, ...unsubmitted] });
    setContextMenu(null);
  };

  const handleUnsubmitAll = () => {
    if (!onUpdateHomework) return;
    const targets = homeworkUnsubmitted({ ...homework, submitted: [] }, students);
    const targetSet = new Set(targets);
    onUpdateHomework(homework.id, {
      submitted: homework.submitted.filter((n) => !targetSet.has(n)),
    });
    setContextMenu(null);
  };

  const handleCopyContent = async () => {
    await copyToClipboard(
      unsubmitted.length
        ? `미제출 ${unsubmitted.length}명: ${unsubmitted.join(", ")}`
        : "모두 제출했습니다"
    );
    setContextMenu(null);
  };

  // 이름 세그먼트 클릭 시 팝오버 열기 (실제 높이는 팝오버가 재서 붙인다)
  const handleNameClick = (targetEl: HTMLElement, nameIdx: number) => {
    if (activeNameIdx === nameIdx) {
      setActiveNameIdx(null);
      setNameAnchor(null);
    } else {
      setNameAnchor(popupAnchorFrom(targetEl));
      setActiveNameIdx(nameIdx);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    setIsEditing(false);
    if (!editableRef.current || !onUpdateHomework) return;
    const newTemplate = extractTemplateFromDOM(editableRef.current, { countAttr: COUNT_ATTR });
    if (!newTemplate) {
      editableRef.current.innerHTML = html;
      return;
    }
    if (newTemplate !== template) onUpdateHomework(homework.id, { displayTemplate: newTemplate });
    else editableRef.current.innerHTML = html;
  };

  const handleInput = () => {
    if (!editableRef.current) return;
    const currentCount = editableRef.current.querySelectorAll("[data-worker-index]").length;
    if (currentCount < expectedNameCount) {
      // 학생 이름 span 삭제 감지 -> 즉각 백업 복원
      editableRef.current.innerHTML = lastGoodHtmlRef.current;
      return;
    }
    lastGoodHtmlRef.current = editableRef.current.innerHTML;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
    const span = nameSpanFromEvent(e);
    if (span) {
      handleNameClick(span, parseInt(span.dataset.workerIndex || "0", 10));
      return;
    }
    setIsEditing(true);
    isFocusedRef.current = true;
  };

  const menuItems: ContextMenuItem[] = [
    {
      key: "submitAll",
      label: "모두 제출 처리",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      disabled: unsubmitted.length === 0,
      trailing:
        unsubmitted.length > 0 ? (
          <span className="text-emerald-300 font-bold">{unsubmitted.length}명</span>
        ) : null,
      onClick: handleSubmitAll,
    },
    {
      key: "reset",
      label: "제출 초기화",
      icon: <Copy className="w-3.5 h-3.5 text-rose-300" />,
      labelClass: "text-rose-300 hover:text-rose-200",
      disabled: homework.submitted.length === 0,
      trailing:
        homework.submitted.length > 0 ? (
          <span className="text-rose-300 font-bold">{homework.submitted.length}명</span>
        ) : null,
      onClick: handleUnsubmitAll,
    },
    { key: "d1", divider: true },
    {
      key: "copy",
      label: "내용 복사",
      icon: <Copy className="w-3.5 h-3.5 text-slate-300" />,
      onClick: handleCopyContent,
    },
    ...(onRemoveBoardHomework
      ? [
          {
            key: "remove",
            label: "칠판에서 빼기",
            icon: <EyeOff className="w-3.5 h-3.5 text-slate-400" />,
            labelClass: "text-slate-300 hover:text-white",
            onClick: () => {
              onRemoveBoardHomework(homework.id);
              setContextMenu(null);
            },
          } satisfies ContextMenuItem,
        ]
      : []),
  ];

  // 마감/수동 완료된 과제는 칠판에서 자동으로 빠진다 (모든 훅 호출 이후)
  if (resolveHomeworkStatus(homework, today) !== "ACTIVE") return null;

  const activeName = activeNameIdx !== null ? unsubmitted[activeNameIdx] : undefined;

  return (
    <BoardElementShell onSelect={onSelect} onContextMenu={handleContextMenu}>
      <div
        ref={editableRef}
        /* 대상 선택 드롭다운에서 서식을 걸 수 있도록 id 로 찾을 수 있게 한다 (자유 글상자와 동일) */
        data-card-id={homework.id}
        contentEditable={true}
        suppressContentEditableWarning
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect?.();
          const span = nameSpanFromEvent(e);
          if (span) {
            e.preventDefault();
            handleNameClick(span, parseInt(span.dataset.workerIndex || "0", 10));
            return;
          }
          isFocusedRef.current = true;
        }}
        onFocus={() => {
          isFocusedRef.current = true;
          setIsEditing(true);
          onSelect?.();
        }}
        onBlur={handleBlur}
        onClick={handleClick}
        onKeyDown={(e) => editableKeyGuard(e, editableRef.current)}
        onInput={handleInput}
        onPaste={editablePasteGuard}
        className={`outline-none rounded inline-block transition-all cursor-text select-text ${textColor}`}
        style={{
          whiteSpace: "pre-wrap",
          letterSpacing: "-0.02em",
          ...(customColor ? { color: customColor } : {}),
        }}
        title={
          isEditing
            ? "텍스트 수정 중 (Enter로 완료 · ? 는 미제출자 이름 자리)"
            : "클릭: 서식 편집 / 이름 클릭: 제출 처리"
        }
      />

      {mounted && contextMenu && (
        <BoardContextMenu
          pos={contextMenu}
          title={homework.title}
          icon={<ClipboardList className="w-4 h-4 text-indigo-400 shrink-0" />}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {mounted && activeNameIdx !== null && nameAnchor && (
        <BoardItemPopup
          anchor={nameAnchor}
          onClose={() => {
            setActiveNameIdx(null);
            setNameAnchor(null);
          }}
          header={
            <BoardItemPopupHeader
              name={activeName ?? ""}
              nameClass="text-rose-300"
              tag={<span className="text-[10px] text-amber-400 font-bold">미제출</span>}
            />
          }
        >
          <div className="pt-0.5 space-y-1.5">
            <button
              type="button"
              onClick={() => handleSubmitName(activeName ?? "")}
              className="w-full py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title="이 학생의 과제를 제출 처리하고 미제출자 목록에서 뺍니다"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>제출 처리</span>
            </button>
          </div>
        </BoardItemPopup>
      )}
    </BoardElementShell>
  );
}
