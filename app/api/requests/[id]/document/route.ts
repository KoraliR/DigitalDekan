import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { studentSession } from "@/lib/api";

function documentHtml(name: string, number: string, title: string, date: string) {
  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 640px; margin: 40px auto; color: #241e1a; line-height: 1.6; }
  h1 { text-align: center; font-size: 20px; letter-spacing: .1em; }
  .meta { margin: 32px 0; }
  .row { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 8px 0; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; }
  .note { margin-top: 32px; font-size: 12px; color: #888; }
</style></head>
<body>
  <h1>СПРАВКА</h1>
  <p>Настоящая справка выдана для предъявления по месту требования (вымышленный документ конкурсного прототипа).</p>
  <div class="meta">
    <div class="row"><span>Выдана</span><strong>${name}</strong></div>
    <div class="row"><span>Номер заявки</span><strong>${number}</strong></div>
    <div class="row"><span>Дата формирования</span><strong>${date}</strong></div>
  </div>
  <p>${title}. Документ носит демонстрационный характер и не содержит настоящих персональных данных.</p>
  <div class="sign">
    <span>Декан факультета</span>
    <span>________________</span>
  </div>
  <p class="note">Цифровой деканат · сгенерировано автоматически · подлежит проверке</p>
</body>
</html>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await studentSession();
  if ("response" in session) return session.response;

  const { id } = await params;
  const request = await db.serviceRequest.findFirst({ where: { id, userId: session.accountId } });
  if (!request) return NextResponse.json({ error: "Заявка не найдена." }, { status: 403 });
  if (request.type !== "STUDY" && request.type !== "MILITARY") {
    return NextResponse.json({ error: "По этой заявке документ не предусмотрен." }, { status: 403 });
  }
  if (request.status !== "READY") return NextResponse.json({ error: "Справка ещё не готова." }, { status: 403 });

  const user = await db.user.findUnique({ where: { id: session.accountId }, select: { name: true } });
  const title = request.type === "MILITARY" ? "Справка для военкомата" : "Справка об обучении";
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const html = documentHtml(user?.name ?? "Студент", request.number ?? id.slice(0, 8), title, date);
  const fileName = "spravka-" + (request.number ?? id.slice(0, 8)).replace(/[^0-9A-Za-z-]/g, "").replace(/^-+/, "") + ".html";

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
