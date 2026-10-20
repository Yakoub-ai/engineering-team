---
id: client-public-authority
kind: questionnaire
domain: legal
scope: client-type
status: unreviewed
reviewed_by:
review_by: 2027-04-20
languages: [sv, en]
---
# Client type: public authority or municipality (myndighet, kommun, region)

### Q-PUB-01
- stage: pre
- priority: 2
- topic: case-handling
- type: open
- sv: Hur går ett ärende till hos er från inkommen handling till beslut, och i vilket system registreras och diarieförs det?
- en: How does a case flow from incoming document to decision, and in which system is it registered?
- why_sv: Handläggningsflödet och diariesystemet är ramen för all förändring.
- why_en: The case-handling flow and the registry system are the frame for any change.
- fills: workflow.as-is

### Q-PUB-02
- stage: pre
- priority: 2
- topic: lead-time
- type: number
- sv: Vad är en typisk handläggningstid, och finns lagstadgade eller interna tidsgränser som är svåra att hålla?
- en: What is a typical handling time, and are there statutory or internal time limits that are hard to meet?
- why_sv: Ledtid och tidsgränser är ofta det tydligaste måttet på förbättring.
- why_en: Lead time and time limits are often the clearest measure of improvement.
- fills: opportunities.success-metric

### Q-PUB-03
- stage: meeting
- priority: 1
- topic: disclosure
- type: open
- sv: Hur hanterar ni begäran om utlämnande av allmänna handlingar och prövning av sekretess, och hur stor del är manuellt arbete?
- en: How do you handle requests for access to public documents and confidentiality assessments, and how much is manual work?
- why_sv: Sekretessprövning är juridiskt känsligt, så stöd måste designas så att människan beslutar.
- why_en: Confidentiality assessment is legally sensitive, so support must be designed so a human decides.
- fills: opportunities.disclosure
- sensitive: yes

### Q-PUB-04
- stage: meeting
- priority: 2
- topic: procurement
- type: open
- sv: Hur upphandlas nya system hos er, och finns krav på hosting inom Sverige eller EU, säkerhetsklassning eller ramavtal som begränsar valet?
- en: How are new systems procured, and do requirements on hosting in Sweden or the EU, security classification or framework agreements limit the choice?
- why_sv: Upphandling och säkerhetskrav avgör om en köpt lösning ens är möjlig.
- why_en: Procurement and security requirements decide whether a bought solution is even possible.
- fills: constraints.procurement
