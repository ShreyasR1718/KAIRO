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

    connection.commit()
    connection.close()


create_tables()


# ---------- Request Models ----------

class PostCreate(BaseModel):
    username: str
    community: str
    title: str
    content: str = ""


class VoteUpdate(BaseModel):
    change: int


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

    if vote.change not in (-1, 1):
        raise HTTPException(
            status_code=400,
            detail="Vote change must be 1 or -1"
        )

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "SELECT votes FROM posts WHERE id = ?",
        (post_id,)
    )

    post = cursor.fetchone()

    if post is None:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Post not found"
        )

    new_votes = post["votes"] + vote.change

    cursor.execute(
        "UPDATE posts SET votes = ? WHERE id = ?",
        (new_votes, post_id)
    )

    connection.commit()
    connection.close()

    return {
        "post_id": post_id,
        "votes": new_votes
    }
# ---------- Comments API ----------

class CommentCreate(BaseModel):
    username: str
    content: str


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