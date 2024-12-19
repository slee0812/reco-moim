from flask import Flask, render_template, jsonify, request
import requests
from FindDestination import calculate_centroid, haversine
import pandas as pd
import math
import logging
import os

# Flask 앱 초기화 및 템플릿/정적 파일 경로 설정
app = Flask(__name__,
           template_folder='../frontend/templates',
           static_folder='../frontend/static')
logging.basicConfig(level=logging.DEBUG)

# API 키 설정
KAKAO_API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"  # Kakao REST API 키
KAKAO_JAVASCRIPT_KEY = "0dff67bd8267e5a437996508dae7e7d8"  # Kakao JavaScript 키
ODSAY_API_KEY = "9Ref0yCZ6ETJkTnNNqtpuw"  # ODsay API 키

@app.route("/")
def index():
    return render_template("Recommend.html", JAVASCRIPT_KEY=KAKAO_JAVASCRIPT_KEY)

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
        data = data.fillna({'위도': 0, '경도': 0})

        # 각 전철역과 현재 위치 사이의 거리 계산
        data['거리'] = data.apply(lambda row: haversine(current_lat, current_lon, row['위도'], row['경도']), axis=1)

        # 가장 가까운 역 찾기
        nearest_station = data.loc[data['거리'].idxmin()]
        
        return jsonify({
            "latitude": nearest_station['위도'],
            "longitude": nearest_station['경도']
        })
    except Exception as e:
        logging.error(f"Error in get_centroid: {str(e)}")
        return jsonify({"error": str(e)}), 500

# 에러 핸들러
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(debug=True)