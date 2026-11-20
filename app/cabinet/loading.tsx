export default function Loading() {
  return <div className="workspace" aria-busy="true" aria-label="Загрузка раздела">
    <div className="skeleton skeleton-title" />
    <div className="profile-grid" style={{ marginTop: 16 }}>
      <section className="panel"><div className="skeleton skeleton-title" /><div className="skeleton-list">{[0, 1, 2].map((row) => <div className="skeleton skeleton-line" key={row} />)}</div></section>
      <section className="panel"><div className="skeleton skeleton-title" /><div className="skeleton-list">{[0, 1, 2].map((row) => <div className="skeleton skeleton-line" key={row} />)}</div></section>
    </div>
  </div>;
}
