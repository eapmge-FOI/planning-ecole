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

function getExecutionType(division, simultane) {
  if (division === 'Non') {
    return 'Commune';
  }
  if (simultane === 'Oui') {
    return 'Simultané';
  }
  return 'Séquentiel';
}

async function calculateLoad() {
  const nombreAspirants = parseInt(document.getElementById('aspirantsInput').value);
  
  if (!nombreAspirants || nombreAspirants < 1) {
    alert('Veuillez entrer un nombre d\'aspirants valide');
    return;
  }

  const courses = await loadCourses();
  const school = await loadSchoolParams();

  let totalMinutes = 0;
  let commonMinutes = 0;
  let divided2Minutes = 0;
  let divided3PlusMinutes = 0;

  const courseDetails = courses.map(course => {
    const numGroups = calculateNumberOfGroups(course, nombreAspirants);
    const executionType = getExecutionType(course.division, course.simultane);
    
    let courseMinutes;
    if (course.division === 'Non') {
      // Pas de division = une seule session
      courseMinutes = course.duree;
      commonMinutes += courseMinutes;
    } else if (course.simultane === 'Oui') {
      // Division avec simultané = groupes en parallèle
      courseMinutes = course.duree;
      commonMinutes += courseMinutes;
    } else {
      // Division sans simultané = groupes séquentiels
      courseMinutes = course.duree * numGroups;
      if (numGroups === 2) {
        divided2Minutes += courseMinutes;
      } else if (numGroups > 2) {
        divided3PlusMinutes += courseMinutes;
      }
    }

    totalMinutes += courseMinutes;

    return {
      id: course.id,
      branche: course.branche,
      lecon: course.lecon,
      duree: course.duree,
      participants: course.participants,
      numGroups: numGroups,
      executionType: executionType,
      totalMinutes: courseMinutes,
      totalHours: (courseMinutes / 60).toFixed(2)
    };
  });

  const totalHours = (totalMinutes / 60).toFixed(1);
  
  // Calcul des heures à dispo : 2 heures par semaine
  // Semaines estimées = heures séquentielles / 40 (5 jours * 8h)
  const sequentialHours = (divided2Minutes + divided3PlusMinutes) / 60;
  const commonHours = commonMinutes / 60;
  const estimatedWeeks = sequentialHours / 40;
  const disposoHours = (estimatedWeeks * 2).toFixed(1);
  const totalWithDispo = (parseFloat(totalHours) + parseFloat(disposoHours)).toFixed(1);

  // Afficher le résumé
  document.getElementById('totalHours').textContent = totalHours;
  document.getElementById('disposoHours').textContent = disposoHours;
  document.getElementById('totalWithDispo').textContent = totalWithDispo;

  // Afficher la répartition
  const commonHoursFormatted = (commonMinutes / 60).toFixed(1);
  const divided2HoursFormatted = (divided2Minutes / 60).toFixed(1);
  const divided3PlusHoursFormatted = (divided3PlusMinutes / 60).toFixed(1);

  document.getElementById('commonHours').textContent = commonHoursFormatted + ' h';
  document.getElementById('divided2Hours').textContent = divided2HoursFormatted + ' h';
  document.getElementById('divided3PlusHours').textContent = divided3PlusHoursFormatted + ' h';

  // Calculer les widths des barres (proportionnelles)
  const maxHours = Math.max(commonMinutes, divided2Minutes, divided3PlusMinutes, 1);
  document.getElementById('commonBar').style.width = ((commonMinutes / maxHours) * 100) + '%';
  document.getElementById('divided2Bar').style.width = ((divided2Minutes / maxHours) * 100) + '%';
  document.getElementById('divided3PlusBar').style.width = ((divided3PlusMinutes / maxHours) * 100) + '%';

  // Afficher le tableau
  const tbody = document.querySelector('#coursesTable tbody');
  tbody.innerHTML = '';
  
  courseDetails.forEach(detail => {
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

  // Afficher les cartes
  document.getElementById('summaryCard').style.display = 'block';
  document.getElementById('breakdownCard').style.display = 'block';
  document.getElementById('tableCard').style.display = 'block';
}

// Charger les données au démarrage et initialiser
document.addEventListener('DOMContentLoaded', async () => {
  const school = await loadSchoolParams();
  document.getElementById('aspirantsInput').value = school.nombre_aspirants;
});
