async function loadData(){

const school = await fetch("data/school_params.json")
.then(r=>r.json())

const courses = await fetch("data/courses.json")
.then(r=>r.json())

let totalMinutes=0

const tbody=document.querySelector("#coursesTable tbody")

tbody.innerHTML=""

courses.forEach(course=>{

let groups=Math.ceil(
school.nombre_aspirants /
course.participants_max
)

let minutes=course.duree*groups

totalMinutes+=minutes

let row=`

<tr>

<td>${course.id}</td>

<td>${course.lecon}</td>

<td>${course.duree}</td>

<td>${course.participants_max}</td>

<td>${groups}</td>

<td>${minutes/60}</td>

</tr>

`

tbody.innerHTML+=row

})

let totalHours=totalMinutes/60

document.getElementById("summary").innerHTML=`

<p><b>Ecole :</b> ${school.nom_ecole}</p>

<p><b>Aspirants :</b> ${school.nombre_aspirants}</p>

<p><b>Heures totales :</b> ${totalHours}</p>

<p><b>Mois minimum :</b> 8</p>

`

}
