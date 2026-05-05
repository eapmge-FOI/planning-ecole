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

function matchDividedCourses(courses, nombreAspirants) {
  // Séparer les cours divisés non-simultanés
  const dividedNonSimCourses = courses
    .map((course, index) => ({
      ...course,
      originalIndex: index,
      numGroups: calculateNumberOfGroups(course, nombreAspirants)
    }))
    .filter(course => course.division === 'Oui' && course.simultane === 'Non');

  // Créer des "slots" de durée pour le matching
  const durationGroups = {};
  dividedNonSimCourses.forEach(course => {
    if (!durationGroups[course.duree]) {
      durationGroups[course.duree] = [];
    }
    durationGroups[course.duree].push(course);
  });

  // Matching : créer des paires
  const matched = new Set();
  const pairs = [];
  const unmatched = [];

  Object.keys(durationGroups).forEach(duration => {
    const coursesOfSameDuration = durationGroups[duration];
    
    for (let i = 0; i < coursesOfSameDuration.length - 1; i += 2) {
      const course1 = coursesOfSameDuration[i];
      const course2 = coursesOfSameDuration[i + 1];
      
      pairs.push([course1, course2]);
      matched.add(course1.originalIndex);
      matched.add(course2.originalIndex);
    }

    if (coursesOfSameDuration.length % 2 === 1) {
      const lastCourse = coursesOfSameDuration[coursesOfSameDuration.length - 1];
      unmatched.push(lastCourse);
    }
  });

  return {
    pairs,
    unmatched,
    matchedIndices: matched
  };
}

async function calculateLoad() {
  const nombreAspirants = parseInt(document.getElementById('aspirantsInput').value);
  
  if (!nombreAspirants || nombreAspirants < 1) {
    alert('Veuillez entrer un nombre d\'aspirants valide');
    return;
  }

  const courses = await loadCourses();
  const school = await loadSchoolParams();

  const matchingResult = matchDividedCourses(courses, nombreAspirants);

  let totalMinutes = 0;
  let commonMinutes = 0;
  let divided2Minutes = 0;
  let divided3PlusMinutes = 0;
  let unpairedMinutes = 0;
  let coursesProcessed = 0;

  const courseDetails = [];

  // 1. Traiter les cours non-divisés
  courses.forEach((course, index) => {
    if (course.division === 'Non') {
      const courseMinutes = course.duree;
      totalMinutes += courseMinutes;
      commonMinutes += courseMinutes;
      coursesProcessed++;

      courseDetails.push({
        id: course.id,
        branche: course.branche,
        lecon: course.lecon,
        duree: course.duree,
        participants: course.participants,
        numGroups: 1,
        executionType: 'Commune',
        totalMinutes: courseMinutes,
        totalHours: (courseMinutes / 60).toFixed(2)
      });
    }
  });

  // 2. Traiter les cours simultanés
  courses.forEach((course, index) => {
    if (course.division === 'Oui' && course.simultane === 'Oui') {
      const numGroups = calculateNumberOfGroups(course, nombreAspirants);
      const courseMinutes = course.duree;
      totalMinutes += courseMinutes;
      commonMinutes += courseMinutes;
      coursesProcessed++;

      courseDetails.push({
        id: course.id,
        branche: course.branche,
        lecon: course.lecon,
        duree: course.duree,
        participants: course.participants,
        numGroups: numGroups,
        executionType: 'Simultané',
        totalMinutes: courseMinutes,
        totalHours: (courseMinutes / 60).toFixed(2)
      });
    }
  });

  // 3. Traiter les paires de cours
  matchingResult.pairs.forEach(([course1, course2]) => {
    const courseMinutes = course1.duree;
    const numGroups = course1.numGroups;
    totalMinutes += courseMinutes;
    
    if (numGroups === 2) {
      divided2Minutes += courseMinutes;
    } else if (numGroups > 2) {
      divided3PlusMinutes += courseMinutes;
    }

    coursesProcessed += 2;

    courseDetails.push({
      id: course1.id,
      branche: course1.branche,
      lecon: course1.lecon,
      duree: course1.duree,
      participants: course1.participants,
      numGroups: numGroups,
      executionType: 'Séquentiel (appairé)',
      totalMinutes: courseMinutes,
      totalHours: (courseMinutes / 60).toFixed(2)
    });

    courseDetails.push({
      id: course2.id,
      branche: course2.branche,
      lecon: course2.lecon,
      duree: course2.duree,
      participants: course2.participants,
      numGroups: numGroups,
      executionType: 'Séquentiel (appairé)',
      totalMinutes: courseMinutes,
      totalHours: (courseMinutes / 60).toFixed(2)
    });
  });

  // 4. Traiter les cours non-appairés
  matchingResult.unmatched.forEach(course => {
    const numGroups = course.numGroups;
    const courseMinutes = course.duree * numGroups;
    totalMinutes += courseMinutes;
    unpairedMinutes += courseMinutes;

    coursesProcessed++;

    courseDetails.push({
      id: course.id,
      branche: course.branche,
      lecon: course.lecon,
      duree: course.duree,
      participants: course.participants,
      numGroups: numGroups,
      executionType: 'Séquentiel (non-appairé)',
      totalMinutes: courseMinutes,
      totalHours: (courseMinutes / 60).toFixed(2)
    });
  });

  // Calcul des heures
  const totalHours = (totalMinutes / 60).toFixed(1);
  
  const estimatedWeeks = (unpairedMinutes / 60) / 40;
  let disposoHours = estimatedWeeks * 2;
  
  if (unpairedMinutes > 0 && disposoHours < 2) {
    disposoHours = 2;
  }
  if (unpairedMinutes === 0) {
    disposoHours = 0;
  }
  
  disposoHours = disposoHours.toFixed(1);
  const totalWithDispo = (parseFloat(totalHours) + parseFloat(disposoHours)).toFixed(1);

  // Afficher le résumé
  document.getElementById('coursesCount').textContent = coursesProcessed;
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

  // Calculer les widths des barres
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

  // Ajouter la ligne "À dispo des instructeurs" si besoin
  if (parseFloat(disposoHours) > 0) {
    const row = document.createElement('tr');
    row.style.fontWeight = 'bold';
    row.style.backgroundColor = '#fff3cd';
    row.innerHTML = `
      <td colspan="6">À dispo des instructeurs</td>
      <td>${disposoHours}</td>
    `;
    tbody.appendChild(row);
  }

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
