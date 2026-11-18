export function Field({ label, htmlFor, hint, error, errorId, children }: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  errorId?: string;
  children: React.ReactNode;
}) {
  return <div className="field">
    <label className="field-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && !error && <p className="field-hint">{hint}</p>}
    {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
  </div>;
}
