/** Authored line icons (24px grid, 1.75 stroke) shared by customer and back-office screens. */
const paths = {
  home: <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5h4v5" /></>,
  trip: <><path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  cart: <><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9.5" cy="19" r="1.25" /><circle cx="17" cy="19" r="1.25" /></>,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  backpack: <><path d="M7 9a5 5 0 0 1 10 0v11H7z" /><path d="M10 4.5h4" /><path d="M7 13h10M10 13v3h4v-3" /></>,
  store: <><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 11.5v8h13v-8" /><path d="M10 19.5v-4.5h4v4.5" /></>,
  leaf: <><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19c3-4 6-7 9-9" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  external: <><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5 11 13" /><path d="M17 14v5.5H4.5V7H10" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  location: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="7" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
