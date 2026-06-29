# Contributing to Platform Provisioner UI

Thank you for your interest in contributing to Platform Provisioner UI! This document provides guidelines for contributing to this project.

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/tibco/platform-provisioner-ui/issues) to report bugs or request features.
- Include steps to reproduce the issue, expected behavior, and actual behavior.
- Provide browser, OS, and Node.js version information when relevant.

### Submitting Changes

1. Fork the repository and create a feature branch from `main`.
2. Make your changes, following the coding conventions below.
3. Ensure all checks pass:
   ```bash
   cd provisioner-webui
   npm run type-check
   npm run build
   npx playwright test
   ```
4. Submit a pull request targeting the `main` branch.

### Coding Conventions

- **Frontend**: Vue 3 Composition API with `<script setup>` and TypeScript.
- **Backend**: JavaScript (Node.js / Koa).
- **Formatting**: Prettier (configured in the project).
- **Linting**: ESLint (configured in the project).
- **Components**: Use PrimeVue components where possible.

### Commit Messages

Use the format: `[TICKET-ID] Short description of change`

Example: `[PCP-12345] Fix session handling on login page`

## Development Setup

See the [README](provisioner-webui/README.md) for local development instructions.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
