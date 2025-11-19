-- Create iot table
CREATE TABLE IF NOT EXISTS iot (
    id SERIAL PRIMARY KEY,
    altitude REAL NOT NULL,
    pressure REAL NOT NULL,
    temperature REAL NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on timestamp for better query performance
CREATE INDEX IF NOT EXISTS idx_iot_timestamp ON iot(timestamp DESC);
