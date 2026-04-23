const CONFIG = {
  DAY_START: 8 * 60,
  LUNCH_START: 12 * 60,
  LUNCH_END: 13 * 60 + 30,
  DAY_END: 17 * 60 + 30,
  SLOT_DURATION: 30,

  HALF_DAY_SLOTS: [8 * 60, 10 * 60, 13 * 60 + 30, 15 * 60 + 30],
  FULL_DAY_SLOTS: [8 * 60, 13 * 60 + 30]
};

function addMonthsToDate(dateString, monthsToAdd) {
  const baseDate = new Date(dateString);
  const result = new Date(baseDate);
  const originalDay = result.getDate();

  result.setMonth(result.getMonth() + monthsToAdd);

  if (result.getDate() < originalDay) {
    result.setDate(0);
  }

  return result;
}

function formatDateFR(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${day}.${month}.${year}`;
}

function formatDateISO(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayNameFR(dateObj) {
  const days = [
    "dimanche",
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi"
  ];
  return days[dateObj.getDay()];
}

function getConstraintLabel(course) {
  const constraints = [];

  if (course.ordre_lecon && course.ordre_lecon > 0) {
    constraints.push(`ordre ${course.ordre_lecon}`);
  }

  if (course.apres_cours_id && course.apres_cours_id.length > 0) {
    constraints.push(`après: ${course.apres_cours_id.join(", ")}`);
  }

  if (course.avant_cours_id && course.avant_cours_id.length > 0) {
    constraints.push(`avant: ${course.avant_cours_id.join(", ")}`);
  }

  if (course.delai_max_valeur !== null && course.delai_max_unite !== null) {
    constraints.push(`délai max: ${course.delai_max_valeur} ${course.delai_max_unite}`);
  }

  if (course.max_par_semaine !== null) {
    constraints.push(`max/semaine: ${course.max_par_semaine}`);
  }

  if (course.jour_specifique) {
    constraints.push(`jour: ${course.jour_specifique}`);
  }

  return constraints.length === 0 ? "aucune contrainte" : constraints.join(" | ");
}

function parseLines(text) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "");
}

function parseJoursFeries(text) {
  return parseLines(text).map(line => ({
    day: line,
    label: "jour férié"
  }));
}

function parseVacances(text) {
  return parseLines(text)
    .map(line => {
      const parts = line.split(",").map(x => x.trim());
      if (parts.length !== 2) return null;
      return {
        start: parts[0],
        end: parts[1],
        label: "vacances"
      };
    })
    .filter(item => item !== null);
}

function parseStages(text) {
  return parseLines(text)
    .map(line => {
      const parts = line.split(",").map(x => x.trim());
      if (parts.length !== 3) return null;
      return {
        stage_id: parts[0],
        start: parts[1],
        end: parts[2],
        label: "stage"
      };
    })
    .filter(item => item !== null);
}

function renderSpecialPeriods(assermentationDate, joursFeries, vacances, stages) {
  const container = document.getElementById("specialPeriods");
  if (!container) return;

  let html = "";

  html += `<p><b>Assermentation :</b> ${formatDateFR(new Date(assermentationDate))}</p>`;

  html += `<h3>Jours fériés</h3>`;
  if (joursFeries.length > 0) {
    html += "<ul>";
    joursFeries.forEach(item => {
      html += `<li>${formatDateFR(new Date(item.day))} - ${item.label}</li>`;
    });
    html += "</ul>";
  } else {
    html += "<p>Aucun jour férié.</p>";
  }

  html += `<h3>Vacances</h3>`;
  if (vacances.length > 0) {
    html += "<ul>";
    vacances.forEach(item => {
      html += `<li>${formatDateFR(new Date(item.start))} au ${formatDateFR(new Date(item.end))} - ${item.label}</li>`;
    });
    html += "</ul>";
  } else {
    html += "<p>Aucune période de vacances.</p>";
  }

  html += `<h3>Stages</h3>`;
  if (stages.length > 0) {
    html += "<ul>";
    stages.forEach(item => {
      html += `<li>${item.stage_id} : ${formatDateFR(new Date(item.start))} au ${formatDateFR(new Date(item.end))} - ${item.label}</li>`;
    });
    html += "</ul>";
  } else {
    html += "<p>Aucun stage.</p>";
  }

  container.innerHTML = html;
}

function isInPeriod(dateIso, startIso, endIso) {
  return dateIso >= startIso && dateIso <= endIso;
}

function getWeekKeyFromISO(isoDate) {
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);

  const dayNum = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNum + 3);

  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);

  const weekNumber = 1 + Math.round((d - firstThursday) / (7 * 24 * 60 * 60 * 1000));

  return `${d.getFullYear()}-S${String(weekNumber).padStart(2, "0")}`;
}

function buildBaseCalendar(dateDebut, dateFin, assermentationDate, joursFeries, vacances, stages) {
  const days = [];
  const current = new Date(dateDebut);
  const end = new Date(dateFin);

  while (current <= end) {
    const iso = formatDateISO(current);
    const dayOfWeek = current.getDay();

    let status = "ouvrable";
    let detail = "";
    let cssClass = "status-open";

    if (iso === assermentationDate) {
      status = "assermentation";
      detail = "journée complète";
      cssClass = "status-assermentation";
    } else {
      const matchingStage = stages.find(item => isInPeriod(iso, item.start, item.end));
      const matchingVacation = vacances.find(item => isInPeriod(iso, item.start, item.end));
      const matchingHoliday = joursFeries.find(item => item.day === iso);

      if (matchingStage) {
        status = "stage";
        detail = matchingStage.stage_id;
        cssClass = "status-stage";
      } else if (matchingVacation) {
        status = "vacances";
        detail = matchingVacation.label;
        cssClass = "status-vacation";
      } else if (matchingHoliday) {
        status = "jour férié";
        detail = matchingHoliday.label;
        cssClass = "status-holiday";
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        status = "week-end";
        detail = "";
        cssClass = "status-weekend";
      }
    }

    days.push({
      iso,
      dateFr: formatDateFR(current),
      jour: getDayNameFR(current),
      status,
      detail,
      cssClass,
      weekKey: getWeekKeyFromISO(iso)
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function renderCalendar(days) {
  const tbody = document.querySelector("#calendarTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  days.forEach(day => {
    const row = `
      <tr class="${day.cssClass}">
        <td>${day.dateFr}</td>
        <td>${day.jour}</td>
        <td>${day.status}</td>
        <td>${day.detail || ""}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

function summarizeCalendar(days) {
  const count = {
    ouvrable: 0,
    weekend: 0,
    ferie: 0,
    vacances: 0,
    stage: 0,
    assermentation: 0
  };

  days.forEach(day => {
    if (day.status === "ouvrable") count.ouvrable++;
    else if (day.status === "week-end") count.weekend++;
    else if (day.status === "jour férié") count.ferie++;
    else if (day.status === "vacances") count.vacances++;
    else if (day.status === "stage") count.stage++;
    else if (day.status === "assermentation") count.assermentation++;
  });

  return count;
}

function renderCalendarSummary(summary) {
  const container = document.getElementById("calendarSummary");
  if (!container) return;

  container.innerHTML = `
    <p><b>Jours ouvrables:</b> ${summary.ouvrable}</p>
    <p><b>Week-end:</b> ${summary.weekend}</p>
    <p><b>Jours fériés:</b> ${summary.ferie}</p>
    <p><b>Vacances:</b> ${summary.vacances}</p>
    <p><b>Stage:</b> ${summary.stage}</p>
    <p><b>Assermentation:</b> ${summary.assermentation}</p>
  `;
}

function getConstraintPriority(course) {
  if (course.ordre_lecon && course.ordre_lecon > 0) {
    return { level: 1, reason: `ordre ${course.ordre_lecon}` };
  }

  if (course.jour_specifique) {
    return { level: 1, reason: `jour spécifique: ${course.jour_specifique}` };
  }

  if (course.delai_max_valeur !== null && course.delai_max_unite !== null) {
    return { level: 2, reason: `délai max: ${course.delai_max_valeur} ${course.delai_max_unite}` };
  }

  if (
    (course.apres_cours_id && course.apres_cours_id.length > 0) ||
    (course.avant_cours_id && course.avant_cours_id.length > 0)
  ) {
    return { level: 3, reason: "dépendances de cours" };
  }

  if (course.type && String(course.type).toLowerCase() === "examen") {
    return { level: 4, reason: "examen" };
  }
    const openDays = calendarDays.filter(day => day.status === "ouvrable");
  const fridayOpenDays = openDays.filter(day => day.dayOfWeek === 5).length;

  const openWeeks = new Set(openDays.map(day => getWeekKeyFromISO(day.iso)));
  const numberOfOpenWeeks = openWeeks.size;

  const standardHours = openDays.length * 8;
  const debriefHours = fridayOpenDays * 1;
  const runningHours = numberOfOpenWeeks * 1.5;

  const realisticCapacity = standardHours - debriefHours - runningHours;

  return {
    openDays: openDays.length,
    fridayOpenDays,
    numberOfOpenWeeks,
    standardHours,
    debriefHours,
    runningHours,
    realisticCapacity
  };
}

function getOrderingPriority(course) {
  if (course.jour_specifique) {
    return { level: 1, reason: `jour spécifique: ${course.jour_specifique}` };
  }

  if (course.delai_max_valeur !== null && course.delai_max_unite !== null) {
    return { level: 2, reason: `délai max: ${course.delai_max_valeur} ${course.delai_max_unite}` };
  }

  if (
    (course.apres_cours_id && course.apres_cours_id.length > 0) ||
    (course.avant_cours_id && course.avant_cours_id.length > 0)
  ) {
    return { level: 3, reason: "dépendance avec autre cours" };
  }

  if (course.ordre_lecon && course.ordre_lecon > 0) {
    return { level: 4, reason: `ordre interne sous-branche: ${course.ordre_lecon}` };
  }

  if (course.max_par_semaine !== null) {
    return { level: 5, reason: `maximum par semaine: ${course.max_par_semaine}` };
  }

  return { level: 6, reason: "aucune contrainte particulière" };
}

function renderOrderingTable(courses) {
  const tbody = document.querySelector("#orderingTable tbody");
  if (!tbody) return [];

  tbody.innerHTML = "";

  const ordered = [...courses]
    .map(course => {
      const ordering = getOrderingPriority(course);
      return {
        ...course,
        orderingLevel: ordering.level,
        orderingReason: ordering.reason
      };
    })
    .sort((a, b) => {
      if (a.orderingLevel !== b.orderingLevel) {
        return a.orderingLevel - b.orderingLevel;
      }

      if ((a.ordre_lecon || 0) !== (b.ordre_lecon || 0)) {
        return (a.ordre_lecon || 0) - (b.ordre_lecon || 0);
      }

      return a.id.localeCompare(b.id);
    });

  ordered.forEach((course, index) => {
    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${course.id}</td>
        <td>${course.lecon}</td>
        <td>${course.orderingLevel}</td>
        <td>${course.orderingReason}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });

  return ordered;
}

function getInitialAvailability(course, allCourses) {
  if (course.apres_cours_id && course.apres_cours_id.length > 0) {
    return {
      status: "bloqué",
      reason: `dépend de: ${course.apres_cours_id.join(", ")}`
    };
  }

  if (course.ordre_lecon && course.ordre_lecon > 1) {
    const previousCourses = allCourses.filter(other =>
      other.sous_branche === course.sous_branche &&
      other.ordre_lecon > 0 &&
      other.ordre_lecon < course.ordre_lecon
    );

    if (previousCourses.length > 0) {
      return {
        status: "bloqué",
        reason: `attend ordre précédent dans ${course.sous_branche}`
      };
    }
  }

  return {
    status: "plaçable",
    reason: "aucun blocage initial"
  };
}

function renderAvailabilityTable(courses) {
  const tbody = document.querySelector("#availabilityTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  courses.forEach(course => {
    const availability = getInitialAvailability(course, courses);

    const row = `
      <tr>
        <td>${course.id}</td>
        <td>${course.lecon}</td>
        <td>${availability.status}</td>
        <td>${availability.reason}</td>
      </tr>
    `;

    tbody.innerHTML += row;
  });
}

function dependenciesSatisfied(course, completed) {
  if (!course.apres_cours_id || course.apres_cours_id.length === 0) {
    return true;
  }

  return course.apres_cours_id.every(id => completed.has(id));
}

function ordreSatisfied(course, completed, courses) {
  if (!course.ordre_lecon || course.ordre_lecon <= 1) {
    return true;
  }

  const previous = courses.filter(c =>
    c.sous_branche === course.sous_branche &&
    c.ordre_lecon > 0 &&
    c.ordre_lecon < course.ordre_lecon
  );

  return previous.every(c => completed.has(c.id));
}

function getAvailableCourses(courses, completed) {
  return courses.filter(course => {
    if (completed.has(course.id)) return false;
    if (!dependenciesSatisfied(course, completed)) return false;
    if (!ordreSatisfied(course, completed, courses)) return false;
    return true;
  });
}

function simulateExecution(courses) {
  const completed = new Set();
  const result = [];
  let step = 1;

  while (completed.size < courses.length) {
    const available = getAvailableCourses(courses, completed);

    if (available.length === 0) {
      result.push({
        step: "ERREUR",
        id: "---",
        lecon: "cycle ou dépendance impossible",
        reason: "vérifier dépendances"
      });
      break;
    }

    available.forEach(course => {
      completed.add(course.id);

      result.push({
        step: step,
        id: course.id,
        lecon: course.lecon,
        reason: "contraintes satisfaites"
      });

      step++;
    });
  }

  return result;
}

function renderSimulation(courses) {
  const tbody = document.querySelector("#simulationTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const simulation = simulateExecution(courses);

  simulation.forEach(item => {
    const row = `
      <tr>
        <td>${item.step}</td>
        <td>${item.id}</td>
        <td>${item.lecon}</td>
        <td>${item.reason}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

function computeSchoolGroups(courses, nombreAspirants) {
  let maxGroups = 1;

  courses.forEach(course => {
    if (course.division === "Oui") {
      const groups = Math.ceil(nombreAspirants / course.participants);
      if (groups > maxGroups) {
        maxGroups = groups;
      }
    }
  });

  const result = [];

  for (let i = 1; i <= maxGroups; i++) {
    result.push({
      id: i,
      name: `Groupe ${i}`
    });
  }

  return result;
}

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
  // Débriefing hebdomadaire injecté seulement si explicitement marqué dans les données.
  // Cela évite de confondre un cours "debriefing retour stage" ou d'information.
  return course.weekly_debrief === true;
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
  ]);

  courses.forEach(course => {
    if (!course.id || String(course.id).trim() === "") {
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

  function dfs(id, stack) {
    if (visiting.has(id)) {
      errors.push(`Cycle détecté dans les dépendances: ${[...stack, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id)) return;

    visiting.add(id);
    const nextIds = graph[id] || [];
    nextIds.forEach(nextId => dfs(nextId, [...stack, id]));
    visiting.delete(id);
    visited.add(id);
  }

  Object.keys(graph).forEach(id => dfs(id, []));

  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)]
  };
}

function renderValidationReport(report) {
  const container = document.getElementById("validationReport");
  if (!container) return;

  let html = "";

  if (report.errors.length === 0 && report.warnings.length === 0) {
    html = `<p><b>Aucune erreur détectée.</b></p>`;
    container.innerHTML = html;
    return;
  }

  if (report.errors.length > 0) {
    html += `<h3>Erreurs bloquantes</h3><ul>`;
    report.errors.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += `</ul>`;
  }

  if (report.warnings.length > 0) {
    html += `<h3>Avertissements</h3><ul>`;
    report.warnings.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += `</ul>`;
  }

  container.innerHTML = html;
}

function sortCoursesForPlanning(courses, schoolStartIso) {
  return [...courses].sort((a, b) => {
    const aDebrief = isDebriefCourse(a) ? 1 : 0;
    const bDebrief = isDebriefCourse(b) ? 1 : 0;
    if (aDebrief !== bDebrief) return aDebrief - bDebrief;

    const aAsser = isAssermentationCourse(a) ? 1 : 0;
    const bAsser = isAssermentationCourse(b) ? 1 : 0;
    if (aAsser !== bAsser) return aAsser - bAsser;

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
        <td>${session.lecon}</td>
        <td>${session.mode}</td>
        <td>${cible}</td>
        <td>${session.duree}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });
}

function createCourseBuckets(batchSessions) {
  const buckets = {};

  batchSessions.forEach(session => {
    if (!buckets[session.courseId]) {
      buckets[session.courseId] = [];
    }

    buckets[session.courseId].push({
      ...session,
      remaining: session.duree
    });
  });

  return buckets;
}

function buildMultiGroupPlanning(courses, calendarDays, groups, nombreAspirants) {
  const openDays = getOpenDays(calendarDays);
  const allDays = calendarDays;
  const schoolStartIso = calendarDays[0]?.iso;
  const sessions = buildRealSessions(courses, groups, nombreAspirants, schoolStartIso);
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

  const result = [];
  let dayIndex = 0;
  let currentMinutes = 8 * 60;
  let sessionIndex = 0;
  let rotationOffset = 0;
  const processedSessionIds = new Set();

  const weekUsage = {};
  const completedCourseIds = new Set();
  const remainingMinutesByCourse = {};
  
sessions.sort((a, b) => {
  if (a.latestAllowedIso && !b.latestAllowedIso) return -1;
  if (!a.latestAllowedIso && b.latestAllowedIso) return 1;

  if (a.latestAllowedIso && b.latestAllowedIso) {
    return a.latestAllowedIso.localeCompare(b.latestAllowedIso);
  }

  return 0;
});

  sessions.forEach(session => {
    if (!remainingMinutesByCourse[session.courseId]) {
      remainingMinutesByCourse[session.courseId] = 0;
    }
    remainingMinutesByCourse[session.courseId] += session.duree;
  });

function markCourseMinutes(courseId, minutes) {
  if (remainingMinutesByCourse[courseId] === undefined) return;

  remainingMinutesByCourse[courseId] -= minutes;

  if (remainingMinutesByCourse[courseId] <= 0) {
    remainingMinutesByCourse[courseId] = 0;
    completedCourseIds.add(courseId);
  }
}

  function addWeekUsage(courseId, isoWeek) {
    if (!weekUsage[courseId]) weekUsage[courseId] = {};
    if (!weekUsage[courseId][isoWeek]) weekUsage[courseId][isoWeek] = 0;
    weekUsage[courseId][isoWeek] += 1;
  }

  function getWeekUsage(courseId, isoWeek) {
    return weekUsage[courseId]?.[isoWeek] || 0;
  }

  function getIsoWeekForOpenDay(index) {
    if (index < 0 || index >= openDays.length) return null;
    return getWeekKeyFromISO(openDays[index].iso);
  }

  function nextSlot() {
    if (currentMinutes >= 12 * 60 && currentMinutes < 13 * 60 + 30) {
      currentMinutes = 13 * 60 + 30;
    }

    if (currentMinutes >= 17 * 60 + 30) {
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

  function findNextReadySessionIndex() {
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      if (processedSessionIds.has(session.sessionId)) continue;
      const course = courseMap[session.courseId];
      if (!course) continue;

      if (courseIsReady(course, completedCourseIds, courseMap)) {
        return i;
      }
    }
    return -1;
  }

	let safety = 0;
  while (processedSessionIds.size < sessions.length) {
  safety++;
if (safety > 10000) {
  console.error("Boucle infinie détectée", {
  sessionIndex,
  dayIndex,
  currentMinutes
});
  break;
}
    const readyIndex = findNextReadySessionIndex();
    if (readyIndex === -1) {
      break;
    }

    sessionIndex = readyIndex;
    const session = sessions[sessionIndex];

    // CAS 0 : assermentation à date fixe
    if (session.mode === "fixed_full_day") {
      const assermentationInput = document.getElementById("assermentationInput");
      const fixedDate = assermentationInput ? assermentationInput.value : null;

      if (fixedDate) {
        const fixedDayIndex = findDayIndexByIso(fixedDate);
        if (fixedDayIndex >= 0) {
          const fixedDay = allDays[fixedDayIndex];

          const blocks = [
            ["08:00", "12:00", 240],
            ["13:30", "17:30", 240]
          ];

          blocks.forEach(block => {
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

      processedSessionIds.add(session.sessionId);
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
        processedSessionIds.add(session.sessionId);
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

      processedSessionIds.add(session.sessionId);
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
        processedSessionIds.add(session.sessionId);
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
        });

        currentMinutes += slot;
        remaining -= slot;
        markCourseMinutes(session.courseId, slot);

        nextSlot();
        if (remaining > 0) {
          dayIndex = findNextValidDayIndex(dayIndex, session.jour_specifique);
        }
      }

      processedSessionIds.add(session.sessionId);
      continue;
    }

    // CAS 3 : non simultané continu
    const batchJour = session.jour_specifique || "";
    const batch = [];

while (
  sessionIndex < sessions.length &&
  sessions[sessionIndex].mode === "non_simultane"
) {
  const candidate = sessions[sessionIndex];
  const candidateCourse = courseMap[candidate.courseId];

  // 🔴 AJOUT CRITIQUE
  if (!courseIsReady(candidateCourse, completedCourseIds, courseMap)) {
    break;
  }

  if ((candidate.jour_specifique || "") !== batchJour) {
    break;
  }

  batch.push({
    ...candidate,
    remaining: candidate.duree
  });
  processedSessionIds.add(candidate.sessionId);

  sessionIndex++;
}

    const buckets = {};
    batch.forEach(s => {
      if (!buckets[s.courseId]) buckets[s.courseId] = [];
      buckets[s.courseId].push(s);
    });

    const courseIds = Object.keys(buckets);

    while (courseIds.some(courseId => buckets[courseId].some(s => s.remaining > 0))) {
      const rotatedGroups = getRotatedGroups();

      const activeSessions = [];
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

            assignment.session.remaining -= 30;
            markCourseMinutes(assignment.session.courseId, 30);
          } else {
            result.push({
              date: openDays[dayIndex].dateFr,
              time: minutesToTimeString(start) + "-" + minutesToTimeString(end),
              groupe: assignment.groupName,
              id: "",
              lecon: "à dispo des instructeurs",
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
        id: debriefCourse.id,
        lecon: debriefCourse.lecon,
        duree: 60
      });
    });
  }

  return result;
}

function renderPlanning(planning) {
  const tbody = document.querySelector("#planningTable tbody");
  if (!tbody) {
  console.warn("Table non trouvée");
  return;
}

  tbody.innerHTML = "";

  function frDateToSortable(dateFr) {
    const [day, month, year] = dateFr.split(".");
    return `${year}-${month}-${day}`;
  }

  const parsed = planning.map(row => {
    const [startTime, endTime] = row.time.split("-");
    return {
      date: row.date,
      sortableDate: frDateToSortable(row.date),
      startTime,
      endTime,
      groupe: row.groupe,
      id: row.id || "",
      lecon: row.lecon || "",
      duree: row.duree
    };
  });

  parsed.sort((a, b) => {
    if (a.sortableDate !== b.sortableDate) return a.sortableDate.localeCompare(b.sortableDate);
    if (a.groupe !== b.groupe) return a.groupe.localeCompare(b.groupe);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    return a.lecon.localeCompare(b.lecon);
  });

  const merged = [];

  parsed.forEach(row => {
    const last = merged[merged.length - 1];

    if (
      last &&
      last.sortableDate === row.sortableDate &&
      last.groupe === row.groupe &&
      last.id === row.id &&
      last.lecon === row.lecon &&
      last.endTime === row.startTime
    ) {
      last.endTime = row.endTime;
      last.duree += row.duree;
    } else {
      merged.push({
        date: row.date,
        sortableDate: row.sortableDate,
        startTime: row.startTime,
        endTime: row.endTime,
        groupe: row.groupe,
        id: row.id,
        lecon: row.lecon,
        duree: row.duree
      });
    }
  });

  merged.sort((a, b) => {
      if (a.sortableDate !== b.sortableDate) return a.sortableDate.localeCompare(b.sortableDate);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.groupe !== b.groupe) return a.groupe.localeCompare(b.groupe);
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    return a.lecon.localeCompare(b.lecon);
  });

  merged.forEach(row => {
    const html = `
      <tr>
        <td>${row.date}</td>
        <td>${row.startTime}-${row.endTime}</td>
        <td>${row.groupe}</td>
        <td>${row.id}</td>
        <td>${row.lecon}</td>
        <td>${row.duree}</td>
      </tr>
    `;
    tbody.innerHTML += html;
  });
}

async function loadData() {
  const school = await fetch("data/school_params.json").then(r => r.json());
  const courses = await fetch("data/courses.json").then(r => r.json());

  const validation = validateCourses(courses);
renderValidationReport(validation);

if (validation.errors.length > 0) {
  document.getElementById("summary").innerHTML = `
    <p><b>Planification bloquée.</b></p>
    <p>Corrigez d'abord les erreurs dans le catalogue.</p>
  `;
  renderOrderingTable(courses);
  renderAvailabilityTable(courses);
  renderSimulation(courses);
  renderGroups([]);
  renderRealSessionsTable([]);
  renderPlanning([]);
  return;
}

  const dateDebut = document.getElementById("dateDebutInput").value || school.date_debut;
  const nombreAspirants = Number(document.getElementById("aspirantsInput").value);
  const assermentationDate = document.getElementById("assermentationInput").value || school.date_assermentation;

  const joursFeries = parseJoursFeries(document.getElementById("joursFeriesInput").value);
  const vacances = parseVacances(document.getElementById("vacancesInput").value);
  const stages = parseStages(document.getElementById("stagesInput").value);

  let totalMinutes = 0;
  let totalSessions = 0;
  let totalEncadrantsSimultanes = 0;
  let totalVehicules = 0;
  let totalSallesSupp = 0;
  let totalCoursSansContrainte = 0;
  let totalMinutesSansContrainte = 0;

  const tbody = document.querySelector("#coursesTable tbody");
  if (tbody) {
    tbody.innerHTML = "";

    courses.forEach(course => {
      let groupes = 1;

      if (course.division === "Oui") {
        groupes = Math.ceil(nombreAspirants / course.participants);
      }

      let seances = 1;

      if (course.simultane === "Non") {
        seances = groupes;
      }

      const minutes = course.duree * seances;
      const heures = (minutes / 60).toFixed(1);

      let encadrantsTotal = course.encadrants;

      if (course.simultane === "Oui") {
        encadrantsTotal = course.encadrants * groupes;
      }

      const vehicules = Math.ceil(nombreAspirants / 13);

      let sallesSup = 0;
      if (course.simultane === "Oui") {
        sallesSup = Math.max(groupes - 1, 0);
      }

      const contrainte = getConstraintLabel(course);
      const sansContrainte = contrainte === "aucune contrainte";

      totalMinutes += minutes;
      totalSessions += seances;
      totalEncadrantsSimultanes += encadrantsTotal;
      totalVehicules += vehicules;
      totalSallesSupp += sallesSup;

      if (sansContrainte) {
        totalCoursSansContrainte += 1;
        totalMinutesSansContrainte += minutes;
      }

      const row = `
        <tr>
          <td>${course.id}</td>
          <td>${course.lecon}</td>
          <td>${course.type}</td>
          <td>${course.duree}</td>
          <td>${course.participants}</td>
          <td>${course.division}</td>
          <td>${course.simultane}</td>
          <td>${groupes}</td>
          <td>${seances}</td>
          <td>${heures}</td>
          <td>${encadrantsTotal}</td>
          <td>${vehicules}</td>
          <td>${sallesSup}</td>
          <td>${contrainte}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  }

  const totalHours = totalMinutes / 60;
  const minimumEndDate = addMonthsToDate(dateDebut, 8);
  const heuresSansContrainte = (totalMinutesSansContrainte / 60).toFixed(1);

  renderSpecialPeriods(assermentationDate, joursFeries, vacances, stages);

  const calendarDays = buildBaseCalendar(
    dateDebut,
    formatDateISO(minimumEndDate),
    assermentationDate,
    joursFeries,
    vacances,
    stages
  );

  const calendarStats = renderBaseCalendar(calendarDays);
  const capacityStats = computeRealisticCapacity(calendarDays);

  renderOrderingTable(courses);
  renderAvailabilityTable(courses);
  renderSimulation(courses);

  const groups = computeSchoolGroups(courses, nombreAspirants);
  renderGroups(groups);

  const realSessions = buildRealSessions(courses, groups, nombreAspirants);
  renderRealSessionsTable(realSessions);

  const planning = buildMultiGroupPlanning(courses, calendarDays, groups, nombreAspirants);
  renderPlanning(planning);

  const capaciteHeuresStandard = capacityStats.standardHours;
  const capaciteHeuresRealiste = capacityStats.realisticCapacity;
  const ecartStandard = (capaciteHeuresStandard - totalHours).toFixed(1);
  const ecartRealiste = (capaciteHeuresRealiste - totalHours).toFixed(1);

  const tientStandard = Number(ecartStandard) >= 0 ? "oui" : "non";
  const tientRealiste = Number(ecartRealiste) >= 0 ? "oui" : "non";

  const summary = document.getElementById("summary");
  if (summary) {
    summary.innerHTML = `
      <p><b>École :</b> ${school.nom_ecole}</p>
      <p><b>Date début :</b> ${formatDateFR(new Date(dateDebut))}</p>
      <p><b>Nombre d’aspirants :</b> ${nombreAspirants}</p>
      <p><b>Total séances :</b> ${totalSessions}</p>
      <p><b>Heures totales à placer :</b> ${totalHours.toFixed(1)}</p>
      <p><b>Date fin minimale (8 mois) :</b> ${formatDateFR(minimumEndDate)}</p>
      <hr>
      <p><b>Jours ouvrables disponibles :</b> ${calendarStats.countOuvrables}</p>
      <p><b>Vendredis ouvrables :</b> ${capacityStats.fridayOpenDays}</p>
      <p><b>Semaines avec jours ouvrables :</b> ${capacityStats.numberOfOpenWeeks}</p>
      <p><b>Capacité standard (8h/jour) :</b> ${capaciteHeuresStandard.toFixed(1)} h</p>
      <p><b>Retrait débriefings vendredi :</b> -${capacityStats.debriefHours.toFixed(1)} h</p>
      <p><b>Retrait course à pied hebdomadaire :</b> -${capacityStats.runningHours.toFixed(1)} h</p>
      <p><b>Capacité réaliste estimée :</b> ${capaciteHeuresRealiste.toFixed(1)} h</p>
      <p><b>Écart standard capacité - charge :</b> ${ecartStandard} h</p>
      <p><b>Écart réaliste capacité - charge :</b> ${ecartRealiste} h</p>
      <p><b>Ça tient théoriquement dans 8 mois (standard) :</b> ${tientStandard}</p>
      <p><b>Ça tient théoriquement dans 8 mois (réaliste) :</b> ${tientRealiste}</p>
      <hr>
      <p><b>Cours sans contrainte :</b> ${totalCoursSansContrainte}</p>
      <p><b>Heures sans contrainte :</b> ${heuresSansContrainte}</p>
      <p><b>Total encadrants simultanés (somme théorique) :</b> ${totalEncadrantsSimultanes}</p>
      <p><b>Total véhicules D1 (somme théorique) :</b> ${totalVehicules}</p>
      <p><b>Total salles supplémentaires (somme théorique) :</b> ${totalSallesSupp}</p>
    `;
  }
}

async function initializeForm() {
  const school = await fetch("data/school_params.json").then(r => r.json());

  document.getElementById("dateDebutInput").value = school.date_debut;
  document.getElementById("aspirantsInput").value = school.nombre_aspirants;
  document.getElementById("assermentationInput").value = school.date_assermentation;

  const joursFeriesText = (school.jours_feries || [])
    .map(item => item.day)
    .join("\n");

  const vacancesText = (school.vacances || [])
    .map(item => `${item.start},${item.end}`)
    .join("\n");

  const stagesText = (school.stages || [])
    .map(item => `${item.stage_id},${item.start},${item.end}`)
    .join("\n");

  document.getElementById("joursFeriesInput").value = joursFeriesText;
  document.getElementById("vacancesInput").value = vacancesText;
  document.getElementById("stagesInput").value = stagesText;

  loadData();
}

window.addEventListener("DOMContentLoaded", initializeForm);
