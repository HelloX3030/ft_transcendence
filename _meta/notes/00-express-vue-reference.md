# Express + Vue — Full Stack Reference

---

## 1. How They Work Together

Express handles the **backend** (server, API, data). Vue handles the **frontend** (UI, user interaction).

```
Browser (Vue)  ──fetch('/api/users')──▶  Express Server  ──▶  Database
               ◀──── JSON data ─────────                  ◀────
```

| Layer    | Technology                        | Responsibility                        |
|----------|-----------------------------------|---------------------------------------|
| Frontend | Vue                               | UI, user interaction, displaying data |
| Backend  | Express (Node.js)                 | API routes, business logic, auth      |
| Data     | PostgreSQL / SQLite / MongoDB     | Storing and querying data             |

---

## 2. Express — The Basics

### Defining Routes

A route maps a URL + HTTP method to a function that runs on your server:

```js
import express from 'express'

const app = express()
app.use(express.json())  // parse incoming JSON

app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'Anna' }, { id: 2, name: 'Ben' }])
})

app.listen(3000, () => console.log('Server on port 3000'))
```

| Method       | Usage              | Example            |
|--------------|--------------------|--------------------|
| GET          | Read / fetch data  | GET /api/users     |
| POST         | Create new data    | POST /api/users    |
| PUT / PATCH  | Update data        | PUT /api/users/1   |
| DELETE       | Remove data        | DELETE /api/users/1|

### URL Parameters

Use `:placeholder` syntax to capture dynamic values from the URL:

```js
const users = {
  Ben:  { lastName: 'Müller',  age: 28 },
  Anna: { lastName: 'Schmidt', age: 32 },
}

app.get('/user/:name', (req, res) => {
  const name = req.params.name        // e.g. 'Ben'
  const user = users[name]

  if (!user) {
    return res.status(404).json({ error: 'Not found' })
  }

  res.json({ firstName: name, ...user })
})

// GET /user/Ben  →  { firstName: 'Ben', lastName: 'Müller', age: 28 }
```

---

## 3. Vue — The Basics

Vue is a reactive UI framework. When data changes, the DOM updates automatically.

### Component Structure

```vue
<template>
  <ul>
    <li v-for="user in users" :key="user.id">
      {{ user.name }}
    </li>
  </ul>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const users = ref([])           // reactive variable

onMounted(async () => {         // runs when component loads
  const res = await fetch('/api/users')
  users.value = await res.json()
})
</script>
```

| Concept       | What it does                                      |
|---------------|---------------------------------------------------|
| `ref()`       | Creates a reactive variable — UI updates with it  |
| `v-for`       | Loops over an array in the template               |
| `v-model`     | Two-way binding — syncs input to a variable       |
| `@click`      | Event listener                                    |
| `onMounted()` | Runs code when the component first loads          |

---

## 4. Database + Express + Vue (Full Stack)

Vue never talks to the database directly — always through Express.

### Express Talking to the Database

Most projects use an ORM like **Prisma** to avoid raw SQL:

```js
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// GET — fetch all users
app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

// POST — create a new user
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body
  const user = await prisma.user.create({ data: { name, email } })
  res.status(201).json(user)
})
```

### Vue Sending Data to Express

```js
async function addUser() {
  await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName.value })
  })
}
```

### Typical Project Structure

```
my-app/
├── server/
│   ├── server.js           ← Express setup + middleware
│   ├── routes/
│   │   ├── users.js        ← /api/users routes
│   │   └── auth.js         ← login / logout
│   └── prisma/
│       └── schema.prisma   ← DB schema
└── client/
    ├── src/
    │   ├── App.vue
    │   └── components/
    └── vite.config.js      ← proxy config (port 5173 → 3000)
```

---

## 5. Common Express Patterns

### 5.1 Middleware

Functions that run before your route handler. `next()` passes control forward.

```js
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})
```

### 5.2 Authentication (JWT)

```js
import jwt from 'jsonwebtoken'

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Not logged in' })

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Protect any route by adding the middleware
app.get('/api/profile', requireAuth, (req, res) => {
  res.json(req.user)
})
```

### 5.3 Environment Variables

Never hardcode secrets. Use a `.env` file (always in `.gitignore`):

```bash
# .env
DATABASE_URL=postgres://localhost/myapp
JWT_SECRET=supersecretkey123
PORT=3000
```

```js
import 'dotenv/config'

const secret = process.env.JWT_SECRET
const port   = process.env.PORT ?? 3000
```

### 5.4 Input Validation

Never trust what the client sends:

```js
import { z } from 'zod'

const UserSchema = z.object({
  name:  z.string().min(2),
  email: z.string().email(),
  age:   z.number().min(0).max(120),
})

app.post('/api/users', (req, res) => {
  const result = UserSchema.safeParse(req.body)

  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() })
  }

  const { name, email, age } = result.data   // safe to use now
})
```

### 5.5 Error Handling

Special 4-argument middleware — always put it last:

```js
// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status ?? 500).json({
    error: err.message ?? 'Something went wrong'
  })
})

// In any route, call next(err) to trigger it
app.get('/api/thing', async (req, res, next) => {
  try {
    const data = await riskyOperation()
    res.json(data)
  } catch (err) {
    next(err)
  }
})
```

### 5.6 CORS

When Vue (port 5173) calls Express (port 3000), the browser blocks it by default:

```js
import cors from 'cors'

app.use(cors({
  origin: 'http://localhost:5173'
}))
```

### 5.7 Rate Limiting

Prevents abuse on sensitive routes like login:

```js
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100                    // max 100 requests per window
})

app.use('/api/', limiter)
```

### 5.8 Middleware Order in server.js

Order matters — runs top to bottom:

```js
app.use(cors())               // 1. allow cross-origin
app.use(express.json())       // 2. parse request body
app.use(logger)               // 3. log every request
app.use(rateLimiter)          // 4. block abusers

app.use('/api/users', userRoutes)   // 5. your routes
app.use('/api/auth',  authRoutes)

app.use(errorHandler)         // 6. catch errors (always last)
```

---

## 6. Quick Reference

| Thing          | Library             | Install                      |
|----------------|---------------------|------------------------------|
| Server         | Express             | `express`                    |
| ORM            | Prisma              | `prisma @prisma/client`      |
| Validation     | Zod                 | `zod`                        |
| Auth tokens    | jsonwebtoken        | `jsonwebtoken`               |
| Env variables  | dotenv              | `dotenv`                     |
| CORS           | cors                | `cors`                       |
| Rate limiting  | express-rate-limit  | `express-rate-limit`         |
| Vue frontend   | Vue + Vite          | `npm create vue@latest`      |
