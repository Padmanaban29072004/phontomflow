from fastapi import FastAPI

from routes import router

app = FastAPI(title="PHANTOM-Flow L2 Agent", version="1.0.0")
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "l2-agent"}

