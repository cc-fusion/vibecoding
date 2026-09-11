import type { CSSProperties } from 'react';
export function Icon({ name, size = 18, className = '', style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    wave: <><path d="M2 9c3-6 5 6 9 0s6 6 11 0M2 15c3-6 5 6 9 0s6 6 11 0" /></>,
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" strokeWidth="0" />,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" strokeWidth="0"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" strokeWidth="0"/></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/></>,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    external: <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />,
    book: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Z"/><path d="M12 5v15"/></>,
    code: <path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    camera: <><path d="M8 5 6 8H3v12h18V8h-3l-2-3Z"/><circle cx="12" cy="13" r="3"/></>,
    settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="16" cy="17" r="3" fill="currentColor"/></>,
    droplet: <path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" />,
    cube: <><path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10M7.5 4.5l9 5"/></>,
    grid: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/></>,
    link: <><path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-2 2" transform="translate(1 0) scale(.92)"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    cursor: <path d="m4 3 6 18 3-8 8-3Z" />,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    activity: <path d="M2 12h4l3-8 5 16 3-8h5" />,
    layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/></>,
    spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></>,
    step: <><path d="m5 5 10 7-10 7Z" fill="currentColor" strokeWidth="0"/><path d="M19 5v14"/></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{paths[name] || paths.activity}</svg>;
}
