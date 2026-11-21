"use client";
import { useEffect, useState } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { nextQuote, quoteCategories, type MotivationQuote } from "@/lib/quotes";

// Цитата живёт весь заход: вернувшись на «Сегодня» внутри приложения, студент
// видит ту же мысль, а после перезагрузки страницы получает новую.
let visitQuote: MotivationQuote | null = null;
const lastSeenKey = "dekanat-quote-last";

export function QuoteCard({ initial }: { initial: MotivationQuote }) {
  const [quote, setQuote] = useState<MotivationQuote>(() => visitQuote ?? initial);

  // Первую цитату захода уже выбрал сервер. Единственная поправка — если она
  // совпала с прошлым визитом, берём другую: «меняется каждый заход».
  useEffect(() => {
    if (visitQuote) {
      if (visitQuote.id !== quote.id) setQuote(visitQuote);
      return;
    }
    let repeated = false;
    try {
      repeated = window.localStorage.getItem(lastSeenKey) === quote.id;
    } catch {}
    const next = repeated ? nextQuote(quote.id) : quote;
    visitQuote = next;
    if (next !== quote) setQuote(next);
    try { window.localStorage.setItem(lastSeenKey, next.id); } catch {}
    // Выполняется один раз за заход — дальше цитату держит модульная переменная.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shuffle() {
    const next = nextQuote(quote.id);
    visitQuote = next;
    setQuote(next);
    try { window.localStorage.setItem(lastSeenKey, next.id); } catch {}
  }

  return <section className="panel motivation" aria-label="Мотивация">
    <div className="motivation-head">
      <span className="motivation-tag"><Sparkles size={12} aria-hidden="true" />{quoteCategories[quote.category]}</span>
      <button type="button" className="motivation-next" onClick={shuffle} aria-label="Показать другую цитату">
        <Shuffle size={14} aria-hidden="true" /><span>Другая цитата</span>
      </button>
    </div>
    <div aria-live="polite" aria-atomic="true">
      <blockquote className="motivation-quote"><p className="motivation-text" key={quote.id}>{quote.text}</p></blockquote>
      <p className="motivation-author" key={quote.id + "-author"}>— <cite>{quote.author}</cite>{quote.source ? <span>, {quote.source}</span> : null}</p>
    </div>
  </section>;
}
