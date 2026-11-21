// Мягкий фон служебного кабинета: тёплые световые пятна и едва заметная сетка.
// Один компонент на все страницы сотрудника, чтобы фон не расходился.
export function StaffBackdrop() {
  return <div className="staff-bg" aria-hidden="true">
    <span className="staff-bg-glow staff-bg-glow-a" />
    <span className="staff-bg-glow staff-bg-glow-b" />
    <span className="staff-bg-glow staff-bg-glow-c" />
  </div>;
}
