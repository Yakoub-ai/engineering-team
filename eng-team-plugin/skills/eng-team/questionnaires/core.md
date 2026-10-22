---
id: core
kind: questionnaire
domain: any
scope: core
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
---
# Core questions (every client, every team)

Asked of every team regardless of client type or legal area. Format and selection rules: `challenger/questionnaire.md`.

`audience` (pre-meeting questions only) says who the question is for: `user` (does the work), `manager` (leads the team or decides) and `it` (runs or knows the systems). A question with no `audience` is for `user` and `manager`.

### Q-CORE-01
- stage: pre
- priority: 1
- audience: user, manager, it
- topic: overview
- type: open
- sv: Beskriv med några meningar vad ert team gör och vilka som anlitar eller vänder sig till er.
- en: In a few sentences, describe what your team does and who engages or relies on you.
- why_sv: Vi vill förstå uppdraget med era egna ord innan vi föreslår något.
- why_en: We want to understand the work in your own words before proposing anything.
- fills: engagement.team

### Q-CORE-02
- stage: pre
- priority: 1
- audience: user, manager
- topic: volume
- type: number
- sv: Ungefär hur många ärenden, uppdrag eller leveranser hanterar teamet per månad, och hur många personer arbetar i teamet?
- en: Roughly how many cases, assignments or deliveries does the team handle per month, and how many people work in the team?
- why_sv: Volym avgör om en förändring lönar sig och vilken typ av lösning som är rimlig.
- why_en: Volume decides whether a change pays off and which kind of solution is reasonable.
- fills: workflow.volume

### Q-CORE-03
- stage: pre
- priority: 1
- audience: user, manager
- topic: pain-points
- type: list
- sv: Vilka tre moment i vardagen tar mest tid eller upplevs som mest frustrerande?
- en: Which three moments in your working day take the most time or feel the most frustrating?
- why_sv: Det är där förbättringar ger mest effekt och där ni själva ser värdet.
- why_en: That is where improvements have the most effect and where you yourselves see the value.
- fills: opportunities.pain-points

### Q-CORE-04
- stage: pre
- priority: 1
- audience: user, manager
- topic: tools
- type: list
- sv: Vilka system och verktyg använder ni dagligen, till exempel ärendehantering, dokumenthantering, e-post, tidredovisning, branschspecifika system och mallar?
- en: Which systems and tools do you use daily, for example case management, document management, email, time recording, industry-specific systems and templates?
- why_sv: Vi måste utgå från det ni redan har och betalar för innan vi föreslår något nytt.
- why_en: We must start from what you already have and pay for before suggesting anything new.
- fills: systems.inventory

### Q-CORE-05
- stage: pre
- priority: 1
- audience: user
- topic: artifact
- type: artifact
- sv: Skicka gärna ett anonymiserat exempel på hur arbetet ser ut, till exempel en mall, checklista eller ett flödesschema. Ta bort namn, personnummer, ärendenummer och allt som omfattas av sekretess.
- en: Please send an anonymised example of how the work looks, for example a template, checklist or flow chart. Remove names, personal identity numbers, case numbers and anything covered by confidentiality.
- why_sv: Ett konkret exempel visar mer än en beskrivning och gör mötet effektivare.
- why_en: A concrete example shows more than a description and makes the meeting more effective.
- fills: workflow.artifacts
- sensitive: yes

### Q-CORE-06
- stage: pre
- priority: 2
- audience: user
- topic: repetition
- type: list
- sv: Vilka uppgifter gör ni om och om igen med små variationer?
- en: Which tasks do you do again and again with small variations?
- why_sv: Återkommande uppgifter med tydliga regler är de bästa kandidaterna för stöd eller automatisering.
- why_en: Recurring tasks with clear rules are the best candidates for support or automation.
- fills: opportunities.repetition

### Q-CORE-07
- stage: pre
- priority: 2
- audience: user, manager
- topic: waiting
- type: list
- sv: Var i arbetet väntar ni mest på andra, till exempel kollegor, klienter, myndigheter eller externa system?
- en: Where in the work do you wait most on others, for example colleagues, clients, authorities or external systems?
- why_sv: Väntetid och överlämningar är ofta större förlorad tid än själva handläggningen.
- why_en: Waiting and handoffs are often a bigger loss of time than the actual handling.
- fills: workflow.handoffs

### Q-CORE-08
- stage: pre
- priority: 2
- audience: user
- topic: knowledge
- type: open
- sv: Hur hittar och återanvänder ni tidigare arbete, till exempel mallar, beslut, utlåtanden eller interna riktlinjer?
- en: How do you find and reuse earlier work, for example templates, decisions, opinions or internal guidelines?
- why_sv: Kunskapsåteranvändning är ett av de vanligaste och mest värdefulla förbättringsområdena.
- why_en: Knowledge reuse is one of the most common and most valuable areas for improvement.
- fills: opportunities.knowledge

### Q-CORE-09
- stage: pre
- priority: 3
- audience: manager
- topic: constraints
- type: open
- sv: Finns regler eller policyer som begränsar vilka verktyg ni får använda, till exempel IT-policy, kundkrav, sekretess, branschregler eller upphandlingsregler?
- en: Are there rules or policies that limit which tools you may use, for example IT policy, customer requirements, confidentiality, industry rules or procurement rules?
- why_sv: Det avgör direkt vilka lösningar som är möjliga att köpa eller bygga.
- why_en: It directly decides which solutions are possible to buy or build.
- fills: constraints.policy

### Q-CORE-10
- stage: pre
- priority: 3
- audience: manager, it
- topic: skills
- type: choice
- options_sv: Vi har egen IT/utveckling; Vi har en person som scriptar eller bygger; Vi köper allt av externa leverantörer; Vet inte
- options_en: We have in-house IT/development; We have one person who scripts or builds; We buy everything from external vendors; Don't know
- sv: Vilken teknisk kompetens finns inom organisationen?
- en: What technical capability exists within the organisation?
- why_sv: Det avgör om det är realistiskt att bygga och underhålla en egen lösning.
- why_en: It decides whether building and maintaining an in-house solution is realistic.
- fills: constraints.skills

### Q-CORE-18
- stage: pre
- priority: 1
- audience: user, manager, it
- topic: desired-state
- type: open
- sv: Om ni fick önska fritt: hur skulle arbetet fungera om ett halvår, och vad skulle vara annorlunda mot idag?
- en: If you could wish freely: how would the work run in six months, and what would be different from today?
- why_sv: Önskat läge visar vad en lösning ska uppnå och hjälper oss skilja behov från vanor.
- why_en: The desired state shows what a solution must achieve and helps us tell needs from habits.
- fills: opportunities.desired-state

### Q-CORE-19
- stage: pre
- priority: 1
- audience: it
- topic: platform-detail
- type: list
- sv: Lista era viktigaste system. För varje: namn och utgåva, om det är molntjänst eller driftas hos er, om det finns API eller export, vem som administrerar det och ungefär när avtalet förnyas.
- en: List your most important systems. For each: name and edition, whether it is a cloud service or hosted by you, whether it has an API or export, who administers it and roughly when the contract renews.
- why_sv: Det avgör om vi kan bygga ovanpå det ni har, konfigurera det eller om ett köp är rimligt, och när.
- why_en: It decides whether we can build on what you have, configure it, or whether a purchase is reasonable, and when.
- fills: systems.platforms

### Q-CORE-20
- stage: pre
- priority: 1
- audience: manager, it
- topic: requirements
- type: list
- sv: Vilka krav måste en ny lösning uppfylla, till exempel IT- och säkerhetsgodkännande, var data får lagras, inloggning (SSO), upphandling eller avtalsprocess, och ungefär hur lång tid tar det?
- en: Which requirements must a new solution meet, for example IT and security approval, where data may be stored, sign-in (SSO), procurement or contract process, and roughly how long does it take?
- why_sv: Kraven avgör vilka alternativ som är möjliga att köpa eller bygga och hur snabbt det kan ske.
- why_en: The requirements decide which options are possible to buy or build and how fast it can happen.
- fills: constraints.requirements

### Q-CORE-11
- stage: meeting
- priority: 1
- topic: walkthrough
- type: open
- sv: Gå igenom ett nyligen avslutat ärende eller en leverans från start till slut: vad hände, i vilken ordning, vem gjorde vad och i vilket system?
- en: Walk us through a recently closed case or delivery from start to finish: what happened, in which order, who did what and in which system?
- why_sv: Ett verkligt exempel avslöjar steg och överlämningar som en beskrivning missar.
- why_en: A real example reveals steps and handoffs that a description misses.
- fills: workflow.as-is

### Q-CORE-12
- stage: meeting
- priority: 1
- topic: errors
- type: open
- sv: Var uppstår fel, omarbete eller risk för att något missas, och vad kostar det?
- en: Where do errors, rework or the risk of missing something arise, and what does it cost?
- why_sv: Risk och kvalitetsbrister väger ofta tyngre än tidsbesparing i reglerat arbete.
- why_en: Risk and quality gaps often weigh more than time savings in regulated work.
- fills: opportunities.risk

### Q-CORE-13
- stage: meeting
- priority: 2
- topic: prior-attempts
- type: open
- sv: Vad har ni redan provat, till exempel verktyg, automatisering eller AI-stöd, och vad hände?
- en: What have you already tried, for example tools, automation or AI support, and what happened?
- why_sv: Vi vill undvika att upprepa misslyckade försök och bygga vidare på det som fungerade.
- why_en: We want to avoid repeating failed attempts and build on what worked.
- fills: history.attempts

### Q-CORE-14
- stage: meeting
- priority: 2
- topic: decision
- type: open
- sv: Vem beslutar om nya verktyg eller arbetssätt, hur lång tid tar ett beslut, och vem betalar?
- en: Who decides on new tools or ways of working, how long does a decision take, and who pays?
- why_sv: Utan beslutsfattare och budgetägare blir även en bra rekommendation stående.
- why_en: Without a decision-maker and a budget owner even a good recommendation stalls.
- fills: engagement.decision

### Q-CORE-15
- stage: meeting
- priority: 2
- topic: success
- type: open
- sv: Hur skulle ni mäta att något har blivit bättre, till exempel timmar per ärende eller leverans, ledtid eller antal fel?
- en: How would you measure that something has improved, for example hours per case or delivery, lead time or number of errors?
- why_sv: Mätbara mål gör att vi kan visa effekt och prioritera rätt.
- why_en: Measurable goals let us show effect and prioritise correctly.
- fills: opportunities.success-metric

### Q-CORE-16
- stage: meeting
- priority: 2
- topic: ai-attitude
- type: open
- sv: Hur ser teamet på AI-stöd, och finns det röda linjer, till exempel att kund- eller känsligt material aldrig får lämna er egen miljö?
- en: How does the team see AI support, and are there red lines, for example that customer or sensitive material may never leave your own environment?
- why_sv: Inställning och röda linjer styr vilka lösningar som är värda att utreda.
- why_en: Attitude and red lines steer which solutions are worth investigating.
- fills: constraints.ai
- sensitive: yes

### Q-CORE-17
- stage: meeting
- priority: 3
- topic: budget
- type: number
- sv: Finns det en budgetram för engångskostnad och löpande kostnad per månad, även som intervall?
- en: Is there a budget range for one-off cost and recurring monthly cost, even as an interval?
- why_sv: Budget avgör skillnaden mellan prenumeration, integration och egen utveckling.
- why_en: Budget decides the difference between a subscription, an integration and in-house development.
- fills: constraints.budget
