import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { cancelRequest } from "@/app/actions";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { dateLabel, requestStatusClass, services, statuses, timeLabel } from "@/lib/model";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await account("STUDENT");
  const request = await db.serviceRequest.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!request) forbidden();
  const number = request.number ?? "З-" + request.id.slice(0, 8);
  const isDocument = request.type === "STUDY" || request.type === "MILITARY";
  const canCancel = request.status === "NEW" || request.status === "PROCESSING";
  return <main className="workspace content-stack">
    <p className="notice">Концепт для конкурса. Не является официальным сервисом вуза</p>
    <section className="panel content-stack">
      <div className="section-head"><div><h1>Заявка {number}</h1><p className="muted">{services[request.type]}</p></div>
        <span className={"pill " + requestStatusClass[request.status]}>{statuses[request.status]}</span></div>
      <dl className="request-facts">
        <div className="request-fact"><dt>Дата подачи</dt><dd>{dateLabel(request.createdAt)} · {timeLabel(request.createdAt)}</dd></div>
        <div className="request-fact"><dt>Последнее изменение</dt><dd>{dateLabel(request.updatedAt ?? request.createdAt)} · {timeLabel(request.updatedAt ?? request.createdAt)}</dd></div>
        {request.readyBy && <div className="request-fact"><dt>Срок готовности</dt><dd>{dateLabel(request.readyBy)}</dd></div>}
        <div className="request-fact"><dt>Комментарий</dt><dd>{request.comment || "Комментария пока нет"}</dd></div>
      </dl>
      <div className="profile-actions">
        {isDocument && request.status === "READY" && <a className="button button-primary" href={"/api/requests/" + request.id + "/document"}>Скачать справку</a>}
        {canCancel && <form action={async () => { "use server"; await cancelRequest(request.id); redirect("/cabinet/services"); }}><button className="button button-secondary" type="submit">Отменить заявку</button></form>}
        <Link className="text-link" href="/cabinet/services">К моим заявкам</Link>
      </div>
    </section>
  </main>;
}
