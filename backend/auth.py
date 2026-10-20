import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_connection
from security import (
    hash_password,
    verify_password,
    create_access_token
)


# =====================================
# AUTHENTICATION ROUTER
# =====================================

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


# =====================================
# REQUEST MODELS
# =====================================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# =====================================
# STUDENT REGISTRATION
# =====================================

@router.post("/register")
def register_student(student: RegisterRequest):

    name = student.name.strip()
    email = student.email.strip().lower()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name cannot be empty"
        )

    if not email or "@" not in email:
        raise HTTPException(
            status_code=400,
            detail="Enter a valid email address"
        )

    if len(student.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 8 characters"
        )

    hashed_password = hash_password(student.password)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO students (name, email, password)
            VALUES (?, ?, ?)
            """,
            (name, email, hashed_password)
        )

        connection.commit()

        return {
            "message": "Registration successful!",
            "student_id": cursor.lastrowid,
            "name": name
        }

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    finally:
        connection.close()


# =====================================
# STUDENT LOGIN WITH JWT TOKEN
# =====================================

@router.post("/login")
def login_student(student: LoginRequest):

    email = student.email.strip().lower()

    connection = get_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT id, name, email, password
            FROM students
            WHERE email = ?
            """,
            (email,)
        )

        user = cursor.fetchone()

    finally:
        connection.close()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        student.password,
        user["password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Generate JWT token after successful login
    access_token = create_access_token(user["id"])

    return {
        "message": "Login successful!",
        "student_id": user["id"],
        "name": user["name"],
        "access_token": access_token,
        "token_type": "bearer"
    }