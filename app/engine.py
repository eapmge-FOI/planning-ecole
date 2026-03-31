from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from math import ceil
from pathlib import Path
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
                max_par_semaine=parse_optional_int(row["max_par_semaine"]),
                jour_specifique=parse_optional_str(row["jour_specifique"]),
            )
            courses.append(course)

    return courses


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
