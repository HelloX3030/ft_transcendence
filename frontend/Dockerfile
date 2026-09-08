# Pinned, not floating: shared/ is consumed as raw TypeScript, and Node only
# loads it correctly from 22.23 on. On 22.18-22.22 the require() of that
# ESM barrel dies with ERR_INTERNAL_ASSERTION, and before 22.18 there is no
# type stripping at all — so a floating tag decides whether the app boots.
FROM node:22.23-alpine
WORKDIR /app
EXPOSE 5173
