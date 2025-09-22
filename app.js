const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/YearGuess.html');
});

app.get('/streak', (req, res) => {
    res.sendFile(__dirname + '/public/streak.html');
});

app.get('/daily-event', async (req, res) => {
    const event = await getDailyEvent();
    res.send({ event: event });
});

app.get('/guess/:year', async (req, res) => {
    const year = req.params.year;
    if (!/^\d{4}$/.test(year)) {
        return res.status(400).send({ error: 'Year must be a 4-digit number' });
    }

    feedback(year).then((feedback) => {
        return res.send({ ...feedback });
    });
});

async function feedback(guess) {
    return getDailyEvent().then((event) => {
        return scoreGuess(guess, event.year);
    });
}

function scoreGuess(guess, answer) {
    const n = guess.length;
    const marks = Array(n).fill('absent');
    let allCorrect = true;

    // 1) Mark greens and count remaining answer digits
    const remaining = {}; // digit -> count
    for (let i = 0; i < n; i++) {
        if (guess[i] === answer[i]) {
            marks[i] = 'correct';
        } else {
            remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
            allCorrect = false;
        }
    }

    // 2) For non-greens, mark yellow only if there's remaining supply
    for (let i = 0; i < n; i++) {
        if (marks[i] === 'correct') continue;
        const d = guess[i];
        if (remaining[d] > 0) {
            marks[i] = 'present';
            remaining[d]--; // consume one occurrence
        }
    }

    return { marks: marks, allCorrect: allCorrect };
}

function sanitizeEvents(events) {
    const sanitizeEvents = [];
    events.forEach((event) => {
        if (event.year < 0) {
            return; // No BC years
        }
        sanitizeEvents.push({
            year:
                String(event.year).length < 4
                    ? String(event.year).padStart(4, '0') // Pad to 4 digits
                    : String(event.year),
            text: event.text,
        });
    });

    return sanitizeEvents;
}

async function getDailyEvent() {
    const events = await getEvents();

    let event = events[pickDailyIndex(data.selected.length - 1)];
    return {
        year: event.year,
        text: event.text,
    };
}

async function getEvents() {
    let today = new Date();
    let month = today.getMonth() + 1; // 1-12
    let day = today.getDate(); // 1-31
    wikimediaUrl = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${month}/${day}`;

    try {
        const res = await fetch(wikimediaUrl, {
            headers: {
                'Api-User-Agent': 'YearGuessGame/1.0 (ruha0001@stud.ek.dk)',
            },
        });
        const data = await res.json();

        return sanitizeEvents(data.selected);
    } catch (error) {
        console.error(error);
    }
}

// GIBITTY Code to get around serverless hosting limitations
// Deterministic "random" index for today's date (same for all users today)

// FNV-1a 32-bit hash
function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
}

// Build a stable seed like "2025-09-19"
function dailySeed(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Get deterministic index in [0, len)
function pickDailyIndex(len, d = new Date()) {
    const h = hash32(dailySeed(d));
    return h % len;
}

const PORT = 8080;
app.listen(PORT, () => {
    console.log('Server is running on port', PORT);
});
