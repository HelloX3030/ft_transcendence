# NestJS + Vue — Full Stack Reference

---

## 1. How They Work Together

NestJS handles the **backend** (server, API, business logic). Vue handles the **frontend** (UI, user interaction). Same architecture as Express + Vue, but Nest is opinionated and class-based.

```
Browser (Vue)  ──fetch('/api/users')──▶  NestJS Server  ──▶  Database
               ◀──── JSON data ─────────                 ◀────
```

| Layer    | Technology                        | Responsibility                        |
|----------|-----------------------------------|---------------------------------------|
| Frontend | Vue                               | UI, user interaction, displaying data |
| Backend  | NestJS (Node.js + TypeScript)     | API routes, business logic, auth      |
| Data     | PostgreSQL / SQLite / MongoDB     | Storing and querying data             |

NestJS runs on top of Express by default (you can swap it for Fastify), so under the hood it's still the same Node HTTP server — just wrapped in a much more structured framework.

---

## 2. NestJS — The Core Building Blocks

Nest is built around three concepts. Once these click, the rest is variations on the theme.

| Concept        | What it is                                                       |
|----------------|------------------------------------------------------------------|
| **Module**     | Groups related code (a feature area). Every app has one root.    |
| **Controller** | Handles incoming HTTP requests. Maps URLs to methods.            |
| **Provider**   | Class with logic (usually a "Service"). Injected via DI.         |

### Bootstrapping the App

```ts
// main.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')        // all routes prefixed with /api
  await app.listen(3000)
}
bootstrap()
```

### A Controller

The `@Controller('users')` decorator says "all routes in this class start with `/users`."

```ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id)
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }
}
```

| Decorator                | Express equivalent              |
|--------------------------|---------------------------------|
| `@Get()` / `@Post()` etc | `app.get()` / `app.post()`      |
| `@Param('id')`           | `req.params.id`                 |
| `@Body()`                | `req.body`                      |
| `@Query('q')`            | `req.query.q`                   |
| `@Req()` / `@Res()`      | `req` / `res` (avoid if you can)|

### A Service (Provider)

Business logic lives here, **not** in the controller. The `@Injectable()` decorator marks it as something the DI container can wire up.

```ts
import { Injectable, NotFoundException } from '@nestjs/common'

@Injectable()
export class UsersService {
  private users = [
    { id: 1, name: 'Anna' },
    { id: 2, name: 'Ben' },
  ]

  findAll() {
    return this.users
  }

  findOne(id: number) {
    const user = this.users.find(u => u.id === id)
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  create(dto: { name: string }) {
    const user = { id: this.users.length + 1, ...dto }
    this.users.push(user)
    return user
  }
}
```

### A Module

Modules tie controllers + providers together so Nest knows about them.

```ts
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],   // allow other modules to inject it
})
export class UsersModule {}
```

The root `AppModule` imports everything:

```ts
@Module({
  imports: [UsersModule, AuthModule],
})
export class AppModule {}
```

### Dependency Injection in 30 seconds

When you write `constructor(private readonly usersService: UsersService) {}`, Nest sees the type, looks in its container, and hands you an instance. You never write `new UsersService()`. This is what makes services trivial to test (you just swap them out with mocks).

---

## 3. Vue — Unchanged

The Vue side is identical to the Express setup — the frontend doesn't care what framework serves the API. See the Express + Vue reference for `ref()`, `v-for`, `v-model`, `onMounted()`, etc.

The only thing that changes: your Vite proxy still points at port 3000 (Nest's default), so `vite.config.js` looks the same.

---

## 4. Database + NestJS + Vue

Two common ORM choices: **Prisma** (most popular today) or **TypeORM** (has first-party `@nestjs/typeorm` integration).

### Prisma the Nest Way

Wrap PrismaClient in a service so it can be injected:

```ts
// prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
  }
}
```

Then inject it into any service:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany()
  }

  create(data: { name: string; email: string }) {
    return this.prisma.user.create({ data })
  }
}
```

### TypeORM Alternative

```ts
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User],
      synchronize: true,   // dev only!
    }),
    TypeOrmModule.forFeature([User]),
  ],
})
```

---

## 5. Common NestJS Patterns

### 5.1 DTOs + Validation

DTOs are plain classes describing the shape of incoming data. Validation runs automatically via decorators from `class-validator`.

```ts
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsInt, Min, Max } from 'class-validator'

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string

  @IsEmail()
  email: string

  @IsInt()
  @Min(0) @Max(120)
  age: number
}
```

Enable validation globally in `main.ts`:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // strip unknown properties
  forbidNonWhitelisted: true, // reject requests with extra fields
  transform: true,            // auto-convert strings → numbers etc.
}))
```

Now any controller using `@Body() dto: CreateUserDto` gets validated input for free. Invalid requests automatically return 400 with a detailed error.

### 5.2 Guards (Authentication)

Guards are Nest's version of "auth middleware." They decide whether a request proceeds.

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new UnauthorizedException()

    try {
      req.user = this.jwtService.verify(token)
      return true
    } catch {
      throw new UnauthorizedException('Invalid token')
    }
  }
}
```

Apply per-route or per-controller:

```ts
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@Req() req) {
  return req.user
}
```

In real projects, use `@nestjs/passport` + `@nestjs/jwt` instead of rolling your own.

### 5.3 Configuration (@nestjs/config)

```ts
// app.module.ts
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
```

Inject `ConfigService` anywhere:

```ts
constructor(private config: ConfigService) {}

const secret = this.config.get<string>('JWT_SECRET')
```

`.env` works the same as in Express — never commit it.

### 5.4 Pipes, Interceptors, Middleware (Quick Tour)

Nest splits the "middleware" concept into more specific tools:

| Tool         | When it runs              | Typical use                       |
|--------------|---------------------------|-----------------------------------|
| Middleware   | Before everything         | Logging, raw request manipulation |
| Guard        | Before route handler      | Auth / authorization              |
| Pipe         | Right before handler runs | Validation, transformation        |
| Interceptor  | Around the handler        | Logging, caching, response shaping|
| Exception Filter | When an error is thrown | Custom error responses          |

You usually only need guards, pipes, and the occasional interceptor.

### 5.5 Error Handling

Nest ships with built-in HTTP exceptions. Just throw them:

```ts
throw new NotFoundException('User not found')
throw new BadRequestException('Invalid input')
throw new ForbiddenException()
```

For custom errors, write an Exception Filter:

```ts
@Catch(SomeCustomError)
export class CustomErrorFilter implements ExceptionFilter {
  catch(err: SomeCustomError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse()
    res.status(500).json({ error: err.message })
  }
}
```

### 5.6 CORS

One line in `main.ts`:

```ts
app.enableCors({ origin: 'http://localhost:5173' })
```

### 5.7 Rate Limiting (@nestjs/throttler)

```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

### 5.8 Typical Project Structure

Nest is more opinionated about layout than Express. The CLI (`nest g module users`, `nest g controller users`, etc.) generates this for you.

```
my-app/
├── server/
│   ├── src/
│   │   ├── main.ts              ← bootstrap
│   │   ├── app.module.ts        ← root module
│   │   ├── prisma/
│   │   │   └── prisma.service.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │       └── create-user.dto.ts
│   │   └── auth/
│   │       ├── auth.module.ts
│   │       ├── auth.controller.ts
│   │       ├── auth.service.ts
│   │       └── jwt-auth.guard.ts
│   └── prisma/
│       └── schema.prisma
└── client/
    ├── src/
    │   ├── App.vue
    │   └── components/
    └── vite.config.js           ← proxy 5173 → 3000
```

---

## 6. Quick Reference

| Thing             | Library                  | Install                                  |
|-------------------|--------------------------|------------------------------------------|
| Framework         | NestJS                   | `npm i -g @nestjs/cli` → `nest new app`  |
| ORM               | Prisma                   | `prisma @prisma/client`                  |
| ORM (alt)         | TypeORM                  | `@nestjs/typeorm typeorm pg`             |
| Validation        | class-validator          | `class-validator class-transformer`      |
| Auth tokens       | JWT                      | `@nestjs/jwt @nestjs/passport`           |
| Config / .env     | @nestjs/config           | `@nestjs/config`                         |
| Rate limiting     | @nestjs/throttler        | `@nestjs/throttler`                      |
| CORS              | built-in                 | (no install)                             |
| Vue frontend      | Vue + Vite               | `npm create vue@latest`                  |

---

## 7. Express → Nest Cheat Sheet

For when you're translating mental models from the old reference:

| Express                              | NestJS equivalent                        |
|--------------------------------------|------------------------------------------|
| `app.get('/users', handler)`         | `@Get()` in a `@Controller('users')`     |
| `req.params.id`                      | `@Param('id') id: string`                |
| `req.body`                           | `@Body() dto: SomeDto`                   |
| `req.query.q`                        | `@Query('q') q: string`                  |
| Manual middleware for auth           | A `Guard` with `@UseGuards(...)`         |
| `app.use((err, req, res, next) =>…)` | An `ExceptionFilter`                     |
| Manual `joi`/`zod` validation        | DTO + `class-validator` + `ValidationPipe` |
| `cors()` middleware                  | `app.enableCors({...})`                  |
| `express-rate-limit`                 | `@nestjs/throttler`                      |
| `dotenv`                             | `@nestjs/config` + `ConfigService`       |
| Folder structure: free-for-all       | `nest g module/controller/service` CLI   |
