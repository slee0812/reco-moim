from flask import Flask, render_template, jsonify
import requests
from FindDestination import calculate_centroid

app = Flask(__name__, template_folder='../frontend')

API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"

@app.route("/")
def index():
    return render_template("Recommend.html")

@app.route("/centroid")
def get_centroid():
    # 지하철역들에 대한 좌표 (예시 데이터)
    subway_stations = [
        (37.4019, 126.9229),
        (37.3947, 126.9631),
        (37.4842, 126.9293)
    ]
    # 중심점 계산
    latitude, longitude = 37.47656223234824,126.98155858357366
    
    # centroid 값을 반환
    return jsonify({
        "latitude": latitude,
        "longitude": longitude
    })

@app.route("/places")
def get_places():
    latitude, longitude = calculate_centroid([(37.4019, 126.9229), (37.3947, 126.9631), (37.4842, 126.9293)])
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    params = {
        "query": "지하철역",
        "x": longitude,
        "y": latitude,
        "radius": 5000,
    }
    headers = {"Authorization": f"KakaoAK {API_KEY}"}
    response = requests.get(url, headers=headers, params=params)

    if response.status_code == 200:
        return jsonify(response.json())
    else:
        return jsonify({"error": response.text}), response.status_code

if __name__ == "__main__":
    app.run(debug=True)
