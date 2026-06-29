const { sql } = require('@vercel/postgres');
const fs = require('fs');
const envConfig = fs.readFileSync('.env', 'utf8');
envConfig.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)='?([^']+)'?$/) || line.match(/^([^=]+)="?([^"]+)"?$/) || line.match(/^([^=]+)=(.+)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

async function init() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS monitored_services (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Seed initial data
    await sql`
      INSERT INTO monitored_services (name, url) VALUES
      ('Weather', 'https://api.openweathermap.org/data/2.5/weather?q=London&appid=' || ${process.env.OPENWEATHER_API_KEY || ''}),
      ('Crypto', 'https://api.coingecko.com/api/v3/ping'),
      ('Jokes', 'https://official-joke-api.appspot.com/random_joke')
      ON CONFLICT DO NOTHING;
    `;
    console.log('Successfully created and seeded monitored_services table');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

init();
