from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from auth import router as auth_router
from database import get_connection
from security import verify_access_token
import json


# =====================================
# FASTAPI APPLICATION
# =====================================

app = FastAPI(title="Student Skill Gap Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


# =====================================
# JWT AUTHENTICATION
# =====================================

bearer_scheme = HTTPBearer()


def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    return verify_access_token(credentials.credentials)


def verify_student_access(requested_id: int, logged_in_id: int):
    if requested_id != logged_in_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access another student's data"
        )


# =====================================
# CAREER SKILLS
# =====================================

career_skills = {
    "Cloud Engineer": [
        "Python", "Linux", "Networking",
        "AWS", "Git", "Docker"
    ],
    "Software Developer": [
        "Python", "Java", "SQL",
        "Git", "DSA", "OOP"
    ],
    "Data Analyst": [
        "Python", "SQL", "Excel",
        "Power BI", "Statistics"
    ],
    "Web Developer": [
        "HTML", "CSS", "JavaScript",
        "React", "Node.js", "SQL"
    ],
    "Cybersecurity Analyst": [
        "Linux", "Networking", "Python",
        "Cybersecurity", "SQL"
    ],
    "AI/ML Engineer": [
        "Python", "Machine Learning",
        "Statistics", "Pandas", "SQL"
    ]
}


# =====================================
# REQUEST MODELS
# =====================================

class SkillRequest(BaseModel):
    career: str
    skills: list[str]


class SaveAnalysisRequest(BaseModel):
    student_id: int
    career: str
    skills: list[str]


class ProgressRequest(BaseModel):
    student_id: int
    skill: str
    status: str


# =====================================
# HOME API
# =====================================

@app.get("/")
def home():
    return {
        "message": "Student Skill Gap Analyzer API is running!"
    }


# =====================================
# CAREERS API
# =====================================

@app.get("/careers")
def get_careers():
    return career_skills


# =====================================
# ANALYSIS HELPER
# =====================================

def calculate_analysis(career, skills):

    if career not in career_skills:
        raise HTTPException(
            status_code=400,
            detail="Invalid career selected"
        )

    required_skills = career_skills[career]

    matched_skills = [
        skill for skill in required_skills
        if skill in skills
    ]

    missing_skills = [
        skill for skill in required_skills
        if skill not in skills
    ]

    percentage = round(
        len(matched_skills) / len(required_skills) * 100
    )

    roadmap = []

    for index, skill in enumerate(missing_skills, start=1):
        roadmap.append({
            "week": index,
            "task": f"Learn {skill} and complete a practice project"
        })

    return {
        "career": career,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "percentage": percentage,
        "roadmap": roadmap
    }


# =====================================
# ANALYZE SKILLS API
# =====================================

@app.post("/analyze")
def analyze_skills(
    request: SkillRequest,
    student_id: int = Depends(get_current_student)
):
    return calculate_analysis(
        request.career,
        request.skills
    )


# =====================================
# SAVE ANALYSIS API
# =====================================

@app.post("/save-analysis")
def save_analysis(
    request: SaveAnalysisRequest,
    logged_in_id: int = Depends(get_current_student)
):

    verify_student_access(request.student_id, logged_in_id)

    result = calculate_analysis(
        request.career,
        request.skills
    )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            "SELECT id FROM students WHERE id = ?",
            (logged_in_id,)
        )

        student = cursor.fetchone()

        if student is None:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        cursor.execute(
            """
            INSERT INTO skill_analysis
            (student_id, career, selected_skills,
             missing_skills, percentage)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                logged_in_id,
                request.career,
                json.dumps(request.skills),
                json.dumps(result["missing_skills"]),
                result["percentage"]
            )
        )

        connection.commit()

        return {
            "message": "Analysis saved successfully!",
            "percentage": result["percentage"],
            "missing_skills": result["missing_skills"]
        }

    finally:
        connection.close()


# =====================================
# PREVIOUS ANALYSIS HISTORY API
# =====================================

@app.get("/history/{student_id}")
def get_analysis_history(
    student_id: int,
    logged_in_id: int = Depends(get_current_student)
):

    verify_student_access(student_id, logged_in_id)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, career, selected_skills,
                   missing_skills, percentage, analyzed_at
            FROM skill_analysis
            WHERE student_id = ?
            ORDER BY analyzed_at DESC, id DESC
            """,
            (logged_in_id,)
        )

        records = cursor.fetchall()

        history = []

        for record in records:
            history.append({
                "id": record["id"],
                "career": record["career"],
                "selected_skills": json.loads(
                    record["selected_skills"] or "[]"
                ),
                "missing_skills": json.loads(
                    record["missing_skills"] or "[]"
                ),
                "percentage": record["percentage"],
                "date": record["analyzed_at"]
            })

        return {"history": history}

    finally:
        connection.close()


# =====================================
# SAVE / UPDATE LEARNING PROGRESS
# =====================================

@app.post("/progress")
def save_learning_progress(
    request: ProgressRequest,
    logged_in_id: int = Depends(get_current_student)
):

    verify_student_access(request.student_id, logged_in_id)

    allowed_status = [
        "Not Started",
        "In Progress",
        "Completed"
    ]

    if request.status not in allowed_status:
        raise HTTPException(
            status_code=400,
            detail="Invalid progress status"
        )

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            "SELECT id FROM students WHERE id = ?",
            (logged_in_id,)
        )

        if cursor.fetchone() is None:
            raise HTTPException(
                status_code=404,
                detail="Student not found"
            )

        cursor.execute(
            """
            SELECT id FROM learning_progress
            WHERE student_id = ? AND skill = ?
            """,
            (logged_in_id, request.skill)
        )

        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE learning_progress
                SET status = ?
                WHERE student_id = ? AND skill = ?
                """,
                (
                    request.status,
                    logged_in_id,
                    request.skill
                )
            )
        else:
            cursor.execute(
                """
                INSERT INTO learning_progress
                (student_id, skill, status)
                VALUES (?, ?, ?)
                """,
                (
                    logged_in_id,
                    request.skill,
                    request.status
                )
            )

        connection.commit()

        return {
            "message": "Learning progress saved successfully!",
            "skill": request.skill,
            "status": request.status
        }

    finally:
        connection.close()


# =====================================
# GET LEARNING PROGRESS
# =====================================

@app.get("/progress/{student_id}")
def get_learning_progress(
    student_id: int,
    logged_in_id: int = Depends(get_current_student)
):

    verify_student_access(student_id, logged_in_id)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT skill, status
            FROM learning_progress
            WHERE student_id = ?
            ORDER BY id DESC
            """,
            (logged_in_id,)
        )

        records = cursor.fetchall()

        progress = []

        for record in records:
            progress.append({
                "skill": record["skill"],
                "status": record["status"]
            })

        return {"progress": progress}

    finally:
        connection.close()