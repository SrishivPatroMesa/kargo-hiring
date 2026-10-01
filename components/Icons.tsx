// Small inline icon set (stroke icons, 24px grid) so the app needs no icon library.
type P = { size?: number; className?: string };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconList = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
export const IconUpload = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>);
export const IconRubric = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
export const IconChevron = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M9 18l6-6-6-6" /></svg>);
export const IconSend = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>);
export const IconSpark = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>);
export const IconFile = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>);
export const IconInfo = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>);
export const IconCheck = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M20 6L9 17l-5-5" /></svg>);
export const IconSwap = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" /></svg>);
export const IconLock = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
export const IconTrash = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>);
export const IconFlag = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg>);

/** Kargo mark: three stacked containers. */
export const KargoMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <rect x="3" y="18" width="12" height="9" rx="1.5" fill="#e8702a" />
    <rect x="17" y="18" width="12" height="9" rx="1.5" fill="#3c8fb5" />
    <rect x="10" y="7" width="12" height="9" rx="1.5" fill="#ffffff" />
    <path d="M6 20v5M9 20v5M12 20v5M20 20v5M23 20v5M26 20v5M13 9v5M16 9v5M19 9v5" stroke="rgba(14,33,64,.35)" strokeWidth="1" />
  </svg>
);
