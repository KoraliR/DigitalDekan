"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, X } from "lucide-react";
import { cancelRequest } from "@/app/actions";
import { dateLabel, timeLabel, requestTypeClass, requestStatusClass, services, statuses, type RequestView } from "@/lib/model";
import { Sheet } from "@/components/ui/sheet";

export function RequestDialog({ request, onClose }: { request: RequestView; onClose: () => void }) {
  const isDocument = request.type === "STUDY" || request.type === "MILITARY";
  const ready = request.status === "READY";
  const canCancel = request.status === "NEW" || request.status === "PROCESSING";
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, startCancel] = useTransition();

  async function download() {
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch("/api/requests/" + request.id + "/document");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Не удалось скачать справку.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "spravka-" + request.number.replace(/[^0-9A-Za-z-]/g, "").replace(/^-+/, "") + ".html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Не удалось скачать справку.");
    } finally {
      setDownloading(false);
    }
  }

  return <Sheet id="request-dialog" labelledBy="request-title" onClose={onClose}>
    <div className="panel sheet-panel">
      <div className="sheet-head">
        <div><span className={"pill " + requestTypeClass[request.type]}>{services[request.type]}</span><h2 id="request-title">Заявка {request.number}</h2></div>
        <button type="button" className="button button-icon" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
      </div>

      <dl className="request-facts">
        <div className="request-fact"><dt>Номер заявки</dt><dd>{request.number}</dd></div>
        <div className="request-fact"><dt>Дата подачи</dt><dd>{dateLabel(new Date(request.createdAt))} · {timeLabel(new Date(request.createdAt))}</dd></div>
        <div className="request-fact"><dt>Последнее изменение</dt><dd>{dateLabel(new Date(request.updatedAt))} · {timeLabel(new Date(request.updatedAt))}</dd></div>
        {request.readyBy && <div className="request-fact"><dt>Срок готовности</dt><dd>{dateLabel(new Date(request.readyBy))}</dd></div>}
        <div className="request-fact"><dt>Статус</dt><dd><span className={"pill " + requestStatusClass[request.status]}>{statuses[request.status]}</span></dd></div>
        <div className="request-fact"><dt>Комментарий</dt><dd>{request.comment || "Комментария пока нет"}</dd></div>
      </dl>

      <Link className="text-link" href={"/cabinet/requests/" + request.id}>Открыть страницу заявки</Link>

      {isDocument && ready && <div className="sheet-actions">
        <button type="button" className="button button-primary" onClick={download} disabled={downloading}>
          <Download size={16} /> {downloading ? "Скачиваем…" : "Скачать справку"}
        </button>
        {downloadError && <p className="form-error" role="alert">{downloadError}</p>}
      </div>}

      {canCancel && <div className="sheet-actions">
        <button type="button" className="button button-secondary" disabled={cancelling} onClick={() => startCancel(async () => {
          const result = await cancelRequest(request.id);
          if (result?.error) setCancelError(result.error); else onClose();
        })}>{cancelling ? "Отменяем…" : "Отменить заявку"}</button>
        {cancelError && <p className="form-error" role="alert">{cancelError}</p>}
      </div>}
    </div>
  </Sheet>;
}
