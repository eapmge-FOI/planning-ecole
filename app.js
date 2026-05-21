async function loadCourses() {
  const response = await fetch('data/courses.json');
  return response.json();
}

async function loadSchoolParams() {
  const response = await fetch('data/school_params.json');
  return response.json();
}

function calculateNumberOfGroups(course, nombreAspirants) {
  if (course.division === 'Non') {
    return 1;
  }
  return Math.ceil(nombreAspirants / course.participants);
}

function getExecutionType(course, numGroups) {
  if (course.division === 'Non' || numGroups === 1) {
    return 'Commune';
  }
  if (course.simultane === 'Oui') {
    return 'Divisée simultanée';
  }
  return 'Divisée séquentielle';
}

function computeCourseMinutes(course, nombreAspirants) {
  const numGroups = calculateNumberOfGroups(course, nombreAspirants);
  const isDivided = course.division === 'Oui' && numGroups > 1;
  const isSimultaneousDivision = isDivided && course.simultane === 'Oui';
  const isSequentialDivision = isDivided && course.simultane === 'Non';

  // Temps "calendrier école":
  // - Non divisé => 1x durée
  // - Divisé + simultané => 1x durée
  // - Divisé + non simultané => durée * nb groupes
  const effectiveMinutes = isSequentialDivision ? course.duree * numGroups : course.duree;

  return {
    numGroups,
    isSimultaneousDivision,
    isSequentialDivision,
    effectiveMinutes,
  };
}

async function calculateLoad() {
  const nombreAspirants = parseInt(document.getElementById('aspirantsInput').value, 10);

  if (!Number.isInteger(nombreAspirants) || nombreAspirants < 1) {
    alert("Veuillez entrer un nombre d'aspirants valide");
    return;
  }

  const courses = await loadCourses();

  let totalMinutes = 0; // Minutes calendrier école
  let commonMinutes = 0;
  let simultaneousMinutes = 0;
  let sequential2Minutes = 0;
  let sequential3PlusMinutes = 0;
  let instructorDispoMinutes = 0;
  let sequentialDispoMinutes = 0;
  let coursesProcessed = 0;

  const courseDetails = [];

  courses.forEach((course) => {
    const {
      numGroups,
      isSimultaneousDivision,
      isSequentialDivision,
      effectiveMinutes,
    } = computeCourseMinutes(course, nombreAspirants);

    totalMinutes += effectiveMinutes;
    coursesProcessed += 1;

    // Répartition affichée
    if (isSimultaneousDivision) {
      simultaneousMinutes += effectiveMinutes;
    } else if (isSequentialDivision && numGroups === 2) {
      sequential2Minutes += effectiveMinutes;
    } else if (isSequentialDivision) {
      sequential3PlusMinutes += effectiveMinutes;
    } else {
      commonMinutes += effectiveMinutes;
    }

    // Règle métier:
    // Si division=Oui, simultane=Non et duree > 240,
    // alors le "reste de l'école" est à dispo des instructeurs.
    // On compte ici le surplus séquentiel: (groupes - 1) * durée.
    if (isSequentialDivision && course.duree > 240) {
      sequentialDispoMinutes += (numGroups - 1) * course.duree;
    }

    courseDetails.push({
      id: course.id,
      branche: course.branche,
      lecon: course.lecon,
      duree: course.duree,
      participants: course.participants,
      numGroups,
      executionType: getExecutionType(course, numGroups),
      totalMinutes: effectiveMinutes,
      totalHours: (effectiveMinutes / 60).toFixed(2),
    });
  });

  // +2h / semaine d'école (base 40h/semaine)
  // Arrondi à la semaine supérieure si au moins un cours.
  const baseWeeks = totalMinutes > 0 ? Math.ceil(totalMinutes / (40 * 60)) : 0;
  const weeklyInstructorDispoMinutes = baseWeeks * 120;
  instructorDispoMinutes = sequentialDispoMinutes + weeklyInstructorDispoMinutes;

  const totalHours = (totalMinutes / 60).toFixed(1);
  const disposoHours = (instructorDispoMinutes / 60).toFixed(1);
  const dispoHoursPerAspirant = (instructorDispoMinutes / 60 / nombreAspirants).toFixed(2);
  const totalWithDispo = (parseFloat(totalHours) + parseFloat(disposoHours)).toFixed(1);

  // Résumé
  document.getElementById('coursesCount').textContent = coursesProcessed;
  document.getElementById('totalHours').textContent = totalHours;
  document.getElementById('disposoHours').textContent = disposoHours;
  document.getElementById('disposoHoursPerAspirant').textContent = dispoHoursPerAspirant;
  document.getElementById('totalWithDispo').textContent = totalWithDispo;

  // Répartition
  const commonHoursFormatted = (commonMinutes / 60).toFixed(1);
  const simultaneousHoursFormatted = (simultaneousMinutes / 60).toFixed(1);
  const sequential2HoursFormatted = (sequential2Minutes / 60).toFixed(1);
  const sequential3PlusHoursFormatted = (sequential3PlusMinutes / 60).toFixed(1);

  document.getElementById('commonHours').textContent = commonHoursFormatted + ' h';
  document.getElementById('simultaneousHours').textContent = simultaneousHoursFormatted + ' h';
  document.getElementById('sequential2Hours').textContent = sequential2HoursFormatted + ' h';
  document.getElementById('sequential3PlusHours').textContent = sequential3PlusHoursFormatted + ' h';

  const maxMinutes = Math.max(
    commonMinutes,
    simultaneousMinutes,
    sequential2Minutes,
    sequential3PlusMinutes,
    1,
  );
  document.getElementById('commonBar').style.width = ((commonMinutes / maxMinutes) * 100) + '%';
  document.getElementById('simultaneousBar').style.width = ((simultaneousMinutes / maxMinutes) * 100) + '%';
  document.getElementById('sequential2Bar').style.width = ((sequential2Minutes / maxMinutes) * 100) + '%';
  document.getElementById('sequential3PlusBar').style.width = ((sequential3PlusMinutes / maxMinutes) * 100) + '%';

  // Tableau
  const tbody = document.querySelector('#coursesTable tbody');
  tbody.innerHTML = '';

  courseDetails.forEach((detail) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${detail.id}</td>
      <td>${detail.branche}</td>
      <td>${detail.lecon}</td>
      <td>${detail.duree}</td>
      <td>${detail.numGroups}</td>
      <td>${detail.executionType}</td>
      <td>${detail.totalHours}</td>
    `;
    tbody.appendChild(row);
  });

  if (parseFloat(disposoHours) > 0) {
    const row = document.createElement('tr');
    row.style.fontWeight = 'bold';
    row.style.backgroundColor = '#fff3cd';
    row.innerHTML = `
      <td colspan="6">À dispo des instructeurs (séquentiel long + 2h/semaine école)</td>
      <td>${disposoHours}</td>
    `;
    tbody.appendChild(row);
  }

  // Afficher les cartes
  document.getElementById('summaryCard').style.display = 'block';
  document.getElementById('breakdownCard').style.display = 'block';
  document.getElementById('tableCard').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', async () => {
  const school = await loadSchoolParams();
  document.getElementById('aspirantsInput').value = school.nombre_aspirants;
});
