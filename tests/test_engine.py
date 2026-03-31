from datetime import date

from app.engine import (
    CourseTemplate,
    CourseType,
    DelayUnit,
    PlanningEngine,
    SchoolParams,
)


def test_calculate_groups():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),
        nombre_aspirants=35,
        date_assermentation=date(2026, 9, 4),
    )

    course = CourseTemplate(
        branche="Sport",
        sous_branche="Sport",
        type=CourseType.PRATIQUE,
        identifiant_cours="H14",
        lecon="Circuit condition physique",
        duree_minutes=150,
        participants_max=12,
    )

    engine = PlanningEngine(school=school, courses=[course])

    assert engine.calculate_groups(course) == 3


def test_generate_sessions_for_course():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),
        nombre_aspirants=35,
        date_assermentation=date(2026, 9, 4),
    )

    course = CourseTemplate(
        branche="Sport",
        sous_branche="Sport",
        type=CourseType.PRATIQUE,
        identifiant_cours="H14",
        lecon="Circuit condition physique",
        duree_minutes=150,
        participants_max=12,
    )

    engine = PlanningEngine(school=school, courses=[course])
    sessions = engine.generate_sessions_for_course(course)

    assert len(sessions) == 3
    assert sessions[0].group_name == "groupe 1"
    assert sessions[1].group_name == "groupe 2"
    assert sessions[2].group_name == "groupe 3"


def test_course_without_special_constraint():
    course = CourseTemplate(
        branche="Droit",
        sous_branche="Procédure",
        type=CourseType.THEORIQUE,
        identifiant_cours="A1",
        lecon="Bases légales 1",
        duree_minutes=120,
        participants_max=35,
    )

    assert course.is_without_special_constraint is True


def test_course_with_delay_is_not_without_constraint():
    course = CourseTemplate(
        branche="Droit",
        sous_branche="Procédure",
        type=CourseType.THEORIQUE,
        identifiant_cours="A2",
        lecon="Bases légales 2",
        duree_minutes=120,
        participants_max=35,
        delai_max_valeur=0,
        delai_max_unite=DelayUnit.JOUR,
    )

    assert course.is_without_special_constraint is False
