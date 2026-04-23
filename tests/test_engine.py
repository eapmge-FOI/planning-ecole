from datetime import date

from app.engine import (
    CourseTemplate,
    CourseType,
    DelayUnit,
    PlanningEngine,
    SchoolParams,
    load_courses,
    load_school_params,
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


def test_load_school_params():
    school = load_school_params("data/school_params.json")

    assert school.nom_ecole == "Ecole PM 2026"
    assert school.nombre_aspirants == 35
    assert school.date_debut == date(2026, 1, 5)
    assert school.date_assermentation == date(2026, 9, 4)
    assert len(school.jours_feries) == 2
    assert len(school.vacances) == 1
    assert len(school.stages) == 1


def test_load_courses():
    courses = load_courses("data/courses.csv")

    assert len(courses) == 6
    assert courses[0].identifiant_cours == "A1"
    assert courses[1].apres_cours_id == ["A1"]
    assert courses[2].identifiant_cours == "H14"
    assert courses[2].max_par_semaine == 1
    assert courses[3].jour_specifique == "vendredi"


def test_school_load_summary():
    school = load_school_params("data/school_params.json")
    courses = load_courses("data/courses.csv")
    engine = PlanningEngine(school=school, courses=courses)

    summary = engine.school_load_summary()

    assert summary.nom_ecole == "Ecole PM 2026"
    assert summary.nombre_aspirants == 35
    assert summary.total_cours_catalogue == 6
    assert summary.total_seances_reelles > 0
    assert summary.volume_total_minutes > 0
    assert summary.volume_total_heures > 0


def test_constraint_diagnostic_on_sample_data():
    school = load_school_params("data/school_params.json")
    courses = load_courses("data/courses.csv")
    engine = PlanningEngine(school=school, courses=courses)

    diagnostic = engine.constraint_diagnostic()

    assert diagnostic.total_cours == 6
    assert diagnostic.cours_avec_contraintes == 5
    assert diagnostic.prerequis_inconnus == []
    assert diagnostic.cycles_detectes == []
    assert diagnostic.cours_goulots == ["A2", "S1"]


def test_constraint_diagnostic_detects_unknown_and_cycle():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),
        nombre_aspirants=30,
        date_assermentation=date(2026, 9, 4),
    )

    c1 = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.THEORIQUE,
        identifiant_cours="C1",
        lecon="Cours 1",
        duree_minutes=60,
        participants_max=30,
        apres_cours_id=["C2"],
    )
    c2 = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.THEORIQUE,
        identifiant_cours="C2",
        lecon="Cours 2",
        duree_minutes=60,
        participants_max=30,
        apres_cours_id=["C1", "X999"],
    )

    engine = PlanningEngine(school=school, courses=[c1, c2])
    diagnostic = engine.constraint_diagnostic()

    assert diagnostic.prerequis_inconnus == ["C2 -> X999"]
    assert diagnostic.cycles_detectes == [["C1", "C2", "C1"]]


def test_generate_greedy_schedule_respects_after_and_weekly_limit():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),  # lundi
        nombre_aspirants=30,
        date_assermentation=date(2026, 9, 4),
    )

    a1 = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.THEORIQUE,
        identifiant_cours="A1",
        lecon="A1",
        duree_minutes=60,
        participants_max=30,
    )
    a2 = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.THEORIQUE,
        identifiant_cours="A2",
        lecon="A2",
        duree_minutes=60,
        participants_max=30,
        apres_cours_id=["A1"],
        max_par_semaine=1,
    )

    engine = PlanningEngine(school=school, courses=[a2, a1])
    result = engine.generate_greedy_schedule(months=1)

    assert len(result.unscheduled_session_ids) == 0
    a1_session = next(x for x in result.scheduled if x.parent_course_id == "A1")
    a2_session = next(x for x in result.scheduled if x.parent_course_id == "A2")
    assert a1_session.day <= a2_session.day


def test_generate_greedy_schedule_respects_specific_day():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),  # lundi
        nombre_aspirants=30,
        date_assermentation=date(2026, 9, 4),
    )

    friday_course = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.THEORIQUE,
        identifiant_cours="F1",
        lecon="Vendredi only",
        duree_minutes=60,
        participants_max=30,
        jour_specifique="vendredi",
    )

    engine = PlanningEngine(school=school, courses=[friday_course])
    result = engine.generate_greedy_schedule(months=1)

    assert len(result.scheduled) == 1
    assert result.scheduled[0].day.weekday() == 4


def test_generate_greedy_schedule_respects_min_delay():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),  # lundi
        nombre_aspirants=30,
        date_assermentation=date(2026, 9, 4),
    )
    stage = CourseTemplate(
        branche="Terrain",
        sous_branche="Stage",
        type=CourseType.STAGE,
        identifiant_cours="N6",
        lecon="Stage",
        duree_minutes=60,
        participants_max=30,
    )
    debrief = CourseTemplate(
        branche="Terrain",
        sous_branche="Debrief",
        type=CourseType.THEORIQUE,
        identifiant_cours="N7",
        lecon="Debriefing retour STAGE",
        duree_minutes=60,
        participants_max=30,
        apres_cours_id=["N6"],
        delai_min_valeur=1,
        delai_min_unite=DelayUnit.JOUR,
    )

    engine = PlanningEngine(school=school, courses=[debrief, stage])
    result = engine.generate_greedy_schedule(months=1)

    stage_day = next(x.day for x in result.scheduled if x.parent_course_id == "N6")
    debrief_day = next(x.day for x in result.scheduled if x.parent_course_id == "N7")
    assert (debrief_day - stage_day).days >= 1


def test_generate_greedy_schedule_interleaves_dependent_groups():
    school = SchoolParams(
        nom_ecole="Ecole test",
        date_debut=date(2026, 1, 5),
        nombre_aspirants=35,
        date_assermentation=date(2026, 9, 4),
    )

    prereq = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.PRATIQUE,
        identifiant_cours="P1",
        lecon="Pré-requis",
        duree_minutes=60,
        participants_max=12,
    )
    dependent = CourseTemplate(
        branche="Bloc",
        sous_branche="B1",
        type=CourseType.PRATIQUE,
        identifiant_cours="P2",
        lecon="Dépendant",
        duree_minutes=60,
        participants_max=12,
        apres_cours_id=["P1"],
    )

    engine = PlanningEngine(school=school, courses=[dependent, prereq])
    result = engine.generate_greedy_schedule(months=1)

    p2_days = [x.day for x in result.scheduled if x.parent_course_id == "P2"]
    p1_days = [x.day for x in result.scheduled if x.parent_course_id == "P1"]

    assert p2_days
    assert p1_days
    assert min(p2_days) <= max(p1_days)
