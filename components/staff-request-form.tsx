"use client";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Check, Play, X } from "lucide-react";
import type { RequestStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { processRequest } from "@/app/staff/actions";
import { transitions } from "@/lib/workflow";

const templates = [
  "Заявка принята в работу.",
  "Документ готов. Его можно получить в деканате.",
  "Уточните данные и подайте заявку повторно.",
];

function RequestButtons({ status }: { status: RequestStatus }) {
  const { pending } = useFormStatus();
  const available = transitions[status];
  return <div className="staff-wide staff-button-row">
    <Button variant="secondary" name="status" value={status} disabled={pending}>{pending ? "Сохраняем…" : "Сохранить детали"}</Button>
    {available.includes("PROCESSING") && <Button name="status" value="PROCESSING" disabled={pending}><Play size={16} /> В работу</Button>}
    {available.includes("READY") && <Button name="status" value="READY" disabled={pending}><Check size={16} /> Готово</Button>}
    {available.includes("REJECTED") && <Button variant="danger" name="status" value="REJECTED" disabled={pending}><X size={16} /> Отклонить</Button>}

  </div>;
}

export function StaffRequestForm({ id, revision, status, comment, readyBy }: {
  id: string;
  revision: number;
  status: RequestStatus;
  comment: string;
  readyBy: string;
}) {
  const text = useRef<HTMLTextAreaElement>(null);
  return <form className="staff-fields" action={processRequest} onSubmit={(event) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter?.getAttribute("value") === "REJECTED" && !text.current?.value.trim()) {
      event.preventDefault();
      text.current?.setCustomValidity("Укажите причину отклонения.");
      text.current?.reportValidity();
      text.current?.setCustomValidity("");
    }
  }}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="revision" value={revision} />
    <label>Срок готовности<input name="readyBy" type="date" defaultValue={readyBy} /></label>
    <label>Шаблон комментария<select defaultValue="" onChange={(event) => {
      if (text.current && event.target.value) {
        text.current.value = event.target.value;
        text.current.setCustomValidity("");
        text.current.focus();
      }
      event.target.value = "";
    }}><option value="">Выбрать шаблон</option>
      {templates.map((item) => <option key={item} value={item}>{item}</option>)}
    </select></label>
    <label className="staff-wide">Комментарий студенту<textarea ref={text} name="comment" maxLength={1000} defaultValue={comment} onInput={(event) => event.currentTarget.setCustomValidity("")} /></label>
    <RequestButtons status={status} />
  </form>;
}