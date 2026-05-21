import requests
import math

def check_emergency(vitals, onboarding_data=None):
    """
    Priority 1: Emergency Triage Logic
    Returns (is_emergency, message)
    """
    heart_rate = vitals.get('heartRate', 72)
    spo2 = vitals.get('spo2', 98)
    temp = vitals.get('temperature', 37)
    
    # Check for red flags
    if onboarding_data and onboarding_data.get('chest_pain_side') != 'none' and onboarding_data.get('chest_pressure'):
        return True, "Critical: Chest pain with pressure detected. Possible cardiac emergency."
        
    if spo2 < 90:
        return True, "Critical: Low blood oxygen (SpO2 < 90%). Immediate oxygen support needed."
        
    if heart_rate > 120 or heart_rate < 40:
        return True, f"Critical: Abnormal heart rate ({heart_rate} BPM). Significant cardiac risk."
        
    if temp > 39:
        return True, "Critical: High fever (> 39°C). Risk of heat stroke or severe infection."
        
    return False, None

def get_prakriti_assessment(onboarding_data):
    """
    Basic Prakriti Assessment based on habits
    Returns: Dominant Dosha and recommendations
    """
    # Initialize scores
    scores = {'Vata': 0, 'Pitta': 0, 'Kapha': 0}
    
    # 1. Diet & Digestion
    if onboarding_data.get('diet_type') == 'non-veg':
        scores['Pitta'] += 1
    if onboarding_data.get('outside_food_intake') == 'regularly':
        scores['Pitta'] += 1
        scores['Kapha'] += 1
        
    # 2. Sleep
    if not onboarding_data.get('proper_sleep'):
        scores['Vata'] += 2
        
    # 3. Energy Levels
    if onboarding_data.get('low_energy') or onboarding_data.get('physical_exhaustion'):
        scores['Vata'] += 1
        
    # Determine dominant dosha
    dominant_dosha = max(scores, key=scores.get)
    
    # Recommendations mapping
    recommendations = {
        'Vata': {
            'medicines': [{'name': 'Ashwagandha', 'benefit': 'Reduces stress and improves energy'}],
            'lifestyle': ['Daily oil massage (Abhyanga)', 'Stick to a regular routine', 'Avoid cold winds'],
            'diet': ['Warm, cooked foods', 'Sweet, sour, and salty tastes', 'Avoid dry or raw food']
        },
        'Pitta': {
            'medicines': [{'name': 'Amalaki', 'benefit': 'Cools the body and improves digestion'}],
            'lifestyle': ['Stay cool', 'Avoid intense heat', 'Practice meditation'],
            'diet': ['Cooling foods like cucumber and watermelon', 'Sweet, bitter, and astringent tastes', 'Avoid spicy food']
        },
        'Kapha': {
            'medicines': [{'name': 'Triphala', 'benefit': 'Improves metabolic rate and detoxification'}],
            'lifestyle': ['Regular vigorous exercise', 'Stay warm and dry', 'Seek variety and stimulation'],
            'diet': ['Light, warm foods', 'Pungent, bitter, and astringent tastes', 'Avoid heavy or oily food']
        }
    }
    
    return dominant_dosha, recommendations[dominant_dosha]

def get_nearby_hospitals(lat, lng):
    """
    Finds top 3 nearby hospitals using OpenStreetMap Overpass API
    """
    if lat is None or lng is None:
        return []
        
    # Overpass API query for hospitals within 5km (5000m)
    overpass_url = "https://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    node["amenity"="hospital"](around:5000, {lat}, {lng});
    out body;
    """
    
    try:
        response = requests.post(overpass_url, data={'data': overpass_query}, timeout=10)
        data = response.json()
        
        hospitals = []
        for element in data.get('elements', []):
            name = element.get('tags', {}).get('name', 'General Hospital')
            addr = element.get('tags', {}).get('addr:full', 'Nearby')
            h_lat = element.get('lat')
            h_lng = element.get('lon')
            
            # Simple distance calculation (Haversine)
            dist = calculate_distance(lat, lng, h_lat, h_lng)
            
            hospitals.append({
                'name': name,
                'address': addr,
                'distance': f"{dist:.2f} km",
                'contact': element.get('tags', {}).get('phone', 'N/A')
            })
            
        # Sort by distance and return top 3
        hospitals.sort(key=lambda x: float(x['distance'].split()[0]))
        return hospitals[:3]
        
    except Exception as e:
        print(f"Hospital Locator Error: {e}")
        return []

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371 # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) * math.sin(d_lat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(d_lon / 2) * math.sin(d_lon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c
