"use client";

import { useEffect, useState } from "react";

interface AnalogClockProps {
  size?: number | string;
  color?: string;
  className?: string;
}

export default function AnalogClock({
  size = "100%",
  color = "currentColor",
  className = "",
}: AnalogClockProps) {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const update = () => setTime(new Date());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const secondAngle = seconds * 6;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const hourAngle = ((hours % 12) + minutes / 60 + seconds / 3600) * 30;

  // 12개 시간 눈금 (바깥쪽 테두리 부근에 짧게 배치)
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = i * 30 * (Math.PI / 180);
    const isMajor = i % 3 === 0;
    const innerRadius = isMajor ? 41 : 42.5;
    const outerRadius = 45;
    const x1 = 50 + innerRadius * Math.sin(angle);
    const y1 = 50 - innerRadius * Math.cos(angle);
    const x2 = 50 + outerRadius * Math.sin(angle);
    const y2 = 50 - outerRadius * Math.cos(angle);
    return { x1, y1, x2, y2, isMajor, key: i };
  });

  // 1~12 숫자 레이블 (눈금과 겹치지 않게 안쪽에 배치)
  const numbers = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    const angle = num * 30 * (Math.PI / 180);
    const radius = 33;
    const x = 50 + radius * Math.sin(angle);
    const y = 50 - radius * Math.cos(angle);
    return { num, x, y };
  });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`select-none overflow-visible ${className}`}
      style={{ color }}
    >
      {/* 시계 외곽 다이얼 */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.85"
      />

      {/* 12개 눈금 */}
      {ticks.map((t) => (
        <line
          key={t.key}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="currentColor"
          strokeWidth={t.isMajor ? 1.8 : 1}
          strokeLinecap="round"
          strokeOpacity={t.isMajor ? 0.9 : 0.55}
        />
      ))}

      {/* 1~12 전체 숫자 */}
      {numbers.map(({ num, x, y }) => (
        <text
          key={num}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="7.5"
          fontWeight="bold"
          fill="currentColor"
          fillOpacity={0.88}
          style={{ fontFamily: "system-ui, -apple-system, sans-serif", userSelect: "none" }}
        >
          {num}
        </text>
      ))}

      {/* 시침 (짧고 굵음) */}
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="30"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        transform={`rotate(${hourAngle} 50 50)`}
      />

      {/* 분침 (길고 중간 굵기) */}
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.9"
        transform={`rotate(${minuteAngle} 50 50)`}
      />

      {/* 초침 (가늘고 붉은색 포인트) */}
      <line
        x1="50"
        y1="55"
        x2="50"
        y2="14"
        stroke="#f43f5e"
        strokeWidth="1.2"
        strokeLinecap="round"
        transform={`rotate(${secondAngle} 50 50)`}
      />

      {/* 중심 핀 */}
      <circle cx="50" cy="50" r="2.2" fill="#f43f5e" />
      <circle cx="50" cy="50" r="1" fill="#ffffff" />
    </svg>
  );
}
