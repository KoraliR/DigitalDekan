import Link from "next/link";
import { notFound } from "next/navigation";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { dateLabel, timeLabel } from "@/lib/model";
import { newsAudienceLabel, newsKindClass, newsKindLabel, studentNewsAudiences } from "@/lib/news";

/** Отдельная страница новости: студент открывает и читает каждую новость отдельно. */
export default async function NewsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await account("STUDENT");
  const { id } = await params;
  const group = user.groupId
    ? await db.studyGroup.findUnique({ where: { id: user.groupId }, select: { id: true, faculty: true, course: true } })
    : null;
  const staffIds = user.groupId
    ? (await db.staffProfile.findMany({ where: { groups: { some: { id: user.groupId } } }, select: { userId: true } })).map((item) => item.userId)
    : [];
  const news = await db.news.findFirst({
    where: { id, audience: { in: studentNewsAudiences(group, staffIds) } },
    include: { author: { select: { name: true } } },
  });
  if (!news) notFound();
  const audienceGroups = news.audience.startsWith("group:")
    ? await db.studyGroup.findMany({ where: { id: news.audience.slice("group:".length) }, select: { id: true, name: true } })
    : [];

  return <main className="workspace news-page">
    <div className="news-page-head">
      <Link className="text-link" href="/cabinet/today">← Все новости</Link>
      <Link className="text-link" href="/cabinet/today">В личный кабинет</Link>
    </div>
    <article className="panel content-stack news-detail">
      <div className="news-detail-meta">
        <span className={"pill " + newsKindClass(news.kind)}>{newsKindLabel(news.kind)}</span>
        <span className="muted">{dateLabel(news.createdAt)} · {timeLabel(news.createdAt)} МСК</span>
      </div>
      <h1>{news.title}</h1>
      <p className="news-detail-body message-body">{news.body}</p>
      <p className="muted news-detail-foot">
        {newsAudienceLabel(news.audience, audienceGroups)}{news.author ? " · " + news.author.name : ""}
      </p>
    </article>
  </main>;
}
