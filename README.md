# LocateMe API

A lightweight and scalable REST API built with Node.js, Express, and PostgreSQL for receiving, storing, and serving real-time device location data.

## 📦 Features

- Fast and modular Express server
- PostgreSQL database integration
- RESTful endpoint to save device positions
- Secure configuration with CORS and Helmet
- Organized architecture: controllers, services, routes, database layer
- SQL schema included for easy database setup

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/marcelosanchez/locateme-api.git
cd locateme-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```dotenv
PORT=3000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/locateme
FRONTEND_ORIGIN=http://localhost:5173
```

Adjust `yourpassword` to match your PostgreSQL setup.

---

## 🛠 Database Setup

### Step 1: Create the database manually

Connect to PostgreSQL:

```bash
psql -U postgres
```

Inside `psql`, create the database:

```sql
CREATE DATABASE locateme;
\q
```

### Step 2: Load the database schema

After the database is created, load the schema:

```bash
psql -U postgres -d locateme -f db/schema/init_locateme.sql
```

This will create all the tables and views necessary for the API to function.

---

## ⚙️ Running the Server

Start the API in development mode:

```bash
node server.js
```

(Optional) Using `nodemon` for auto-reload:

```bash
npm install -g nodemon
nodemon server.js
```

The API will run by default on `http://localhost:3000/`.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| POST | `/locateme/position/` | Save a new device position |

---

## 📜 Example POST Request

```bash
curl -X POST http://localhost:3000/locateme/position/ \
-H "Content-Type: application/json" \
-d '{
  "device_id": "device123",
  "latitude": -1.123456,
  "longitude": -1.123456,
  "timestamp": 1714321234567,
  "readable_datetime": "2025-04-28 18:00:00"
}'
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
