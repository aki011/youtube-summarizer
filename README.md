# 📺 YouTube Video Summarizer

An AI-powered web app that generates instant English summaries of YouTube videos in **any language**, using **Groq's free LLaMA API** and the **YouTube Transcript API**.

Built with: **Python Flask** · **HTML/CSS/JS** · **Groq API (LLaMA 3.3 70B)** · **YouTube Transcript API**

🌐 **Live Demo:** [https://youtube-summarizer-thr5.onrender.com](https://youtube-summarizer-thr5.onrender.com)

---

## 📸 Screenshots & Demo

### 1. Analyzing Video State
When a URL is submitted, the app securely fetches the captions and processes them through Groq LLaMA AI.
<img src="./static/images/Screenshot%201.png" width="800" alt="Analyzing video loader">

### 2. Summary Generation & Quick Take
Once processed, the application displays the video metadata alongside an instant 3-4 sentence "Quick Take" overview.
<img src="./static/images/Screenshot%202.png" width="800" alt="Summary overview and quick take">

### 3. Comprehensive Breakdown
A multi-paragraph "Full Summary" offers an in-depth analytical breakdown of the video's content structure.
<img src="./static/images/Screenshot%203.png" width="800" alt="Detailed summary section">

### 4. Key Takeaways & Action Items
The app extracts structural key bullets, actionable insights, and embeds the source transcript below for reference.
<img src="./static/images/Screenshot%204.png" width="800" alt="Key points and actionable insights">

---

## ✨ Features

- 🔗 Paste any YouTube URL — get a full AI summary in seconds
- 🌐 **Any language supported** — Hindi, Spanish, French, etc. auto-summarized in English
- 📜 **Original transcript shown** — see the raw transcript in its original language
- ⚡ **Short Summary** — 3-4 sentence overview
- 📄 **Detailed Summary** — multi-paragraph in-depth analysis
- 🔑 **Key Bullet Points** — 6-8 most important takeaways
- 🚀 **Actionable Insights** — practical action items from the video
- 🖼 Video thumbnail and title display
- ⬇ Download summary as `.txt` file
- ⎘ Copy individual sections or the full summary
- 🔔 Toast notifications and loading progress
- 📱 Fully responsive dark UI

---

## 🚀 Quick Setup (5 minutes)

### 1. Clone the repository

```bash
git clone https://github.com/aki011/youtube-summarizer.git
cd youtube-summarizer
```

### 2. Create a virtual environment

```bash
python -m venv venv

# Activate:
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Get your FREE Groq API key

1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign in with Google (free, no credit card needed)
3. Click **"Create API Key"**
4. Copy the key — it starts with `gsk_...`

### 5. Set up your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
GROQ_API_KEY=gsk_your_groq_key_here
YOUTUBE_API_KEY=your_youtube_data_api_key_here   # optional
```

> **Note:** `YOUTUBE_API_KEY` is optional. Without it, the video title shows as "YouTube Video". To get one, go to [Google Cloud Console](https://console.cloud.google.com/) → Enable "YouTube Data API v3" → Create an API key.

### 6. Run the app

```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## ☁️ Deployment (Render)

This app is deployed on [Render](https://render.com) (free tier).

| Field | Value |
|---|---|
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt && pip install gunicorn==21.2.0` |
| Start Command | `gunicorn app:app` |
| Instance Type | Free |

**Environment Variables to set on Render:**
```
GROQ_API_KEY = gsk_your_key_here
YOUTUBE_API_KEY = your_key_here   (optional)
```

To redeploy after changes:
```bash
git add .
git commit -m "your update"
git push
```
Render auto-redeploys on every push. ✅

> **Note:** Free tier apps sleep after 15 min of inactivity. First request after sleep takes ~30 seconds to wake up.

---

## 📁 Project Structure

```
youtube-summarizer/
│
├── app.py                  # Flask backend — routing, transcript fetch, Groq API
├── requirements.txt        # Python dependencies
├── Procfile                # Render/Heroku start command
├── .env.example            # Environment variable template
├── .env                    # Your actual API keys (never commit this!)
├── .gitignore              # Excludes venv, .env from git
├── README.md               # This file
│
├── templates/
│   └── index.html          # Main UI (Jinja2 template)
│
└── static/
    ├── style.css           # Dark theme styling (responsive)
    └── script.js           # Frontend logic (API calls, copy, download)
```

---

## 🌐 Multilingual Support

This app handles videos in **any language**:

| Video Language | What happens |
|---|---|
| English | Transcript fetched and summarized directly |
| Hindi, Spanish, French, etc. | Transcript fetched in original language → Groq AI summarizes in English |
| Non-translatable captions | Raw transcript used, Groq translates + summarizes |

The **Original Transcript** section shows the first 300 words of the raw transcript in its original language, so you can verify the source.

---

## 🧪 Sample YouTube URLs to Test

| Video | Language | URL |
|-------|----------|-----|
| TED Talk: How great leaders inspire | English | `https://www.youtube.com/watch?v=qp0HIF3SfI4` |
| 3Blue1Brown: Neural Networks | English | `https://www.youtube.com/watch?v=aircAruvnKk` |
| Kurzgesagt: Loneliness | English | `https://www.youtube.com/watch?v=n3Xv_g3g-mA` |
| Hindi tech video | Hindi | `https://www.youtube.com/watch?v=90jZ0ThlHCQ` |
| Y Combinator: Startup advice | English | `https://www.youtube.com/watch?v=CBYhVcO4WgI` |

---

## 🔧 How It Works

```
User pastes YouTube URL
        │
        ▼
Flask validates URL & extracts video ID
        │
        ▼
youtube-transcript-api fetches captions
(tries English first → falls back to any language)
        │
        ▼
If non-English → Groq told to summarize in English
                 + return original language snippet
        │
        ▼
Groq LLaMA 3.3 70B generates structured summary
        │
        ▼
JSON response → JavaScript renders all 5 sections
```

---

## ⚠️ Edge Cases Handled

| Scenario | Response |
|----------|----------|
| Invalid URL | Clear error message with supported formats |
| Private / deleted video | "Video is unavailable" error |
| No captions at all | "Could not retrieve transcript" error |
| Very short transcript | "Transcript too short" error |
| Long transcript (>12k chars) | Auto-trimmed before sending to Groq |
| Non-English video | Summarized in English, original shown below |
| Groq rate limit hit | "Please wait 30 seconds" message |
| Invalid API key | Setup instructions shown |

---

## 🛠 Troubleshooting

**`ModuleNotFoundError`**
```bash
pip install -r requirements.txt
```

**`Client.__init__() got an unexpected keyword argument 'proxies'`**
```bash
pip install httpx==0.27.2
```

**`GROQ_API_KEY not set`**
Make sure your `.env` file exists with `GROQ_API_KEY=gsk_...`

**`No transcript found`**
The video has captions disabled. Try a different video.

**Port already in use**
```python
# Change in app.py:
app.run(debug=True, port=5001)
```

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| flask | 3.1.0 | Web framework |
| youtube-transcript-api | 1.2.4 | Fetch video transcripts (all languages) |
| groq | 0.11.0 | LLaMA 3.3 70B AI summarization |
| httpx | 0.27.2 | HTTP client (Groq SDK dependency) |
| python-dotenv | 1.0.1 | Load `.env` variables |
| requests | 2.32.3 | YouTube metadata API calls |
| gunicorn | 21.2.0 | Production WSGI server for deployment |

---

## 🆓 Why Groq?

| | Gemini Free | Groq Free |
|---|---|---|
| Daily requests | ~50 (often 0 on new projects) | 14,400 |
| Speed | 5–10 sec | 1–2 sec |
| Setup | Complex (quota, restrictions) | Simple — just paste key |
| Model | Gemini 2.0 Flash | LLaMA 3.3 70B |
| Key format | `AIza...` | `gsk_...` |

---

## 👨‍💻 Author

**Akshay** · [github.com/aki011](https://github.com/aki011)

---

## 📄 License

MIT — free to use for personal and educational projects.