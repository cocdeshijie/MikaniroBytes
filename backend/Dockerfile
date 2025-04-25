FROM python:3.10-slim

# Create app directory
WORKDIR /app

# Copy in requirements (adjust the filename to match your project)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose FastAPI's default port (optional, but good practice)
EXPOSE 8000

# Default command to run the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
