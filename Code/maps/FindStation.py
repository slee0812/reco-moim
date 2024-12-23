import numpy as np
import pandas as pd
from math import radians, sin, cos, sqrt, atan2
import requests
import os

# 각각의 현재 위치에서 가장 가까운 역 찾기
def find_nearest_stations(origins):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # 현재 파일의 절대 경로
    csv_path = os.path.join(BASE_DIR, '../../Data/maps/seoul_subway.csv')
    def calculate_distance(lat1, lon1, lat2, lon2):
        R = 6371
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        return R * c

    try:
        data = pd.read_csv(csv_path)
        data['위도'] = pd.to_numeric(data['위도'], errors='coerce')
        data['경도'] = pd.to_numeric(data['경도'], errors='coerce')
        data = data.dropna(subset=['위도', '경도'])

        nearest_stations = []
        for origin in origins:
            data['거리'] = data.apply(lambda row: calculate_distance(origin['latitude'], origin['longitude'], row['위도'], row['경도']), axis=1)
            nearest_station = data.loc[data['거리'].idxmin()]
            nearest_stations.append({
                "name": origin['name'],
                "current_latitude": origin['latitude'],
                "current_longitude": origin['longitude'],
                "nearest_station": nearest_station['역명'],
                "station_latitude": nearest_station['위도'],
                "station_longitude": nearest_station['경도'],
                "distance": nearest_station['거리']
            })
        return nearest_stations
    except Exception as e:
        return {"error": str(e)}


# 각 출발지에서 목적지까지 경로 찾기
def get_public_transit_route(origins, destination):
    url = "https://api.odsay.com/v1/api/searchPubTransPathT"
    result = []
    for origin in origins:
        params = {
            "SX": origin['current_longitude'],
            "SY": origin['current_latitude'],
            "EX": destination['longitude'],
            "EY": destination['latitude'],
            "apiKey": "6NGvqhV5Q5n77duoHpFxDfQzFsSoi77quyRJDe9yvl0"
        }
        response = requests.get(url, params=params)
        try:
            if response.status_code == 429:
                print("API 호출 제한 초과! (ODsay)")
                print("Response Headers:", response.headers)
                print("Response Body:", response.text)
                result.append({
                    "name": origin.get('name', 'Unknown'),
                    "info": {
                        "totalTime": float("inf"),
                        "totalDistance": float("inf")
                    },
                    "subPath": []
                })
                continue

            path_data = response.json()["result"]["path"][0]
            result.append({
                "name": origin.get('name', 'Unknown'),
                "info": {
                    "totalTime": path_data["info"]["totalTime"],
                    "totalDistance": path_data["info"]["totalDistance"]
                },
                "subPath": path_data["subPath"]
            })
        except (KeyError, IndexError):
            print(f"API 호출 실패 또는 데이터 누락: {response.status_code}, 응답: {response.text}")
            result.append({
                "name": origin.get('name', 'Unknown'),
                "info": {
                    "totalTime": float("inf"),
                    "totalDistance": float("inf")
                },
                "subPath": []
            })
    return result

# 중심점 위치 찾기
def calculate_centroid(locations):
    # locations: 각 위치의 {"latitude": , "longitude": } 딕셔너리 리스트
    # people_counts를 사용하지 않고, 모든 위치에 동일한 인원수(1명)를 가정

    # 각 위치에 동일한 인원 수(1명)가 있다고 가정
    total_people = len(locations)  # 각 위치에 1명씩 있다고 가정

    # 각 위도와 경도를 리스트화
    weighted_latitudes = np.array([loc["latitude"] for loc in locations])
    weighted_longitudes = np.array([loc["longitude"] for loc in locations])
    
    # 총 인원수로 나누어 가중 평균 계산
    centroid_latitude = weighted_latitudes.sum() / total_people
    centroid_longitude = weighted_longitudes.sum() / total_people
    result = {"latitude": centroid_latitude, "longitude": centroid_longitude}
    return result