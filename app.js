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

async function loadData() {
  const school = await fetch("data/school_params.json").then(r => r.json());
  const courses = await fetch("data/courses.json").then(r => r.json());

  const aspirantsInput = document.getElementById("aspirantsInput");
  const nombreAspirants = Number(aspirantsInput.value);

  let totalMinutes = 0;
  let totalSessions = 0;

  const tbody = document.querySelector("#coursesTable tbody");
  tbody.innerHTML = "";

  courses.forEach(course => {
    const groups = Math.ceil(nombreAspirants / course.participants_max);
    const minutes = course.duree * groups;
    const hours = minutes / 60;

    totalMinutes += minutes;
    totalSessions += groups;

    const row = `
      <tr>
        <td>${course.id}</td>
        <td>${course.lecon}</td>
        <td>${course.duree}</td>
        <td>${course.participants_max}</td>
        <td>${groups}</td>
        <td>${groups}</td>
        <td>${hours}</td>
      </tr>
    `;

    tbody.innerHTML += row;
  });

  const totalHours = totalMinutes / 60;
  const minimumEndDate = addMonthsToDate(school.date_debut, 8);

  document.getElementById("summary").innerHTML = `
    <p><b>École :</b> ${school.nom_ecole}</p>
    <p><b>Date de début :</b> ${formatDateFR(new Date(school.date_debut))}</p>
    <p><b>Nombre d’aspirants :</b> ${nombreAspirants}</p>
    <p><b>Total cours catalogue :</b> ${courses.length}</p>
    <p><b>Total séances réelles :</b> ${totalSessions}</p>
    <p><b>Volume total minutes :</b> ${totalMinutes}</p>
    <p><b>Volume total heures :</b> ${totalHours}</p>
    <p><b>Date de fin minimale (8 mois) :</b> ${formatDateFR(minimumEndDate)}</p>
  `;
}

window.addEventListener("DOMContentLoaded", loadData);
