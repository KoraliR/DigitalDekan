import { campusDay, plusDays, type DashboardData } from "@/lib/model";

export function demoData(day: string): DashboardData {
  function at(offset: number, time: string) {
    return campusDay(plusDays(day, offset)) + "T" + time + ":00+03:00";
  }
  return {
    lessons: [
      { id: "d1", title: "Технологии программирования", teacher: "Калинина И. В.", room: "320", type: "LECTURE", startsAt: at(0, "08:30"), endsAt: at(0, "10:00") },
      { id: "d2", title: "Управление данными", teacher: "Подгорный М. С.", room: "204", type: "PRACTICE", startsAt: at(0, "10:20"), endsAt: at(0, "11:50") },
      { id: "d3", title: "Проектирование интерфейсов", teacher: "Волкова А. Н.", room: "105", type: "PRACTICE", startsAt: at(0, "12:10"), endsAt: at(0, "13:40") },
      { id: "d4", title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "LECTURE", startsAt: at(1, "10:20"), endsAt: at(1, "11:50") },
    ],
    grades: [
      { id: "g1", title: "Технологии программирования", score: 45, threshold: 60, term: 3 },
      { id: "g2", title: "Управление данными", score: 52, threshold: 60, term: 3 },
      { id: "g3", title: "Базы данных", score: 48, threshold: 60, term: 3 },
      { id: "g4", title: "Введение в разработку", score: 68, threshold: 60, term: 2 },
    ],
    deadlines: [
      { id: "c1", title: "Отчёт по лабораторной № 3", course: "Технологии программирования", dueAt: at(1, "23:59") },
      { id: "c2", title: "Реферат по ИС", course: "Управление данными", dueAt: at(3, "18:00") },
      { id: "c3", title: "Презентация проекта", course: "Проектирование интерфейсов", dueAt: at(5, "16:00") },
    ],
    requests: [],
    news: [{ id: "n1", title: "Приём заявок на справки", body: "Подать заявку на справку об обучении можно во вкладке «Сервисы». Там же появится её статус." }],
  };
}