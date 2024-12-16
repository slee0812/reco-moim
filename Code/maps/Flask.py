from flask import Flask, render_template, jsonify
import requests
from FindDestination import calculate_centroid, haversine
import pandas as pd
import math

app = Flask(__name__, template_folder='../frontend')

API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"

@app.route("/")
def index():
    return render_template("Recommend.html")

@app.route("/centroid")
def get_centroid():
    # CSV 파일 읽기
    data = pd.read_csv('../../Data/maps/subway_stations.csv')

    # 현재 위치 (위도, 경도)
    current_lat = 37.4842
    current_lon = 126.9293

    # '위도'와 '경도'가 숫자 형식인지 확인하고, 결측값 처리
    data['위도'] = pd.to_numeric(data['위도'], errors='coerce')
    data['경도'] = pd.to_numeric(data['경도'], errors='coerce')

    # 결측값 처리 (NaN이 있는 경우, 예시로 NaN을 0으로 채움)
    data = data.fillna({'위도': 0, '경도': 0})

    # 각 전철역과 현재 위치 사이의 거리 계산
    data['거리'] = data.apply(lambda row: haversine(current_lat, current_lon, row['위도'], row['경도']), axis=1)

    # 가장 가까운 역 찾기
    nearest_station = data.loc[data['거리'].idxmin()]
    
    # centroid 값을 반환
    return jsonify({
        "latitude": nearest_station['위도'],
        "longitude": nearest_station['경도']
    })

@app.route("/places")
def get_places():
    latitude, longitude = get_centroid()
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    params = {
        "query": "음식점",
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
