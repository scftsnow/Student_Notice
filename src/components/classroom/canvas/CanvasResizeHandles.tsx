import React from "react";

export const RESIZE_ENABLE = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
};

export const RESIZE_HANDLES = {
  top: <div title="상단 크기 조절" data-handle="top" className="w-full h-full cursor-ns-resize" />,
  right: (
    <div title="우측 크기 조절" data-handle="right" className="w-full h-full flex items-center justify-end cursor-ew-resize">
      <div className="w-1 h-8 rounded-full bg-white/40 group-hover:bg-indigo-400 transition-colors mr-0.5" />
    </div>
  ),
  bottom: (
    <div title="하단 크기 조절" data-handle="bottom" className="w-full h-full flex items-end justify-center cursor-ns-resize pb-0.5">
      <div className="w-8 h-1 rounded-full bg-white/40 group-hover:bg-indigo-400 transition-colors" />
    </div>
  ),
  left: <div title="좌측 크기 조절" data-handle="left" className="w-full h-full cursor-ew-resize" />,
  topLeft: <div title="대각선 크기 조절" data-handle="topLeft" className="w-full h-full cursor-nwse-resize" />,
  topRight: <div title="대각선 크기 조절" data-handle="topRight" className="w-full h-full cursor-nesw-resize" />,
  bottomLeft: <div title="대각선 크기 조절" data-handle="bottomLeft" className="w-full h-full cursor-nesw-resize" />,
  bottomRight: (
    <div title="모서리 크기 조절" data-handle="bottomRight" className="w-full h-full flex items-end justify-end p-1 cursor-nwse-resize">
      <div className="w-3 h-3 border-r-2 border-b-2 border-white/70 group-hover:border-indigo-400 transition-colors rounded-br-xs" />
    </div>
  ),
};
