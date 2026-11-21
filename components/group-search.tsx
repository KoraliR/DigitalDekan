"use client";
import { useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export type GroupSearchGroup = { id: string; name: string };

type Choice = { value: string; label: string; keywords?: string };

function normalize(value: string) {
  return value.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\u0301/g, "");
}

function matches(choice: Choice, query: string) {
  return normalize(choice.label + " " + (choice.keywords ?? "")).includes(normalize(query));
}

/**
 * Комбобокс с поиском по подсказкам. Выбранное значение пишется в hidden input,
 * поэтому компонент одинаково хорошо работает и в GET-фильтрах, и в POST-формах.
 * Устроен как обычное поле формы: подпись сверху, контрол той же высоты, без
 * дополнительных подписей под полем.
 */
function SearchSelect({ name, label, placeholder, choices, defaultValue = "", allowEmpty = false, allLabel = "Все", emptyLabel = "Ничего не найдено" }: {
  name: string;
  label: string;
  placeholder?: string;
  choices: Choice[];
  defaultValue?: string;
  allowEmpty?: boolean;
  allLabel?: string;
  emptyLabel?: string;
}) {
  const id = useId();
  const listboxId = id + "-listbox";
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selectedLabel = choices.find((choice) => choice.value === selected)?.label ?? "";
  const trimmed = query.trim();
  const matching = trimmed ? choices.filter((choice) => matches(choice, trimmed)) : choices;
  const items: Choice[] = allowEmpty && !trimmed ? [{ value: "", label: allLabel }, ...matching] : matching;
  const activeId = active >= 0 && items[active] ? listboxId + "-option-" + active : undefined;
  const emptyPlaceholder = allowEmpty ? allLabel : placeholder;

  function pick(choice: Choice) {
    setSelected(choice.value);
    setQuery("");
    setOpen(false);
    setActive(-1);
  }
  function clear() {
    setSelected("");
    setQuery("");
    setOpen(false);
    setActive(-1);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (open && items.length) {
        event.preventDefault();
        pick(items[active >= 0 && items[active] ? active : 0]);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  return <div className={"group-search" + (open ? " is-open" : "")}>
    <span className="group-search-label">{label}</span>
    <div className="group-search-field">
      <input id={id} type="text" role="combobox" autoComplete="off" spellCheck={false} aria-label={label}
        aria-expanded={open} aria-controls={listboxId} aria-autocomplete="list" aria-activedescendant={activeId}
        placeholder={emptyPlaceholder} value={open ? query : selectedLabel}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          setActive(-1);
          // Стереть текст в поле — значит снять выбор и вернуться ко всем группам.
          if (allowEmpty && !next.trim()) setSelected("");
        }}
        onFocus={() => { setOpen(true); setQuery(""); setActive(-1); }}
        onBlur={() => { setOpen(false); setQuery(""); setActive(-1); }}
        onKeyDown={onKeyDown} />
      {allowEmpty && selectedLabel && !open && <button type="button" className="group-search-clear" title={"Сбросить: " + allLabel}
        aria-label={"Сбросить выбор: " + label} onMouseDown={(event) => event.preventDefault()} onClick={clear}>
        <X size={15} aria-hidden="true" />
      </button>}
      <ChevronDown className="group-search-chevron" size={16} aria-hidden="true" />
    </div>
    <input type="hidden" name={name} value={selected} />
    {open && <ul className="group-search-list" id={listboxId} role="listbox" aria-label={label}>
      {!items.length && <li className="group-search-empty" role="presentation">{emptyLabel}</li>}
      {items.map((choice, index) => <li key={choice.value || "all-option"} id={listboxId + "-option-" + index}
        role="option" aria-selected={active === index} className={"group-search-option" + (active === index ? " is-active" : "")}
        onMouseDown={(event) => { event.preventDefault(); pick(choice); }} onMouseEnter={() => setActive(index)}>
        {choice.label}
      </li>)}
    </ul>}
  </div>;
}

export function GroupSearch({ name, groups, defaultValue = "", label = "Группа", placeholder = "Начните вводить название группы", allLabel = "Все группы", emptyLabel = "Группы не найдены" }: {
  name: string;
  groups: GroupSearchGroup[];
  defaultValue?: string;
  label?: string;
  placeholder?: string;
  allLabel?: string;
  emptyLabel?: string;
}) {
  const choices = groups.map((group) => ({ value: group.id, label: group.name, keywords: group.name }));
  return <SearchSelect name={name} label={label} placeholder={placeholder} choices={choices}
    defaultValue={defaultValue} allowEmpty allLabel={allLabel} emptyLabel={emptyLabel} />;
}

/**
 * Выбор аудитории объявления: «все / факультет / курс / группа». Группы ищутся
 * по названию теми же подсказками, что и в фильтрах, и подставляют audience=group:<id>.
 */
export function AudiencePicker({ name = "audience", groups, faculties, courses, defaultValue = "all", label = "Аудитория", placeholder = "Начните вводить группу или выберите аудиторию" }: {
  name?: string;
  groups: GroupSearchGroup[];
  faculties: string[];
  courses: number[];
  defaultValue?: string;
  label?: string;
  placeholder?: string;
}) {
  const choices: Choice[] = [
    { value: "all", label: "Все закреплённые группы" },
    ...faculties.map((faculty) => ({ value: "faculty:" + faculty, label: "Факультет · " + faculty })),
    ...courses.map((course) => ({ value: "course:" + course, label: "Курс · " + course })),
    ...groups.map((group) => ({ value: "group:" + group.id, label: "Группа · " + group.name, keywords: group.name })),
  ];
  return <SearchSelect name={name} label={label} placeholder={placeholder} choices={choices}
    defaultValue={defaultValue} emptyLabel="Аудитория не найдена" />;
}
