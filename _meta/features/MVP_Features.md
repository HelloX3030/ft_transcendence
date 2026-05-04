# MVP-Features

# MVP Feature-Liste — Trailer Tinder

*Stand: April 2026 · Final für MVP-Scope · Modulpunkte: 14 (Pflicht-Minimum)*

---

## 🎬 Core Mechanik

- Vertikaler TikTok-Style Trailer-Feed (Vollbild, Autoplay)
- Swipe-Aktionen: Like / Dislike / Save
- Gemischter Katalog: neue Releases, Klassiker, Nischenfilme

## 🤖 Recommendation Engine

- Empfehlung auf Basis expliziter Präferenzen (Genres, Regisseure, Schauspieler)
- Empfehlung auf Basis impliziten Verhaltens (Likes, Verweildauer, Skip-Speed, Kommentare, Shares)

## 👤 Profil & Onboarding

- Profilerstellung mit Lieblings-Genres / Regisseuren / Schauspielern
- Top-5-Lieblingsfilme im Onboarding (Cold-Start-Signal)
- Settings zur jederzeitigen Anpassung der Präferenzen
- **Avatar-Upload** (mit Default-Avatar, falls keiner gewählt)
- **OAuth-Login** (Google oder 42)

## 👥 Soziale Features

- Friends-System (hinzufügen / entfernen)
- **Online-Status der Freunde sichtbar**
- **Basic Chat zwischen Freunden** (1:1, nur Text — keine Gruppen, kein Trailer-Sharing)

## 🍿 Movie Night Mode

- Gruppen-Session starten und Freunde einladen
- Alle swipen gleichzeitig in Echtzeit
- Live-Ranking auf Basis der Überschneidungen

## 📋 Listen & Watchlists

- Persönliche Watchlist

## 🔔 Notifications

- Movie-Night-Einladungen
- Friend-Requests

## ⚖️ Compliance & Datenschutz

- Daten-Export (GDPR-konform)
- Account-Löschung inkl. vollständiger Datenlöschung

## Modul-Punkte-Zuordnung

| # | Modul | Typ | Pkt | Abgedeckt durch |
| --- | --- | --- | --- | --- |
| 1 | Frontend + Backend Framework | Major | 2 | Allgemeine Architektur (z.B. React + NestJS) |
| 2 | Real-time mit WebSockets | Major | 2 | Movie Night Mode (Live-Swiping & -Ranking) |
| 3 | User Interaction (Chat + Profile + Friends) | Major | 2 | Friends-System + Profile + Basic Chat |
| 4 | Standard User Management | Major | 2 | Profil + Avatar-Upload + Online-Status |
| 5 | Recommendation System mit ML | Major | 2 | Recommendation Engine (Kern-Feature) |
| 6 | ORM | Minor | 1 | Backend-Datenzugriff |
| 7 | OAuth 2.0 | Minor | 1 | OAuth-Login (Google/42) |
| 8 | Notification System | Minor | 1 | In-App-Benachrichtigungen |
| 9 | GDPR-Compliance | Minor | 1 | Daten-Export + Löschung |
|  | **Gesamt** |  | **14** |  |

→ **Pflicht-Minimum erreicht.** Kein Bonus-Puffer.

## Empfehlung für Bonus-Module *(später hinzufügbar)*

Sobald MVP steht, könnt ihr für Bonus-Punkte ergänzen:

Modul	Typ	Pkt	Aufwand
2FA	Minor	1	gering
Sentiment-Analyse auf Kommentaren	Minor	1	mittel (setzt Kommentare voraus)
Multi-Language i18n (3+ Sprachen)	Minor	1	mittel
Custom Design System (10+ Komponenten)	Minor	1	gering, nebenbei
WAF + Vault	Major	2	hoch (DevOps)
Advanced Analytics Dashboard	Major	2	hoch
???			
