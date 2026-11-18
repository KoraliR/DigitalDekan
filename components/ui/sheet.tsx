"use client";
import { useEffect } from "react";

export function Sheet({ id, labelledBy, onClose, children }: {
  id: string;
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const dialog = document.getElementById(id) as HTMLDialogElement | null;
    if (dialog && !dialog.open) dialog.showModal();
  }, [id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  return <dialog id={id} className="sheet" aria-labelledby={labelledBy}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    {children}
  </dialog>;
}
