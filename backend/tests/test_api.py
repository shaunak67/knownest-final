"""
Backend API Tests for knowNest
Tests: Categories, Topics, Search, Auth-gated Bookmarks, YouTube integration
"""
import pytest
import requests
import os
from dotenv import load_dotenv
from pathlib import Path

# Load frontend env vars
env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(env_path)

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')

class TestPublicEndpoints:
    """Test public API endpoints (no auth required)"""

    def test_get_categories(self):
        """Test GET /api/categories returns 5 categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 5, f"Expected 5 categories, got {len(data)}"
        
        # Verify structure of first category
        cat = data[0]
        assert "category_id" in cat
        assert "name" in cat
        assert "slug" in cat
        assert "description" in cat
        assert "icon" in cat
        assert "image_url" in cat
        assert "topic_count" in cat
        
        print(f"✓ GET /api/categories returned {len(data)} categories")

    def test_get_category_first_aid(self):
        """Test GET /api/categories/first-aid returns category with topics"""
        response = requests.get(f"{BASE_URL}/api/categories/first-aid")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "category" in data
        assert "topics" in data
        
        category = data["category"]
        assert category["slug"] == "first-aid"
        assert category["name"] == "First Aid"
        
        topics = data["topics"]
        assert isinstance(topics, list), "Topics should be a list"
        assert len(topics) > 0, "First Aid should have topics"
        
        print(f"✓ GET /api/categories/first-aid returned {len(topics)} topics")

    def test_get_topic_cpr(self):
        """Test GET /api/topics/t_cpr returns topic with YouTube videos"""
        response = requests.get(f"{BASE_URL}/api/topics/t_cpr")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "topic" in data
        assert "videos" in data
        
        topic = data["topic"]
        assert topic["topic_id"] == "t_cpr"
        assert topic["title"] == "CPR - Cardiopulmonary Resuscitation"
        assert topic["category_slug"] == "first-aid"
        assert "content" in topic
        assert "tags" in topic
        
        videos = data["videos"]
        assert isinstance(videos, list), "Videos should be a list"
        
        # YouTube API should return videos if key is set
        if len(videos) > 0:
            video = videos[0]
            assert "video_id" in video
            assert "title" in video
            assert "description" in video
            assert "thumbnail" in video
            assert "channel_title" in video
            print(f"✓ GET /api/topics/t_cpr returned topic with {len(videos)} YouTube videos")
        else:
            print("⚠ YouTube API returned no videos (check API key or quota)")

    def test_search_cpr(self):
        """Test GET /api/search?q=cpr returns matching topics"""
        response = requests.get(f"{BASE_URL}/api/search?q=cpr")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "results" in data
        
        results = data["results"]
        assert isinstance(results, list), "Results should be a list"
        assert len(results) > 0, "Should find CPR topic"
        
        # Verify CPR topic is in results
        cpr_found = any(t["topic_id"] == "t_cpr" for t in results)
        assert cpr_found, "CPR topic should be in search results"
        
        print(f"✓ GET /api/search?q=cpr returned {len(results)} results")

    def test_search_empty_query(self):
        """Test search with empty query returns empty results"""
        response = requests.get(f"{BASE_URL}/api/search?q=")
        assert response.status_code == 200
        
        data = response.json()
        assert data["results"] == []
        print("✓ Search with empty query returns empty results")

    def test_get_category_not_found(self):
        """Test GET /api/categories/invalid returns 404"""
        response = requests.get(f"{BASE_URL}/api/categories/invalid-category")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid category returns 404")

    def test_get_topic_not_found(self):
        """Test GET /api/topics/invalid returns 404"""
        response = requests.get(f"{BASE_URL}/api/topics/invalid_topic")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid topic returns 404")


class TestAuthGatedEndpoints:
    """Test auth-gated endpoints (require authentication)"""

    def test_bookmarks_post_without_auth(self):
        """Test POST /api/bookmarks requires authentication (401 without token)"""
        response = requests.post(
            f"{BASE_URL}/api/bookmarks",
            json={"topic_id": "t_cpr"}
        )
        assert response.status_code == 401, f"Expected 401 (Unauthorized), got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Not authenticated"
        print("✓ POST /api/bookmarks returns 401 without auth")

    def test_bookmarks_get_without_auth(self):
        """Test GET /api/bookmarks requires authentication"""
        response = requests.get(f"{BASE_URL}/api/bookmarks")
        assert response.status_code == 401, f"Expected 401 (Unauthorized), got {response.status_code}"
        print("✓ GET /api/bookmarks returns 401 without auth")

    def test_bookmarks_delete_without_auth(self):
        """Test DELETE /api/bookmarks requires authentication"""
        response = requests.delete(f"{BASE_URL}/api/bookmarks/t_cpr")
        assert response.status_code == 401, f"Expected 401 (Unauthorized), got {response.status_code}"
        print("✓ DELETE /api/bookmarks returns 401 without auth")

    def test_auth_me_without_session(self):
        """Test GET /api/auth/me returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401 (Unauthorized), got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Not authenticated"
        print("✓ GET /api/auth/me returns 401 without session")


class TestDataIntegrity:
    """Test data structure and integrity"""

    def test_all_categories_have_topics(self):
        """Verify all categories have topics"""
        response = requests.get(f"{BASE_URL}/api/categories")
        categories = response.json()
        
        for cat in categories:
            cat_response = requests.get(f"{BASE_URL}/api/categories/{cat['slug']}")
            cat_data = cat_response.json()
            
            # Each category should have at least 1 topic
            assert len(cat_data["topics"]) > 0, f"Category {cat['slug']} has no topics"
        
        print("✓ All 5 categories have topics")

    def test_topic_belongs_to_correct_category(self):
        """Verify topics belong to correct categories"""
        response = requests.get(f"{BASE_URL}/api/topics/t_cpr")
        topic = response.json()["topic"]
        
        # Verify CPR topic belongs to first-aid category
        assert topic["category_slug"] == "first-aid"
        print("✓ Topics have correct category_slug")

    def test_search_returns_valid_topics(self):
        """Verify search results are valid topic objects"""
        response = requests.get(f"{BASE_URL}/api/search?q=safety")
        results = response.json()["results"]
        
        for topic in results:
            assert "topic_id" in topic
            assert "title" in topic
            assert "description" in topic
            assert "category_slug" in topic
            assert "tags" in topic
        
        print(f"✓ Search returns valid topic objects ({len(results)} results)")
