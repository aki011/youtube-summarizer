# ============================================================
# app.py — YouTube Summarizer Backend
# Uses: Groq API (free, fast), youtube-transcript-api 1.x
# Supports: Cookie-based auth to bypass YouTube IP bans
# ============================================================

import os
import re
import tempfile
import traceback
import requests
from flask import Flask, request, jsonify, render_template
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
from groq import Groq

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    VideoUnavailable,
    NoTranscriptFound,
)

load_dotenv()

app = Flask(__name__)

GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "").strip()
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()
YOUTUBE_COOKIES = os.getenv("YOUTUBE_COOKIES", "").strip()  # Cookie string from env
MAX_TRANSCRIPT_CHARS = 12000


# ─── Build YouTubeTranscriptApi client with cookies if available ──
def get_ytt_client():
    """
    Returns a YouTubeTranscriptApi instance.
    Uses cookies to bypass YouTube's IP ban on cloud servers.
    Cookies can be provided via:
      1. YOUTUBE_COOKIES env variable (for Render deployment)
      2. cookies.txt file in project root (for local dev)
    """
    # Option 1: cookies from environment variable (Render)
    if YOUTUBE_COOKIES:
        try:
            tmp = tempfile.NamedTemporaryFile(
                mode='w', suffix='.txt', delete=False, encoding='utf-8'
            )
            tmp.write(YOUTUBE_COOKIES)
            tmp.close()
            print(f"[Cookies] Using cookies from environment variable")
            return YouTubeTranscriptApi(cookie_path=tmp.name)
        except Exception as e:
            print(f"[Cookies] Failed to use env cookies: {e}")

    # Option 2: cookies.txt file in project root (local dev)
    cookies_path = os.path.join(os.path.dirname(__file__), "cookies.txt")
    if os.path.exists(cookies_path):
        try:
            print(f"[Cookies] Using cookies.txt file")
            return YouTubeTranscriptApi(cookie_path=cookies_path)
        except Exception as e:
            print(f"[Cookies] Failed to use cookies.txt: {e}")

    # No cookies — will work locally but may fail on cloud servers
    print("[Cookies] No cookies found — using unauthenticated client")
    return YouTubeTranscriptApi()


# ─── Extract YouTube video ID ─────────────────────────────────
def extract_video_id(url: str):
    try:
        p    = urlparse(url.strip())
        host = (p.hostname or "").replace("www.", "")
        if host == "youtube.com":
            if p.path == "/watch":
                return parse_qs(p.query).get("v", [None])[0]
            if p.path.startswith("/shorts/"):
                return p.path.split("/")[2]
            if p.path.startswith("/embed/"):
                return p.path.split("/")[2]
        if host == "youtu.be":
            return p.path.lstrip("/").split("?")[0]
    except Exception:
        pass
    return None


# ─── Fetch video title + thumbnail ────────────────────────────
def get_video_metadata(video_id: str) -> dict:
    thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    title     = "YouTube Video"
    if YOUTUBE_API_KEY and not YOUTUBE_API_KEY.startswith("your_"):
        try:
            resp  = requests.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={"id": video_id, "key": YOUTUBE_API_KEY, "part": "snippet"},
                timeout=8,
            )
            items = resp.json().get("items", [])
            if items:
                snippet   = items[0]["snippet"]
                title     = snippet.get("title", title)
                thumbs    = snippet.get("thumbnails", {})
                thumbnail = thumbs.get("maxres", thumbs.get("high", {})).get("url", thumbnail)
        except Exception:
            pass
    return {"title": title, "thumbnail": thumbnail}


# ─── Convert transcript entries to plain text ─────────────────
def entries_to_text(entries) -> str:
    parts = []
    for e in entries:
        if isinstance(e, dict):
            parts.append(e.get("text", ""))
        else:
            parts.append(getattr(e, "text", ""))
    return " ".join(p.strip() for p in parts if p.strip())


# ─── Fetch transcript ─────────────────────────────────────────
def fetch_transcript(video_id: str) -> dict:
    ytt = get_ytt_client()

    try:
        transcript_list = ytt.list(video_id)
    except VideoUnavailable:
        raise Exception("Video is unavailable (private or deleted).")
    except TranscriptsDisabled:
        raise Exception("Transcripts are disabled for this video.")
    except Exception as e:
        msg = str(e)
        if "IP" in msg or "blocked" in msg.lower() or "cookie" in msg.lower():
            raise Exception(
                "YouTube is blocking this server's IP. "
                "Please add YouTube cookies in Render environment variables. "
                "See README for instructions."
            )
        raise Exception(f"Could not access video: {msg}")

    # Try English first
    try:
        t    = transcript_list.find_transcript(["en", "en-US", "en-GB"])
        text = entries_to_text(t.fetch())
        if text.strip():
            print(f"[Transcript] ✓ English ({len(text)} chars)")
            return {
                "text":          text[:MAX_TRANSCRIPT_CHARS],
                "language":      "en",
                "language_name": "English",
                "is_english":    True,
            }
    except Exception as e:
        print(f"[Transcript] No English: {e}")

    # Try any available language
    for t in transcript_list:
        lang      = t.language_code
        lang_name = t.language
        print(f"[Transcript] Trying: {lang} ({lang_name})")
        try:
            text = entries_to_text(t.fetch())
            if not text.strip():
                continue
            print(f"[Transcript] ✓ Got {lang} ({lang_name}) — {len(text)} chars")
            return {
                "text":          text[:MAX_TRANSCRIPT_CHARS],
                "language":      lang,
                "language_name": lang_name,
                "is_english":    lang.startswith("en"),
            }
        except Exception as e:
            print(f"[Transcript] {lang} failed: {e}")
            continue

    raise Exception("Could not retrieve transcript for this video.")


# ─── Call Groq API ────────────────────────────────────────────
def generate_summary_with_groq(transcript_data: dict) -> dict:
    if not GROQ_API_KEY or not GROQ_API_KEY.startswith("gsk_"):
        raise Exception(
            "Invalid or missing GROQ_API_KEY. "
            "Get your free key at https://console.groq.com/keys"
        )

    transcript = transcript_data["text"]
    is_english = transcript_data["is_english"]
    lang_name  = transcript_data["language_name"]
    lang_code  = transcript_data["language"]

    lang_note = ""
    if not is_english:
        lang_note = f"\nIMPORTANT: This transcript is in {lang_name}. Write ALL summaries in ENGLISH. After the ### ORIGINAL TRANSCRIPT section, include the first 300 words of the original {lang_name} transcript.\n"

    prompt = f"""Analyze the following YouTube video transcript and provide a structured summary.
{lang_note}
Use EXACTLY these section headers (with the ### prefix):

### SHORT SUMMARY
Write 3-4 sentences in English capturing the core message of the video.

### DETAILED SUMMARY
Write 2-3 paragraphs in English covering the main topics, arguments, and conclusions.

### KEY BULLET POINTS
- List 6-8 key points in English
- Each bullet should be a complete, informative sentence

### ACTIONABLE INSIGHTS
- List 4-6 practical takeaways in English
- Start each with an action verb

### ORIGINAL TRANSCRIPT
{f'Include the first 300 words of the original {lang_name} transcript here.' if not is_english else 'N/A - Transcript is already in English.'}

TRANSCRIPT ({lang_name}):
{transcript}"""

    try:
        client   = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert multilingual content summarizer. Always produce summaries in clear English. Follow formatting instructions exactly."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2048,
        )
        raw_text = response.choices[0].message.content
        print(f"[Groq] ✓ Response ({len(raw_text)} chars)")
        result = parse_summary_response(raw_text)
        result["transcript_language"]      = lang_name
        result["transcript_language_code"] = lang_code
        result["was_translated"]           = not is_english
        return result

    except Exception as e:
        err = str(e)
        if "429" in err or "rate_limit" in err.lower():
            raise Exception("Groq API rate limit hit. Please wait 30 seconds and try again.")
        if "401" in err or "invalid_api_key" in err.lower():
            raise Exception("Invalid Groq API key. Get your free key at https://console.groq.com/keys")
        raise Exception(f"Groq API error: {err}")


# ─── Parse Groq response ──────────────────────────────────────
def parse_summary_response(text: str) -> dict:
    result = {
        "short_summary":        "",
        "detailed_summary":     "",
        "bullet_points":        [],
        "actionable_insights":  [],
        "original_transcript":  "",
    }

    def parse_list(content: str) -> list:
        return [
            re.sub(r"^[\s\-\*•\d\.]+", "", line).strip()
            for line in content.split("\n")
            if re.sub(r"^[\s\-\*•\d\.]+", "", line).strip()
        ]

    for part in re.split(r"###\s*", text):
        part = part.strip()
        if not part:
            continue
        lines   = part.split("\n")
        header  = lines[0].strip().upper()
        content = "\n".join(lines[1:]).strip()

        if "SHORT SUMMARY" in header:
            result["short_summary"] = content
        elif "DETAILED SUMMARY" in header:
            result["detailed_summary"] = content
        elif "KEY BULLET" in header:
            result["bullet_points"] = parse_list(content)
        elif any(k in header for k in ("ACTIONABLE", "INSIGHT", "TAKEAWAY")):
            result["actionable_insights"] = parse_list(content)
        elif "ORIGINAL TRANSCRIPT" in header:
            if content and not content.startswith("N/A"):
                result["original_transcript"] = content

    if not any([result["short_summary"], result["detailed_summary"]]):
        result["short_summary"]    = text[:600]
        result["detailed_summary"] = text

    return result


# ─── ROUTES ──────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/summarize", methods=["POST"])
def summarize():
    try:
        body = request.get_json(silent=True)
        if not body or "url" not in body:
            return jsonify({"error": "Please provide a YouTube URL."}), 400

        url = body["url"].strip()
        if not url:
            return jsonify({"error": "URL cannot be empty."}), 400

        video_id = extract_video_id(url)
        if not video_id:
            return jsonify({"error": (
                "Invalid YouTube URL. Supported formats:\n"
                "• youtube.com/watch?v=ID\n"
                "• youtu.be/ID\n"
                "• youtube.com/shorts/ID"
            )}), 400

        print(f"\n[Request] video_id={video_id}")

        meta            = get_video_metadata(video_id)
        transcript_data = fetch_transcript(video_id)
        word_count      = len(transcript_data["text"].split())

        print(f"[Request] lang={transcript_data['language_name']}, words={word_count}")

        if word_count < 30:
            return jsonify({"error": "Transcript is too short to summarize."}), 400

        summary = generate_summary_with_groq(transcript_data)

        return jsonify({
            "success":           True,
            "video_id":          video_id,
            "title":             meta["title"],
            "thumbnail":         meta["thumbnail"],
            "transcript_length": word_count,
            **summary,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    key_ok = bool(GROQ_API_KEY) and GROQ_API_KEY.startswith("gsk_")
    return jsonify({
        "status":                 "ok",
        "groq_configured":        key_ok,
        "groq_key_prefix":        (GROQ_API_KEY[:12] + "...") if GROQ_API_KEY else "NOT SET",
        "youtube_api_configured": bool(YOUTUBE_API_KEY) and not YOUTUBE_API_KEY.startswith("your_"),
        "cookies_configured":     bool(YOUTUBE_COOKIES) or os.path.exists("cookies.txt"),
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)