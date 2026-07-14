const BASE_URL = 'http://localhost:3000/v1/auth/register';
const PASSWORD = 'B8skxi!dk&';
const LANGUAGE = 'de';
const COUNT = 30;
const PREFIX = 'hofmann';

async function createUser(username) {
  const body = {
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
    language: LANGUAGE,
  };

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fehler bei ${username}: ${res.status} ${text}`);
  }

  return res.json();
}

async function main() {
  for (let i = 1; i <= COUNT; i++) {
    const username = `${PREFIX}${i}`;
    try {
      const data = await createUser(username);
      console.log(`✅ ${username} created`, data);
    } catch (err) {
      console.error(`❌ ${username} failed:`, err.message);
    }
  }
}

main();
