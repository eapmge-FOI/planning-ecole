from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from math import ceil
from typing import List, Optional


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
    max_par_semaine: Optional[int] = None
    jour_specifique: Optional[str] = None

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
        if (self.delai_max_valeur is None) != (self.delai_max_unite is None):
            raise ValueError(
                f"{self.identifiant_cours}: delai_max_valeur et delai_max_unite doivent être remplis ensemble"
            )

    @property
    def is_without_special_constraint(self) -> bool:
        return (
            self.ordre_lecon == 0
            and not self.apres_cours_id
            and not self.avant_cours_id
            and self.delai_max_valeur is None
            and self.jour_specifique is None
            and self.max_par_semaine is None
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


class PlanningEngine:
    STANDARD_DAY_MINUTES = 480
    EXTENDED_DAY_MINUTES = 540
    MAX_EXTENDED_DAYS_PER_WEEK = 2
    WEEKLY_RUNNING_MINUTES = 90
    MAX_WEEKLY_MINUTES = (5 * STANDARD_DAY_MINUTES) + (2 * 60) + WEEKLY_RUNNING_MINUTES

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

        if groups == 1:
            return [
                GeneratedSession(
                    parent_course_id=course.identifiant_cours,
                    session_id=f"{course.identifiant_cours}-CE",
                    group_name="classe entière",
                    duree_minutes=course.duree_minutes,
                )
            ]

        for i in range(1, groups + 1):
            sessions.append(
                GeneratedSession(
                    parent_course_id=course.identifiant_cours,
                    session_id=f"{course.identifiant_cours}-G{i}",
                    group_name=f"groupe {i}",
                    duree_minutes=course.duree_minutes,
                )
            )

        return sessions

    def course_loads(self) -> List[CourseLoad]:
        rows: List[CourseLoad] = []

        for course in self.courses:
            groups = self.calculate_groups(course)
            minutes = course.duree_minutes * groups

            rows.append(
                CourseLoad(
                    identifiant_cours=course.identifiant_cours,
                    lecon=course.lecon,
                    nombre_groupes=groups,
                    nombre_seances_reelles=groups,
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
