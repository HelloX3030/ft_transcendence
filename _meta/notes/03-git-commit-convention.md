# Git Commit Convention

## Core Types

- `feat:` A new feature
- `fix:` A bug fix
- `refactor:` Code changes that neither fix a bug nor add a feature
- `docs:` Documentation only changes
- `style:` Code style changes (formatting, whitespace, etc. — no logic changes)

## Breaking Changes

- `BREAKING CHANGE:` or `!` after the type/scope indicates a breaking change

Example:

- `feat!: change authentication flow`

## Additional Types

- `test:` Adding or updating tests
- `chore:` Maintenance tasks (build scripts, dependencies, tooling)
- `ci:` Changes to CI/CD pipelines (GitHub Actions, etc.)
- `build:` Changes that affect the build system or dependencies

## Notes

- Commits should be **atomic** (one logical change per commit)
- Use **present tense** ("add feature" not "added feature")
- Keep messages clear and meaningful
