from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_connection


app = FastAPI(title="KAIRO API")


# ---------- CORS ----------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Database Setup ----------

def create_tables():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            community TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            votes INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            vote_type INTEGER NOT NULL,
            UNIQUE(post_id, username),
            FOREIGN KEY (post_id) REFERENCES posts(id)
        )
    """)

    connection.commit()
    connection.close()


create_tables()


# ---------- Request Models ----------

class PostCreate(BaseModel):
    username: str
    community: str
    title: str
    content: str = ""

class PostUpdate(BaseModel):

    username: str

    title: str

    content: str = ""


class VoteUpdate(BaseModel):
    change: int
    username: str


class CommentCreate(BaseModel):
    username: str
    content: str


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ---------- Basic Routes ----------

@app.get("/")
def home():
    return {
        "message": "Welcome to KAIRO API",
        "status": "running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy"
    }


# ---------- Posts API ----------

@app.post("/api/posts")
def create_post(post: PostCreate):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO posts (username, community, title, content)
        VALUES (?, ?, ?, ?)
    """, (
        post.username,
        post.community,
        post.title,
        post.content
    ))

    connection.commit()

    post_id = cursor.lastrowid

    connection.close()

    return {
        "message": "Post created successfully",
        "post_id": post_id
    }

@app.patch("/api/posts/{post_id}")
def update_post(post_id: int, post: PostUpdate):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT username
        FROM posts
        WHERE id = ?
    """, (post_id,))

    existing_post = cursor.fetchone()

    if existing_post is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Post not found"
        )

    if existing_post["username"] != post.username:
        connection.close()
        raise HTTPException(
            status_code=403,
            detail="You can only edit your own post"
        )

    cursor.execute("""
        UPDATE posts
        SET title = ?, content = ?
        WHERE id = ?
    """, (
        post.title,
        post.content,
        post_id
    ))

    connection.commit()
    connection.close()

    return {
        "message": "Post updated successfully",
        "post_id": post_id
    }

@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, username: str):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT username
        FROM posts
        WHERE id = ?
    """, (post_id,))

    existing_post = cursor.fetchone()

    if existing_post is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Post not found"
        )

    if existing_post["username"] != username:
        connection.close()
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own post"
        )

    cursor.execute("""
        DELETE FROM posts
        WHERE id = ?
    """, (post_id,))

    connection.commit()
    connection.close()

    return {
        "message": "Post deleted successfully",
        "post_id": post_id
    }

@app.get("/api/posts")
def get_posts():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM posts
        ORDER BY created_at DESC
    """)

    posts = [dict(row) for row in cursor.fetchall()]

    connection.close()

    return posts


# ---------- Voting API ----------

@app.patch("/api/posts/{post_id}/vote")
def update_vote(post_id: int, vote: VoteUpdate):
    if vote.change not in (-2, -1, 1, 2):
        raise HTTPException(
            status_code=400,
            detail="Invalid vote change"
        )

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM posts WHERE id = ?",
        (post_id,)
    )

    if cursor.fetchone() is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Post not found")

    username = vote.username

    cursor.execute("""
        SELECT vote_type
        FROM post_votes
        WHERE post_id = ? AND username = ?
    """, (post_id, username))

    existing_vote = cursor.fetchone()
    old_vote = existing_vote["vote_type"] if existing_vote else 0

    if vote.change == 1:
        new_vote = 0 if old_vote == 1 else 1
    elif vote.change == -1:
        new_vote = 0 if old_vote == -1 else -1
    elif vote.change == 2:
        new_vote = 1
    else:
        new_vote = -1

    difference = new_vote - old_vote

    if existing_vote is None:
        if new_vote != 0:
            cursor.execute("""
                INSERT INTO post_votes (post_id, username, vote_type)
                VALUES (?, ?, ?)
            """, (post_id, username, new_vote))
    elif new_vote == 0:
        cursor.execute("""
            DELETE FROM post_votes
            WHERE post_id = ? AND username = ?
        """, (post_id, username))
    else:
        cursor.execute("""
            UPDATE post_votes
            SET vote_type = ?
            WHERE post_id = ? AND username = ?
        """, (new_vote, post_id, username))

    cursor.execute("""
        UPDATE posts
        SET votes = votes + ?
        WHERE id = ?
    """, (difference, post_id))

    connection.commit()

    cursor.execute(
        "SELECT votes FROM posts WHERE id = ?",
        (post_id,)
    )

    updated_post = cursor.fetchone()
    connection.close()

    return {
        "post_id": post_id,
        "votes": updated_post["votes"]
    }

@app.get("/api/posts/{post_id}/vote")
def get_user_vote(post_id: int, username: str):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM posts WHERE id = ?",
        (post_id,)
    )

    post = cursor.fetchone()

    if post is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Post not found"
        )

    cursor.execute("""
        SELECT vote_type
        FROM post_votes
        WHERE post_id = ? AND username = ?
    """, (
        post_id,
        username
    ))

    vote = cursor.fetchone()

    connection.close()

    return {
        "post_id": post_id,
        "username": username,
        "vote": vote["vote_type"] if vote else 0
    }


# ---------- Comments API ----------

@app.post("/api/posts/{post_id}/comments")
def create_comment(post_id: int, comment: CommentCreate):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT id FROM posts WHERE id = ?",
        (post_id,)
    )

    post = cursor.fetchone()

    if post is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Post not found"
        )

    cursor.execute("""
        INSERT INTO comments (post_id, username, content)
        VALUES (?, ?, ?)
    """, (
        post_id,
        comment.username,
        comment.content
    ))

    connection.commit()

    comment_id = cursor.lastrowid

    connection.close()

    return {
        "message": "Comment created successfully",
        "comment_id": comment_id
    }


@app.get("/api/posts/{post_id}/comments")
def get_comments(post_id: int):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT *
        FROM comments
        WHERE post_id = ?
        ORDER BY created_at ASC
    """, (post_id,))

    comments = [dict(row) for row in cursor.fetchall()]

    connection.close()

    return comments


# ---------- Authentication API ----------

@app.post("/api/auth/signup")
def signup(user: SignupRequest):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id
        FROM users
        WHERE username = ? OR email = ?
    """, (
        user.username,
        user.email
    ))

    existing_user = cursor.fetchone()

    if existing_user is not None:
        connection.close()

        raise HTTPException(
            status_code=400,
            detail="Username or email already exists"
        )

    cursor.execute("""
        INSERT INTO users (username, email, password)
        VALUES (?, ?, ?)
    """, (
        user.username,
        user.email,
        user.password
    ))

    connection.commit()

    user_id = cursor.lastrowid

    connection.close()

    return {
        "message": "Account created successfully",
        "user_id": user_id,
        "username": user.username
    }


@app.post("/api/auth/login")
def login(user: LoginRequest):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id, username, email
        FROM users
        WHERE email = ? AND password = ?
    """, (
        user.email,
        user.password
    ))

    existing_user = cursor.fetchone()

    connection.close()

    if existing_user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    return {
        "message": "Login successful",
        "user_id": existing_user["id"],
        "username": existing_user["username"],
        "email": existing_user["email"]
    }