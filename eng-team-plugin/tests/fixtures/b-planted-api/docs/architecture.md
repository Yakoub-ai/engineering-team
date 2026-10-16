# planted-api — Architecture

Audience: engineers and technical reviewers
Last verified against: 0000000

## Context (C4 level 1)

```mermaid
C4Context
    title System context
    Person(user, "Business customer", "Views own invoices")
    System(system, "planted-api", "Invoice API")
    System_Ext(psp, "Payment provider", "Takes payments")
    Rel(user, system, "Uses")
    Rel(system, psp, "Calls")
```

## Containers (C4 level 2)

```mermaid
C4Container
    title Containers
    Person(user, "Business customer")
    Container(app, "Invoice API", "Node.js, Express", "Signup and invoice lookup")
    Rel(user, app, "Uses", "HTTPS")
```

## Quality attributes

| Attribute | Target | How met | Evidence |
|---|---|---|---|
| Security | Users see only own invoices | Authenticated lookup | src/server.js |

## Decisions
- None recorded yet.
