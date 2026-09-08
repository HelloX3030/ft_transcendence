# CineMatch – Algorithm Architecture

> Reine Referenz für den Empfehlungsalgorithmus
> Sprache: Python 3.11+ | Frameworks: FastAPI, scikit-learn, NumPy, SciPy
> Letzter Stand: Mai 2026

---

## 1. Mathematische Grundlagen

### 1.1 Content-Based Filtering – Der Film als Vektor

Jeder Film wird in einen hochdimensionalen Feature-Vektor überführt:

$$\vec{f} = [g_1, g_2, \ldots, g_n,\ k_1, k_2, \ldots, k_m,\ a_1, a_2, \ldots, a_p]$$

| Komponente | Quelle (TMDB) | Typ | Dimension |
|:--|:--|:--|:--|
| $g_i$ | `genres` | $\{0,1\}$ binär | ~20 |
| $k_i$ | `keywords` | TF-IDF-gewichtet (float) | ~1000 (sparse) |
| $a_i$ | `cast` + `crew` (director only) | $\{0,1\}$ binär | ~500 (top actors) |

> **Hinweis zu $k_i$:** Keywords werden TF-IDF-gewichtet statt binär kodiert. Rein binäre Keyword-Vektoren in hoher Dimension sind extrem dünnbesetzt — die Kosinus-Ähnlichkeit wird dadurch unzuverlässig, weil die dichte Genre-Komponente dominiert.

**Nutzerprofil-Vektor** (gewichteter Durchschnitt aller Likes, mit exponentiellem Zeitverfall):

$$\vec{u} = \frac{\displaystyle\sum_{f \in L_u} w_f \cdot \vec{f}}{\displaystyle\sum_{f \in L_u} w_f}$$

wobei:
- $L_u$ = Menge der gelikten Filme von Nutzer $u$
- $w_f = e^{-\lambda \cdot \text{age}_f}$ (exponentieller Zeitverfall)
- $\text{age}_f$ = Tage seit der Interaktion
- $\lambda = 0.01$ (Zerfallskonstante, Hyperparameter)

Der Profil-Vektor $\vec{u}$ wird nach jeder Interaktion inkrementell aktualisiert und **in der Datenbank persistiert** (siehe 2.6). Beim Start des Services wird er geladen, nicht neu berechnet.

**Kosinus-Ähnlichkeit** zwischen Nutzerprofil und Film:

$$S_{\text{vec}}(\vec{u}, \vec{f}) = \frac{\vec{u} \cdot \vec{f}}{\|\vec{u}\| \cdot \|\vec{f}\|}$$

### 1.2 NLP-Erweiterung – TF-IDF auf dem Overview

Für den Fließtext der Filmbeschreibung (`overview`) wird ein separater TF-IDF-Vektor erstellt:

$$\text{tf-idf}(t, d) = \text{tf}(t, d) \cdot \log\!\left(\frac{N}{\text{df}(t)}\right)$$

wobei:
- $t$ = Term (Wort), $d$ = Dokument (Filmbeschreibung)
- $N$ = Gesamtzahl der Dokumente
- $\text{tf}$ = Häufigkeit des Terms im Dokument
- $\text{df}$ = Anzahl Dokumente, die den Term enthalten

Ähnlichkeit zwischen Nutzer-Übersichtsvektor und Film:

$$S_{\text{overview}}(\vec{u}_{\text{tfidf}},\ \vec{f}_{\text{tfidf}}) = \frac{\vec{u}_{\text{tfidf}} \cdot \vec{f}_{\text{tfidf}}}{\|\vec{u}_{\text{tfidf}}\| \cdot \|\vec{f}_{\text{tfidf}}\|}$$

> **Hinweis zum Scope:** TF-IDF-Vektoren werden nicht über den gesamten TMDB-Katalog aufgebaut, sondern **nur über den aktuellen Kandidaten-Pool** (60–80 Filme, die TMDB zurückgibt). Der Index ist dadurch leichtgewichtig und muss nicht vorberechnet werden.

> **Abgrenzung zu 1.1:** Die TF-IDF-Vektoren fangen semantischen Kontext ein, den TMDB-Keywords nicht abdecken. Beide Quellen werden explizit gewichtet kombiniert (siehe 1.4), um doppelte Gewichtung ähnlicher Informationen zu vermeiden.

### 1.3 Collaborative Filtering – Matrix-Faktorisierung (SVD)

**Nutzer-Film-Interaktionsmatrix** (gespeist aus der DB, siehe 2.6):

$$R \in \mathbb{R}^{|U| \times |F|}$$

Einträge: $+1$ = Like, $0$ = keine Interaktion, $-1$ = Dislike.

**Singular Value Decomposition** (reduziert auf $k$ latente Faktoren):

$$R \approx U_k \cdot \Sigma_k \cdot V_k^T$$

wobei:
- $U_k \in \mathbb{R}^{|U| \times k}$: Nutzer in latenter Faktor-Repräsentation
- $V_k \in \mathbb{R}^{|F| \times k}$: Filme in latenter Faktor-Repräsentation
- $k = 50$: Anzahl latenter Faktoren (Hyperparameter)

**Vorhersage für unbewerteten Film:**

$$\hat{r}(u, f) = \vec{u}_k \cdot \Sigma_k \cdot \vec{v}_{f,k}^T$$

> **Implementierungshinweis:** $U_k \cdot \Sigma_k^{1/2}$ und $V_k \cdot \Sigma_k^{1/2}$ werden beim Modell-Laden einmalig vorberechnet und gespeichert. Zur Laufzeit reduziert sich die Vorhersage auf ein einfaches Dot-Product.

### 1.4 Hybrid Score

Der Content-Score kombiniert Feature-Vektor und Overview-TF-IDF:

$$S_{\text{content}}(u, f) = \beta \cdot S_{\text{vec}}(\vec{u}, \vec{f}) + (1 - \beta) \cdot S_{\text{overview}}(\vec{u}_{\text{tfidf}}, \vec{f}_{\text{tfidf}})$$

Der finale Hybrid-Score:

$$S_{\text{hybrid}}(u, f) = \alpha \cdot S_{\text{content}}(u, f) + (1 - \alpha) \cdot \hat{r}(u, f)$$

wobei:
- $\alpha = 0.6$: Gewicht Content vs. Collaborative (Hyperparameter)
- $\beta = 0.7$: Gewicht Feature-Vektor vs. Overview-TF-IDF (Hyperparameter)

### 1.5 Cold-Start Fallback

Collaborative Filtering braucht ausreichend Interaktionsdaten. Neue Nutzer durchlaufen folgende Fallback-Kette:

| Interaktionen $|L_u|$ | Strategie | $\alpha$ (effektiv) |
|:--|:--|:--|
| $0$ | Popularity-Ranking (TMDB `popularity`) + Onboarding-Genres | — |
| $1$–$9$ | Content-only (kein Collaborative Filtering) | $1.0$ |
| $\geq 10$ | Voller Hybrid-Score | $0.6$ |

Das Onboarding liefert zwei Cold-Start-Signale:
1. **Explizite Genre-Präferenzen** → initialisiert $\vec{u}$ direkt ohne Likes
2. **Top-5-Lieblingsfilme** → werden als virtuelle Likes mit $\text{age}_f = 0$ in $L_u$ eingetragen

> **Cold-Start und Parameter-Translation:** Auch im reinen Popularity-Modus wird die Parameter-Translation genutzt — der TMDB-Aufruf wird dann allein durch Genre-Präferenzen aus dem Onboarding und `sort_by=popularity.desc` gesteuert, ohne Profil-Vektor.

### 1.6 Engagement-Signale (Real-Time Layer)

Alle Signale werden sofort in der DB gespeichert (siehe 2.6) und inkrementell auf den Profil-Vektor $\vec{u}$ angewendet.

| Signal | Bedingung | $\Delta$ Score | Begründung |
|:--|:--|:--|:--|
| `skip_fast` | `watch_time < 2s` | $-0.50$ | Starkes negatives Signal |
| `watched_long` | `watch_time > 70%` | $+0.30$ | Hohes Interesse |
| `rewatch` | selber Trailer erneut angesehen | $+0.60$ | Maximales Interesse |
| `share` | Trailer geteilt | $+0.60$ | Sozialer Beweis |
| `dislike` | aktives Dislike | $-0.40$ | Explizite Ablehnung |
| `like` | aktives Like | $+0.20$ | Positives Basissignal |
| `watchlist_add` | Film zur Watchlist hinzugefügt | $+0.50$ | Starke Absichtserklärung |

### 1.7 Diversification & Freshness

**Diversifikations-Boost** (Anti-Filterblase): Wenn die letzten $n$ Empfehlungen das gleiche dominante Genre hatten, erhält ein zufälliger Film aus einem anderen Genre einen Boost:

$$S_{\text{final}} \mathrel{+}= \gamma \quad (\gamma = 0.15)$$

**Freshness-Boost** (neue Trailer bevorzugen):

$$\text{freshness}(f) = e^{-\mu \cdot \text{alter}_f}$$

wobei $\text{alter}_f$ = Tage seit Veröffentlichung des Trailers, $\mu = 0.05$.

### 1.8 Finaler Score

$$S_{\text{final}}(u, f) = S_{\text{hybrid}}(u, f) + \sum \Delta_{\text{engagement}} + \gamma \cdot \mathbb{1}_{\text{diversify}} + \delta \cdot \text{freshness}(f)$$

wobei $\delta = 0.1$ (Freshness-Gewicht, Hyperparameter).

---

## 2. Service-Architektur

Der Recommendation-Service läuft als **separater Python-Microservice (FastAPI)** neben dem NestJS-Backend. Kommunikation über das interne Docker-Netzwerk (HTTP).

```
NestJS Backend  ──HTTP──▶  FastAPI Recommender  ──▶  PostgreSQL
    :3000                        :8000
```

### 2.1 Pipeline-Überblick (Hybrid)

Der Feed wird nicht mehr durch Scoring eines lokalen Filmkatalogs erzeugt, sondern durch eine **Parameter-Translation** des Nutzerprofils in einen TMDB-Discover-Aufruf, gefolgt von einem leichtgewichtigen Re-Ranking der zurückgegebenen Kandidaten.

```
1. Nutzerprofil aus DB laden (Vektor + Interaktionshistorie)
        │
        ▼
2. Parameter-Translation: Profil-Vektor → TMDB Discover-Parameter
        │
        ▼
3. TMDB Discover API aufrufen (60–80 Ergebnisse, paginiert)   ← Ort: offen (siehe 2.2)
        │
        ▼
4. Gesehene Filme herausfiltern (aus DB-Interaktionshistorie)
   → Bei zu kleinem Pool: nächste Seite nachladen
        │
        ▼
5. Re-Ranking: Hybrid-Score auf verbleibendem Kandidaten-Pool
        │
        ▼
6. Engagement-Signale + Diversifikation anwenden
        │
        ▼
7. Top N zurückgeben: [{movie_id, score}]
```

> **Vorteil gegenüber lokalem Katalog:** Kein Aufbau oder Pflege eines vollständigen Filmvektoren-Indexes nötig. TMDB liefert automatisch neue Releases. Der TF-IDF-Index wird nur über den aktuellen Kandidaten-Pool (60–80 Filme) aufgebaut — kein wöchentliches Rebuild.

### 2.2 TMDB-Aufruf: Offene Entscheidung

Der Ort des TMDB-Aufrufs ist noch nicht final entschieden. Beide Optionen sind architektonisch valide:

| | Option A: Python ruft TMDB | Option B: NestJS ruft TMDB |
|:--|:--|:--|
| **Ablauf** | Python übersetzt Profil → Parameter → ruft TMDB → re-rankt → gibt `[{movie_id, score}]` zurück | Python gibt nur TMDB-Parameter zurück → NestJS ruft TMDB → schickt Ergebnisse ggf. zurück zum Re-Ranking |
| **NestJS↔Python-Vertrag** | Unverändert: Request `{user_id, limit}`, Response `[{movie_id, score}]` | Neuer Vertrag nötig: zwei Roundtrips oder Re-Ranking entfällt |
| **Pro** | Vollständige Pipeline im Python-Service, klare Trennung | NestJS hält TMDB-Integration zentral (falls bereits vorhanden) |
| **Con** | TMDB-Key im Python-Service, zusätzliche HTTP-Abhängigkeit | Komplexerer Ablauf; Re-Ranking ohne Python-Service schwieriger |

### 2.3 Parameter-Translation (Profil-Vektor → TMDB Discover)

Der Profil-Vektor $\vec{u}$ wird in konkrete TMDB Discover-Parameter übersetzt:

| Profil-Komponente | TMDB-Parameter | Logik |
|:--|:--|:--|
| Genre-Gewichte $g_i$ | `with_genres` | Top-3 Genres nach Gewicht, OR-verknüpft (siehe Hinweis unten) |
| Schauspieler/Regisseur $a_i$ | `with_cast`, `with_crew` | Top-2 nach Gewicht (optional, wird bei schwachen Signalen weggelassen) |
| Keyword-Gewichte $k_i$ | `with_keywords` | Top-5 Keywords nach TF-IDF-Gewicht |
| Interaktionshistorie | `vote_average.gte` | Durchschnittliche Bewertung gelikter Filme als untere Schwelle |
| Watch-Time-Signale | `primary_release_date.gte` | Präferenz für neuere Filme bei hoher Watch-Time auf aktuellen Releases |
| Diversifikations-Flag | `with_genres` (modifiziert) | Bei aktiver Diversifikation: dominantes Genre aus Top-3 entfernen |

**Beispiel-Output:**
```json
{
  "with_genres": "28,12",
  "with_keywords": "4565,1701,818",
  "with_cast": "6193",
  "vote_average.gte": 6.5,
  "vote_count.gte": 100,
  "sort_by": "popularity.desc",
  "page": 2
}
```

> **Granularität:** Die Parameter-Translation ist bewusst verlustbehaftet — sie approximiert den hochdimensionalen Profil-Vektor. Das Re-Ranking (Schritt 5 in 2.1) kompensiert diese Vergröberung durch feingranulares Scoring auf dem zurückgegebenen Pool.

> **Abweichung von der ursprünglichen Spezifikation (Issue #247):** Die obige Tabelle beschrieb ursprünglich *eine* Discover-Abfrage, in der alle Dimensionen UND-verknüpft sind. In der Praxis liefert das für aktive Nutzer null Ergebnisse: ein Film müsste alle drei Genres tragen **und** einen der Keywords **und** einen der Schauspieler **und** den Regisseur **und** beide Vote-Schwellen erfüllen. Je mehr ein Nutzer interagiert, desto leerer wird der Pool — genau umgekehrt zum gewünschten Verhalten.
>
> Stattdessen erzeugt `profile_to_query_plan()` **mehrere Abfragen**, deren Vereinigung den Kandidaten-Pool bildet:
>
> | Abfrage | Constraint | Seiten |
> |:--|:--|:--|
> | `core` | Genres OR-verknüpft + Vote-Schwellen | `tmdb_pages` |
> | `cast` | nur `with_cast` | `tmdb_facet_pages` |
> | `crew` | nur `with_crew` | `tmdb_facet_pages` |
> | `keywords` | nur `with_keywords` | `tmdb_facet_pages` |
>
> Discover ist damit für **Recall** zuständig, das Re-Ranking für **Precision** — konsistent mit dem Granularitäts-Hinweis oben. Die Facetten-Abfragen tragen bewusst keine Genre- oder Vote-Average-Einschränkung: „mehr Filme mit diesem Schauspieler" ist für sich genommen eine vollständige Absicht.
>
> Ebenfalls entschärft: `vote_average.gte` liegt jetzt um `tmdb_vote_margin` **unter** dem Profil-Durchschnitt statt exakt darauf. Eine Schwelle genau auf dem Durchschnitt aller gelikten Filme schließt definitionsgemäß die Hälfte davon aus.

### 2.4 Kandidaten-Pool, Deduplizierung & Seitenrotation

**Pool-Größe:** TMDB gibt standardmäßig 20 Ergebnisse pro Seite zurück. Es werden **3 Seiten parallel** abgefragt (60 Kandidaten), um nach Deduplizierung einen ausreichend großen Re-Ranking-Pool zu haben.

**Deduplizierung:** Gesehene Filme werden anhand der DB-Interaktionshistorie herausgefiltert (`user_interactions`-Tabelle). Ist der verbleibende Pool nach dem Filter kleiner als `2 × limit`, wird eine weitere Seite nachgeladen.

**Seitenrotation für Abwechslung:** Um zu vermeiden, dass bei identischen Parametern immer dieselben 60 Filme erscheinen, bewegt sich das Ergebnisfenster in zwei unabhängigen Achsen:

```python
base_page = crc32(f"{user_id}:{date.today().isoformat()}") % tmdb_page_window
page      = base_page + cursor * tmdb_pages + 1      # max. 500 (TMDB-Limit)
sort_by   = tmdb_sort_cycle[cursor % len(tmdb_sort_cycle)]
```

- **Täglich, pro Nutzer:** `base_page` streut zwei Nutzer mit identischem Geschmack auseinander und mischt täglich neu. `crc32` statt `hash()`, weil letzteres pro Prozess gesalzen ist und die Rotation bei jedem Neustart neu würfeln würde.
- **Pro Aufruf:** der `cursor` (siehe 2.5) verschiebt das Fenster um eine volle Abrufbreite und rotiert zusätzlich die Sortierung.

> **Warum beides (Issue #249):** Reine Tagesrotation bedeutet, dass jeder `/feed`-Aufruf innerhalb eines Tages dasselbe Fenster liefert — der Nutzer sieht dieselben ~60 Filme, bis Mitternacht. Und Blättern allein durchläuft nur *eine* Sortierung derselben Popularitäts-Rangliste; wer deren Kopf erschöpft hat, findet am Kopf der nächsten Sortierung andere Filme.

**Cursor-Herleitung:** Der Engine nimmt den größeren Effekt aus beiden Quellen:

```python
effective_cursor = max(requested_cursor, 0) + len(seen_ids) // limit
```

Der übergebene Cursor deckt wiederholte Aufrufe *innerhalb* einer Session ab (bevor Signale vorliegen), die Interaktionshistorie den Rest: Wer bereits 200 Filme bewertet hat, darf nicht wieder am Anfangsfenster landen — unabhängig davon, was der Aufrufer sendet. Dadurch bewegt sich der Feed auch dann weiter, wenn ein Aufrufer gar keinen Cursor mitschickt.

**Leerer Pool:** Liefert der Abfrageplan nach der Deduplizierung nichts, wiederholt die Engine die Abfrage **ohne jede Geschmacks-Einschränkung** (nur `vote_count.gte` und die Ausschlussliste bleiben). Ein leerer Feed ist nie die richtige Antwort: eine unpersonalisierte Empfehlung ist besser als ein leerer Bildschirm.

### 2.5 FastAPI-Endpunkte

| Method | Path | Request Body | Response | Beschreibung |
|:--|:--|:--|:--|:--|
| `POST` | `/feed` | `{user_id, limit, cursor?}` | `[{movie_id, score}]` | Personalisierten Feed berechnen (inkl. TMDB-Aufruf, falls Option A). `cursor` (Default `0`) = wie viele Feeds tief der Aufrufer in dieser Session bereits ist |
| `POST` | `/feed/params` | `{user_id}` | `{tmdb_params, page}` | Nur Parameter zurückgeben (falls Option B) |
| `POST` | `/signal` | `{user_id, movie_id, action, watch_time?}` | `204` | Engagement-Signal aufzeichnen + Profil aktualisieren |
| `POST` | `/retrain` | `{secret}` | `202` | SVD-Neutraining triggern (intern, abgesichert) |
| `GET` | `/health` | — | `{status}` | Health-Check für Docker |

> **Hinweis:** `/feed` und `/feed/params` sind Alternativen je nach Entscheidung in 2.2 — nur einer der beiden Endpunkte wird im finalen System aktiv sein.

### 2.6 Nutzerinteraktionen in der DB

Die Datenbank ist die **einzige persistente Quelle** für Nutzerdaten. Der Python-Service hält $\vec{u}$ zusätzlich im RAM für schnelle Laufzeit-Updates — bei Neustart wird aus der DB rekonstruiert.

| Datenpunkt | Tabelle | Verwendung im Algorithmus |
|:--|:--|:--|
| Likes / Dislikes | `user_interactions` | Aufbau von $L_u$ für Profil-Vektor + SVD-Matrix |
| Watch-Time pro Film | `user_interactions` | Engagement-Signale (`watched_long`, `skip_fast`) |
| Watchlist-Einträge | `watchlist` | Starkes positives Signal ($+0.50$) bei Profil-Update |
| Gesehene Filme | `user_interactions` | Deduplizierung nach TMDB-Aufruf (Schritt 4 in 2.1) |
| Profil-Vektor $\vec{u}$ | `user_profiles` | Geladen beim Service-Start; nach jeder Interaktion geschrieben |
| Onboarding-Genres / -Filme | `user_preferences` | Cold-Start-Initialisierung von $\vec{u}$ |

---

## 3. Python-Modulstruktur

```
backend/app/recommendation/
├── __init__.py
├── engine.py          # Zentrale Recommender-Engine
├── content_based.py   # Content-Based Filtering (Feature-Vektor + TF-IDF)
├── collaborative.py   # Collaborative Filtering (SVD)
├── hybrid.py          # Hybride Score-Berechnung
├── engagement.py      # Echtzeit-Engagement-Signale
├── diversifier.py     # Diversifikation & Freshness
├── tmdb_bridge.py     # Parameter-Translation + TMDB Discover-Aufruf (Option A)
└── retrain.py         # Batch-Retraining-Job (nightly)
```

> **`tmdb_bridge.py`** übernimmt zwei Aufgaben: (1) Übersetzung des Profil-Vektors in TMDB Discover-Parameter (`profile_to_params()`), (2) optionaler TMDB-Aufruf und Rückgabe der Kandidaten-Liste (`fetch_candidates()`). Bei Option B wird nur (1) genutzt.

---

## 4. Retraining-Strategie

| Komponente | Update-Typ | Frequenz | Mechanismus |
|:--|:--|:--|:--|
| Nutzerprofil $\vec{u}$ (RAM) | Inkrementell | Sofort bei jedem Signal | `update_user_profile()` |
| Nutzerprofil $\vec{u}$ (DB) | Persistenz-Schreiben | Sofort nach RAM-Update | `user_profiles`-Tabelle |
| SVD (kollaborative Matrix) | Batch-Retrain | Nightly (03:00 UTC) | `/retrain`-Endpoint, Cronjob |
| TF-IDF (Kandidaten-Pool) | On-the-fly | Pro Feed-Request | Kein persistierter Index nötig |

**Fallback während Retrain:** Der alte SVD-Checkpoint bleibt aktiv, bis der neue validiert ist — atomarer Dateiaustausch via `joblib`. Während des Retrains fällt $\alpha$ auf $1.0$ zurück (Content-only).

> **Kein wöchentlicher TF-IDF-Rebuild mehr:** Da TF-IDF nur noch auf dem aktuellen Kandidaten-Pool (60–80 Filme) berechnet wird, entfällt das Rebuild über den gesamten Katalog. Der SVD-Retrain über die DB-Interaktionsmatrix bleibt der einzige schwere Batch-Job.

---

## 5. Klassendesign & Schnittstellen

### 5.1 Zentrale Engine

```python
# engine.py

from typing import List
import numpy as np
import joblib
from .content_based import ContentBasedFilter
from .collaborative import CollaborativeFilter
from .hybrid import HybridScorer
from .engagement import EngagementTracker
from .diversifier import Diversifier
from .tmdb_bridge import TMDBBridge

class RecommenderEngine:
    """Zentrale Empfehlungs-Engine. Hält alle Modelle im RAM."""

    def __init__(self):
        self.content_filter: ContentBasedFilter
        self.collab_filter: CollaborativeFilter
        self.hybrid_scorer: HybridScorer
        self.engagement_tracker: EngagementTracker
        self.diversifier: Diversifier
        self.tmdb_bridge: TMDBBridge

        # Hyperparameter
        self.alpha: float = 0.6       # Content vs. Collaborative
        self.beta: float = 0.7        # Feature-Vektor vs. Overview-TF-IDF
        self.gamma: float = 0.15      # Diversifikations-Boost
        self.delta: float = 0.1       # Freshness-Gewicht
        self.lambda_: float = 0.01    # Zeitverfall User-Profil
        self.mu: float = 0.05         # Freshness-Zerfall
        self.k: int = 50              # Latente Faktoren SVD

    def load_models(self, model_dir: str) -> None:
        """Lädt alle serialisierten Modelle beim Startup."""
        self.content_filter = ContentBasedFilter(beta=self.beta)
        self.content_filter.load(model_dir)

        self.collab_filter = CollaborativeFilter(k=self.k)
        self.collab_filter.load(model_dir)

        self.hybrid_scorer = HybridScorer(
            alpha=self.alpha,
            content_filter=self.content_filter,
            collab_filter=self.collab_filter,
        )

        self.engagement_tracker = EngagementTracker()
        self.diversifier = Diversifier(gamma=self.gamma, delta=self.delta, mu=self.mu)
        self.tmdb_bridge = TMDBBridge()

    def get_feed(
        self,
        user_id: str,
        limit: int = 10,
        seen_ids: List[int] = [],
    ) -> List[dict]:
        """
        Berechnet personalisierten Feed für einen Nutzer.

        Args:
            user_id:  Eindeutige Nutzer-ID
            limit:    Maximale Anzahl zurückgegebener Empfehlungen
            seen_ids: Bereits gesehene Film-IDs (aus DB) zur Deduplizierung

        Returns:
            Sortierte Liste: [{movie_id, score}, ...]
        """
        user_profile = self.content_filter.get_profile(user_id)
        tmdb_params = self.tmdb_bridge.profile_to_params(
            user_profile,
            diversify=self.diversifier.should_diversify(user_id),
        )

        candidate_ids = self.tmdb_bridge.fetch_candidates(tmdb_params, exclude=seen_ids)

        scores = self.hybrid_scorer.batch_score(user_id, candidate_ids)
        scores = self.engagement_tracker.apply_signals(user_id, scores)
        scores = self.diversifier.apply(user_id, scores)

        sorted_indices = np.argsort(scores)[::-1][:limit]
        return [
            {"movie_id": candidate_ids[i], "score": float(scores[i])}
            for i in sorted_indices
        ]

    def update_user_profile(self, user_id: str, movie_id: int, action: str) -> None:
        """
        Aktualisiert das Nutzerprofil nach einem Swipe (sofort im RAM + DB wirksam).

        Args:
            user_id:  Nutzer-ID
            movie_id: Film-ID
            action:   'like' | 'dislike' | 'super_like' | 'watchlist_add'
        """
        self.content_filter.update_profile(user_id, movie_id, action, self.lambda_)
        self.engagement_tracker.record_action(user_id, movie_id, action)
```
