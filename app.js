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

async function loadData() {
  const school = await fetch("data/school_params.json").then(r => r.json());
  const courses = await fetch("data/courses.json").then(r => r.json());

  const dateDebutInput = document.getElementById("dateDebutInput");
  const aspirantsInput = document.getElementById("aspirantsInput");

  const dateDebut = dateDebutInput.value || school.date_debut;
  const nombreAspirants = Number(aspirantsInput.value);

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
}

async function initializeForm() {
  const school = await fetch("data/school_params.json").then(r => r.json());

  document.getElementById("dateDebutInput").value = school.date_debut;
  document.getElementById("aspirantsInput").value = school.nombre_aspirants;

  loadData();
}

window.addEventListener("DOMContentLoaded", initializeForm);
