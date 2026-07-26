import urllib.request
import json
import traceback

def test_api(url):
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"URL: {url} -> Keys: {list(data.keys())}")
            if "dashboard" in data:
                print(f"Dashboard keys: {list(data['dashboard'].keys())}")
                if "markers" in data["dashboard"]:
                    print(f"Markers count: {len(data['dashboard']['markers'])}")
            if "network" in data:
                print(f"Network edges count: {len(data['network']['edges'])}")
    except Exception as e:
        print(f"Error testing {url}: {e}")
        traceback.print_exc()

test_api("http://localhost:8000/api/dashboard?days=365")
test_api("http://localhost:8000/api/network")
test_api("http://localhost:8000/api/district_map")
