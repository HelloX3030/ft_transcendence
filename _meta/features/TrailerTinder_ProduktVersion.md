# TrailerTinder — Produktvision

# Trailer Tinder — Produktvision

*Version 2.0 · Stand: April 2026 · Autor: Chris (Product Owner)Update zu v1: klare Trennung zwischen MVP-Scope und Post-MVP-Roadmap*

---

## 1. Vision

Eine mobile-first Web-Application, mit der Nutzer:innen Filme über kurze Trailer entdecken — schnell, intuitiv und sozial. Statt durch endlose Streaming-Kataloge zu scrollen, fällt die Entscheidung in 30 Sekunden auf Basis dessen, was wirklich zählt: dem Film selbst.

## 2. Mehrwert

- **Schnellere Entdeckung:** Trailer-first statt Lesen von Coverbildern und Beschreibungen.
- **Unterhaltung im Prozess:** Der Swipe-Mechanismus ist selbst kurzweilig.
- **Personalisierung:** Ein Recommendation System lernt mit jeder Interaktion und liefert zunehmend treffendere Vorschläge.
- **Soziale Komponente:** Gemeinsame Filmauswahl mit Freunden ist nicht Zusatzfeature, sondern Kern.

## 3. Zielgruppe

Streaming-Nutzer:innen zwischen 18 und 35 Jahren, die zu viel Auswahl bei zu wenig Orientierung haben. Mobile-First, sozial vernetzt, gewohnt an Short-Form-Content (TikTok, Reels).

## 4. Kern-Konzept

Beim App-Start landet der Nutzer direkt im **Swipe-Modus** im TikTok-Format: Trailer werden als vertikaler Vollbild-Feed dargestellt und automatisch abgespielt. Es gibt keine separate Browse-Ansicht — die Discovery ist der primäre Modus.

Das Trailer-Repertoire umfasst neue Releases, Klassiker und Nischenproduktionen ohne Vorab-Eingrenzung. *(Offen: konkrete Eingrenzungslogik — etwa nach Verfügbarkeit auf Streaming-Diensten oder Mindest-Bekanntheitsschwelle.)*

---

## 5. MVP-Scope

Der MVP umfasst alle Funktionen, die für die Projekt-Abgabe verbindlich gebaut werden. Er deckt das Pflicht-Minimum von **14 Modulpunkten** ab und enthält das zentrale Differenzierungs-Feature (Movie Night Mode).

### 5.1 Core Mechanik

- Vertikaler TikTok-Style Trailer-Feed (Vollbild, Autoplay)
- Swipe-Aktionen: Like / Dislike / Save
- Gemischter Katalog: neue Releases, Klassiker, Nischenfilme

### 5.2 Recommendation Engine (Basis)

Empfehlungen basieren im MVP auf zwei Datenquellen:

- **Explizite Präferenzen:** Genres, Regisseur:innen, Schauspieler:innen (aus Profilerstellung und Settings).
- **Implizites Verhalten:** Likes, Verweildauer, Skip-Speed, Kommentare, Shares.

### 5.3 Profil & Onboarding

- Profilerstellung mit Lieblings-Genres / Regisseuren / Schauspielern.
- Top-5-Lieblingsfilme im Onboarding (Cold-Start-Signal).
- Settings zur jederzeitigen Anpassung der Präferenzen.
- Avatar-Upload (mit Default-Avatar, falls keiner gewählt).
- OAuth-Login (Google oder 42).

### 5.4 Soziale Features

- Friends-System (hinzufügen / entfernen).
- Online-Status der Freunde sichtbar.
- Basic Chat zwischen Freunden (1:1, nur Text — keine Gruppen, kein Trailer-Sharing).

### 5.5 Movie Night Mode *(Differenzierungs-Feature)*

- Gruppen-Session starten und Freunde einladen.
- Alle swipen gleichzeitig in Echtzeit.
- Live-Ranking auf Basis der Überschneidungen.

### 5.6 Listen & Watchlists

- Persönliche Watchlist.

### 5.7 Notifications

- Movie-Night-Einladungen.
- Friend-Requests.

### 5.8 Compliance & Datenschutz

- Daten-Export (GDPR-konform).
- Account-Löschung inkl. vollständiger Datenlöschung.

---

## 6. Post-MVP · Add-On-Roadmap

Die folgenden Features gehören zur Produktvision, sind aber bewusst aus dem MVP herausgehalten. Sie können bei Verfügbarkeit von Restkapazität während des Projekts als **Bonus-Module** ergänzt werden (max. +5 Punkte) oder gelten als Roadmap für eine spätere Weiterentwicklung.

### 6.1 Recommendation Engine — Erweiterungen

- Empfehlung auf Basis sozialer Signale (*"gefällt XY"*Badge bei Freunde-Likes).
- *"Why am I seeing this?"* — erklärbarer Recommender mit Begründung pro Trailer.

### 6.2 Profil & Onboarding — Erweiterungen

- Mood-Filter im Onboarding (*"Wofür bist du heute in Stimmung?"*).

### 6.3 Soziale Features — Erweiterungen

- Match mit Freunden bei gleichem Like (*"You and Max both liked Inception"*).
- Match-Score (Geschmacks-Ähnlichkeit).
- Empfehlungen auf Basis gemeinsamer Likes.
- Entdecken neuer Leute mit ähnlichem Geschmack.
- Standort-basiertes Finden anderer Nutzer.
- Gruppen-Chats.

### 6.4 Movie Night Mode — Erweiterungen

- Live-Anzeige während der Session (*"Top Film: Inception — 3/4 Likes"*).

### 6.5 Listen & Watchlists — Erweiterungen

- Geteilte Watchlists mit Freunden (*"Filme für Freitag"*).
- Voting innerhalb von Listen.
- Kommentare pro Film in Listen.
- Sortierung nach Beliebtheit / Datum.

### 6.6 Filter & Discovery *(neu in v2)*

- Streaming-Provider-Filter (Netflix, Prime, Disney+, etc.).
- Top-10 Trending Filme.
- Laufzeit-Filter (*"Nur Filme bis 90 Min"*).

### 6.7 Kommunikation — Erweiterungen

- Direktnachrichten zwischen Freunden (volle DM-Funktionalität).
- Trailer-Sharing in DMs.
- Chat-Funktion (1:1 und Gruppen).
- AI-Inhaltsmoderation für Kommentare und Chats.
- Sentiment-Analyse auf Kommentaren.

### 6.8 Notifications & Sharing — Erweiterungen

- Notification bei Filmfortsetzungen (Sequel-Alert).
- QR-Code pro Trailer für Sharing mit Nicht-App-Nutzern.
- Match-Alert.

### 6.9 Gamification & Engagement *(neu in v2)*

- Achievements / Badges.
- Daily Swipe Streaks.

### 6.10 Bewertung & Feedback *(neu in v2)*

- Bewertungssystem nach dem Schauen (*"Hast du es geschaut? Wie war's?"*) — füttert den Recommender mit echten Ratings.

---

## 7. Modul-Punkte-Übersicht

### MVP — 14 Pflicht-Punkte

| # | Modul | Typ | Pkt | Abgedeckt durch |
| --- | --- | --- | --- | --- |
| 1 | Frontend + Backend Framework | Major | 2 | Allgemeine Architektur |
| 2 | Real-time WebSockets | Major | 2 | Movie Night Mode |
| 3 | User Interaction (Chat + Profile + Friends) | Major | 2 | Section 5.4 |
| 4 | Standard User Management | Major | 2 | Section 5.3 (Profil + Avatar + Online-Status) |
| 5 | Recommendation System ML | Major | 2 | Section 5.2 |
| 6 | ORM | Minor | 1 | Backend-Datenzugriff |
| 7 | OAuth 2.0 | Minor | 1 | Section 5.3 |
| 8 | Notification System | Minor | 1 | Section 5.7 |
| 9 | GDPR | Minor | 1 | Section 5.8 |
|  | **Gesamt** |  | **14** |  |

### Bonus-Optionen aus der Add-On-Roadmap (max. +5 Punkte)

| Add-On Feature | Mapped Module | Typ | Pkt |
| --- | --- | --- | --- |
| AI-Inhaltsmoderation (6.7) | Content Moderation AI | Minor | 1 |
| Sentiment-Analyse auf Kommentaren (6.7) | Sentiment Analysis | Minor | 1 |
| Gamification: Achievements + Streaks (6.9) | Gamification | Minor | 1 |
| Erweiterte Filter: Laufzeit + Trending (6.6) | Advanced Search | Minor | 1 |
| Geteilte Watchlists mit Voting (6.5) | Real-time Collaborative | Minor | 1 |

### Zusätzliche Bonus-Module (außerhalb der Add-On-Liste)

Falls weitere Bonuspunkte benötigt werden, hier sinnvoll umsetzbare Module:

| Modul | Typ | Pkt | Anmerkung |
| --- | --- | --- | --- |
| 2FA | Minor | 1 | Sicherheits-Reife |
| Multi-Language i18n (3+ Sprachen) | Minor | 1 | Lässt sich nebenbei umsetzen |
| Custom Design System (10+ Komponenten) | Minor | 1 | Entsteht ohnehin beim Frontend-Bauen |
| WAF + Vault | Major | 2 | DevOps-Aufwand, dafür Major |

---

## 8. Offene Fragen

- Genaue Eingrenzungslogik des Filmkatalogs (Bekanntheit, Budget, Verfügbarkeit?).
- Daten- und Trailerquelle: TMDB-API + YouTube-Embed als Default?
- Soll die App als PWA für Mobile-Feeling deployt werden?
- Wie genau wird die Verweildauer als Recommender-Signal gewichtet?
- MVP-Zeitplan: welche Wochen sind welchen Sub-Bereichen gewidmet?
