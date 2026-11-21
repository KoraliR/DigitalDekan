// Эмблема кабинета: объёмный смайлик в шапочке магистра.
// Два варианта: «студент» — чистое лицо, «студентка» — чёлка под шапочкой,
// хвостик на резинке и ресницы. Всё нарисовано SVG и CSS: без картинок
// и библиотек, поэтому эмблема чёткая на любом экране.

export type MascotVariant = "male" | "female";

type MascotProps = {
  className?: string;
  idPrefix?: string;
  variant?: MascotVariant;
  /** Если задан, эмблема становится осмысленной картинкой с подписью. */
  title?: string;
};

export function Mascot({ className = "mascot", idPrefix = "mascot", variant = "male", title }: MascotProps) {
  const uid = (name: string) => idPrefix + "-" + name;
  const girl = variant === "female";
  return <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
    role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
    <defs>
      {/* Тёплый шар: ключевой свет сверху слева, тень и отражённый свет снизу. */}
      <radialGradient id={uid("face")} cx="33%" cy="25%" r="90%" fx="26%" fy="16%">
        <stop offset="0%" stopColor="#fff1cf" />
        <stop offset="18%" stopColor="#ffd996" />
        <stop offset="45%" stopColor="#fcaa60" />
        <stop offset="74%" stopColor="#ef7c34" />
        <stop offset="100%" stopColor="#b8461a" />
      </radialGradient>
      <radialGradient id={uid("edge")}>
        <stop offset="56%" stopColor="#7d2f0c" stopOpacity="0" />
        <stop offset="86%" stopColor="#7d2f0c" stopOpacity=".14" />
        <stop offset="100%" stopColor="#7d2f0c" stopOpacity=".4" />
      </radialGradient>
      <linearGradient id={uid("bottom")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#74290a" stopOpacity="0" />
        <stop offset="58%" stopColor="#74290a" stopOpacity=".12" />
        <stop offset="100%" stopColor="#74290a" stopOpacity=".52" />
      </linearGradient>
      <radialGradient id={uid("shine")}>
        <stop offset="0%" stopColor="#fff" stopOpacity=".7" />
        <stop offset="52%" stopColor="#fff" stopOpacity=".22" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={uid("blush")}>
        <stop offset="0%" stopColor="#ff5d33" stopOpacity=".5" />
        <stop offset="58%" stopColor="#ff5d33" stopOpacity=".2" />
        <stop offset="100%" stopColor="#ff5d33" stopOpacity="0" />
      </radialGradient>
      {/* Тёмно-синий бархат шапочки, золотая кисточка. */}
      <linearGradient id={uid("board")} x1="12%" y1="0%" x2="88%" y2="100%">
        <stop offset="0%" stopColor="#5a549a" />
        <stop offset="46%" stopColor="#3b3674" />
        <stop offset="100%" stopColor="#242145" />
      </linearGradient>
      <linearGradient id={uid("crown")} x1="18%" y1="0%" x2="84%" y2="100%">
        <stop offset="0%" stopColor="#46407f" />
        <stop offset="100%" stopColor="#1e1c39" />
      </linearGradient>
      <linearGradient id={uid("tassel")} x1="0%" y1="0%" x2="100%" y2="14%">
        <stop offset="0%" stopColor="#ffeba6" />
        <stop offset="52%" stopColor="#f2c04a" />
        <stop offset="100%" stopColor="#c98f26" />
      </linearGradient>
      <linearGradient id={uid("hair")} x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#9a6338" />
        <stop offset="55%" stopColor="#704326" />
        <stop offset="100%" stopColor="#4f2b19" />
      </linearGradient>
      <radialGradient id={uid("eye")} cx="36%" cy="26%" r="82%">
        <stop offset="0%" stopColor="#5f3923" />
        <stop offset="58%" stopColor="#3a2014" />
        <stop offset="100%" stopColor="#241109" />
      </radialGradient>
      <clipPath id={uid("head")}><circle cx="100" cy="118" r="57" /></clipPath>
    </defs>

    <g className="mascot-float">
      {girl && <g className="mascot-hair-back">
        {/* Хвостик слева, чтобы не спорить с кисточкой на правой стороне. */}
        <path d="M56 92 C 28 86 11 102 15 124 C 19 148 30 166 43 178 C 38 160 35 141 39 123 C 42 108 48 98 56 92 Z" fill={"url(#" + uid("hair") + ")"} />
        <path d="M49 99 C 30 100 20 114 22 129" fill="none" stroke="#b07a4a" strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
        <ellipse cx="52" cy="100" rx="4.6" ry="5.6" transform="rotate(26 52 100)" fill="#eab53c" />
        {/* Бантик на резинке — ещё одна женская деталь, видна и в 100 px. */}
        <path d="M48 96 C 42 92 38 97 41 101 C 37 104 40 109 45 106 L 51 102 Z" fill="#b8384f" />
        <path d="M40 102 C 34 98 30 103 34 107 C 30 110 34 115 38 111 L 44 107 Z" fill="#a02e44" />
        <circle cx="43.5" cy="104" r="2.4" fill="#eab53c" />
      </g>}

      {/* Голова: шар, блик и румянец. */}
      <g clipPath={"url(#" + uid("head") + ")"}>
        <circle cx="100" cy="118" r="57" fill={"url(#" + uid("face") + ")"} />
        <circle cx="100" cy="118" r="57" fill={"url(#" + uid("edge") + ")"} />
        <rect x="42" y="118" width="116" height="62" fill={"url(#" + uid("bottom") + ")"} />
        <path d="M52 146 Q100 190 148 146" fill="none" stroke="#ffb877" strokeWidth="3.4" opacity=".3" strokeLinecap="round" />
        <ellipse cx="77" cy="86" rx="25" ry="15" transform="rotate(-34 77 86)" fill={"url(#" + uid("shine") + ")"} />
        <ellipse cx="62" cy="75" rx="5.8" ry="3.4" transform="rotate(-34 62 75)" fill="#fff" opacity=".62" />
        <ellipse cx="62" cy="130" rx="12" ry="7.4" fill={"url(#" + uid("blush") + ")"} />
        <ellipse cx="138" cy="130" rx="12" ry="7.4" fill={"url(#" + uid("blush") + ")"} />
      </g>

      {/* Глаза с бликами: у девушки ресницы. */}
      <g className="mascot-eyes">
        <ellipse cx="78" cy="108" rx="8.2" ry="10.2" fill={"url(#" + uid("eye") + ")"} />
        <ellipse cx="122" cy="108" rx="8.2" ry="10.2" fill={"url(#" + uid("eye") + ")"} />
        <ellipse cx="75.3" cy="103.4" rx="2.9" ry="3.5" fill="#fff" opacity=".94" />
        <ellipse cx="119.3" cy="103.4" rx="2.9" ry="3.5" fill="#fff" opacity=".94" />
        <circle cx="81.4" cy="112.4" r="1.5" fill="#fff" opacity=".4" />
        <circle cx="125.4" cy="112.4" r="1.5" fill="#fff" opacity=".4" />
        {girl && <>
          <path d="M69.6 104.4 L63.4 101.4 M68.6 108.8 L62.2 108" fill="none" stroke="#3a2014" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />
          <path d="M130.4 104.4 L136.6 101.4 M131.4 108.8 L137.8 108" fill="none" stroke="#3a2014" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />
        </>}
      </g>
      <path d="M78 128 C 86 135 114 135 122 128 C 120 147 112 155 100 155 C 88 155 80 147 78 128 Z" fill="#43190f" />
      <path d="M88 150.6 C 93 153 107 153 112 150.6" fill="none" stroke="#ffd0c2" strokeWidth="1.2" strokeLinecap="round" opacity=".35" />

      {/* Шапочка магистра: околыш, доска с толщиной, пуговица и кисточка. */}
      <path d="M73 52 L127 52 L127 72 C127 82 116 90 100 90 C84 90 73 82 73 72 Z" fill={"url(#" + uid("crown") + ")"} />
      <path d="M79 80 C 89 86 111 86 121 80" fill="none" stroke="#6f68b8" strokeWidth="1.8" strokeLinecap="round" opacity=".55" />
      <path d="M30 50 L100 78 L100 85.5 L30 57.5 Z" fill="#242042" />
      <path d="M170 50 L100 78 L100 85.5 L170 57.5 Z" fill="#16142c" />
      <path d="M30 50 L100 22 L170 50 L100 78 Z" fill={"url(#" + uid("board") + ")"} />
      <path d="M30 50 L100 22 L170 50" fill="none" stroke="#8079c4" strokeWidth="2" strokeLinejoin="round" opacity=".9" />
      <path d="M100 22 L170 50" fill="none" stroke="#a79ff0" strokeWidth="1" strokeLinejoin="round" opacity=".35" />
      <circle cx="100" cy="50" r="4.8" fill="#f6c95a" />
      <circle cx="100" cy="50" r="4.8" fill="none" stroke="#a9761d" strokeWidth="1" />
      <circle cx="98.4" cy="48.4" r="1.5" fill="#fff9e0" opacity=".95" />
      <path d="M100 51 C 118 55 140 53 151 61" fill="none" stroke="#eab53c" strokeWidth="2.4" strokeLinecap="round" />
      <g className="mascot-tassel">
        <path d="M151 61 C 157 74 158 85 154 96" fill="none" stroke="#eab53c" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="154" cy="97" r="3" fill="#f6c95a" />
        <path d="M149 99 C 149 103.5 159 103.5 159 99 L160.5 116 C 160.5 121 147.5 121 147.5 116 Z" fill={"url(#" + uid("tassel") + ")"} />
        <path d="M151 104 L150 117 M154 104 L154 118 M157 104 L158 117" stroke="#bf8b26" strokeWidth=".9" strokeLinecap="round" opacity=".65" />
      </g>
    </g>
  </svg>;
}
