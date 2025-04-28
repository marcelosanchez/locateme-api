-- Step 1: Create database 'locateme' if it does not exist
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'locateme') THEN
      CREATE DATABASE locateme;
   END IF;
END
$$;

-- Step 2: Connect to 'locateme'
\c locateme

-- Step 3: Create tables and views

-- Table: users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: people
CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_people_access
CREATE TABLE user_people_access (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, person_id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: people_groups
CREATE TABLE people_groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: people_in_groups
CREATE TABLE people_in_groups (
  person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES people_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, group_id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: devices
CREATE TABLE devices (
  id VARCHAR PRIMARY KEY,
  name TEXT,
  icon TEXT,
  device_type TEXT,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: devices_notifications
CREATE TABLE devices_notifications (
  device_id VARCHAR PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  telegram_token TEXT NOT NULL,
  telegram_channel_id TEXT NOT NULL,
  notify BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: devices_priority
CREATE TABLE devices_priority (
  device_id VARCHAR PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  is_priority BOOLEAN DEFAULT FALSE,
  refresh_interval INTEGER DEFAULT 60,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: positions
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR REFERENCES devices(id) ON DELETE SET NULL,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  altitude DECIMAL,
  floor_level INTEGER,
  horizontal_accuracy DECIMAL,
  vertical_accuracy DECIMAL,
  position_type TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  timestamp BIGINT,
  readable_datetime TEXT,
  battery_level DECIMAL,
  battery_status TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Views

-- Device with owner info
CREATE VIEW device_with_owner AS
SELECT
  d.id AS device_id,
  d.name AS device_name,
  d.icon AS device_icon,
  d.device_type,
  d.is_primary,
  d.person_id,
  p.name AS person_name,
  p.emoji AS person_emoji
FROM devices d
JOIN people p ON d.person_id = p.id;

-- Last position per device
CREATE VIEW latest_positions AS
SELECT DISTINCT ON (device_id)
  device_id,
  latitude,
  longitude,
  timestamp,
  readable_datetime,
  battery_level,
  battery_status,
  created_at
FROM positions
ORDER BY device_id, timestamp DESC;

-- Full device status
CREATE VIEW full_device_status AS
SELECT
  d.device_id,
  d.device_name,
  d.device_icon,
  d.device_type,
  d.is_primary,
  d.person_id,
  d.person_name,
  d.person_emoji,
  p.latitude,
  p.longitude,
  p.readable_datetime,
  p.battery_level,
  p.battery_status
FROM device_with_owner d
JOIN latest_positions p ON d.device_id = p.device_id;
