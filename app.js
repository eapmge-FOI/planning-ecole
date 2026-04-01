function addMonthsToDate(dateString, monthsToAdd){

const baseDate=new Date(dateString)

const result=new Date(baseDate)

const originalDay=result.getDate()

result.setMonth(result.getMonth()+monthsToAdd)

if(result.getDate()<originalDay){

result.setDate(0)

}

return result

}

function formatDateFR(dateObj){

const year=dateObj.getFullYear()

const month=String(dateObj.getMonth()+1).padStart(2,"0")

const day=String(dateObj.getDate()).padStart(2,"0")

return `${day}.${month}.${year}`

}

async function loadData(){

const school=await fetch("data/school_params.json")
.then(r=>r.json())

const courses=await fetch("data/courses.json")
.then(r=>r.json())

const nombreAspirants=
Number(document.getElementById("aspirantsInput").value)

let totalMinutes=0

let totalSessions=0

const tbody=
document.querySelector("#coursesTable tbody")

tbody.innerHTML=""

courses.forEach(course=>{

let groupes=1

if(course.division==="Oui"){

groupes=Math.ceil(
nombreAspirants/course.participants
)

}

let seances=1

if(course.simultane==="Non"){

seances=groupes

}

let minutes=
course.duree*seances

totalMinutes+=minutes

totalSessions+=seances

let encadrantsTotal=
course.encadrants

if(course.simultane==="Oui"){

encadrantsTotal=
course.encadrants*groupes

}

let vehicules=
Math.ceil(nombreAspirants/13)

let sallesSup=0

if(course.simultane==="Oui"){

sallesSup=Math.max(groupes-1,0)

}

let heures=
(minutes/60).toFixed(1)

let row=`

<tr>

<td>${course.id}</td>

<td>${course.lecon}</td>

<td>${course.duree}</td>

<td>${course.participants}</td>

<td>${groupes}</td>

<td>${seances}</td>

<td>${heures}</td>

</tr>

`

tbody.innerHTML+=row

})

let totalHours=
(totalMinutes/60).toFixed(1)

let minimumEndDate=
addMonthsToDate(school.date_debut,8)

document.getElementById("summary").innerHTML=`

<p><b>Ecole :</b> ${school.nom_ecole}</p>

<p><b>Date début :</b> ${formatDateFR(new Date(school.date_debut))}</p>

<p><b>Aspirants :</b> ${nombreAspirants}</p>

<p><b>Total séances :</b> ${totalSessions}</p>

<p><b>Heures totales :</b> ${totalHours}</p>

<p><b>Date fin minimale :</b>
${formatDateFR(minimumEndDate)}</p>

`

}

window.addEventListener(
"DOMContentLoaded",
loadData
)
