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

> **Abgrenzung zu 1.1:** Die TF-IDF-Vektoren fangen semantischen Kontext ein, den TMDB-Keywords nicht abdecken. Beide Quellen werden explizit gewichtet kombiniert (siehe 1.4), um doppelte Gewichtung ähnlicher Informationen zu vermeiden.

### 1.3 Collaborative Filtering – Matrix-Faktorisierung (SVD)

**Nutzer-Film-Interaktionsmatrix:**

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

### 1.6 Engagement-Signale (Real-Time Layer)

| Signal | Bedingung | $\Delta$ Score | Begründung |
|:--|:--|:--|:--|
| `skip_fast` | `watch_time < 2s` | $-0.50$ | Starkes negatives Signal |
| `watched_long` | `watch_time > 70%` | $+0.30$ | Hohes Interesse |
| `rewatch` | selber Trailer erneut angesehen | $+0.60$ | Maximales Interesse |
| `share` | Trailer geteilt | $+0.60$ | Sozialer Beweis |
| `dislike` | aktives Dislike | $-0.40$ | Explizite Ablehnung |
| `like` | aktives Like | $+0.20$ | Positives Basissignal |

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

### 2.1 FastAPI-Endpunkte

| Method | Path | Request Body | Response | Beschreibung |
|:--|:--|:--|:--|:--|
| `POST` | `/feed` | `{user_id, candidate_ids[], limit}` | `[{movie_id, score}]` | Personalisierten Feed berechnen |
| `POST` | `/signal` | `{user_id, movie_id, action, watch_time?}` | `204` | Engagement-Signal aufzeichnen + Profil aktualisieren |
| `POST` | `/retrain` | `{secret}` | `202` | SVD-Neutraining triggern (intern, abgesichert) |
| `GET` | `/health` | — | `{status}` | Health-Check für Docker |

### 2.2 Kandidaten-Vorselektion

`get_feed()` erhält bereits vorgefilterte `candidate_ids`. Das NestJS-Backend ist verantwortlich für:

1. Gesehene Filme ausfiltern (`NOT IN user_interactions`)
2. Kürzlich verworfene Filme ausfiltern (z. B. Dislike in den letzten 30 Tagen)
3. Popularity-Threshold anwenden (z. B. nur Filme mit TMDB `vote_count > 50`)

Der FastAPI-Service scored dann typischerweise 200–500 Filme, nicht den gesamten Katalog.

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
└── retrain.py         # Batch-Retraining-Job (nightly)
```

---

## 4. Retraining-Strategie

| Komponente | Update-Typ | Frequenz | Mechanismus |
|:--|:--|:--|:--|
| Nutzerprofil $\vec{u}$ | Inkrementell (im RAM) | Sofort bei jedem Signal | `update_user_profile()` |
| SVD (kollaborative Matrix) | Batch-Retrain | Nightly (03:00 UTC) | `/retrain`-Endpoint, Cronjob |
| TF-IDF-Vektoren (Filme) | Batch-Retrain | Wöchentlich oder bei Katalog-Update | `content_based.py` rebuild |

**Fallback während Retrain:** Der alte SVD-Checkpoint bleibt aktiv, bis der neue validiert ist — atomarer Dateiaustausch via `joblib`. Während des Retrains fällt $\alpha$ auf $1.0$ zurück (Content-only).

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

class RecommenderEngine:
    """Zentrale Empfehlungs-Engine. Hält alle Modelle im RAM."""

    def __init__(self):
        self.content_filter: ContentBasedFilter
        self.collab_filter: CollaborativeFilter
        self.hybrid_scorer: HybridScorer
        self.engagement_tracker: EngagementTracker
        self.diversifier: Diversifier

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

    def get_feed(
        self,
        user_id: str,
        candidate_ids: List[int],
        limit: int = 10,
    ) -> List[dict]:
        """
        Berechnet personalisierten Feed für einen Nutzer.

        Args:
            user_id:       Eindeutige Nutzer-ID
            candidate_ids: Vorgefilterte Film-IDs (nicht gesehen, nicht kürzlich verworfen)
            limit:         Maximale Anzahl zurückgegebener Empfehlungen

        Returns:
            Sortierte Liste: [{movie_id, score}, ...]
        """
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
        Aktualisiert das Nutzerprofil nach einem Swipe (sofort im RAM wirksam).

        Args:
            user_id:  Nutzer-ID
            movie_id: Film-ID
            action:   'like' | 'dislike' | 'super_like'
        """
        self.content_filter.update_profile(user_id, movie_id, action, self.lambda_)
        self.engagement_tracker.record_action(user_id, movie_id, action)
```
