from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# YouTube API
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str

class CategoryOut(BaseModel):
    category_id: str
    name: str
    slug: str
    description: str
    icon: str
    image_url: str
    topic_count: int = 0

class TopicOut(BaseModel):
    topic_id: str
    category_slug: str
    title: str
    description: str
    content: str
    icon: str
    tags: List[str] = []

class VideoOut(BaseModel):
    video_id: str
    title: str
    description: str
    thumbnail: str
    channel_title: str

class TopicDetailOut(BaseModel):
    topic: TopicOut
    videos: List[VideoOut] = []

class BookmarkIn(BaseModel):
    topic_id: str

class BookmarkOut(BaseModel):
    bookmark_id: str
    user_id: str
    topic_id: str
    created_at: str
    topic: Optional[TopicOut] = None

class SessionIn(BaseModel):
    session_id: str

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> Optional[dict]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        return None
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        return None
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    return user_doc

async def require_auth(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def create_session(body: SessionIn, response: Response):
    async with httpx.AsyncClient() as http_client:
        resp = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    email = data["email"]
    name = data["name"]
    picture = data.get("picture", "")
    session_token = data["session_token"]

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60
    )

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    # Include session_token in response body for frontend storage
    result = dict(user_doc) if user_doc else {}
    result["session_token"] = session_token
    return result

@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ==================== CATEGORIES & TOPICS ====================

@api_router.get("/categories", response_model=List[CategoryOut])
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    for cat in cats:
        cat["topic_count"] = await db.topics.count_documents({"category_slug": cat["slug"]})
    return cats

@api_router.get("/categories/{slug}")
async def get_category_detail(slug: str):
    cat = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    topics = await db.topics.find({"category_slug": slug}, {"_id": 0}).to_list(100)
    cat["topic_count"] = len(topics)
    return {"category": cat, "topics": topics}

@api_router.get("/topics/{topic_id}")
async def get_topic_detail(topic_id: str):
    topic = await db.topics.find_one({"topic_id": topic_id}, {"_id": 0})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    videos = []
    if YOUTUBE_API_KEY:
        try:
            youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY, cache_discovery=False)
            search_query = f"{topic['title']} tutorial guide"
            request = youtube.search().list(
                part="snippet",
                q=search_query,
                type="video",
                maxResults=5,
                videoDuration="short",
                relevanceLanguage="en",
                safeSearch="strict"
            )
            yt_response = request.execute()
            for item in yt_response.get("items", []):
                videos.append({
                    "video_id": item["id"]["videoId"],
                    "title": item["snippet"]["title"],
                    "description": item["snippet"]["description"][:200],
                    "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"],
                    "channel_title": item["snippet"]["channelTitle"]
                })
        except HttpError as e:
            logger.error(f"YouTube API error: {e}")
        except Exception as e:
            logger.error(f"YouTube error: {e}")
    return {"topic": topic, "videos": videos}

@api_router.get("/search")
async def search_topics(q: str = ""):
    if not q or len(q) < 2:
        return {"results": []}
    regex = {"$regex": q, "$options": "i"}
    topics = await db.topics.find(
        {"$or": [{"title": regex}, {"description": regex}, {"tags": regex}, {"content": regex}]},
        {"_id": 0}
    ).to_list(50)
    return {"results": topics}

# ==================== BOOKMARKS ====================

@api_router.post("/bookmarks")
async def add_bookmark(body: BookmarkIn, request: Request):
    user = await require_auth(request)
    existing = await db.bookmarks.find_one(
        {"user_id": user["user_id"], "topic_id": body.topic_id}, {"_id": 0}
    )
    if existing:
        return existing
    bookmark = {
        "bookmark_id": f"bm_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "topic_id": body.topic_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bookmarks.insert_one(bookmark)
    bm_copy = {k: v for k, v in bookmark.items() if k != "_id"}
    return bm_copy

@api_router.delete("/bookmarks/{topic_id}")
async def remove_bookmark(topic_id: str, request: Request):
    user = await require_auth(request)
    await db.bookmarks.delete_one({"user_id": user["user_id"], "topic_id": topic_id})
    return {"message": "Bookmark removed"}

@api_router.get("/bookmarks")
async def get_bookmarks(request: Request):
    user = await require_auth(request)
    bookmarks = await db.bookmarks.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    result = []
    for bm in bookmarks:
        topic = await db.topics.find_one({"topic_id": bm["topic_id"]}, {"_id": 0})
        bm["topic"] = topic
        result.append(bm)
    return {"bookmarks": result}

# ==================== YOUTUBE VIDEO SEARCH ====================

@api_router.get("/videos/search")
async def search_videos(q: str = ""):
    if not q or not YOUTUBE_API_KEY:
        return {"videos": []}
    try:
        youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY, cache_discovery=False)
        request = youtube.search().list(
            part="snippet",
            q=q,
            type="video",
            maxResults=10,
            videoDuration="short",
            relevanceLanguage="en",
            safeSearch="strict"
        )
        yt_response = request.execute()
        videos = []
        for item in yt_response.get("items", []):
            videos.append({
                "video_id": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "description": item["snippet"]["description"][:200],
                "thumbnail": item["snippet"]["thumbnails"]["medium"]["url"],
                "channel_title": item["snippet"]["channelTitle"]
            })
        return {"videos": videos}
    except Exception as e:
        logger.error(f"YouTube search error: {e}")
        return {"videos": []}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    cat_count = await db.categories.count_documents({})
    if cat_count > 0:
        return {"message": "Data already seeded", "categories": cat_count}

    categories = [
        {
            "category_id": "cat_first_aid",
            "name": "First Aid",
            "slug": "first-aid",
            "description": "Essential first aid knowledge for emergencies. Learn CPR, wound care, and life-saving techniques.",
            "icon": "heart",
            "image_url": "https://images.unsplash.com/photo-1611923973164-e0e5f7f69872?crop=entropy&cs=srgb&fm=jpg&q=85"
        },
        {
            "category_id": "cat_finance",
            "name": "Finance",
            "slug": "finance",
            "description": "Navigate your financial world confidently. From taxes to banking, learn money management essentials.",
            "icon": "dollar-sign",
            "image_url": "https://images.unsplash.com/photo-1763730512449-f1a505f432a9?crop=entropy&cs=srgb&fm=jpg&q=85"
        },
        {
            "category_id": "cat_crisis",
            "name": "Crisis Management",
            "slug": "crisis-management",
            "description": "Be prepared for any crisis. Self-defense techniques, disaster preparedness, and survival skills.",
            "icon": "shield",
            "image_url": "https://images.unsplash.com/photo-1769095211047-472fbd40f58d?crop=entropy&cs=srgb&fm=jpg&q=85"
        },
        {
            "category_id": "cat_civic",
            "name": "Civic Sense",
            "slug": "civic-sense",
            "description": "Your rights and responsibilities as a citizen. Voting, RTI, and community engagement.",
            "icon": "flag",
            "image_url": "https://images.unsplash.com/photo-1597700331582-aab3614b3c0c?crop=entropy&cs=srgb&fm=jpg&q=85"
        },
        {
            "category_id": "cat_safety",
            "name": "Safety Tips",
            "slug": "safety-tips",
            "description": "Stay safe in every situation. Road safety, cyber security, food safety, and more.",
            "icon": "alert-triangle",
            "image_url": "https://images.unsplash.com/photo-1770430724878-ef327337a9ae?crop=entropy&cs=srgb&fm=jpg&q=85"
        }
    ]

    topics = [
        # First Aid
        {"topic_id": "t_cpr", "category_slug": "first-aid", "title": "CPR - Cardiopulmonary Resuscitation", "description": "Learn how to perform CPR to save lives during cardiac emergencies.", "content": "CPR is a life-saving technique used when someone's heart stops beating. Steps: 1) Call emergency services. 2) Place the heel of your hand on the center of the chest. 3) Push hard and fast at 100-120 compressions per minute. 4) Give 2 rescue breaths after every 30 compressions. 5) Continue until help arrives. Remember: Hands-only CPR is better than no CPR.", "icon": "activity", "tags": ["cpr", "heart", "emergency", "life-saving"]},
        {"topic_id": "t_burns", "category_slug": "first-aid", "title": "Burns Treatment", "description": "How to treat different types of burns effectively.", "content": "For minor burns: 1) Cool the burn under running water for 10-20 minutes. 2) Don't use ice. 3) Cover with a sterile bandage. 4) Take over-the-counter pain relief. For severe burns: 1) Call emergency services immediately. 2) Don't remove stuck clothing. 3) Cover with a clean cloth. 4) Keep the person warm. Never apply butter or toothpaste to burns.", "icon": "thermometer", "tags": ["burns", "treatment", "skin", "first-aid"]},
        {"topic_id": "t_choking", "category_slug": "first-aid", "title": "Choking - Heimlich Maneuver", "description": "Learn the Heimlich maneuver to help someone who is choking.", "content": "If someone is choking: 1) Ask 'Are you choking?' If they can't speak, act immediately. 2) Stand behind them, wrap arms around their waist. 3) Make a fist with one hand, place it above the navel. 4) Grasp your fist with the other hand. 5) Give quick upward thrusts. 6) Repeat until the object is expelled. For infants: Use back blows and chest thrusts.", "icon": "alert-circle", "tags": ["choking", "heimlich", "airway", "emergency"]},
        {"topic_id": "t_bleeding", "category_slug": "first-aid", "title": "Controlling Severe Bleeding", "description": "Techniques to control severe bleeding in emergencies.", "content": "Steps to control bleeding: 1) Apply direct pressure with a clean cloth. 2) Keep pressing firmly for 15 minutes. 3) If blood soaks through, add more cloth on top. 4) Elevate the injured area above the heart. 5) Apply a tourniquet only as a last resort, 2-3 inches above the wound. 6) Call emergency services immediately for severe bleeding.", "icon": "droplet", "tags": ["bleeding", "wound", "pressure", "emergency"]},
        {"topic_id": "t_fractures", "category_slug": "first-aid", "title": "Fracture First Aid", "description": "How to provide first aid for bone fractures.", "content": "First aid for fractures: 1) Keep the person still. 2) Stabilize the injured area - don't try to realign. 3) Apply ice packs wrapped in cloth. 4) Immobilize with a splint if possible. 5) Check circulation below the injury. 6) Treat for shock if needed. Signs of a fracture: intense pain, swelling, deformity, inability to move the limb.", "icon": "minus-circle", "tags": ["fracture", "bone", "splint", "injury"]},

        # Finance
        {"topic_id": "t_taxes", "category_slug": "finance", "title": "Understanding Income Tax", "description": "A beginner's guide to filing income tax returns.", "content": "Income tax essentials: 1) Know your tax slab based on income. 2) Gather Form 16 from employer. 3) Collect investment proofs for deductions (80C, 80D). 4) File returns online at the tax department website. 5) Claim deductions: PPF, ELSS, insurance premiums. 6) Keep records for 7 years. Key dates: Usually July 31 for individuals. Late filing incurs penalties.", "icon": "file-text", "tags": ["tax", "income", "filing", "deductions"]},
        {"topic_id": "t_pan", "category_slug": "finance", "title": "PAN Card - Application & Uses", "description": "Everything about PAN card - application, correction, and uses.", "content": "PAN (Permanent Account Number) is essential for: 1) Filing tax returns. 2) Opening bank accounts. 3) High-value transactions. How to apply: Visit NSDL or UTIITSL websites. Documents needed: ID proof, address proof, date of birth proof. Processing time: 15-20 days. For corrections: Submit a correction form online. Link PAN with Aadhaar to keep it active.", "icon": "credit-card", "tags": ["pan", "card", "identity", "government"]},
        {"topic_id": "t_banking", "category_slug": "finance", "title": "Banking Essentials", "description": "Understanding savings accounts, fixed deposits, and digital banking.", "content": "Banking basics: 1) Choose between savings and current accounts based on needs. 2) Maintain minimum balance to avoid charges. 3) Use UPI for instant transfers. 4) Set up auto-pay for recurring bills. 5) FD rates vary - compare before investing. 6) Enable two-factor authentication. 7) Never share OTPs or PINs. Digital banking tips: Use official apps, check statements regularly.", "icon": "briefcase", "tags": ["banking", "savings", "digital", "upi"]},
        {"topic_id": "t_budgeting", "category_slug": "finance", "title": "Personal Budgeting", "description": "Create and maintain a personal budget for financial health.", "content": "The 50/30/20 rule: 50% needs, 30% wants, 20% savings. Steps: 1) Track all income sources. 2) List fixed expenses (rent, EMIs). 3) Track variable expenses for a month. 4) Set spending limits per category. 5) Build an emergency fund (3-6 months expenses). 6) Review and adjust monthly. Tools: Use budgeting apps or simple spreadsheets.", "icon": "pie-chart", "tags": ["budget", "savings", "planning", "money"]},
        {"topic_id": "t_insurance", "category_slug": "finance", "title": "Insurance Guide", "description": "Types of insurance and how to choose the right coverage.", "content": "Essential insurance types: 1) Health insurance - covers medical expenses. 2) Term life insurance - protects dependents. 3) Vehicle insurance - mandatory by law. 4) Home insurance - covers property damage. How to choose: Compare premiums, check claim settlement ratio, read policy terms. Ideal coverage: Health - 10-15 lakh minimum. Term - 10-15x annual income.", "icon": "shield", "tags": ["insurance", "health", "life", "coverage"]},

        # Crisis Management
        {"topic_id": "t_self_defense", "category_slug": "crisis-management", "title": "Basic Self-Defense", "description": "Essential self-defense techniques everyone should know.", "content": "Key self-defense principles: 1) Be aware of surroundings. 2) Trust your instincts. 3) Target vulnerable areas: eyes, nose, throat, groin, knees. 4) Use palm strikes instead of punches. 5) Break free from grabs - rotate toward the thumb. 6) Make noise and attract attention. 7) Run when possible - escaping is winning. Take a formal self-defense class for hands-on training.", "icon": "zap", "tags": ["self-defense", "safety", "protection", "awareness"]},
        {"topic_id": "t_fire_safety", "category_slug": "crisis-management", "title": "Fire Safety & Evacuation", "description": "What to do during a fire emergency.", "content": "Fire safety: 1) Install smoke detectors on every floor. 2) Keep fire extinguishers accessible. 3) Plan escape routes - two ways out of every room. During a fire: 1) Alert everyone - shout 'FIRE!' 2) Stay low to avoid smoke. 3) Feel doors before opening - hot means fire behind. 4) Use stairs, never elevators. 5) Stop, Drop, and Roll if clothes catch fire. 6) Call fire services from outside.", "icon": "alert-triangle", "tags": ["fire", "evacuation", "safety", "emergency"]},
        {"topic_id": "t_earthquake", "category_slug": "crisis-management", "title": "Earthquake Preparedness", "description": "How to stay safe during and after an earthquake.", "content": "During an earthquake: 1) DROP to hands and knees. 2) Take COVER under a sturdy table. 3) HOLD ON until shaking stops. 4) Stay away from windows and heavy objects. 5) If outdoors, move to an open area. After: 1) Check for injuries. 2) Expect aftershocks. 3) Check gas and water lines. 4) Don't use elevators. Prepare: Keep an emergency kit with water, food, flashlight, and first aid.", "icon": "activity", "tags": ["earthquake", "disaster", "preparedness", "safety"]},
        {"topic_id": "t_flood", "category_slug": "crisis-management", "title": "Flood Survival Guide", "description": "Essential steps to survive flood situations.", "content": "Before a flood: 1) Know your area's flood risk. 2) Prepare an emergency kit. 3) Keep important documents in waterproof bags. During: 1) Move to higher ground immediately. 2) Never walk or drive through floodwater. 3) 6 inches of water can knock you down. 4) Avoid touching electrical equipment. After: 1) Don't drink tap water until cleared. 2) Watch for weakened structures. 3) Document damage for insurance.", "icon": "cloud-rain", "tags": ["flood", "water", "disaster", "survival"]},

        # Civic Sense
        {"topic_id": "t_voting", "category_slug": "civic-sense", "title": "Voting Rights & Process", "description": "Your guide to exercising your right to vote.", "content": "Voting essentials: 1) Register to vote - check eligibility (18+ years, citizen). 2) Get your voter ID card. 3) Check your name on the electoral roll. 4) Know your polling booth. On election day: 1) Carry voter ID. 2) Verify your details. 3) Cast your vote using EVM. 4) Get the ink mark. Your vote is secret - no one can force you to reveal your choice. Report any malpractice to the Election Commission.", "icon": "check-square", "tags": ["voting", "election", "democracy", "rights"]},
        {"topic_id": "t_rti", "category_slug": "civic-sense", "title": "Right to Information (RTI)", "description": "How to file an RTI application for government transparency.", "content": "RTI empowers citizens to seek information from public authorities. How to file: 1) Write an application to the Public Information Officer. 2) Be specific about information sought. 3) Pay the nominal fee (Rs 10 for central govt). 4) Response due within 30 days. 5) File first appeal within 30 days if unsatisfied. 6) Second appeal goes to Information Commission. RTI applies to all government bodies and entities receiving government funding.", "icon": "file-text", "tags": ["rti", "information", "government", "transparency"]},
        {"topic_id": "t_traffic", "category_slug": "civic-sense", "title": "Traffic Rules & Road Discipline", "description": "Essential traffic rules every citizen should follow.", "content": "Traffic rules: 1) Always wear seatbelts/helmets. 2) Follow speed limits. 3) Don't use phones while driving. 4) Yield to pedestrians at crosswalks. 5) Obey traffic signals - red means stop. 6) Don't drink and drive. 7) Use indicators before turning. 8) Maintain safe following distance. 9) Honk only when necessary. Fines have increased significantly - follow rules to save lives and money.", "icon": "navigation", "tags": ["traffic", "rules", "road", "driving"]},
        {"topic_id": "t_hygiene", "category_slug": "civic-sense", "title": "Public Hygiene & Cleanliness", "description": "Maintaining cleanliness in public spaces.", "content": "Public hygiene practices: 1) Don't litter - use dustbins. 2) Segregate waste - wet and dry. 3) Cover mouth while sneezing/coughing. 4) Wash hands frequently. 5) Don't spit in public. 6) Clean up after pets. 7) Report blocked drains or garbage accumulation. 8) Participate in community clean-up drives. Good hygiene prevents diseases and creates a pleasant environment for everyone.", "icon": "trash-2", "tags": ["hygiene", "cleanliness", "public", "health"]},

        # Safety Tips
        {"topic_id": "t_road_safety", "category_slug": "safety-tips", "title": "Road Safety Tips", "description": "Stay safe on roads as a pedestrian, cyclist, or driver.", "content": "Road safety: 1) Pedestrians: Use crosswalks, look both ways, wear bright clothing at night. 2) Cyclists: Wear helmets, use bike lanes, have lights. 3) Drivers: Regular vehicle maintenance, don't speed, no distractions. 4) Children: Always hold hands, teach road signs. 5) Night driving: Use headlights, reduce speed. Most accidents are preventable with awareness and patience.", "icon": "map", "tags": ["road", "safety", "pedestrian", "driving"]},
        {"topic_id": "t_cyber_safety", "category_slug": "safety-tips", "title": "Cyber Safety", "description": "Protect yourself online from scams and cyber threats.", "content": "Cyber safety tips: 1) Use strong, unique passwords. 2) Enable two-factor authentication. 3) Don't click suspicious links. 4) Verify sender before sharing info. 5) Keep software updated. 6) Don't share OTPs or bank details. 7) Use secure Wi-Fi networks. 8) Regular backups. 9) Check URLs before entering credentials. 10) Report suspicious activity immediately. Common scams: phishing emails, fake job offers, lottery frauds.", "icon": "lock", "tags": ["cyber", "online", "security", "privacy"]},
        {"topic_id": "t_food_safety", "category_slug": "safety-tips", "title": "Food Safety", "description": "Guidelines for safe food handling and storage.", "content": "Food safety rules: 1) Wash hands before cooking. 2) Cook food to proper temperatures. 3) Refrigerate within 2 hours. 4) Don't cross-contaminate - separate raw and cooked. 5) Check expiry dates. 6) Wash fruits and vegetables. 7) Use clean utensils. 8) When in doubt, throw it out. Temperature danger zone: 4°C to 60°C - bacteria multiply rapidly. Reheat food to at least 74°C.", "icon": "coffee", "tags": ["food", "safety", "hygiene", "cooking"]},
        {"topic_id": "t_home_safety", "category_slug": "safety-tips", "title": "Home Safety", "description": "Make your home safe for everyone, especially children and elderly.", "content": "Home safety checklist: 1) Install smoke detectors and CO monitors. 2) Keep fire extinguisher accessible. 3) Store medicines and chemicals safely. 4) Secure heavy furniture to walls. 5) Use non-slip mats in bathrooms. 6) Keep emergency numbers visible. 7) Check electrical wiring regularly. 8) Install window guards for children. 9) Adequate lighting on stairs. 10) Lock away sharp objects and tools.", "icon": "home", "tags": ["home", "safety", "childproofing", "elderly"]}
    ]

    await db.categories.insert_many(categories)
    await db.topics.insert_many(topics)

    return {"message": "Data seeded successfully", "categories": len(categories), "topics": len(topics)}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Auto-seed on startup
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
        logger.info("Seeding initial data...")
        # Import seed logic inline
        categories = [
            {"category_id": "cat_first_aid", "name": "First Aid", "slug": "first-aid", "description": "Essential first aid knowledge for emergencies.", "icon": "heart", "image_url": "https://images.unsplash.com/photo-1611923973164-e0e5f7f69872?crop=entropy&cs=srgb&fm=jpg&q=85"},
            {"category_id": "cat_finance", "name": "Finance", "slug": "finance", "description": "Navigate your financial world confidently.", "icon": "dollar-sign", "image_url": "https://images.unsplash.com/photo-1763730512449-f1a505f432a9?crop=entropy&cs=srgb&fm=jpg&q=85"},
            {"category_id": "cat_crisis", "name": "Crisis Management", "slug": "crisis-management", "description": "Be prepared for any crisis.", "icon": "shield", "image_url": "https://images.unsplash.com/photo-1769095211047-472fbd40f58d?crop=entropy&cs=srgb&fm=jpg&q=85"},
            {"category_id": "cat_civic", "name": "Civic Sense", "slug": "civic-sense", "description": "Your rights and responsibilities as a citizen.", "icon": "flag", "image_url": "https://images.unsplash.com/photo-1597700331582-aab3614b3c0c?crop=entropy&cs=srgb&fm=jpg&q=85"},
            {"category_id": "cat_safety", "name": "Safety Tips", "slug": "safety-tips", "description": "Stay safe in every situation.", "icon": "alert-triangle", "image_url": "https://images.unsplash.com/photo-1770430724878-ef327337a9ae?crop=entropy&cs=srgb&fm=jpg&q=85"}
        ]
        topics = [
            {"topic_id": "t_cpr", "category_slug": "first-aid", "title": "CPR - Cardiopulmonary Resuscitation", "description": "Learn how to perform CPR to save lives.", "content": "CPR steps: Call emergency, push hard and fast on chest center at 100-120/min, give 2 rescue breaths every 30 compressions.", "icon": "activity", "tags": ["cpr", "heart", "emergency"]},
            {"topic_id": "t_burns", "category_slug": "first-aid", "title": "Burns Treatment", "description": "How to treat burns effectively.", "content": "Cool under running water 10-20 min. Don't use ice. Cover with sterile bandage.", "icon": "thermometer", "tags": ["burns", "treatment"]},
            {"topic_id": "t_choking", "category_slug": "first-aid", "title": "Choking - Heimlich Maneuver", "description": "Help someone who is choking.", "content": "Stand behind, wrap arms around waist, make fist above navel, thrust upward.", "icon": "alert-circle", "tags": ["choking", "heimlich"]},
            {"topic_id": "t_bleeding", "category_slug": "first-aid", "title": "Controlling Severe Bleeding", "description": "Techniques to control severe bleeding.", "content": "Apply direct pressure with clean cloth. Keep pressing 15 minutes. Elevate above heart.", "icon": "droplet", "tags": ["bleeding", "wound"]},
            {"topic_id": "t_fractures", "category_slug": "first-aid", "title": "Fracture First Aid", "description": "First aid for bone fractures.", "content": "Keep still, stabilize area, apply ice, immobilize with splint.", "icon": "minus-circle", "tags": ["fracture", "bone"]},
            {"topic_id": "t_taxes", "category_slug": "finance", "title": "Understanding Income Tax", "description": "Guide to filing income tax.", "content": "Know your tax slab, gather Form 16, file online, claim deductions under 80C.", "icon": "file-text", "tags": ["tax", "income"]},
            {"topic_id": "t_pan", "category_slug": "finance", "title": "PAN Card", "description": "PAN card application and uses.", "content": "Apply online at NSDL/UTIITSL. Needed for tax filing, bank accounts, high-value transactions.", "icon": "credit-card", "tags": ["pan", "card"]},
            {"topic_id": "t_banking", "category_slug": "finance", "title": "Banking Essentials", "description": "Savings, FDs, and digital banking.", "content": "Choose right account type, maintain min balance, use UPI, enable 2FA.", "icon": "briefcase", "tags": ["banking", "savings"]},
            {"topic_id": "t_budgeting", "category_slug": "finance", "title": "Personal Budgeting", "description": "Create a personal budget.", "content": "Follow 50/30/20 rule: 50% needs, 30% wants, 20% savings.", "icon": "pie-chart", "tags": ["budget", "savings"]},
            {"topic_id": "t_insurance", "category_slug": "finance", "title": "Insurance Guide", "description": "Types of insurance coverage.", "content": "Health, term life, vehicle, home insurance. Compare premiums and claim ratios.", "icon": "shield", "tags": ["insurance", "health"]},
            {"topic_id": "t_self_defense", "category_slug": "crisis-management", "title": "Basic Self-Defense", "description": "Self-defense techniques.", "content": "Be aware, target vulnerable areas, use palm strikes, break grabs, run when possible.", "icon": "zap", "tags": ["self-defense", "safety"]},
            {"topic_id": "t_fire_safety", "category_slug": "crisis-management", "title": "Fire Safety", "description": "Fire emergency procedures.", "content": "Install smoke detectors, plan escape routes, stay low, use stairs.", "icon": "alert-triangle", "tags": ["fire", "evacuation"]},
            {"topic_id": "t_earthquake", "category_slug": "crisis-management", "title": "Earthquake Preparedness", "description": "Stay safe during earthquakes.", "content": "DROP, COVER, HOLD ON. Stay away from windows. Prepare emergency kit.", "icon": "activity", "tags": ["earthquake", "disaster"]},
            {"topic_id": "t_flood", "category_slug": "crisis-management", "title": "Flood Survival", "description": "Survive flood situations.", "content": "Move to higher ground, never walk through floodwater, keep documents waterproof.", "icon": "cloud-rain", "tags": ["flood", "disaster"]},
            {"topic_id": "t_voting", "category_slug": "civic-sense", "title": "Voting Rights", "description": "Exercise your right to vote.", "content": "Register at 18, get voter ID, know your booth, vote is secret.", "icon": "check-square", "tags": ["voting", "election"]},
            {"topic_id": "t_rti", "category_slug": "civic-sense", "title": "Right to Information", "description": "File RTI applications.", "content": "Write to PIO, be specific, pay Rs 10, response within 30 days.", "icon": "file-text", "tags": ["rti", "government"]},
            {"topic_id": "t_traffic", "category_slug": "civic-sense", "title": "Traffic Rules", "description": "Essential traffic rules.", "content": "Wear seatbelts/helmets, follow speed limits, no phones while driving.", "icon": "navigation", "tags": ["traffic", "rules"]},
            {"topic_id": "t_hygiene", "category_slug": "civic-sense", "title": "Public Hygiene", "description": "Maintain public cleanliness.", "content": "Don't litter, segregate waste, wash hands, cover mouth while sneezing.", "icon": "trash-2", "tags": ["hygiene", "cleanliness"]},
            {"topic_id": "t_road_safety", "category_slug": "safety-tips", "title": "Road Safety", "description": "Stay safe on roads.", "content": "Use crosswalks, wear helmets, maintain vehicles, be aware at night.", "icon": "map", "tags": ["road", "safety"]},
            {"topic_id": "t_cyber_safety", "category_slug": "safety-tips", "title": "Cyber Safety", "description": "Protect yourself online.", "content": "Strong passwords, 2FA, don't click suspicious links, verify senders.", "icon": "lock", "tags": ["cyber", "security"]},
            {"topic_id": "t_food_safety", "category_slug": "safety-tips", "title": "Food Safety", "description": "Safe food handling.", "content": "Wash hands, cook properly, refrigerate within 2 hours, check expiry.", "icon": "coffee", "tags": ["food", "safety"]},
            {"topic_id": "t_home_safety", "category_slug": "safety-tips", "title": "Home Safety", "description": "Make your home safe.", "content": "Smoke detectors, fire extinguisher, non-slip mats, secure furniture.", "icon": "home", "tags": ["home", "safety"]}
        ]
        await db.categories.insert_many(categories)
        await db.topics.insert_many(topics)
        logger.info(f"Seeded {len(categories)} categories and {len(topics)} topics")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
