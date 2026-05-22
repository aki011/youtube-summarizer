# 📺 YouTube Video Summarizer

An AI-powered web app that generates instant summaries of YouTube videos using **Google Gemini 1.5 Flash** and the **YouTube Transcript API**.

Built with: **Python Flask** · **HTML/CSS/JS** · **Gemini API** · **YouTube Transcript API**

---

## ✨ Features

- 🔗 Paste any YouTube URL to get a full AI-powered summary
- ⚡ **Short Summary** — 3-4 sentence overview
- 📄 **Detailed Summary** — Multi-paragraph in-depth analysis
- 🔑 **Key Bullet Points** — 6-8 most important takeaways
- 🚀 **Actionable Insights** — Practical action items from the video
- 🖼 Video thumbnail and title display
- ⬇ Download summary as `.txt` file
- ⎘ Copy individual sections or the full summary
- 🔔 Toast notifications and loading progress
- 📱 Fully responsive design

---

## 🚀 Quick Setup (5 minutes)

### 1. Clone / Download the project

```bash
cd youtube-summarizer
```

### 2. Create a virtual environment

```bash
python -m venv venv

# Activate it:
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up API keys

```bash
# Copy the example env file
cp .env.example .env
```

Then open `.env` and fill in your keys:

```env
GEMINI_API_KEY=your_gemini_api_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here   # optional
```

**Getting your Gemini API Key (free):**
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy and paste it into `.env`

**Getting your YouTube Data API Key (optional — for video titles):**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Enable APIs**
4. Search for and enable **"YouTube Data API v3"**
5. Go to **Credentials → Create Credentials → API Key**
6. Copy and paste it into `.env`

> **Note:** If you skip the YouTube API key, the app still works perfectly — video titles will just show as "YouTube Video".

### 5. Run the app

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 📁 Project Structure

```
youtube-summarizer/
│
├── app.py                  # Flask backend — all routes and logic
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── .env                    # Your actual API keys (don't commit this!)
├── README.md               # This file
│
├── templates/
│   └── index.html          # Main HTML page (Jinja2 template)
│
└── static/
    ├── style.css           # All styling (dark theme, responsive)
    └── script.js           # Frontend logic (API calls, copy, download)
```

---

## 🧪 Sample YouTube URLs to Test

| Video | URL |
|-------|-----|
| TED Talk: How great leaders inspire | `https://www.youtube.com/watch?v=qp0HIF3SfI4` |
| 3Blue1Brown: Neural Networks | `https://www.youtube.com/watch?v=aircAruvnKk` |
| Y Combinator: How to Start a Startup | `https://www.youtube.com/watch?v=CBYhVcO4WgI` |
| Kurzgesagt: Loneliness | `https://www.youtube.com/watch?v=n3Xv_g3g-mA` |
| Veritasium: The Biggest Lie in Physics | `https://www.youtube.com/watch?v=Jx8765cvIUw` |

---

## 🔧 How It Works

```
User pastes URL
       │
       ▼
Flask validates URL & extracts video ID
       │
       ▼
youtube-transcript-api fetches captions
       │
       ▼
Transcript trimmed to 30,000 chars (token limit)
       │
       ▼
Gemini 1.5 Flash generates structured summary
       │
       ▼
JSON response → JavaScript renders UI
```

---

## ⚠️ Edge Cases Handled

| Scenario | Response |
|----------|----------|
| Invalid URL | "Invalid YouTube URL" error |
| Private video | "Video is private" error |
| No captions/transcript | "No transcript found" error |
| Very short transcript | "Transcript too short" error |
| Long transcript (>30k chars) | Auto-truncated with notice |
| Missing Gemini API key | Setup instructions shown |
| Network/API failure | User-friendly error message |
| Non-English videos | Summarizes in whatever language is available |

---

## 🛠 Troubleshooting

**`ModuleNotFoundError`** — Run `pip install -r requirements.txt` again with your virtualenv active.

**`Gemini API key not configured`** — Make sure your `.env` file exists and has `GEMINI_API_KEY=` filled in.

**`No transcript found`** — The video doesn't have captions. Try a different video, or one with auto-generated subtitles enabled.

**Port already in use** — Change the port in `app.py`: `app.run(debug=True, port=5001)`

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| flask | 3.0.0 | Web framework |
| youtube-transcript-api | 0.6.2 | Fetch video transcripts |
| google-generativeai | 0.7.2 | Gemini AI integration |
| python-dotenv | 1.0.0 | Load `.env` variables |
| requests | 2.31.0 | HTTP calls to YouTube API |

---

## 📄 License

MIT — free to use for personal and educational projects.
