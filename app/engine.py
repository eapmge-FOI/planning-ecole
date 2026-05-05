from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from math import ceil
from pathlib import Path
from typing import Dict, List, Optional, Set
from collections import Counter, defaultdict


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
    label: str = "vacances"

    def contains(self, day: date) -> bool:
        return self.start <= day <= self.end


@dataclass
class StagePeriod:
    stage_id: str
    start: date
    end: date
    label: str = "stage"

    def contains(self, day: date) -> bool:
        return self.start <= day <= self.end


@dataclass
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
class UnscheduledSessionDiagnostic:
    session_id: str
    parent_course_id: str
    group_name: str
    reasons: Dict[str, int]
    primary_reason: str

@dataclass
class SchedulingResult:
    scheduled: List[ScheduledSession]
    unscheduled_session_ids: List[str]
    planning_start: date
    planning_end: date
    unscheduled_details: List[UnscheduledSessionDiagnostic] = field(default_factory=list)


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
    return date.fromisoformat(value.strip())


def parse_optional_int(value: str) -> Optional[int]:
    value = value.strip()
    if not value:
        return None
    return int(value)


def parse_optional_str(value: str) -> Optional[str]:
    value = value.strip()
    if not value:
        return None
    return value


def parse_id_list(value: str) -> List[str]:
    value = value.strip()
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def load_school_params(filepath: str) -> SchoolParams:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    jours_feries = [
        Holiday(
            day=parse_date(item["day"]),
            label=item.get("label", "jour férié"),
        )
        for item in data.get("jours_feries", [])
    ]

    vacances = [
        VacationPeriod(
            start=parse_date(item["start"]),
            end=parse_date(item["end"]),
            label=item.get("label", "vacances"),
        )
        for item in data.get("vacances", [])
    ]

    stages = [
        StagePeriod(
            stage_id=item["stage_id"],
            start=parse_date(item["start"]),
            end=parse_date(item["end"]),
            label=item.get("label", "stage"),
        )
        for item in data.get("stages", [])
    ]

    return SchoolParams(
        nom_ecole=data["nom_ecole"],
        date_debut=parse_date(data["date_debut"]),
        nombre_aspirants=int(data["nombre_aspirants"]),
        date_assermentation=parse_date(data["date_assermentation"]),
        jours_feries=jours_feries,
        vacances=vacances,
        stages=stages,
        duree_min_mois=int(data.get("duree_min_mois", 8)),
    )


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


# ⚠️ JE TE METS ICI UNIQUEMENT LA PARTIE CORRIGÉE IMPORTANTE
# (le reste de ton fichier était bon)

class PlanningEngine:
    STANDARD_DAY_MINUTES = 480
    EXTENDED_DAY_MINUTES = 540
    MAX_EXTENDED_DAYS_PER_WEEK = 2
    WEEKLY_RUNNING_MINUTES = 90
    MAX_WEEKLY_MINUTES = (5 * STANDARD_DAY_MINUTES) + (2 * 60) + WEEKLY_RUNNING_MINUTES
    DEFAULT_SLOT_STARTS = [8 * 60, 10 * 60, 13 * 60 + 30, 15 * 60 + 30]

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
        occupied_slots: Set[tuple] = set()
        course_cursor = 0

        failure_reasons: Dict[str, Counter] = defaultdict(Counter)

        for current_day in self._iter_planning_days(planning_start, planning_end):
            if self._is_day_blocked(current_day):
                continue

            week_key = current_day.isocalendar()

            for start_minute in self.DEFAULT_SLOT_STARTS:
                candidate = self._pick_next_schedulable_session(
                    ordered_courses,
                    course_cursor,
                    current_day,
                    f"{week_key.year}-W{week_key.week}",
                    sessions_by_course,
                    scheduled_ids,
                    sessions_by_week_course,
                    occupied_slots,
                    start_minute,
                    failure_reasons,
                )

                if candidate is None:
                    continue

                scheduled.append(candidate)
                self._scheduled_by_id[candidate.session_id] = candidate
                scheduled_ids.add(candidate.session_id)

                parent_idx = next(
                    (i for i, c in enumerate(ordered_courses)
                     if c.identifiant_cours == candidate.parent_course_id),
                    course_cursor,
                )

                course_cursor = (parent_idx + 1) % len(ordered_courses)

                weekly_key = f"{candidate.parent_course_id}:{week_key.year}-W{week_key.week}"
                sessions_by_week_course[weekly_key] = sessions_by_week_course.get(weekly_key, 0) + 1

                occupied_slots.add((candidate.day, candidate.start_minute, candidate.group_name))

        unscheduled_sessions = [s for s in sessions if s.session_id not in scheduled_ids]

        unscheduled_details = []
        for session in unscheduled_sessions:
            reasons = dict(failure_reasons.get(session.session_id, Counter()))
            primary = max(reasons, key=reasons.get) if reasons else "no_slot_found"

            unscheduled_details.append(
                UnscheduledSessionDiagnostic(
                    session.session_id,
                    session.parent_course_id,
                    session.group_name,
                    reasons,
                    primary,
                )
            )

        return SchedulingResult(
            scheduled,
            [s.session_id for s in unscheduled_sessions],
            planning_start,
            planning_end,
            unscheduled_details,
        )

    def _pick_next_schedulable_session(
        self,
        ordered_courses,
        start_index,
        current_day,
        week_key,
        sessions_by_course,
        scheduled_ids,
        sessions_by_week_course,
        occupied_slots,
        start_minute,
        failure_reasons,
    ):
        for offset in range(len(ordered_courses)):
            course = ordered_courses[(start_index + offset) % len(ordered_courses)]

            pending = [
                s for s in sessions_by_course.get(course.identifiant_cours, [])
                if s.session_id not in scheduled_ids
            ]

            for session in pending:
                if not self._course_day_constraint_ok(course, current_day):
                    failure_reasons[session.session_id]["day_constraint"] += 1
                    continue

                if not self._course_weekly_constraint_ok(course, week_key, sessions_by_week_course):
                    failure_reasons[session.session_id]["weekly_limit"] += 1
                    continue

                dep_ok, reason = self._course_dependencies_satisfied(
                    course, session, current_day, scheduled_ids, sessions_by_course
                )

                if not dep_ok:
                    failure_reasons[session.session_id][reason] += 1
                    continue

                if (current_day, start_minute, session.group_name) in occupied_slots:
                    failure_reasons[session.session_id]["slot_collision"] += 1
                    continue

                return ScheduledSession(
                    session.session_id,
                    session.parent_course_id,
                    self._course_map[session.parent_course_id].lecon,
                    session.group_name,
                    current_day,
                    start_minute,
                    session.duree_minutes,
                )

        return None

    def _course_dependencies_satisfied(
        self, course, session, current_day, scheduled_ids, sessions_by_course
    ):
        for prereq in course.apres_cours_id + course.doit_suivre_id:
            if prereq not in sessions_by_course:
                return False, "dependency_unknown"

            prereq_sessions = sessions_by_course[prereq]

            matched = next(
                (self._scheduled_by_id[s.session_id]
                 for s in prereq_sessions
                 if s.session_id in scheduled_ids),
                None,
            )

            if not matched:
                return False, "dependency_not_scheduled"

        return True, ""

    def _course_day_constraint_ok(self, course, day):
        if not course.jour_specifique:
            return True
        return day.weekday() == self.DAY_NAME_TO_WEEKDAY.get(course.jour_specifique.lower(), -1)

    def _course_weekly_constraint_ok(self, course, week_key, sessions_by_week_course):
        if course.max_par_semaine is None:
            return True
        key = f"{course.identifiant_cours}:{week_key}"
        return sessions_by_week_course.get(key, 0) < course.max_par_semaine


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
