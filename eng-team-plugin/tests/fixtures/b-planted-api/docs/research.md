# planted-api — Research note

Audience: engineers and technical reviewers
Last verified against: 0000000

- Express 4.x is the long-supported line and fits a small JSON API (source: https://expressjs.com/).
- Payments go through a payment service provider, which keeps card data out of scope (source: https://stripe.com/docs/security).
- Personal data of EU users falls under GDPR (source: https://eur-lex.europa.eu/eli/reg/2016/679/oj).
