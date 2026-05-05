import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'

const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/ping', async (_req, res) => {
  const rows = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`
  res.json({ message: 'pong', db_time: rows[0]?.now })
})

app.listen(3000, () => console.log('backend on :3000'))
