// Сова-преподаватель — эмблема служебного кабинета.
// Очки, бабочка и указка читаются как «преподаватель»; анимации — парение,
// моргание, покачивание кисточек на ушах и постукивание указкой.
// Всё SVG + CSS: без картинок и библиотек, работает и на 96 px, и на 180 px.

type OwlProps = {
  className?: string;
  idPrefix?: string;
};

export function Owl({ className = "owl", idPrefix = "owl" }: OwlProps) {
  const uid = (name: string) => idPrefix + "-" + name;
  return <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={uid("body")} x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#b98c62" />
        <stop offset="55%" stopColor="#966740" />
        <stop offset="100%" stopColor="#6d4527" />
      </linearGradient>
      <linearGradient id={uid("wing")} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8a5b38" />
        <stop offset="100%" stopColor="#5c3a22" />
      </linearGradient>
      <linearGradient id={uid("belly")} x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stopColor="#fbf0df" />
        <stop offset="100%" stopColor="#ecd6b6" />
      </linearGradient>
      <radialGradient id={uid("face")} cx="42%" cy="34%" r="72%">
        <stop offset="0%" stopColor="#fffaf0" />
        <stop offset="72%" stopColor="#f8ead3" />
        <stop offset="100%" stopColor="#e7cdaa" />
      </radialGradient>
      <radialGradient id={uid("iris")} cx="38%" cy="32%" r="78%">
        <stop offset="0%" stopColor="#ffd979" />
        <stop offset="58%" stopColor="#efad3c" />
        <stop offset="100%" stopColor="#c9821f" />
      </radialGradient>
      <linearGradient id={uid("brass")} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f6d287" />
        <stop offset="55%" stopColor="#dfae52" />
        <stop offset="100%" stopColor="#b9832c" />
      </linearGradient>
      <linearGradient id={uid("beak")} x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#f8b453" />
        <stop offset="100%" stopColor="#d9852c" />
      </linearGradient>
      <linearGradient id={uid("pointer")} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a9774a" />
        <stop offset="100%" stopColor="#d8a873" />
      </linearGradient>
      <linearGradient id={uid("tie")} x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#413d78" />
        <stop offset="100%" stopColor="#262346" />
      </linearGradient>
    </defs>

    <g className="owl-float">
      {/* Кисточки-уши: слегка подрагивают. */}
      <g className="owl-tuft owl-tuft-left">
        <path d="M63 44 L46 15 L79 35 Z" fill={"url(#" + uid("body") + ")"} />
      </g>
      <g className="owl-tuft owl-tuft-right">
        <path d="M137 44 L154 15 L121 35 Z" fill={"url(#" + uid("body") + ")"} />
      </g>

      {/* Тело, грудка, крылья, лапки. */}
      <path d="M100 26 C 132 26 158 50 166 88 C 173 118 170 152 154 174 C 142 190 122 196 100 196 C 78 196 58 190 46 174 C 30 152 27 118 34 88 C 42 50 68 26 100 26 Z" fill={"url(#" + uid("body") + ")"} />
      <path d="M100 26 C 118 26 132 36 142 52 C 120 44 80 44 58 52 C 68 36 82 26 100 26 Z" fill="#c69a6d" opacity=".55" />
      <path d="M100 112 C 76 112 62 130 62 156 C 62 178 78 190 100 190 C 122 190 138 178 138 156 C 138 130 124 112 100 112 Z" fill={"url(#" + uid("belly") + ")"} />
      <g fill="none" stroke="#d9b78f" strokeWidth="1.6" strokeLinecap="round" opacity=".6">
        <path d="M78 132 Q100 142 122 132" />
        <path d="M74 146 Q100 157 126 146" />
        <path d="M78 161 Q100 172 122 161" />
      </g>
      <path d="M44 102 C 28 122 28 152 44 172 C 54 162 58 142 56 122 C 54 112 50 106 44 102 Z" fill={"url(#" + uid("wing") + ")"} />
      <path d="M156 102 C 172 122 172 152 156 172 C 146 162 142 142 144 122 C 146 112 150 106 156 102 Z" fill={"url(#" + uid("wing") + ")"} />
      <g fill="none" stroke="#4a2d19" strokeWidth="1.4" strokeLinecap="round" opacity=".55">
        <path d="M42 132 C 50 136 52 146 48 156" />
        <path d="M158 132 C 150 136 148 146 152 156" />
      </g>
      <g fill="#e79a3c">
        <path d="M84 192 C 84 188 90 188 90 192 L90 197 L84 197 Z" />
        <path d="M110 192 C 110 188 116 188 116 192 L116 197 L110 197 Z" />
      </g>

      {/* Голова: лицевой диск, глаза, очки, клюв. */}
      <g className="owl-face">
        <circle cx="79" cy="80" r="37" fill={"url(#" + uid("face") + ")"} />
        <circle cx="121" cy="80" r="37" fill={"url(#" + uid("face") + ")"} />
        <circle cx="79" cy="80" r="37" fill="none" stroke="#d9b78f" strokeWidth="1.6" opacity=".7" />
        <circle cx="121" cy="80" r="37" fill="none" stroke="#d9b78f" strokeWidth="1.6" opacity=".7" />

        <g className="owl-eyes">
          <circle cx="80" cy="82" r="21" fill="#fffaf0" />
          <circle cx="120" cy="82" r="21" fill="#fffaf0" />
          <circle cx="80" cy="83" r="13.5" fill={"url(#" + uid("iris") + ")"} />
          <circle cx="120" cy="83" r="13.5" fill={"url(#" + uid("iris") + ")"} />
          <circle cx="80" cy="84" r="6.4" fill="#241309" />
          <circle cx="120" cy="84" r="6.4" fill="#241309" />
          <circle cx="76.6" cy="79.6" r="3" fill="#fff" opacity=".95" />
          <circle cx="116.6" cy="79.6" r="3" fill="#fff" opacity=".95" />
          <circle cx="83.4" cy="88.4" r="1.5" fill="#fff" opacity=".5" />
          <circle cx="123.4" cy="88.4" r="1.5" fill="#fff" opacity=".5" />
        </g>

        {/* Очки преподавателя. */}
        <g className="owl-glasses" fill="none" stroke={"url(#" + uid("brass") + ")"} strokeWidth="4" strokeLinecap="round">
          <circle cx="80" cy="82" r="25" />
          <circle cx="120" cy="82" r="25" />
          <path d="M105 79 C 107.5 76.5 112.5 76.5 115 79" strokeWidth="3.2" />
          <path d="M55 80 L40 73" strokeWidth="2.6" />
          <path d="M145 80 L160 73" strokeWidth="2.6" />
        </g>
        <path d="M65 69 L79 61 M105 69 L119 61" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" opacity=".35" />

        <path d="M93 104 C 96 102 104 102 107 104 L100 119 Z" fill={"url(#" + uid("beak") + ")"} />
        <path d="M95 106 C 97 105 100 105 100 105" stroke="#ffe0a8" strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      </g>

      {/* Бабочка и указка. */}
      <g className="owl-tie">
        <path d="M100 148 L78 136 C 74 134 72 138 73 142 L75 156 C 76 160 80 161 83 158 Z" fill={"url(#" + uid("tie") + ")"} />
        <path d="M100 148 L122 136 C 126 134 128 138 127 142 L125 156 C 124 160 120 161 117 158 Z" fill={"url(#" + uid("tie") + ")"} />
        <circle cx="100" cy="148" r="6" fill="#e4b455" />
      </g>

      <g className="owl-pointer">
        <path d="M150 138 L188 84" stroke={"url(#" + uid("pointer") + ")"} strokeWidth="6" strokeLinecap="round" />
        <path d="M186 87 L190 81" stroke="#2f2c57" strokeWidth="7.6" strokeLinecap="round" />
        <ellipse cx="151" cy="139" rx="10" ry="8" transform="rotate(-30 151 139)" fill={"url(#" + uid("wing") + ")"} />
        <path d="M146 137 C 149 134 154 135 156 139" fill="none" stroke="#4a2d19" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
      </g>
    </g>
  </svg>;
}
