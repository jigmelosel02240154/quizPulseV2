# QuizPulse

A cross-platform mobile trivia app for CST students. Play real-time 1v1 and room-based quiz battles, practise solo, track subject mastery and daily streaks, and compete on a campus leaderboard, all in an ad-free environment.

**Stack:** React Native (Expo) · Node.js + Express · Socket.io · Firebase Authentication · Cloud Firestore

---

## Features

- **Real-time multiplayer:** quick 1v1 matchmaking and private rooms with 6-digit codes (up to 8 players), with live score updates.
- **Server-authoritative game logic:** the server runs the question timer, checks answers and calculates scores. Correct answers are never sent to clients before a question closes.
- **Reconnect support:** a player who drops mid-match has 20 seconds to rejoin and resume the same question.
- **Practice mode:** solo quizzes with subject and difficulty filters.
- **Authentication:** Firebase Auth (email/password), with Firebase ID tokens (JWTs) verified by the Node server for both REST and Socket.io.
- **Analytics dashboard:** accuracy per subject, overall accuracy, current and best daily streak, matches and wins.
- **Leaderboards and badges:** global and CST campus rankings, emoji avatars, and five achievement badges.
- **Admin API:** add, edit and delete questions (requires an admin account).

## Repository structure

```
quizpulse/
├── app/                      Expo (React Native) mobile app
│   ├── App.js                navigation and auth gate
│   ├── app.json, eas.json    Expo / build configuration
│   ├── metro.config.js
│   └── src/
│       ├── config.js         SERVER_URL + Firebase web config (edit this)
│       ├── firebase.js, api.js, socket.js, theme.js
│       ├── components/UI.js
│       └── screens/          Auth, Home, Room, SinglePlayer, Stats, Leaderboard, Profile
├── server/                   Node.js backend
│   ├── src/                  index, routes, game (multiplayer engine), stats, scoring, seed ...
│   ├── scripts/              make-admin.js, latency-test.js
│   ├── test/                 scoring + multiplayer integration tests
│   ├── .env.example
│   ├── Dockerfile, render.yaml
│   └── package.json
├── firestore.rules           deny-all client rules (all data access goes through the server)
├── firestore.indexes.json    index for the campus leaderboard
└── README.md
```

## How it works

```
 Expo app ──(Firebase Auth)──► Firebase  (sign-up / login, returns an ID token)
    │
    ├── REST  + Bearer token ──► Node/Express ──► Firestore (via firebase-admin)
    └── Socket.io + token    ──► game engine  ──► Firestore (results, stats)
```

The app never reads or writes Firestore directly. It signs in with Firebase, then sends its ID token to the server, which verifies it and performs all database operations. This is why `firestore.rules` denies all client access.

### Firestore collections
- `users/{uid}`: username, avatar, campus, streak, bestStreak, totalScore, matches, wins, badges[], subjects{ IT: {correct,total}, ... }
- `questions/{id}`: subject, difficulty, text, options[], correctIndex
- `matches/{id}`: room code, type, subject, final ranking, per-question answer log

### Socket events
| Client to server | Server to client |
|---|---|
| `quick_match`, `cancel_search` | `searching` |
| `create_room`, `join_room`, `start_room`, `leave_room` | `lobby_update`, `match_start` |
| `submit_answer {choice}` | `question_start`, `score_update`, `question_end` |
| `ping_check` | `match_end`, `badges_earned`, `match_error`, `resume` |

---

## Setup

**Requirements:** Node.js 18 or newer, a Firebase account, and the **Expo Go** app on a phone (or an Android/iOS emulator).

### 1. Firebase project
1. In the [Firebase console](https://console.firebase.google.com), create a project.
2. **Authentication > Sign-in method:** enable **Email/Password**.
3. **Firestore Database > Create database** (production mode).
4. Publish the contents of `firestore.rules` in the Firestore *Rules* tab, and create the index described in `firestore.indexes.json` (or click the link Firestore shows the first time you open the campus leaderboard).
5. **Project settings > General > Your apps:** add a **Web app** and copy its config values.
6. **Project settings > Service accounts > Generate new private key.** Save the file as `server/serviceAccountKey.json`. **Never commit this file.**

### 2. Server
```bash
cd server
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm install
npm run seed                  # loads sample questions (safe to repeat)
npm test                      # runs the unit and integration tests
npm start                     # http://localhost:3000/health
```
Keep this terminal open while using the app.

### 3. Mobile app
```bash
cd app
npm install
```
Open `app/src/config.js` and set:
- `firebaseConfig`: the values from step 1.5
- `SERVER_URL`: your computer's **Wi-Fi IPv4 address** and port 3000, e.g. `http://192.168.0.144:3000` (find it with `ipconfig`; do not use `localhost`)

Then:
```bash
npx expo start
```
Scan the QR code with Expo Go. The phone must be on the **same Wi-Fi** as the computer, and Windows Firewall must allow port 3000:
```
netsh advfirewall firewall add rule name="QuizPulse" dir=in action=allow protocol=TCP localport=3000
```

### 4. Try it
1. Register an account (choose an avatar and username).
2. Play a **Practice** round, then check the **Analytics** tab.
3. Test multiplayer with two devices and two accounts: **Create room** on one and **Join** with the code on the other, or use **Quick 1v1 Match** on both.

### Admin accounts (optional)
```bash
cd server
npm run make-admin -- you@example.com
```
Sign out and in again. That account can then use `GET/POST/PUT/DELETE /api/admin/questions`.

## Testing

```bash
cd server
npm test
```
Covers the scoring function and the multiplayer engine (matchmaking, answer validation, forfeit on disconnect, reconnect and resume).

**Real-time latency (target: under 200 ms):**
```bash
cd server
set FIREBASE_API_KEY=<your web api key>
set TEST_EMAIL=you@example.com
set TEST_PASSWORD=yourpassword
set SERVER_URL=http://localhost:3000
npm run latency
```
(On macOS/Linux, use `export` or prefix the variables on the same line.) The script reports min, average, p95 and max round-trip times over 100 samples. The app also shows live latency in the lobby and during matches.

## Deployment

**Server:** deploy `server/` to Render, Railway or similar (`render.yaml` and `Dockerfile` are included). Instead of the key file, set the environment variable `FIREBASE_SERVICE_ACCOUNT` to the full service-account JSON on one line.

**Android APK:**
```bash
cd app
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
Set `SERVER_URL` to the deployed **https** address first. Android release builds block plain `http://`.

## Security notes

- `server/serviceAccountKey.json` and `server/.env` are **not** part of this repository (see `.gitignore`). To run the project you need your own Firebase project and key.
- The Firebase web config in `app/src/config.js` is not secret; it identifies the project and is meant to be in client apps.
- Clients cannot access Firestore directly, so scores, stats and questions can only be changed through the server.

## Known limitations

- Practice-mode results are reported by the app, so the server only caps them at the theoretical maximum rather than verifying them. Multiplayer scoring is fully server-side.
- Push notifications and room QR codes (optional items in the proposal) are not implemented.

## Troubleshooting

| Problem | Fix |
|---|---|
| App cannot reach the server | Server not running, wrong IP in `config.js`, different Wi-Fi network, or firewall blocking port 3000. Test `http://<your-ip>:3000/health` in the phone browser. |
| Socket says `unauthorized` | The Firebase config in the app and the service-account key belong to different Firebase projects. |
| Metro error about `react-native/asset-registry` | Remove the `unstable_enablePackageExports` line from `app/metro.config.js`. |
| Campus leaderboard errors | Create the Firestore index (the error message contains a one-click link). |
| Admin routes return 403 | Sign out and back in after running `make-admin`. |

## Project information

- **Project:** QuizPulse (Project II)
- **Author:** _your name, student number_
- **Course / Supervisor:** _course code, tutor name_
