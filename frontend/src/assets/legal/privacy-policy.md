# Privacy Policy — CineMates

**Last updated:** August 21, 2026

This policy describes what **CineMates — a student project at 42 Heilbronn** ("we", "us", "our") stores about you, what we do with it, and how long we keep it. It is written to match the application as it is actually built, not as we once planned it.

CineMates is a non-commercial student project, developed as part of the 42 School Common Core curriculum (ft_transcendence). It is not a company, it has no users beyond the people trying it out, and it is not deployed on the public internet.

---

## 1. Who We Are

For any question about this policy or the data behind it, write to:

📧 **cwolf@student.42heilbronn.de**

## 2. What We Store

| What                | The details                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Account**         | Username, email address, and — if you signed up with a password — that password, hashed with argon2. If you signed up through Google, we store your Google account id instead. |
| **Profile**         | Your avatar, if you upload one, and the genres, actors and directors you pick during onboarding.                                                                               |
| **Two-factor**      | If you turn on two-factor login, the secret your authenticator app shares with us, plus the counter that stops a code being reused.                                            |
| **Taste profile**   | A numeric vector we derive from your ratings. It is what decides the order of your feed.                                                                                       |
| **Ratings**         | Whether you liked or disliked a trailer, and how many seconds of it you watched.                                                                                               |
| **Watchlists**      | Your lists, the movies on them, and who else may see or edit them.                                                                                                             |
| **Friends**         | Who you are friends with, who sent the request, and whether it was accepted.                                                                                                   |
| **Chat**            | The messages you send, who sent them, and when the other person read them.                                                                                                     |
| **Notifications**   | What happened, who caused it, and whether you have opened it.                                                                                                                  |
| **Sessions**        | For each login: a hashed token, your IP address, your browser's user agent, and an expiry date.                                                                                |
| **Password resets** | If you request one: a hashed single-use token and its expiry.                                                                                                                  |

We do not store payment details, your location, your contacts, or anything about you gathered from other websites.

## 3. What We Do With It

- **Your feed.** Your ratings build the taste profile described above, and our recommendation service uses it to decide which trailers you see and in what order. This is the core of the app — if you rate trailers, you are shaping what it shows you.
- **Social features.** Friends, one-to-one chat, whether your friends can see that you are online, watchlists you share with other people, and the notifications that go with all of it.
- **Keeping it running.** Sessions keep you logged in, and rate limits and login records keep the service usable and reasonably secure.

We do not sell anything, we do not advertise, and we do not share your data with anyone for marketing.

## 4. Services Outside CineMates

| Service              | What reaches them                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Google**           | Only if you log in with Google: the login exchange itself. We ask for your email address and basic profile.                                                                                |
| **TMDB**             | Our server asks TMDB for movie data. **This includes the text you type into search**, which is sent as a query. Nothing that identifies you is sent along with it.                         |
| **YouTube**          | Trailers play in an embedded player, so your browser contacts Google and your IP address reaches them. We use the no-cookie player host, so nothing is set until a trailer actually plays. |
| **Our email server** | If you ask for a password reset, your email address goes to the mail server that sends it.                                                                                                 |

The recommendation service is **ours**. It runs alongside the app on a private network and is not a third party.

## 5. Where It Runs

CineMates runs as a set of containers on whichever machine starts the project — during an evaluation, that is the evaluator's computer. The database, the cache, the file storage for avatars, and the recommendation service all live there. There is no public deployment, no hosting provider, and no backups: if the data is deleted, it is gone.

## 6. How Long We Keep It

Some data is deleted automatically, whether or not you ask:

| Data                                    | Kept for                    |
| --------------------------------------- | --------------------------- |
| Chat messages                           | 90 days after they are sent |
| Notifications you have read             | 30 days                     |
| Notifications you have not read         | 90 days                     |
| Uploads that nothing points at any more | 1 day                       |
| Used or expired password-reset tokens   | 1 day                       |
| Login sessions                          | Until they expire           |

Chat messages are the one to know about: **your conversations are not a permanent archive.** A message disappears 90 days after it was sent, for both people, and there is no way to get it back.

Everything else is kept until you delete your account.

## 7. What You Can Ask Us To Do

Two things, and we would rather promise two we can do than six we cannot:

- **Correct your profile.** Your username, avatar and preferences are yours to change in the app at any time.
- **Delete your account.** Email us at **cwolf@student.42heilbronn.de** and we will delete it.

## 8. Deleting Your Account

When your account is deleted, it is removed from the database directly, and everything attached to it goes with it: your profile, preferences, taste profile, ratings, watchlist memberships, friendships, chat messages, and notifications. Your uploaded files are then deleted from storage as well.

This cannot be undone, and since we keep no backups, there is nothing to restore from.

## 9. Security

- Passwords are hashed with argon2 and never stored in a readable form.
- Two-factor login is available and off by default.
- Login tokens live in cookies your browser will not hand to JavaScript, and each session is stored hashed.
- Uploaded files sit in a private bucket that is not reachable from the internet.

That said: this is a student project built by five people learning as they go, not a product with a security team behind it. Please do not put anything genuinely sensitive into it.

## 10. Cookies

We use five cookies, all of them necessary for the app to work:

- `access_token` and `refresh_token` keep you logged in.
- `mfa_token` carries you through the second step of a two-factor login.
- `oauth_state` protects the Google login from being tampered with.
- `sidebar_state` remembers whether you left the sidebar open.

We do not use localStorage, and we do not use advertising or cross-site tracking cookies. Embedded trailers are loaded from YouTube's no-cookie host, which sets nothing until you play one.

## 11. Age

CineMates is intended for people **18 or older**. We do not ask for your age and have no way to verify it, so this is a rule of the project rather than something we check.

## 12. Changes

We may update this policy as the project changes. The date at the top says when it was last edited.

## 13. Contact

📧 **cwolf@student.42heilbronn.de**

---

_Written for a 42 School student project (ft_transcendence). It describes what this application actually does with your data, and is not a substitute for legal advice for a commercial product._
