import sqlite3
import os

DATABASE_NAME = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "kairo.db"
)


def get_connection():

    connection = sqlite3.connect(DATABASE_NAME)

    connection.row_factory = sqlite3.Row

    return connection