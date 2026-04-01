from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.engine import PlanningEngine, load_courses, load_school_params

app = FastAPI(title="Planning école")

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    school = load_school_params(str(BASE_DIR / "data" / "school_params.json"))
    courses = load_courses(str(BASE_DIR / "data" / "courses.csv"))
    engine = PlanningEngine(school=school, courses=courses)

    summary = engine.school_load_summary()
    course_loads = engine.course_loads()

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "summary": summary,
            "course_loads": course_loads,
        },
    )
