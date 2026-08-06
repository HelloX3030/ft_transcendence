import type { apiResponse, UserMeResponse } from "@cinemates/shared";

const BASE_URL = "http://localhost:3000/v1";
const PASSWORD = "B8skxi!dk&";
const LANGUAGE = "de";
const COUNT = 30;
const PREFIX = "hofmann";

interface TestUser {
  username: string;
  id: number;
  cookie: string;
}

function extractCookies(res: Response) {
  const raw = res.headers.getSetCookie();
  return raw.map((c) => c.split(";")[0]).join("; ");
}

async function createUser(username: string) {
  const body = {
    username,
    email: `${username}@example.com`,
    password: PASSWORD,
    language: LANGUAGE,
  };

  const res = await fetch(BASE_URL + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ${username}: ${res.status} ${text}`);
  }
  return res;
}

async function getId(cookie: string) {
  const res = await fetch(BASE_URL + "/users/me", {
    headers: { Cookie: cookie },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getId failed: ${res.status} ${text}`);
  }

  const json: UserMeResponse = await res.json();
  return json!.id;
}

async function sendFriendRequest(cookie: string, friendId: number) {
  const res = await fetch(BASE_URL + `/friends/${friendId}`, {
    method: "POST",
    headers: { Cookie: cookie },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sendFriendRequest failed: ${res.status} ${text}`);
  }
}

async function acceptFriendRequest(cookie: string, friendId: number) {
  const res = await fetch(BASE_URL + `/friends/${friendId}/accept`, {
    method: "PATCH",
    headers: { Cookie: cookie },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`acceptFriendRequest failed: ${res.status} ${text}`);
  }
}

async function main() {
  const users: TestUser[] = [];

  for (let i = 1; i <= COUNT; i++) {
    const username = `${PREFIX}${i}`;
    try {
      const res = await createUser(username);
      const cookie = extractCookies(res);
      const id = await getId(cookie);
      users.push({ username, id, cookie });
      console.log(`✅ ${username} created (id: ${id})`);
    } catch (err) {
      console.error(`❌ ${username} failed:`, (err as Error).message);
    }
  }

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      try {
        await sendFriendRequest(users[i]!.cookie, users[j]!.id);
        await acceptFriendRequest(users[j]!.cookie, users[i]!.id);
        console.log(`🤝 ${users[i]!.username} <-> ${users[j]!.username}`);
      } catch (err) {
        console.error(
          `❌ Friend request ${users[i]!.username} -> ${users[j]!.username}:`,
          (err as Error).message,
        );
      }
    }
  }
}

main();
