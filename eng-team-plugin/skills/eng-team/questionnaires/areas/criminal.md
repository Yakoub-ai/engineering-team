---
id: area-criminal
kind: questionnaire
domain: legal
scope: area
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
sources:
  - title: Regulation (EU) 2016/679 (GDPR), Article 10
    url: https://eur-lex.europa.eu/eli/reg/2016/679/oj
    accessed: 2026-10-20
  - title: Lag (2018:218) med kompletterande bestämmelser till EU:s dataskyddsförordning, 3 kap. 8 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser-till_sfs-2018-218/
    accessed: 2026-10-20
  - title: Brottsdatalag (2018:1177), 1 kap. 1 §
    url: https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/brottsdatalag-20181177_sfs-2018-1177/
    accessed: 2026-10-20
---
# Area: criminal law (straffrätt, brottmål; defence, victim counsel and prosecution-side work)

Highest sensitivity. Ask about workflow and volume; never ask the client to send case content.

### Q-CRI-01
- stage: pre
- priority: 1
- topic: case-volume
- type: number
- sv: Hur många brottmål hanterar teamet per månad, och vilken roll har ni (försvarare, målsägandebiträde, åklagarsida, annat)?
- en: How many criminal cases does the team handle per month, and what is your role (defence, victim counsel, prosecution side, other)?
- why_sv: Rollen avgör vilka regler och verktyg som är aktuella.
- why_en: The role decides which rules and tools are relevant.
- fills: engagement.team

### Q-CRI-02
- stage: pre
- priority: 1
- topic: case-file-size
- type: number
- sv: Hur stora är förundersökningsprotokoll och bilagor i ett typiskt mål (sidor, filer, ljud och video), och hur tar ni emot dem?
- en: How large are investigation files and annexes in a typical case (pages, files, audio and video), and how do you receive them?
- why_sv: Materialmängd och format avgör om genomgångsstöd är realistiskt och var det måste köras.
- why_en: Material volume and format decide whether review support is realistic and where it must run.
- fills: workflow.volume

### Q-CRI-03
- stage: pre
- priority: 1
- topic: time-pressure
- type: list
- sv: Vilka moment har hårda tidsgränser, till exempel häktningsförhandlingar eller överklagandefrister, och hur bevakar ni dem?
- en: Which steps have hard time limits, for example custody hearings or appeal deadlines, and how do you track them?
- why_sv: Tidspress ökar värdet av stöd men också kostnaden för fel.
- why_en: Time pressure raises the value of support but also the cost of errors.
- fills: opportunities.deadlines

### Q-CRI-04
- stage: pre
- priority: 2
- topic: handling-restrictions
- type: open
- sv: Vilka regler eller instruktioner gäller för hur utredningsmaterial får lagras och delas, till exempel från domstol, åklagare eller klient?
- en: Which rules or instructions apply to how investigation material may be stored and shared, for example from the court, prosecutor or client?
- why_sv: Hanteringsregler avgör vilka molnverktyg och AI-lösningar som alls kan komma i fråga.
- why_en: Handling rules decide which cloud tools and AI solutions can be considered at all.
- fills: constraints.policy
- sensitive: yes

### Q-CRI-05
- stage: meeting
- priority: 1
- topic: material-review
- type: open
- sv: Hur går genomgången av utredningsmaterial till, till exempel avlyssning, telefonutdrag och förhör, och var tar tiden vägen?
- en: How does review of investigation material work, for example interception, phone extractions and interviews, and where does the time go?
- why_sv: Genomgång av stora materialmängder är den största tidsposten men också det känsligaste momentet.
- why_en: Reviewing large material volumes is the biggest time item but also the most sensitive step.
- fills: workflow.as-is
- sensitive: yes

### Q-CRI-06
- stage: meeting
- priority: 2
- topic: client-contact
- type: open
- sv: Hur kommunicerar ni med klienter som är frihetsberövade eller har begränsad tillgång till teknik, och hur delar ni handlingar säkert?
- en: How do you communicate with clients who are detained or have limited access to technology, and how do you share documents securely?
- why_sv: Kommunikationsvägar och säkerhet sätter ramen för varje digital lösning.
- why_en: Communication routes and security frame every digital solution.
- fills: constraints.client-requirements

### Q-CRI-07
- stage: meeting
- priority: 3
- topic: fees
- type: open
- sv: Hur hanteras ersättning och tidsredovisning för offentlig försvarare, målsägandebiträde och rättshjälp?
- en: How are compensation and time recording handled for public defence counsel, victim counsel and legal aid?
- why_sv: Ersättningsrutiner är regelstyrda och återkommande i varje mål.
- why_en: Compensation routines are rule-driven and recur in every case.
- fills: opportunities.billing

## Guardrails

- Personal data about criminal convictions and offences may be processed only under the control of official authority or where Union or Member State law authorises it with appropriate safeguards. Source: GDPR Article 10.
- In Sweden, 3 kap. 8 § of the Data Protection Act lets authorities process Article 10 data, and permits others only for archive rules; further permissions may be granted by regulation under 3 kap. 9 §. `needs-evidence`: which permission a law firm relies on, and the current authority regulations under 3 kap. 9 §, were not verified. Check with IMY. Source: Lag (2018:218) 3 kap. 8 §.
- The Criminal Data Act (brottsdatalagen) implements Directive (EU) 2016/680 for competent authorities' processing for crime-related purposes; it governs the authority side (police, prosecutors, courts), not a defence firm's own systems. Source: Brottsdatalag (2018:1177) 1 kap. 1 §.
- Default for this area: no AI or cloud processing of case material until the firm's legal basis, the vendor's hosting location and the handling rules in Q-CRI-04 are documented. `opinion:` conservative default pending legal review.
