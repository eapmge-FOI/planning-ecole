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

function formatHours(minutes, decimals = 1) {
  return (minutes / 60).toFixed(decimals);
}

function createCategory(label) {
  return {
    label,
    courses: [],
    minutes: 0,
    dispoMinutes: 0,
    dispoReasons: [],
    rotationGroups: [],
  };
}

function addDispoReason(category, minutes, reason) {
  category.dispoReasons.push({ minutes, reason });
}

function findBestHalfPartition(courses) {
  const totalMinutes = courses.reduce((sum, course) => sum + course.duree, 0);
  const target = Math.floor(totalMinutes / 2);
  const reachable = new Map([[0, null]]);

  courses.forEach((course, index) => {
    Array.from(reachable.keys())
      .sort((a, b) => b - a)
      .forEach((sum) => {
        const nextSum = sum + course.duree;
        if (nextSum <= target && !reachable.has(nextSum)) {
          reachable.set(nextSum, { previous: sum, index });
        }
      });
  });

  const bestSum = Math.max(...reachable.keys());
  const selectedIndexes = new Set();
  let cursor = bestSum;

  while (cursor > 0) {
    const parent = reachable.get(cursor);
    selectedIndexes.add(parent.index);
    cursor = parent.previous;
  }

  const firstTrack = [];
  const secondTrack = [];

  courses.forEach((course, index) => {
    if (selectedIndexes.has(index)) {
      firstTrack.push(course);
    } else {
      secondTrack.push(course);
    }
  });

  return {
    firstTrack,
    secondTrack,
    firstTrackMinutes: bestSum,
    secondTrackMinutes: totalMinutes - bestSum,
    missingMinutes: totalMinutes - (2 * bestSum),
    totalMinutes,
  };
}

function computeSequential2Category(category) {
  const exerciseCourses = category.courses.filter((detail) => detail.duree > 240);
  const shortCourses = category.courses.filter((detail) => detail.duree <= 240);

  exerciseCourses.forEach((detail) => {
    category.minutes += detail.duree;
    category.dispoMinutes += detail.duree;
    detail.rotation = `Exercice >240 min - ${formatHours(detail.duree)} h à dispo en parallèle`;
    category.rotationGroups.push({
      label: detail.lecon,
      numGroups: 2,
      duration: detail.duree,
      courseCount: 1,
      missingLabel: `${formatHours(detail.duree)} h`,
      grossMinutes: detail.duree,
      dispoMinutes: detail.duree,
      reason: 'Exercice de plus de 240 min: l’autre classe est à dispo en parallèle.',
    });
  });

  const exerciseDispoMinutes = exerciseCourses.reduce((sum, detail) => sum + detail.duree, 0);
  if (exerciseCourses.length > 0) {
    addDispoReason(
      category,
      exerciseDispoMinutes,
      `${exerciseCourses.length} exercice(s) >240 min: ajout de la même durée à dispo en parallèle.`,
    );
  }

  if (shortCourses.length === 0) {
    if (category.dispoReasons.length === 0) {
      addDispoReason(category, 0, 'Aucun cours dans cette catégorie.');
    }
    return;
  }

  const partition = findBestHalfPartition(shortCourses);
  category.minutes += partition.totalMinutes;
  category.dispoMinutes += partition.missingMinutes;

  partition.firstTrack.forEach((detail) => {
    detail.rotation = `Cours courts <=240 min - piste A (${formatHours(partition.firstTrackMinutes)} h)`;
  });
  partition.secondTrack.forEach((detail) => {
    detail.rotation = `Cours courts <=240 min - piste B (${formatHours(partition.secondTrackMinutes)} h)`;
  });

  category.rotationGroups.push({
    label: 'Cours courts <=240 min',
    numGroups: 2,
    duration: 'mixte',
    courseCount: shortCourses.length,
    missingLabel: `${formatHours(partition.missingMinutes)} h`,
    grossMinutes: partition.totalMinutes,
    dispoMinutes: partition.missingMinutes,
    reason: partition.missingMinutes > 0
      ? `Il manque ${formatHours(partition.missingMinutes)} h pour équilibrer les deux pistes de cours.`
      : 'Les deux pistes de cours courts sont équilibrées.',
  });

  addDispoReason(
    category,
    partition.missingMinutes,
    partition.missingMinutes > 0
      ? `Cours <=240 min: compensation incomplète, il manque ${formatHours(partition.missingMinutes)} h d'équivalent.`
      : 'Cours <=240 min: les durées se compensent entre les deux classes.',
  );
}

function computeSequential3PlusCategory(category) {
  const buckets = new Map();

  category.courses.forEach((detail) => {
    const bucketKey = `${detail.numGroups}-${detail.duree}`;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        duration: detail.duree,
        numGroups: detail.numGroups,
        courses: [],
      });
    }
    buckets.get(bucketKey).courses.push(detail);
  });

  buckets.forEach((bucket) => {
    const courseCount = bucket.courses.length;
    const remainder = courseCount % bucket.numGroups;
    const missingSlots = remainder === 0 ? 0 : bucket.numGroups - remainder;
    const minutes = courseCount * bucket.duration;
    const dispoMinutes = missingSlots * bucket.duration;

    category.minutes += minutes;
    category.dispoMinutes += dispoMinutes;

    const rotationLabel = `${bucket.duration} min - ${courseCount} cours / ${bucket.numGroups} classes`;
    category.rotationGroups.push({
      ...bucket,
      courseCount,
      missingSlots,
      missingLabel: `${missingSlots} créneau(x)`,
      minutes,
      dispoMinutes,
      label: rotationLabel,
      reason: dispoMinutes > 0
        ? `Rotation incomplète: ${missingSlots} classe(s) sans cours équivalent.`
        : 'Rotation complète: chaque classe a un cours équivalent.',
    });

    bucket.courses.forEach((detail) => {
      detail.rotation = rotationLabel;
    });

    addDispoReason(
      category,
      dispoMinutes,
      dispoMinutes > 0
        ? `${rotationLabel}: ${missingSlots} classe(s) à dispo faute de cours équivalent.`
        : `${rotationLabel}: aucune heure à dispo ajoutée.`,
    );
  });

  if (category.dispoReasons.length === 0) {
    addDispoReason(category, 0, 'Aucun cours dans cette catégorie.');
  }
}

function courseSortValue(detail) {
  return `${detail.categoryOrder}-${detail.branche}-${detail.lecon}-${detail.id}`;
}

async function calculateLoad() {
  const nombreAspirants = parseInt(document.getElementById('aspirantsInput').value, 10);

  if (!Number.isInteger(nombreAspirants) || nombreAspirants < 1) {
    alert("Veuillez entrer un nombre d'aspirants valide");
    return;
  }

  const courses = await loadCourses();
  const categories = {
    common: createCategory('Cours communs'),
    simultaneous: createCategory('Divisées simultanément'),
    sequential2: createCategory('Divisées séquentiellement en 2 classes'),
    sequential3Plus: createCategory('Divisées séquentiellement en 3+ classes'),
  };

  courses.forEach((course) => {
    const numGroups = calculateNumberOfGroups(course, nombreAspirants);
    const isDivided = course.division === 'Oui' && numGroups > 1;
    const isSimultaneousDivision = isDivided && course.simultane === 'Oui';
    const isSequentialDivision = isDivided && course.simultane === 'Non';

    const detail = {
      id: course.id,
      branche: course.branche,
      lecon: course.lecon,
      duree: course.duree,
      participants: course.participants,
      numGroups,
      executionType: getExecutionType(course, numGroups),
      categoryOrder: 0,
      categoryLabel: '',
      rotation: '-',
    };

    if (isSimultaneousDivision) {
      detail.categoryOrder = 2;
      detail.categoryLabel = categories.simultaneous.label;
      categories.simultaneous.courses.push(detail);
      categories.simultaneous.minutes += course.duree;
    } else if (isSequentialDivision && numGroups === 2) {
      detail.categoryOrder = 3;
      detail.categoryLabel = categories.sequential2.label;
      categories.sequential2.courses.push(detail);
    } else if (isSequentialDivision) {
      detail.categoryOrder = 4;
      detail.categoryLabel = categories.sequential3Plus.label;
      categories.sequential3Plus.courses.push(detail);
    } else {
      detail.categoryOrder = 1;
      detail.categoryLabel = categories.common.label;
      categories.common.courses.push(detail);
      categories.common.minutes += course.duree;
    }
  });

  computeSequential2Category(categories.sequential2);
  computeSequential3PlusCategory(categories.sequential3Plus);

  const totalMinutes = Object.values(categories)
    .reduce((sum, category) => sum + category.minutes, 0);

  const rotationDispoMinutes = categories.sequential2.dispoMinutes + categories.sequential3Plus.dispoMinutes;
  const baseWeeks = totalMinutes > 0 ? Math.ceil(totalMinutes / (40 * 60)) : 0;
  const weeklyInstructorDispoMinutes = baseWeeks * 120;
  const instructorDispoMinutes = rotationDispoMinutes + weeklyInstructorDispoMinutes;
  const totalWithDispo = totalMinutes + instructorDispoMinutes;

  addDispoReason(
    categories.common,
    0,
    'Cours communs: aucune heure à dispo ajoutée, toute la classe suit le cours ensemble.',
  );
  addDispoReason(
    categories.simultaneous,
    0,
    'Cours divisés simultanément: aucune heure à dispo ajoutée, les groupes travaillent en parallèle.',
  );

  // Résumé
  document.getElementById('coursesCount').textContent = courses.length;
  document.getElementById('totalHours').textContent = formatHours(totalMinutes);
  document.getElementById('disposoHours').textContent = formatHours(instructorDispoMinutes);
  document.getElementById('totalWithDispo').textContent = formatHours(totalWithDispo);

  // Répartition
  updateBreakdownItem('common', categories.common);
  updateBreakdownItem('simultaneous', categories.simultaneous);
  updateBreakdownItem('sequential2', categories.sequential2);
  updateBreakdownItem('sequential3Plus', categories.sequential3Plus);

  const maxMinutes = Math.max(
    categories.common.minutes,
    categories.simultaneous.minutes,
    categories.sequential2.minutes,
    categories.sequential3Plus.minutes,
    1,
  );

  document.getElementById('commonBar').style.width = `${(categories.common.minutes / maxMinutes) * 100}%`;
  document.getElementById('simultaneousBar').style.width = `${(categories.simultaneous.minutes / maxMinutes) * 100}%`;
  document.getElementById('sequential2Bar').style.width = `${(categories.sequential2.minutes / maxMinutes) * 100}%`;
  document.getElementById('sequential3PlusBar').style.width = `${(categories.sequential3Plus.minutes / maxMinutes) * 100}%`;

  renderCourseDetails(categories);
  renderRotationDetails(categories, rotationDispoMinutes, weeklyInstructorDispoMinutes);

  // Afficher les cartes
  document.getElementById('summaryCard').style.display = 'block';
  document.getElementById('breakdownCard').style.display = 'block';
  document.getElementById('tableCard').style.display = 'block';
}

function updateBreakdownItem(prefix, category) {
  document.getElementById(`${prefix}Hours`).textContent = `${formatHours(category.minutes)} h`;
  document.getElementById(`${prefix}Courses`).textContent = `${category.courses.length} cours`;
}

function renderCourseDetails(categories) {
  const tbody = document.querySelector('#coursesTable tbody');
  tbody.innerHTML = '';

  Object.values(categories).forEach((category) => {
    const sectionRow = document.createElement('tr');
    sectionRow.className = 'category-row';
    sectionRow.innerHTML = `
      <td colspan="8">${category.label} - ${category.courses.length} cours - ${formatHours(category.minutes)} h</td>
    `;
    tbody.appendChild(sectionRow);

    category.courses
      .slice()
      .sort((a, b) => courseSortValue(a).localeCompare(courseSortValue(b)))
      .forEach((detail) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${detail.categoryLabel}</td>
          <td>${detail.id}</td>
          <td>${detail.branche}</td>
          <td>${detail.lecon}</td>
          <td>${detail.duree}</td>
          <td>${detail.numGroups}</td>
          <td>${detail.executionType}</td>
          <td>${detail.rotation}</td>
        `;
        tbody.appendChild(row);
      });

    category.dispoReasons.forEach((item) => {
      const reasonRow = document.createElement('tr');
      reasonRow.className = 'reason-row';
      reasonRow.innerHTML = `
        <td colspan="8">À dispo ajoutée: ${formatHours(item.minutes)} h - ${item.reason}</td>
      `;
      tbody.appendChild(reasonRow);
    });
  });
}

function renderRotationDetails(categories, rotationDispoMinutes, weeklyInstructorDispoMinutes) {
  const tbody = document.querySelector('#rotationTable tbody');
  tbody.innerHTML = '';

  const rotationGroups = [
    ...categories.sequential2.rotationGroups,
    ...categories.sequential3Plus.rotationGroups,
  ];

  rotationGroups.forEach((group) => {
    const row = document.createElement('tr');
    const durationLabel = typeof group.duration === 'number' ? `${group.duration} min` : group.duration;
    row.innerHTML = `
      <td>${group.numGroups} classes</td>
      <td>${durationLabel}</td>
      <td>${group.courseCount ?? group.courses.length}</td>
      <td>${group.missingLabel ?? '-'}</td>
      <td>${formatHours(group.grossMinutes ?? group.minutes)}</td>
      <td>${formatHours(group.dispoMinutes)}</td>
    `;
    tbody.appendChild(row);

    const reasonRow = document.createElement('tr');
    reasonRow.className = 'reason-row';
    reasonRow.innerHTML = `
      <td colspan="6">${group.reason}</td>
    `;
    tbody.appendChild(reasonRow);
  });

  const rotationRow = document.createElement('tr');
  rotationRow.className = 'total-row';
  rotationRow.innerHTML = `
    <td colspan="5">À dispo par rotations incomplètes</td>
    <td>${formatHours(rotationDispoMinutes)}</td>
  `;
  tbody.appendChild(rotationRow);

  const weeklyRow = document.createElement('tr');
  weeklyRow.className = 'total-row';
  weeklyRow.innerHTML = `
    <td colspan="5">Forfait à dispo instructeurs (2h/semaine école)</td>
    <td>${formatHours(weeklyInstructorDispoMinutes)}</td>
  `;
  tbody.appendChild(weeklyRow);
}

document.addEventListener('DOMContentLoaded', async () => {
  const school = await loadSchoolParams();
  document.getElementById('aspirantsInput').value = school.nombre_aspirants;
});
