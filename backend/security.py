import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from pwdlib import PasswordHash


# PASSWORD SECURITY
password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


# JWT CONFIGURATION
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")

ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60


def create_access_token(student_id: int) -> str:
    if not SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is missing"
        )

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(student_id),
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def verify_access_token(token: str) -> int:
    if not SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is missing"
        )

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        student_id = payload.get("sub")

        if student_id is None:
            raise ValueError("Missing student ID")

        return int(student_id)

    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )