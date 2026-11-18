import Link from "next/link";
import { forbidden } from "next/navigation";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { dateLabel, services, statuses } from "@/lib/model";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await account("STUDENT");
  const request = await db.serviceRequest.findFirst({ where: { id: (await params).id, userId: user.id } });
  if (!request) forbidden();
  return <main className="workspace content-stack">
    <p className="notice">Концепт для конкурса. Не является официальным сервисом вуза</p>
    <section className="panel content-stack"><h1>{services[request.type]}</h1>
      <p>Статус: {statuses[request.status]}</p>
      {request.readyBy && <p>Срок готовности: {dateLabel(request.readyBy)}</p>}
      {request.comment && <p className="message-body">{request.comment}</p>}
      <Link className="text-link" href="/cabinet/services">К моим заявкам</Link>
    </section>
  </main>;
}