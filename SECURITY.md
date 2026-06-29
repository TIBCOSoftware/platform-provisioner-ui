# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | Yes                |
| Older   | No                 |

Only the latest release is supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email the maintainers at [security@tibco.com](mailto:security@tibco.com) with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgment within 5 business days.
4. A fix will be developed privately and released as soon as possible.

## Security Best Practices for Deployers

- Always set a unique `SESSION_SECRET` environment variable in production.
- Keep dependencies up to date and run `npm audit` regularly.
- Use HTTPS in production deployments.
- Restrict Kubernetes RBAC permissions to the minimum required.
