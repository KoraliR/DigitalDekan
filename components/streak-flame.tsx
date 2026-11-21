// Огонёк серии посещений: горит, пока студент отмечается на парах.
// Активное состояние — тёплый градиент и свечение, неактивное — погасший серый.

const outer = "M24 4 C 24.6 10 31.6 13.4 33.6 20.6 C 36 29.2 30.6 39 23 39 C 15.4 39 10 32.6 10 24.8 C 10 18.4 14 14.4 16.6 9.4 C 17.2 13.4 18.8 16 21.2 17.2 C 20.6 12.2 21.4 7.8 24 4 Z";
const inner = "M23.4 20 C 23.8 23.6 28 25.2 28 29.6 C 28 33.2 25.8 35.6 22.8 35.6 C 19.7 35.6 17.4 33.2 17.4 29.8 C 17.4 26.6 19.6 24.4 23.4 20 Z";

export function StreakFlame({ active }: { active: boolean }) {
  return <svg className={"streak-flame-svg" + (active ? " is-active" : "")} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="streak-flame-glow">
        <stop offset="0%" stopColor="#ffa05a" stopOpacity=".62" />
        <stop offset="100%" stopColor="#ffa05a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="streak-flame-hot" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stopColor="#ffe07a" />
        <stop offset="40%" stopColor="#ff9f2e" />
        <stop offset="100%" stopColor="#ef4a0c" />
      </linearGradient>
      <linearGradient id="streak-flame-core" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#fffbec" />
        <stop offset="100%" stopColor="#ffd76a" />
      </linearGradient>
      <linearGradient id="streak-flame-cold" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stopColor="#ded7cf" />
        <stop offset="100%" stopColor="#b0a69c" />
      </linearGradient>
    </defs>
    {active && <circle cx="24" cy="26" r="21" fill="url(#streak-flame-glow)" />}
    <path d={outer} fill={active ? "url(#streak-flame-hot)" : "url(#streak-flame-cold)"} />
    <path d={inner} fill={active ? "url(#streak-flame-core)" : "#f7f3ee"} />
  </svg>;
}
