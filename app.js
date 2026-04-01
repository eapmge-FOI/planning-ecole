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

async function loadData() {
  const school = await fetch("data/school_params.json").then(r => r.json());
  const courses = await fetch("data/courses.json").then(r => r.json());

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

  const totalHours = (totalMinutes / 60).toFixed(1);
  const minimumEndDate = addMonthsToDate(dateDebut, 8);
  const heuresSansContrainte = (totalMinutesSansContrainte / 60).toFixed(1);

  document.getElementById("summary").innerHTML = `
    <p><b>École :</b> ${school.nom_ecole}</p>
    <p><b>Date début :</b> ${formatDateFR(new Date(dateDebut))}</p>
    <p><b>Nombre d’aspirants :</b> ${nombreAspirants}</p>
    <p><b>Total séances :</b> ${totalSessions}</p>
    <p><b>Heures totales :</b> ${totalHours}</p>
    <p><b>Date fin minimale (8 mois) :</b> ${formatDateFR(minimumEndDate)}</p>
    <hr>
    <p><b>Cours sans contrainte :</b> ${totalCoursSansContrainte}</p>
    <p><b>Heures sans contrainte :</b> ${heuresSansContrainte}</p>
    <p><b>Total encadrants simultanés (somme théorique) :</b> ${totalEncadrantsSimultanes}</p>
    <p><b>Total véhicules D1 (somme théorique) :</b> ${totalVehicules}</p>
    <p><b>Total salles supplémentaires (somme théorique) :</b> ${totalSallesSupp}</p>
  `;

  renderSpecialPeriods(assermentationDate, joursFeries, vacances, stages);
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
