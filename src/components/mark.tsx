export function PitchMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="#07110c" />
      <rect x="5" y="8" width="22" height="16" fill="#0e1a14" stroke="#3dcf8a" strokeWidth="2" />
      <line x1="16" y1="8" x2="16" y2="24" stroke="#3dcf8a" strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#3dcf8a" strokeWidth="2" />
    </svg>
  );
}
