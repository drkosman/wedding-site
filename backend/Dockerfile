# ---- Base Image ----
FROM python:3.12-slim

# ---- Environment ----
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# ---- Set Work Directory ----
WORKDIR /app

# ---- Install System Dependencies ----
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---- Install Python Dependencies ----
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Copy Application Code ----
COPY . .

# ---- Expose Port ----
EXPOSE 8000

# ---- Start Server ----
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]