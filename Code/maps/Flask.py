from flask import Flask, render_template, jsonify
import requests
from FindDestination import calculate_centroid, haversine
import pandas as pd
import math

# Flask 앱 초기화 및 템플릿/정적 파일 경로 설정
app = Flask(__name__,
           template_folder='../frontend/templates',
           static_folder='../frontend/static')

# API 키 설정
API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"  # REST API 키
JAVASCRIPT_KEY = "0dff67bd8267e5a437996508dae7e7d8"  # JavaScript 키

@app.route("/")
def index():
    # JavaScript 키를 템플릿에 전달
    return render_template("Recommend.html", JAVASCRIPT_KEY=JAVASCRIPT_KEY)

@app.route("/centroid")
def get_centroid():
    try:
        # CSV 파일 읽기
        data = pd.read_csv('../Data/maps/subway_stations.csv')

        # 현재 위치 (위도, 경도)
        current_lat = 37.4842
        current_lon = 126.9293

        # '위도'와 '경도'가 숫자 형식인지 확인하고, 결측값 처리
        data['위도'] = pd.to_numeric(data['위도'], errors='coerce')
        data['경도'] = pd.to_numeric(data['경도'], errors='coerce')

        # 결측값 처리 (NaN이 있는 경우, NaN을 0으로 채움)
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/places")
def get_places():
    try:
        # centroid 값 가져오기
        centroid_data = get_centroid().json
        latitude = centroid_data['latitude']
        longitude = centroid_data['longitude']

        # 카카오 로컬 API 호출
        url = "https://dapi.kakao.com/v2/local/search/keyword.json"
        params = {
            "query": "음식점",
            "x": str(longitude),
            "y": str(latitude),
            "radius": 5000,
        }
        headers = {"Authorization": f"KakaoAK {API_KEY}"}
        response = requests.get(url, headers=headers, params=params)

        # 응답 확인 및 반환
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)