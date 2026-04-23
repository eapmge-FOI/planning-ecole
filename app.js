function renderGroups(groups) {
  const tbody = document.querySelector("#groupsTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  groups.forEach(group => {
    const row = `
      <tr>
        <td>${group.id}</td>
        <td>${group.name}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

function isAssermentationCourse(course) {
  return (course.lecon || "").toUpperCase().includes("ASSERMENTATION");
}

function isDebriefCourse(course) {
  return (course.lecon || "").toUpperCase().includes("DEBRIEF");
}

function isWeeklyDebriefCourse(course) {
  const lesson = (course.lecon || "").toUpperCase();
  const hasStageDependency =
    (course.apres_cours_id && course.apres_cours_id.length > 0) ||
    (course.doit_suivre && course.doit_suivre.length > 0);

  return (
    lesson.includes("DEBRIEF") &&
    !lesson.includes("RETOUR STAGE") &&
    !hasStageDependency
  );
}

function computeEarliestAllowedIso(startIso, value, unit) {
  if (value === null || value === undefined || !unit) return null;

  const d = new Date(startIso + "T00:00:00");
  const u = String(unit).toLowerCase();

  if (u.startsWith("jour")) {
    d.setDate(d.getDate() + Number(value));
  } else if (u.startsWith("semaine")) {
    d.setDate(d.getDate() + Number(value) * 7);
  } else if (u.startsWith("mois")) {
    d.setMonth(d.getMonth() + Number(value));
  } else {
    return null;
  }

  return formatDateISO(d);
}

function computeLatestAllowedIso(startIso, value, unit) {
  if (value === null || value === undefined || !unit) return null;

  const d = new Date(startIso + "T00:00:00");
  const u = String(unit).toLowerCase();

  if (u.startsWith("jour")) {
    d.setDate(d.getDate() + Number(value));
  } else if (u.startsWith("semaine")) {
    d.setDate(d.getDate() + Number(value) * 7);
  } else if (u.startsWith("mois")) {
    d.setMonth(d.getMonth() + Number(value));
  } else {
    return null;
  }

  return formatDateISO(d);
}

function validateCourses(courses) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const validDays = new Set([
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"
@@ -630,64 +662,88 @@ function validateCourses(courses) {
      errors.push("Un cours a un ID vide.");
    } else if (ids.has(course.id)) {
      errors.push(`ID dupliqué: ${course.id}`);
    } else {
      ids.add(course.id);
    }

    if (!Number.isFinite(course.duree) || course.duree <= 0) {
      errors.push(`Durée invalide pour ${course.id}`);
    } else if (course.duree % 30 !== 0) {
      warnings.push(`Durée non multiple de 30 minutes pour ${course.id}`);
    }

    if (!Number.isFinite(course.participants) || course.participants <= 0) {
      errors.push(`Participants invalides pour ${course.id}`);
    }

    if (!Number.isFinite(course.encadrants) || course.encadrants < 0) {
      errors.push(`Encadrants invalides pour ${course.id}`);
    }

    if (course.jour_specifique && !validDays.has(String(course.jour_specifique).toLowerCase())) {
      errors.push(`jour_specifique invalide pour ${course.id}: ${course.jour_specifique}`);
    }

    if (
      course.delai_min_valeur !== null &&
      course.delai_min_valeur !== undefined &&
      (!Number.isFinite(course.delai_min_valeur) || course.delai_min_valeur < 0)
    ) {
      errors.push(`delai_min_valeur invalide pour ${course.id}`);
    }

    if (
      course.delai_min_unite &&
      !["jour", "jours", "semaine", "semaines", "mois", "month", "months"].includes(String(course.delai_min_unite).toLowerCase())
    ) {
      warnings.push(`delai_min_unite non reconnue pour ${course.id}: ${course.delai_min_unite}`);
    }

    if (
      course.delai_max_valeur !== null &&
      course.delai_max_valeur !== undefined &&
      (!Number.isFinite(course.delai_max_valeur) || course.delai_max_valeur < 0)
    ) {
      errors.push(`delai_max_valeur invalide pour ${course.id}`);
    }

    if (
      course.delai_max_unite &&
      !["jour", "jours", "semaine", "semaines", "mois", "month", "months"].includes(String(course.delai_max_unite).toLowerCase())
    ) {
      warnings.push(`delai_max_unite non reconnue pour ${course.id}: ${course.delai_max_unite}`);
    }

    if (
      Number.isFinite(course.delai_min_valeur) &&
      Number.isFinite(course.delai_max_valeur) &&
      course.delai_min_valeur > course.delai_max_valeur &&
      String(course.delai_min_unite || "") === String(course.delai_max_unite || "")
    ) {
      errors.push(`Fenêtre de délai incohérente pour ${course.id} (min > max).`);
    }
  });

  courses.forEach(course => {
    (course.apres_cours_id || []).forEach(depId => {
      if (!ids.has(depId)) {
        errors.push(`${course.id} dépend de ${depId}, mais cet ID n'existe pas.`);
      }
    });

    (course.avant_cours_id || []).forEach(depId => {
      if (!ids.has(depId)) {
        errors.push(`${course.id} a avant_cours_id ${depId}, mais cet ID n'existe pas.`);
      }
    });
  });

  // Détection simple de cycle sur apres_cours_id
  const graph = {};
  courses.forEach(course => {
    graph[course.id] = course.apres_cours_id || [];
  });

  const visiting = new Set();
  const visited = new Set();

@@ -756,159 +812,175 @@ function sortCoursesForPlanning(courses, schoolStartIso) {

    const aDeadline = computeLatestAllowedIso(schoolStartIso, a.delai_max_valeur, a.delai_max_unite) || "9999-12-31";
    const bDeadline = computeLatestAllowedIso(schoolStartIso, b.delai_max_valeur, b.delai_max_unite) || "9999-12-31";
    if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);

    const aHasDay = a.jour_specifique ? 1 : 0;
    const bHasDay = b.jour_specifique ? 1 : 0;
    if (aHasDay !== bHasDay) return bHasDay - aHasDay;

    if (a.sous_branche === b.sous_branche) {
      const ao = Number(a.ordre_lecon || 0);
      const bo = Number(b.ordre_lecon || 0);

      if (ao !== bo) {
        if (ao === 0) return 1;
        if (bo === 0) return -1;
        return ao - bo;
      }
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

function courseIsReady(course, completedCourseIds, courseMap) {
  const deps = course.apres_cours_id || [];
  const deps = [
    ...(course.apres_cours_id || []),
    ...(course.doit_suivre || [])
  ];
  if (deps.some(id => !completedCourseIds.has(id))) {
    return false;
  }

  const currentOrder = Number(course.ordre_lecon || 0);
  if (currentOrder > 0) {
    const previousCourses = Object.values(courseMap).filter(other =>
      other.sous_branche === course.sous_branche &&
      Number(other.ordre_lecon || 0) > 0 &&
      Number(other.ordre_lecon || 0) < currentOrder
    );

    if (previousCourses.some(c => !completedCourseIds.has(c.id))) {
      return false;
    }
  }

  return true;
}

function buildRealSessions(courses, groups, nombreAspirants, schoolStartIso) {
  const sessions = [];
  const sortedCourses = sortCoursesForPlanning(courses, schoolStartIso);

  sortedCourses.forEach(course => {
    const latestAllowedIso = computeLatestAllowedIso(
      schoolStartIso,
      course.delai_max_valeur,
      course.delai_max_unite
    );
    const earliestAllowedIso = computeEarliestAllowedIso(
      schoolStartIso,
      course.delai_min_valeur,
      course.delai_min_unite
    );

    if (isDebriefCourse(course)) {
    if (isWeeklyDebriefCourse(course)) {
      return;
    }

    if (isAssermentationCourse(course)) {
      sessions.push({
        sessionId: `${course.id}-FIXE`,
        courseId: course.id,
        lecon: course.lecon,
        jour_specifique: null,
        duree: course.duree,
        mode: "fixed_full_day",
        label: "date assermentation",
        max_par_semaine: course.max_par_semaine ?? null,
        earliestAllowedIso,
        latestAllowedIso,
        sous_branche: course.sous_branche,
        ordre_lecon: course.ordre_lecon || 0,
        apres_cours_id: course.apres_cours_id || []
        apres_cours_id: course.apres_cours_id || [],
        doit_suivre: course.doit_suivre || []
      });
      return;
    }

    if (course.division === "Non") {
      sessions.push({
        sessionId: `${course.id}-CE`,
        courseId: course.id,
        lecon: course.lecon,
        jour_specifique: course.jour_specifique,
        duree: course.duree,
        mode: "classe_entiere",
        label: "classe entière",
        max_par_semaine: course.max_par_semaine ?? null,
        earliestAllowedIso,
        latestAllowedIso,
        sous_branche: course.sous_branche,
        ordre_lecon: course.ordre_lecon || 0,
        apres_cours_id: course.apres_cours_id || []
        apres_cours_id: course.apres_cours_id || [],
        doit_suivre: course.doit_suivre || []
      });
      return;
    }

    const requiredGroups = Math.ceil(nombreAspirants / course.participants);
    const plannedGroups = groups.slice(0, requiredGroups);

    if (course.simultane === "Oui") {
      sessions.push({
        sessionId: `${course.id}-SIM`,
        courseId: course.id,
        lecon: course.lecon,
        jour_specifique: course.jour_specifique,
        duree: course.duree,
        mode: "simultane",
        groups: plannedGroups.map(g => g.name),
        label: plannedGroups.map(g => g.name).join(", "),
        max_par_semaine: course.max_par_semaine ?? null,
        earliestAllowedIso,
        latestAllowedIso,
        sous_branche: course.sous_branche,
        ordre_lecon: course.ordre_lecon || 0,
        apres_cours_id: course.apres_cours_id || []
        apres_cours_id: course.apres_cours_id || [],
        doit_suivre: course.doit_suivre || []
      });
      return;
    }

    for (let i = 1; i <= requiredGroups; i++) {
      sessions.push({
        sessionId: `${course.id}-REP${i}`,
        courseId: course.id,
        lecon: course.lecon,
        jour_specifique: course.jour_specifique,
        duree: course.duree,
        mode: "non_simultane",
        repetition: i,
        label: `répétition ${i}`,
        max_par_semaine: course.max_par_semaine ?? null,
        earliestAllowedIso,
        latestAllowedIso,
        sous_branche: course.sous_branche,
        ordre_lecon: course.ordre_lecon || 0,
        apres_cours_id: course.apres_cours_id || []
        apres_cours_id: course.apres_cours_id || [],
        doit_suivre: course.doit_suivre || []
      });
    }
  });

  return sessions;
}

function renderRealSessionsTable(sessions) {
  const tbody = document.querySelector("#realSessionsTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  sessions.forEach(session => {
    const cible =
      session.mode === "classe_entiere"
        ? "classe entière"
        : session.mode === "simultane"
        ? session.groups.join(", ")
        : session.label;

    const row = `
      <tr>
        <td>${session.sessionId}</td>
        <td>${session.courseId}</td>
@@ -1009,113 +1081,147 @@ function markCourseMinutes(courseId, minutes) {
      dayIndex++;
      currentMinutes = 8 * 60;
    }
  }

  function moveToNextDay() {
    dayIndex++;
    currentMinutes = 8 * 60;
  }

  function findNextValidDayIndex(startIndex, jourSpecifique) {
    let idx = startIndex;

    while (idx < openDays.length) {
      const day = openDays[idx];

      if (!jourSpecifique) return idx;
      if (day.jour.toLowerCase() === String(jourSpecifique).toLowerCase()) return idx;

      idx++;
    }

    return idx;
  }

  function findNextValidDayIndexWithConstraints(startIndex, jourSpecifique, courseId, maxParSemaine, latestAllowedIso) {
  function findNextValidDayIndexWithConstraints(
    startIndex,
    jourSpecifique,
    courseId,
    maxParSemaine,
    earliestAllowedIso,
    latestAllowedIso
  ) {
    let idx = findNextValidDayIndex(startIndex, jourSpecifique);

    while (idx < openDays.length) {
      const day = openDays[idx];

      if (earliestAllowedIso && day.iso < earliestAllowedIso) {
        idx = findNextValidDayIndex(idx + 1, jourSpecifique);
        continue;
      }

      if (latestAllowedIso && day.iso > latestAllowedIso) {
        return openDays.length;
      }

      if (maxParSemaine !== null && maxParSemaine !== undefined) {
        const isoWeek = getIsoWeekForOpenDay(idx);
        if (getWeekUsage(courseId, isoWeek) >= maxParSemaine) {
          idx = findNextValidDayIndex(idx + 1, jourSpecifique);
          continue;
        }
      }

      return idx;
    }

    return idx;
  }

  function getRemainingTeachMinutesToday(fromMinutes) {
    if (fromMinutes < 12 * 60) {
      return (12 * 60 - fromMinutes) + (17 * 60 + 30 - (13 * 60 + 30));
    }

    if (fromMinutes >= 13 * 60 + 30 && fromMinutes < 17 * 60 + 30) {
      return 17 * 60 + 30 - fromMinutes;
    }

    return 0;
  }

function ensureSessionFitsToday(duration, jourSpecifique, courseId, maxParSemaine, latestAllowedIso) {
function ensureSessionFitsToday(
  duration,
  jourSpecifique,
  courseId,
  maxParSemaine,
  earliestAllowedIso,
  latestAllowedIso
) {
  dayIndex = findNextValidDayIndexWithConstraints(
    dayIndex,
    jourSpecifique,
    courseId,
    maxParSemaine,
    earliestAllowedIso,
    latestAllowedIso
  );

  if (dayIndex >= openDays.length) return false;

  // Pause midi
  if (currentMinutes >= CONFIG.LUNCH_START && currentMinutes < CONFIG.LUNCH_END) {
    currentMinutes = CONFIG.LUNCH_END;
  }

  // Fin de journée
  if (currentMinutes >= CONFIG.DAY_END) {
    moveToNextDay();
    return ensureSessionFitsToday(duration, jourSpecifique, courseId, maxParSemaine, latestAllowedIso);
    return ensureSessionFitsToday(
      duration,
      jourSpecifique,
      courseId,
      maxParSemaine,
      earliestAllowedIso,
      latestAllowedIso
    );
  }

  const remaining = getRemainingTeachMinutesToday(currentMinutes);

  if (duration > remaining) {
    moveToNextDay();
    return ensureSessionFitsToday(duration, jourSpecifique, courseId, maxParSemaine, latestAllowedIso);
    return ensureSessionFitsToday(
      duration,
      jourSpecifique,
      courseId,
      maxParSemaine,
      earliestAllowedIso,
      latestAllowedIso
    );
  }

  return true;
}

function getRotatedGroups() {
  return groups.map((_, i) => groups[(i + rotationOffset) % groups.length]);
}

  function findDayIndexByIso(isoDate) {
    return allDays.findIndex(day => day.iso === isoDate);
  }

  function findNextReadySessionIndex(startIndex) {
    for (let i = startIndex; i < sessions.length; i++) {
      const session = sessions[i];
      const course = courseMap[session.courseId];
      if (!course) continue;

      if (courseIsReady(course, completedCourseIds, courseMap)) {
        return i;
      }
    }
    return -1;
  }
@@ -1163,96 +1269,98 @@ if (safety > 10000) {
            result.push({
              date: fixedDay.dateFr,
              time: `${block[0]}-${block[1]}`,
              groupe: "classe entière",
              id: session.courseId,
              lecon: session.lecon,
              duree: block[2]
            });
          });

          markCourseMinutes(session.courseId, session.duree);
        }
      }

      sessionIndex++;
      continue;
    }

    // CAS 1 : classe entière
    if (session.mode === "classe_entiere") {
      if (!ensureSessionFitsToday(
        session.duree,
        session.jour_specifique,
        session.courseId,
        session.max_par_semaine,
        session.earliestAllowedIso,
        session.latestAllowedIso
      )) {
        sessionIndex++;
        continue;
      }

      const isoWeek = getIsoWeekForOpenDay(dayIndex);
      if (session.max_par_semaine) addWeekUsage(session.courseId, isoWeek);

      let remaining = session.duree;

      while (remaining > 0) {
        const slot = Math.min(30, remaining);
        const start = currentMinutes;
        const end = currentMinutes + slot;

        result.push({
          date: openDays[dayIndex].dateFr,
          time: minutesToTimeString(start) + "-" + minutesToTimeString(end),
          groupe: "classe entière",
          id: session.courseId,
          lecon: session.lecon,
          duree: slot
        });

        currentMinutes += slot;
        remaining -= slot;
        markCourseMinutes(session.courseId, slot);

        nextSlot();
        if (remaining > 0) {
          dayIndex = findNextValidDayIndex(dayIndex, session.jour_specifique);
        }
      }

      sessionIndex++;
      continue;
    }

    // CAS 2 : simultané
    if (session.mode === "simultane") {
      if (!ensureSessionFitsToday(
        session.duree,
        session.jour_specifique,
        session.courseId,
        session.max_par_semaine,
        session.earliestAllowedIso,
        session.latestAllowedIso
      )) {
        sessionIndex++;
        continue;
      }

      const isoWeek = getIsoWeekForOpenDay(dayIndex);
      if (session.max_par_semaine) addWeekUsage(session.courseId, isoWeek);

      let remaining = session.duree;

      while (remaining > 0) {
        const slot = Math.min(30, remaining);
        const start = currentMinutes;
        const end = currentMinutes + slot;

        session.groups.forEach(groupName => {
          result.push({
            date: openDays[dayIndex].dateFr,
            time: minutesToTimeString(start) + "-" + minutesToTimeString(end),
            groupe: groupName,
            id: session.courseId,
            lecon: session.lecon,
            duree: slot
          });
@@ -1315,50 +1423,51 @@ while (
      courseIds.forEach(courseId => {
        const nextSession = buckets[courseId].find(s => s.remaining > 0);
        if (nextSession) activeSessions.push(nextSession);
      });

      const selectedSessions = activeSessions.slice(0, groups.length);
      if (selectedSessions.length === 0) break;

      const representative = selectedSessions[0];

      const waveAssignments = rotatedGroups.map((group, idx) => ({
        groupName: group.name,
        session: selectedSessions[idx] || null
      }));

      const waveDuration = Math.max(
        ...waveAssignments.map(a => (a.session ? a.session.remaining : 0)),
        0
      );

      if (!ensureSessionFitsToday(
        waveDuration,
        batchJour,
        representative.courseId,
        representative.max_par_semaine,
        representative.earliestAllowedIso,
        representative.latestAllowedIso
      )) {
        break;
      }

      const isoWeek = getIsoWeekForOpenDay(dayIndex);
      selectedSessions.forEach(s => {
        if (s.max_par_semaine) addWeekUsage(s.courseId, isoWeek);
      });

      while (waveAssignments.some(a => a.session && a.session.remaining > 0)) {
        const start = currentMinutes;
        const end = currentMinutes + 30;

        waveAssignments.forEach(assignment => {
          if (assignment.session && assignment.session.remaining > 0) {
            result.push({
              date: openDays[dayIndex].dateFr,
              time: minutesToTimeString(start) + "-" + minutesToTimeString(end),
              groupe: assignment.groupName,
              id: assignment.session.courseId,
              lecon: assignment.session.lecon,
              duree: 30
            });

@@ -1374,51 +1483,51 @@ while (
              duree: 30
            });
          }
        });

        currentMinutes += 30;

        if (waveAssignments.some(a => a.session && a.session.remaining > 0)) {
          nextSlot();
          dayIndex = findNextValidDayIndex(dayIndex, batchJour);
        }
      }

      rotationOffset = (rotationOffset + 1) % groups.length;
    }

    // une fois le batch fini, marquer les cours complètement terminés
    courseIds.forEach(courseId => {
      if ((remainingMinutesByCourse[courseId] || 0) <= 0) {
        completedCourseIds.add(courseId);
      }
    });
  }

  // Injection du débriefing en fin de vendredi
  const debriefCourse = courses.find(c => isDebriefCourse(c));
  const debriefCourse = courses.find(c => isWeeklyDebriefCourse(c));
  if (debriefCourse) {
    const fridayDays = openDays.filter(day => day.jour.toLowerCase() === "vendredi");

    fridayDays.forEach(day => {
      const sameDayRows = result.filter(r => r.date === day.dateFr);

      let latestEnd = "16:30";

      sameDayRows.forEach(r => {
        const end = r.time.split("-")[1];
        if (end > latestEnd) latestEnd = end;
      });

      let startTime = "16:30";
      let endTime = "17:30";

      if (latestEnd > "16:30") {
        startTime = "17:30";
        endTime = "18:30";
      }

      result.push({
        date: day.dateFr,
        time: `${startTime}-${endTime}`,
        groupe: "classe entière",
