"use client";
import { useState } from "react";
import { ArrowRight, DoorOpen, MapPin, Route } from "lucide-react";
import type { DashboardData } from "@/lib/model";

const rooms = {
  "105": { floor: 1, x: 91, y: 101, instructions: "Поверните налево в коридор. Аудитория 105 будет справа." },
  "204": { floor: 2, x: 303, y: 99, instructions: "Выйдите с лестницы и пройдите направо. Аудитория 204 будет слева." },
  "320": { floor: 3, x: 91, y: 99, instructions: "Выйдите с лестницы и пройдите налево. Аудитория 320 будет справа." },
} as const;
type Room = keyof typeof rooms;
function mapped(room: string): room is Room {
  return Object.prototype.hasOwnProperty.call(rooms, room);
}

export function Campus({ lessons, initialRoom = "" }: { lessons: DashboardData["lessons"]; initialRoom?: string }) {
  const [origin, setOrigin] = useState("entry");
  const [room, setRoom] = useState(initialRoom || (lessons.find((lesson) => mapped(lesson.room))?.room ?? "204"));
  const destination = mapped(room) ? rooms[room] : undefined;
  const [floor, setFloor] = useState(destination?.floor ?? 1);
  const options = [...new Set([room, ...lessons.map((lesson) => lesson.room), ...Object.keys(rooms)])];
  const sameFloor = floor === destination?.floor;
  const route = destination && (floor === 1 || sameFloor);
  const points = !route ? "" : floor === 1
    ? (origin === "entry" ? "200,238 200,158 " : "200,158 ") + (sameFloor ? destination.x + ",158 " + destination.x + "," + destination.y : "200,99")
    : "200,99 200,158 " + destination.x + ",158 " + destination.x + "," + destination.y;

  return <div className="dashboard-grid campus-grid">
    <section className="panel"><div className="section-head"><div><h2>Главный корпус</h2><p className="muted">Учебная схема</p></div>
      <div className="segmented" aria-label="Этаж">{([1, 2, 3] as const).map((level) => <button key={level} aria-pressed={level === floor} onClick={() => setFloor(level)}>{level}</button>)}</div></div>
      <svg className="floor-map" viewBox="0 0 400 270" role="img" aria-label={`Схема этажа ${floor}${route ? " с маршрутом" : ""}`}>
        <rect className="map-frame" x="20" y="32" width="360" height="211" rx="19" />
        <rect className="map-room" x="34" y="48" width="117" height="76" rx="10" />
        <rect className="map-room" x="166" y="48" width="68" height="76" rx="10" />
        <rect className="map-room" x="249" y="48" width="117" height="76" rx="10" />
        <rect className="map-room" x="34" y="191" width="117" height="38" rx="10" />
        <rect className="map-room" x="249" y="191" width="117" height="38" rx="10" />
        <text x="200" y="76" textAnchor="middle">Лестница</text>
        <text x="91" y="77" textAnchor="middle">{floor === 1 ? "105" : floor === 3 ? "320" : "201"}</text>
        <text x="303" y="77" textAnchor="middle">{floor === 2 ? "204" : floor === 1 ? "101" : "321"}</text>
        {floor === 1 && <text x="200" y="263" textAnchor="middle">Вход</text>}
        {route && <><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={sameFloor ? destination.x : 200} cy={sameFloor ? destination.y : 99} r="8" fill="var(--accent)" stroke="white" strokeWidth="3" /></>}
      </svg>
    </section>
    <section className="panel route-controls"><div className="heading-with-icon"><span className="soft-icon"><Route size={21} /></span><h2>Маршрут</h2></div>
      <label><DoorOpen size={16} /> Откуда<select aria-label="Откуда" value={origin} onChange={(event) => { setOrigin(event.target.value); setFloor(1); }}><option value="entry">Главный вход</option><option value="hall">Холл первого этажа</option></select></label>
      <label><MapPin size={16} /> Куда<select aria-label="Куда" value={room} onChange={(event) => {
        const value = event.target.value; setRoom(value); setFloor(mapped(value) ? rooms[value].floor : 1);
      }}>{options.map((value) => <option key={value} value={value}>Аудитория {value}{lessons.some((lesson) => lesson.room === value) ? " · из расписания" : ""}</option>)}</select></label>
      {destination ? <ol className="route-steps">
        {origin === "entry" && <li><ArrowRight size={16} /> Пройдите через турникеты в холл.</li>}
        {destination.floor > 1 && <li><ArrowRight size={16} /> Пройдите прямо до лестницы и поднимитесь на {destination.floor}-й этаж.</li>}
        <li><ArrowRight size={16} /> {destination.instructions}</li>
      </ol> : <p className="empty">Аудитория {room} отсутствует на учебной схеме.</p>}
    </section>
  </div>;
}