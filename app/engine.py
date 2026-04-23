from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from math import ceil
from pathlib import Path
from typing import List, Optional
from typing import Dict, List, Optional, Set


class CourseType(str, Enum):
    THEORIQUE = "theorique"
    PRATIQUE = "pratique"
    EXAMEN = "examen"
    STAGE = "stage"


class DelayUnit(str, Enum):
    JOUR = "jour"
    SEMAINE = "semaine"
    MOIS = "mois"


@dataclass
class Holiday:
    day: date
    label: str = "jour férié"


@dataclass
class VacationPeriod:
    start: date
    end: date
@@ -54,115 +54,165 @@ class StagePeriod:
class SchoolParams:
    nom_ecole: str
    date_debut: date
    nombre_aspirants: int
    date_assermentation: date
    jours_feries: List[Holiday] = field(default_factory=list)
    vacances: List[VacationPeriod] = field(default_factory=list)
    stages: List[StagePeriod] = field(default_factory=list)
    duree_min_mois: int = 8


@dataclass
class CourseTemplate:
    branche: str
    sous_branche: str
    type: CourseType
    identifiant_cours: str
    lecon: str
    duree_minutes: int
    participants_max: int
    ordre_lecon: int = 0
    apres_cours_id: List[str] = field(default_factory=list)
    avant_cours_id: List[str] = field(default_factory=list)
    delai_max_valeur: Optional[int] = None
    delai_max_unite: Optional[DelayUnit] = None
    delai_min_valeur: Optional[int] = None
    delai_min_unite: Optional[DelayUnit] = None
    max_par_semaine: Optional[int] = None
    jour_specifique: Optional[str] = None
    doit_suivre_id: List[str] = field(default_factory=list)

    def validate(self) -> None:
        if self.duree_minutes <= 0:
            raise ValueError(f"{self.identifiant_cours}: duree_minutes doit être > 0")
        if self.duree_minutes % 30 != 0:
            raise ValueError(
                f"{self.identifiant_cours}: duree_minutes doit être multiple de 30"
            )
        if self.participants_max <= 0:
            raise ValueError(f"{self.identifiant_cours}: participants_max doit être > 0")
        if self.delai_max_valeur is not None and self.delai_max_valeur < 0:
            raise ValueError(
                f"{self.identifiant_cours}: delai_max_valeur doit être >= 0"
            )
        if self.delai_min_valeur is not None and self.delai_min_valeur < 0:
            raise ValueError(
                f"{self.identifiant_cours}: delai_min_valeur doit être >= 0"
            )
        if (self.delai_max_valeur is None) != (self.delai_max_unite is None):
            raise ValueError(
                f"{self.identifiant_cours}: delai_max_valeur et delai_max_unite doivent être remplis ensemble"
            )
        if (self.delai_min_valeur is None) != (self.delai_min_unite is None):
            raise ValueError(
                f"{self.identifiant_cours}: delai_min_valeur et delai_min_unite doivent être remplis ensemble"
            )
        if (
            self.delai_min_valeur is not None
            and self.delai_max_valeur is not None
            and self.delai_min_valeur > self.delai_max_valeur
        ):
            raise ValueError(
                f"{self.identifiant_cours}: delai_min_valeur ne peut pas dépasser delai_max_valeur"
            )

    @property
    def is_without_special_constraint(self) -> bool:
        return (
            self.ordre_lecon == 0
            and not self.apres_cours_id
            and not self.avant_cours_id
            and self.delai_max_valeur is None
            and self.delai_min_valeur is None
            and self.jour_specifique is None
            and self.max_par_semaine is None
            and not self.doit_suivre_id
        )


@dataclass
class GeneratedSession:
    parent_course_id: str
    session_id: str
    group_name: str
    duree_minutes: int


@dataclass
class CourseLoad:
    identifiant_cours: str
    lecon: str
    nombre_groupes: int
    nombre_seances_reelles: int
    volume_total_minutes: int
    volume_total_heures: float
    sans_contrainte: bool


@dataclass
class SchoolLoadSummary:
    nom_ecole: str
    nombre_aspirants: int
    total_cours_catalogue: int
    total_seances_reelles: int
    volume_total_minutes: int
    volume_total_heures: float
    volume_total_jours_theoriques: float
    volume_total_semaines_theoriques: float
    date_fin_minimale: date


@dataclass
class ConstraintDiagnostic:
    total_cours: int
    cours_avec_contraintes: int
    densite_contraintes: float
    prerequis_inconnus: List[str]
    cycles_detectes: List[List[str]]
    cours_goulots: List[str]


@dataclass
class ScheduledSession:
    session_id: str
    parent_course_id: str
    lecon: str
    group_name: str
    day: date
    start_minute: int
    duration_minutes: int


@dataclass
class SchedulingResult:
    scheduled: List[ScheduledSession]
    unscheduled_session_ids: List[str]
    planning_start: date
    planning_end: date


def add_months(base_date: date, months: int) -> date:
    month = base_date.month - 1 + months
    year = base_date.year + month // 12
    month = month % 12 + 1
    day = min(
        base_date.day,
        [
            31,
            29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
        ][month - 1],
    )
    return date(year, month, day)


def parse_date(value: str) -> date:
@@ -235,64 +285,81 @@ def load_school_params(filepath: str) -> SchoolParams:

def load_courses(filepath: str) -> List[CourseTemplate]:
    courses: List[CourseTemplate] = []

    with open(filepath, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            course = CourseTemplate(
                branche=row["branche"].strip(),
                sous_branche=row["sous_branche"].strip(),
                type=CourseType(row["type"].strip()),
                identifiant_cours=row["identifiant_cours"].strip(),
                lecon=row["lecon"].strip(),
                duree_minutes=int(row["duree_minutes"].strip()),
                participants_max=int(row["participants_max"].strip()),
                ordre_lecon=int(row["ordre_lecon"].strip() or 0),
                apres_cours_id=parse_id_list(row["apres_cours_id"]),
                avant_cours_id=parse_id_list(row["avant_cours_id"]),
                delai_max_valeur=parse_optional_int(row["delai_max_valeur"]),
                delai_max_unite=(
                    DelayUnit(row["delai_max_unite"].strip())
                    if row["delai_max_unite"].strip()
                    else None
                ),
                delai_min_valeur=parse_optional_int(row.get("delai_min_valeur", "")),
                delai_min_unite=(
                    DelayUnit(row.get("delai_min_unite", "").strip())
                    if row.get("delai_min_unite", "").strip()
                    else None
                ),
                max_par_semaine=parse_optional_int(row["max_par_semaine"]),
                jour_specifique=parse_optional_str(row["jour_specifique"]),
                doit_suivre_id=parse_id_list(row.get("doit_suivre_id", "")),
            )
            courses.append(course)

    return courses


class PlanningEngine:
    STANDARD_DAY_MINUTES = 480
    EXTENDED_DAY_MINUTES = 540
    MAX_EXTENDED_DAYS_PER_WEEK = 2
    WEEKLY_RUNNING_MINUTES = 90
    MAX_WEEKLY_MINUTES = (5 * STANDARD_DAY_MINUTES) + (2 * 60) + WEEKLY_RUNNING_MINUTES
    DEFAULT_SLOT_STARTS = [8 * 60, 10 * 60, 13 * 60 + 30, 15 * 60 + 30]
    DAY_NAME_TO_WEEKDAY = {
        "lundi": 0,
        "mardi": 1,
        "mercredi": 2,
        "jeudi": 3,
        "vendredi": 4,
        "samedi": 5,
        "dimanche": 6,
    }

    def __init__(self, school: SchoolParams, courses: List[CourseTemplate]) -> None:
        self.school = school
        self.courses = courses
        self._validate_inputs()
        self._course_map = {c.identifiant_cours: c for c in courses}

    def _validate_inputs(self) -> None:
        if self.school.nombre_aspirants <= 0:
            raise ValueError("nombre_aspirants doit être > 0")

        seen_ids = set()
        for course in self.courses:
            course.validate()
            if course.identifiant_cours in seen_ids:
                raise ValueError(f"Identifiant en doublon: {course.identifiant_cours}")
            seen_ids.add(course.identifiant_cours)

    def calculate_groups(self, course: CourseTemplate) -> int:
        return ceil(self.school.nombre_aspirants / course.participants_max)

    def generate_sessions_for_course(self, course: CourseTemplate) -> List[GeneratedSession]:
        groups = self.calculate_groups(course)
        sessions: List[GeneratedSession] = []

@@ -334,42 +401,381 @@ class PlanningEngine:
                    volume_total_minutes=minutes,
                    volume_total_heures=minutes / 60,
                    sans_contrainte=course.is_without_special_constraint,
                )
            )

        return rows

    def school_load_summary(self) -> SchoolLoadSummary:
        loads = self.course_loads()
        total_minutes = sum(x.volume_total_minutes for x in loads)
        total_sessions = sum(x.nombre_seances_reelles for x in loads)

        return SchoolLoadSummary(
            nom_ecole=self.school.nom_ecole,
            nombre_aspirants=self.school.nombre_aspirants,
            total_cours_catalogue=len(self.courses),
            total_seances_reelles=total_sessions,
            volume_total_minutes=total_minutes,
            volume_total_heures=round(total_minutes / 60, 2),
            volume_total_jours_theoriques=round(total_minutes / self.STANDARD_DAY_MINUTES, 2),
            volume_total_semaines_theoriques=round(total_minutes / self.MAX_WEEKLY_MINUTES, 2),
            date_fin_minimale=add_months(self.school.date_debut, self.school.duree_min_mois),
        )

    def constraint_diagnostic(self) -> ConstraintDiagnostic:
        graph = self._build_prerequisite_graph()
        unknown_refs = self._collect_unknown_prerequisites()
        cycles = self._detect_cycles(graph)
        bottlenecks = self._find_bottleneck_courses(graph)
        constrained_courses = sum(1 for c in self.courses if not c.is_without_special_constraint)

        return ConstraintDiagnostic(
            total_cours=len(self.courses),
            cours_avec_contraintes=constrained_courses,
            densite_contraintes=round((constrained_courses / max(len(self.courses), 1)) * 100, 2),
            prerequis_inconnus=sorted(unknown_refs),
            cycles_detectes=cycles,
            cours_goulots=bottlenecks,
        )

    def _collect_unknown_prerequisites(self) -> Set[str]:
        unknown: Set[str] = set()
        for course in self.courses:
            for after_id in course.apres_cours_id + course.doit_suivre_id:
                if after_id not in self._course_map:
                    unknown.add(f"{course.identifiant_cours} -> {after_id}")
            for before_id in course.avant_cours_id:
                if before_id not in self._course_map:
                    unknown.add(f"{before_id} -> {course.identifiant_cours}")
        return unknown

    def _build_prerequisite_graph(self) -> Dict[str, Set[str]]:
        graph: Dict[str, Set[str]] = {course.identifiant_cours: set() for course in self.courses}

        for course in self.courses:
            for after_id in course.apres_cours_id + course.doit_suivre_id:
                if after_id in self._course_map:
                    graph[after_id].add(course.identifiant_cours)
            for before_id in course.avant_cours_id:
                if before_id in self._course_map:
                    graph[course.identifiant_cours].add(before_id)

        return graph

    def _detect_cycles(self, graph: Dict[str, Set[str]]) -> List[List[str]]:
        visited: Set[str] = set()
        on_stack: Set[str] = set()
        stack: List[str] = []
        cycles: Set[tuple[str, ...]] = set()

        def dfs(node: str) -> None:
            visited.add(node)
            on_stack.add(node)
            stack.append(node)

            for nxt in graph[node]:
                if nxt not in visited:
                    dfs(nxt)
                elif nxt in on_stack:
                    idx = stack.index(nxt)
                    cycle = stack[idx:] + [nxt]
                    cycles.add(tuple(cycle))

            stack.pop()
            on_stack.remove(node)

        for node in graph:
            if node not in visited:
                dfs(node)

        return [list(cycle) for cycle in sorted(cycles)]

    def _find_bottleneck_courses(self, graph: Dict[str, Set[str]]) -> List[str]:
        in_degree = {node: 0 for node in graph}
        for node in graph:
            for child in graph[node]:
                in_degree[child] += 1

        max_in = max(in_degree.values(), default=0)
        if max_in == 0:
            return []

        bottlenecks = [node for node, value in in_degree.items() if value == max_in]
        return sorted(bottlenecks)

    def generate_greedy_schedule(self, months: Optional[int] = None) -> SchedulingResult:
        months = months or self.school.duree_min_mois
        planning_start = self.school.date_debut
        planning_end = add_months(planning_start, months)

        sessions: List[GeneratedSession] = []
        ordered_courses = self._order_courses_for_scheduling()
        for course in ordered_courses:
            sessions.extend(self.generate_sessions_for_course(course))

        scheduled: List[ScheduledSession] = []
        self._scheduled_by_id: Dict[str, ScheduledSession] = {}
        scheduled_ids: Set[str] = set()
        sessions_by_course: Dict[str, List[GeneratedSession]] = {}
        for session in sessions:
            sessions_by_course.setdefault(session.parent_course_id, []).append(session)

        sessions_by_week_course: Dict[str, int] = {}
        occupied_slots: Set[tuple[date, int, str]] = set()
        course_cursor = 0

        for current_day in self._iter_planning_days(planning_start, planning_end):
            if self._is_day_blocked(current_day):
                continue

            week_key = current_day.isocalendar()
            for start_minute in self.DEFAULT_SLOT_STARTS:
                candidate = self._pick_next_schedulable_session(
                    ordered_courses=ordered_courses,
                    start_index=course_cursor,
                    current_day=current_day,
                    week_key=f"{week_key.year}-W{week_key.week}",
                    sessions_by_course=sessions_by_course,
                    scheduled_ids=scheduled_ids,
                    sessions_by_week_course=sessions_by_week_course,
                    occupied_slots=occupied_slots,
                    start_minute=start_minute,
                )
                if candidate is None:
                    continue

                scheduled.append(candidate)
                self._scheduled_by_id[candidate.session_id] = candidate
                scheduled_ids.add(candidate.session_id)
                parent_idx = next(
                    (idx for idx, c in enumerate(ordered_courses) if c.identifiant_cours == candidate.parent_course_id),
                    0,
                )
                course_cursor = (parent_idx + 1) % max(len(ordered_courses), 1)
                weekly_key = f"{candidate.parent_course_id}:{week_key.year}-W{week_key.week}"
                sessions_by_week_course[weekly_key] = sessions_by_week_course.get(weekly_key, 0) + 1
                occupied_slots.add((candidate.day, candidate.start_minute, candidate.group_name))

        unscheduled = [session.session_id for session in sessions if session.session_id not in scheduled_ids]
        self._scheduled_by_id = {}
        return SchedulingResult(
            scheduled=scheduled,
            unscheduled_session_ids=unscheduled,
            planning_start=planning_start,
            planning_end=planning_end,
        )

    def _order_courses_for_scheduling(self) -> List[CourseTemplate]:
        graph = self._build_prerequisite_graph()
        in_degree = {course.identifiant_cours: 0 for course in self.courses}
        for parent, children in graph.items():
            for child in children:
                if child in in_degree:
                    in_degree[child] += 1

        ready = [
            self._course_map[cid]
            for cid, deg in in_degree.items()
            if deg == 0
        ]
        ready.sort(key=lambda c: c.ordre_lecon)

        ordered: List[CourseTemplate] = []
        while ready:
            course = ready.pop(0)
            ordered.append(course)
            for child in graph.get(course.identifiant_cours, set()):
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    ready.append(self._course_map[child])
            ready.sort(key=lambda c: c.ordre_lecon)

        seen = {c.identifiant_cours for c in ordered}
        tail = [c for c in sorted(self.courses, key=lambda x: x.ordre_lecon) if c.identifiant_cours not in seen]
        return ordered + tail

    def _iter_planning_days(self, start: date, end: date):
        current = start
        while current <= end:
            yield current
            current = date.fromordinal(current.toordinal() + 1)

    def _is_day_blocked(self, day: date) -> bool:
        if day.weekday() >= 5:
            return True
        if day == self.school.date_assermentation:
            return True
        if any(holiday.day == day for holiday in self.school.jours_feries):
            return True
        if any(vac.contains(day) for vac in self.school.vacances):
            return True
        if any(stage.contains(day) for stage in self.school.stages):
            return True
        return False

    def _pick_next_schedulable_session(
        self,
        ordered_courses: List[CourseTemplate],
        start_index: int,
        current_day: date,
        week_key: str,
        sessions_by_course: Dict[str, List[GeneratedSession]],
        scheduled_ids: Set[str],
        sessions_by_week_course: Dict[str, int],
        occupied_slots: Set[tuple[date, int, str]],
        start_minute: int,
    ) -> Optional[ScheduledSession]:
        if not ordered_courses:
            return None

        for offset in range(len(ordered_courses)):
            course = ordered_courses[(start_index + offset) % len(ordered_courses)]
            pending = [
                s for s in sessions_by_course.get(course.identifiant_cours, []) if s.session_id not in scheduled_ids
            ]
            if not pending:
                continue
            for session in pending:
                if not self._course_day_constraint_ok(course, current_day):
                    continue
                if not self._course_weekly_constraint_ok(course, week_key, sessions_by_week_course):
                    continue
                if not self._course_dependencies_satisfied(
                    course=course,
                    session=session,
                    current_day=current_day,
                    scheduled_ids=scheduled_ids,
                    sessions_by_course=sessions_by_course,
                ):
                    continue
                if (current_day, start_minute, session.group_name) in occupied_slots:
                    continue

                return ScheduledSession(
                    session_id=session.session_id,
                    parent_course_id=session.parent_course_id,
                    lecon=self._course_map[session.parent_course_id].lecon,
                    group_name=session.group_name,
                    day=current_day,
                    start_minute=start_minute,
                    duration_minutes=session.duree_minutes,
                )

        return None

    def _course_dependencies_satisfied(
        self,
        course: CourseTemplate,
        session: GeneratedSession,
        current_day: date,
        scheduled_ids: Set[str],
        sessions_by_course: Dict[str, List[GeneratedSession]],
    ) -> bool:
        dependency_ids = course.apres_cours_id + course.doit_suivre_id
        for prereq in dependency_ids:
            if prereq not in sessions_by_course:
                return False
            prereq_sessions = sessions_by_course[prereq]
            matched = self._find_matching_prereq_session(session, prereq_sessions, scheduled_ids)
            if matched is None:
                return False
            prereq_course = self._course_map[prereq]
            if not self._delay_constraint_ok(course, prereq_course, current_day, matched.day):
                return False
        return True

    def _find_matching_prereq_session(
        self,
        session: GeneratedSession,
        prereq_sessions: List[GeneratedSession],
        scheduled_ids: Set[str],
    ) -> Optional[ScheduledSession]:
        # Priority 1: same group link
        same_group = [
            s for s in prereq_sessions if s.group_name == session.group_name and s.session_id in scheduled_ids
        ]
        if same_group:
            return self._scheduled_session_from_id(same_group[0].session_id)

        # Priority 2: whole-class prerequisite
        whole_class = [
            s for s in prereq_sessions if s.group_name == "classe entière" and s.session_id in scheduled_ids
        ]
        if whole_class:
            return self._scheduled_session_from_id(whole_class[0].session_id)
        return None

    def _scheduled_session_from_id(self, session_id: str) -> Optional[ScheduledSession]:
        # Lightweight lookup built from generated schedule output state.
        # This method is overwritten on each schedule run by assigning `_scheduled_by_id`.
        return getattr(self, "_scheduled_by_id", {}).get(session_id)

    def _delay_constraint_ok(
        self,
        course: CourseTemplate,
        prereq_course: CourseTemplate,
        current_day: date,
        prereq_day: date,
    ) -> bool:
        delta_days = (current_day - prereq_day).days
        min_days = self._delay_to_days(course.delai_min_valeur, course.delai_min_unite)
        max_days = self._delay_to_days(course.delai_max_valeur, course.delai_max_unite)

        # Stage debriefing must remain tightly coupled to its stage.
        if "debriefing retour stage" in course.lecon.lower() and prereq_course.type == CourseType.STAGE:
            max_days = 7 if max_days is None else min(max_days, 7)

        if min_days is not None and delta_days < min_days:
            return False
        if max_days is not None and delta_days > max_days:
            return False
        return True

    def _delay_to_days(self, value: Optional[int], unit: Optional[DelayUnit]) -> Optional[int]:
        if value is None or unit is None:
            return None
        if unit == DelayUnit.JOUR:
            return value
        if unit == DelayUnit.SEMAINE:
            return value * 7
        if unit == DelayUnit.MOIS:
            return value * 30
        return None

    def _course_day_constraint_ok(self, course: CourseTemplate, day: date) -> bool:
        if not course.jour_specifique:
            return True
        target = self.DAY_NAME_TO_WEEKDAY.get(course.jour_specifique.lower())
        if target is None:
            return True
        return day.weekday() == target

    def _course_weekly_constraint_ok(
        self,
        course: CourseTemplate,
        week_key: str,
        sessions_by_week_course: Dict[str, int],
    ) -> bool:
        if course.max_par_semaine is None:
            return True
        counter_key = f"{course.identifiant_cours}:{week_key}"
        return sessions_by_week_course.get(counter_key, 0) < course.max_par_semaine


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent
    school_path = base_dir / "data" / "school_params.json"
    courses_path = base_dir / "data" / "courses.csv"

    school = load_school_params(str(school_path))
    courses = load_courses(str(courses_path))

    engine = PlanningEngine(school=school, courses=courses)

    print("=== Charges par cours ===")
    for row in engine.course_loads():
        print(row)

    print("\n=== Résumé école ===")
    print(engine.school_load_summary())
