from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Definiujemy model danych, który będzie wysyłany/odbierany w JSON
class Message(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"message": "Hello, Azure!"}

@app.post("/echo")
def echo_message(msg: Message):
    # Endpoint przyjmuje JSON i zwraca ten sam JSON
    return {"received": msg.text}
