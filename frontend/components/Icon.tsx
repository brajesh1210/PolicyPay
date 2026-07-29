import React from "react";

const PATHS: Record<string, React.ReactNode> = {
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4M8 14h.01M16 14h.01M9 18h6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3.4v5c0 4.6-3.2 8.2-7.5 9.6-4.3-1.4-7.5-5-7.5-9.6v-5z" />
      <path d="M9.4 12l1.9 1.9 3.6-3.6" />
    </>
  ),
  store: (
    <>
      <path d="M4 9h16l-1 11H5z" />
      <path d="M8 9V6a4 4 0 018 0v3" />
    </>
  ),
  swap: <path d="M7 8h13l-3-3M17 16H4l3 3" />,
  check: <path d="M20 6L9 17l-5-5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 1.9" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6L4.5 18A2 2 0 006.2 21h11.6a2 2 0 001.7-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-3-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003.4 15H3a2 2 0 010-4h.2a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 009 4.6V4a2 2 0 014 0v.2a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0021 11h.2a2 2 0 010 4H21" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.3A3 3 0 0012 8c-1.7 0-3 .9-3 2.1 0 2.6 6 1.3 6 3.8 0 1.2-1.3 2.1-3 2.1a3 3 0 01-2.8-1.3M12 6.4v1.6M12 16v1.6" />
    </>
  ),
  trend: (
    <>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </>
  ),
  warn: (
    <>
      <path d="M10.3 3.9L2 18a2 2 0 001.7 3h16.6A2 2 0 0022 18L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4.5M12 17h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  dl: (
    <>
      <path d="M12 3v12M7.5 11L12 15.5 16.5 11" />
      <path d="M4 20h16" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  play: <path d="M6 4l13 8-13 8z" />,
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  power: (
    <>
      <path d="M12 3v9" />
      <path d="M6.5 6.8a8 8 0 1011 0" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="14" r="4.5" />
      <path d="M11.4 11.2L20 3M17 6l2.5 2.5M14.5 8.5L17 11" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0115.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 01-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21" />
    </>
  ),
  chev: <path d="M9 6l6 6-6 6" />,
  logout: (
    <>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M5.5 5h13l2.5 8v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
