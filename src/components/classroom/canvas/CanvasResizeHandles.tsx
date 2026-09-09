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
  top: <div title="크기 조절 핸들" data-handle="top" className="w-full h-full" />,
  right: <div title="크기 조절 핸들" data-handle="right" className="w-full h-full" />,
  bottom: <div title="크기 조절 핸들" data-handle="bottom" className="w-full h-full" />,
  left: <div title="크기 조절 핸들" data-handle="left" className="w-full h-full" />,
  topLeft: <div title="크기 조절 핸들" data-handle="topLeft" className="w-full h-full" />,
  topRight: <div title="크기 조절 핸들" data-handle="topRight" className="w-full h-full" />,
  bottomLeft: <div title="크기 조절 핸들" data-handle="bottomLeft" className="w-full h-full" />,
  bottomRight: <div title="크기 조절 핸들" data-handle="bottomRight" className="w-full h-full" />,
};
