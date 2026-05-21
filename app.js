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
    rotationGroups: [],
  };
}

function computeSequentialCategory(category) {
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
    const rotationSlots = Math.max(courseCount, bucket.numGroups);
    const minutes = rotationSlots * bucket.duration;
    const dispoMinutes = Math.max(0, bucket.numGroups - courseCount) * bucket.duration;

    category.minutes += minutes;
    category.dispoMinutes += dispoMinutes;

    const rotationLabel = `${bucket.duration} min - ${courseCount} cours / ${bucket.numGroups} classes`;
    category.rotationGroups.push({
      ...bucket,
      rotationSlots,
      minutes,
      dispoMinutes,
      label: rotationLabel,
    });

    bucket.courses.forEach((detail) => {
      detail.rotation = rotationLabel;
    });
  });
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

  computeSequentialCategory(categories.sequential2);
  computeSequentialCategory(categories.sequential3Plus);

  const totalMinutes = Object.values(categories)
    .reduce((sum, category) => sum + category.minutes, 0);

  const rotationDispoMinutes = categories.sequential2.dispoMinutes + categories.sequential3Plus.dispoMinutes;
  const baseWeeks = totalMinutes > 0 ? Math.ceil(totalMinutes / (40 * 60)) : 0;
  const weeklyInstructorDispoMinutes = baseWeeks * 120;
  const instructorDispoMinutes = rotationDispoMinutes + weeklyInstructorDispoMinutes;
  const totalWithDispo = totalMinutes + instructorDispoMinutes;

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
    row.innerHTML = `
      <td>${group.numGroups} classes</td>
      <td>${group.duration} min</td>
      <td>${group.courses.length}</td>
      <td>${group.rotationSlots}</td>
      <td>${formatHours(group.minutes)}</td>
      <td>${formatHours(group.dispoMinutes)}</td>
    `;
    tbody.appendChild(row);
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
