FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1. install deps first so we keep cache hits on code changes
COPY requirements*.txt ./
RUN pip install -U pip && pip install -r requirements.txt

# 2. bring in the source
COPY . ./

EXPOSE 8000
# 3. run migrations every time the container starts, then boot uvicorn
CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
