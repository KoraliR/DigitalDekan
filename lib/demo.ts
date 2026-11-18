import { campusDay, plusDays, type DashboardData } from "@/lib/model";

export function demoData(day: string): DashboardData {
  function at(offset: number, time: string) {
    return campusDay(plusDays(day, offset)) + "T" + time + ":00+03:00";
  }
  return {
    lessons: [
      { id: "d1", title: "Технологии программирования", teacher: "Калинина И. В.", room: "320", type: "LECTURE",
        groups: ["ИВТ-21-1"], campus: "Главный корпус, ул. Примерная, 1",
        teachers: [{ name: "Калинина Ирина Викторовна", position: "доцент, кафедра информационных систем" }],
        originalStartsAt: null, originalEndsAt: null, attendance: "PRESENT",
        startsAt: at(0, "08:30"), endsAt: at(0, "10:00") },
      { id: "d2", title: "Управление данными", teacher: "Подгорный М. С.", room: "204", type: "PRACTICE",
        groups: ["ИВТ-21-1", "ИВТ-21-2"], campus: "Главный корпус, ул. Примерная, 1",
        teachers: [{ name: "Подгорный Михаил Сергеевич", position: "старший преподаватель" }],
        originalStartsAt: null, originalEndsAt: null, attendance: null,
        startsAt: at(0, "10:20"), endsAt: at(0, "11:50") },
      { id: "d3", title: "Проектирование интерфейсов", teacher: "Волкова А. Н.", room: "105", type: "LAB",
        groups: ["ИВТ-21-1"], campus: "Главный корпус, ул. Примерная, 1",
        teachers: [{ name: "Волкова Анна Николаевна", position: "ассистент, кафедра ИС" }],
        originalStartsAt: at(0, "12:10"), originalEndsAt: at(0, "13:40"), attendance: "EXCUSED",
        startsAt: at(0, "12:40"), endsAt: at(0, "14:10") },
      { id: "d4", title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "LECTURE",
        groups: ["ИВТ-21-1"], campus: "Главный корпус, ул. Примерная, 1",
        teachers: [{ name: "Орлов Дмитрий Викторович", position: "профессор, кафедра баз данных" }],
        originalStartsAt: null, originalEndsAt: null, attendance: null,
        startsAt: at(1, "10:20"), endsAt: at(1, "11:50") },
      { id: "d5", title: "Семинар по ИС", teacher: "Гусев А. П.", room: "", type: "SEMINAR",
        groups: ["ИВТ-21-1"], campus: "Главный корпус, ул. Примерная, 1",
        teachers: [{ name: "Гусев Алексей Петрович", position: "доцент" }],
        originalStartsAt: null, originalEndsAt: null, attendance: null,
        startsAt: at(2, "14:00"), endsAt: at(2, "15:30") },
      { id: "d6", title: "Экзамен по ТП", teacher: "Калинина И. В.", room: "320", type: "EXAM",
        groups: ["ИВТ-21-1"], campus: "Главный корпус, ул. Примерная, 1",
        teachers: [{ name: "Калинина Ирина Викторовна", position: "доцент, кафедра информационных систем" }],
        originalStartsAt: null, originalEndsAt: null, attendance: null,
        startsAt: at(5, "09:00"), endsAt: at(5, "10:30") },
      { id: "d7", title: "Зачёт по математике", teacher: "Гусев А. П.", room: "105", type: "TEST",
        groups: ["ИВТ-21-1"], campus: null,
        teachers: [{ name: "Гусев Алексей Петрович" }],
        originalStartsAt: null, originalEndsAt: null, attendance: "ABSENT",
        startsAt: at(-2, "10:20"), endsAt: at(-2, "11:50") },
    ],
    grades: [
      { id: "g1", title: "Технологии программирования", score: 45, threshold: 60, term: 3 },
      { id: "g2", title: "Управление данными", score: 52, threshold: 60, term: 3 },
      { id: "g3", title: "Базы данных", score: 48, threshold: 60, term: 3 },
      { id: "g4", title: "Введение в разработку", score: 68, threshold: 60, term: 2 },
    ],
    deadlines: [
      { id: "c1", title: "Отчёт по лабораторной № 3", course: "Технологии программирования", dueAt: at(1, "23:59"), lessonId: "d1", completedAt: null },
      { id: "c2", title: "Реферат по ИС", course: "Управление данными", dueAt: at(3, "18:00"), lessonId: "d2", completedAt: null },
      { id: "c3", title: "Презентация проекта", course: "Проектирование интерфейсов", dueAt: at(-1, "16:00"), lessonId: "d3", completedAt: at(-1, "12:00") },
    ],
    requests: [],
    news: [{ id: "n1", title: "Приём заявок на справки", body: "Подать заявку на справку об обучении можно во вкладке «Сервисы». Там же появится её статус." }],
  };
}
