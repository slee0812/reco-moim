from flask import app
import requests
import numpy as np
import pandas as pd
import math
import json

KAKAO_API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"
ODSAY_API_KEY = "6NGvqhV5Q5n77duoHpFxDfQzFsSoi77quyRJDe9yvl0"  # ODsay API 키

import numpy as np

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


def get_nearby_subway_stations(center, radius_m=5000):
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
    params = {
        "query": "지하철역",
        "x": center['longitude'],  # 경도
        "y": center['latitude'],   # 위도
        "radius": radius_m,
        "category_group_code": "SW8",  # 지하철역 카테고리 코드
    }
    response = requests.get(url, headers=headers, params=params)
    stations = response.json().get("documents", [])
    
    subway_stations = [
        {"name": station["place_name"], "location": {"latitude": float(station["y"]), "longitude": float(station["x"])}}
        for station in stations
    ]
    return subway_stations  # 리스트 반환


def calculate_travel_time(origin, destinations):
    url = "https://api.odsay.com/v1/api/searchPubTransPathT"
    result = []
    for destination in destinations:
        params = {
            "SX": origin['longitude'],
            "SY": origin['latitude'],
            "EX": destination['longitude'],
            "EY": destination['latitude'],
            "apiKey": "6NGvqhV5Q5n77duoHpFxDfQzFsSoi77quyRJDe9yvl0"
        }
        response = requests.get(url, params=params)
        try:
            # 호출 제한 초과 확인
            if response.status_code == 429:  # 429 Too Many Requests
                print("API 호출 제한 초과! (ODsay)")
                print("Response Headers:", response.headers)
                print("Response Body:", response.text)
                result.append(float("inf"))
                continue

            # 응답 파싱
            result.append(response.json()["result"]["path"][0])
        except (KeyError, IndexError):
            # 기타 오류 출력
            print(f"API 호출 실패 또는 데이터 누락: {response.status_code}, 응답: {response.text}")
            result.append(float("inf"))  # 접근 불가한 경우 무한대로 설정
    return result


def find_optimal_station(origins, subway_stations):
    station_coords = [station["location"] for station in subway_stations]
    travel_path_matrix = [calculate_travel_time(origin, station_coords) for origin in origins]

    # 각 역에 대해 총 시간을 계산
    total_times = []
    for station_idx in range(len(subway_stations)):
        total_time = 0
        for origin_idx in range(len(origins)):
            path_info = travel_path_matrix[origin_idx][station_idx]
            if isinstance(path_info, dict):  # 유효한 경로 정보일 경우
                total_time += path_info["info"]["totalTime"]
            else:
                total_time += float("inf")  # 경로 정보가 없을 경우 무한대로 설정
        total_times.append(total_time)

    # 최적의 역 선택
    optimal_index = np.argmin(total_times)
    optimal_station = subway_stations[optimal_index]

    # 모든 출발지에서 최적의 역으로 가는 경로 계산
    optimal_station_coord = optimal_station["location"]
    optimal_paths = [calculate_travel_time(origin, [optimal_station_coord])[0] for origin in origins]

    details = [
        {
            "origin": origins[origin_idx],  # 출발지 정보
            "path_to_optimal": optimal_paths[origin_idx]  # 최적 역까지의 경로 정보
        }
        for origin_idx in range(len(origins))
    ]

    return {
        "optimal_station_by_total": optimal_station,
        "details": details  # 모든 출발지에서 최적 역까지의 경로 정보를 리스트로 반환
    }





# Haversine formula: 두 지점 간의 거리 계산
def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # 지구 반지름 (km)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c  # km 단위로 반환




# 사용 예시
if __name__ == "__main__":
    # # CSV 파일 읽기
    # data = pd.read_csv('../../Data/maps/subway_stations.csv')

    # # 현재 위치 (위도, 경도)
    # current_lat = 37.4842
    # current_lon = 126.9293

    # # '위도'와 '경도'가 숫자 형식인지 확인하고, 결측값 처리
    # data['위도'] = pd.to_numeric(data['위도'], errors='coerce')
    # data['경도'] = pd.to_numeric(data['경도'], errors='coerce')

    # # 결측값 처리 (NaN이 있는 경우, 예시로 NaN을 0으로 채움)
    # data = data.fillna({'위도': 0, '경도': 0})

    # # 각 전철역과 현재 위치 사이의 거리 계산
    # data['거리'] = data.apply(lambda row: haversine(current_lat, current_lon, row['위도'], row['경도']), axis=1)

    # # 가장 가까운 역 찾기
    # nearest_station = data.loc[data['거리'].idxmin()]

    # # 결과 출력
    # print(f"가장 가까운 역: {nearest_station['역사명']}")
    # print(f"호선: {nearest_station['호선']}")
    # print(f"위도: {nearest_station['위도']}, 경도: {nearest_station['경도']}")
    # print(f"거리: {nearest_station['거리']:.2f} km")

    # Step 1: 출발지 설정
    # origins = [(37.5082, 126.8916), (37.4855, 126.9019)]  # 신도림, 구로디지털단지
    origins = [{"latitude": 37.49328307697023, "longitude": 126.92051756183096}, {"latitude": 37.51331105877401, "longitude": 127.10023101886318}]  # 안양역, 평촌역, 신림역역

    # Step 2: 중심점 계산
    centroid = calculate_centroid(origins)
    print("Centroid:", centroid)

    # Step 3: 중심점 반경 내 지하철역 검색
    subway_stations = get_nearby_subway_stations(centroid)
    print("Nearby Subway Stations:", subway_stations)

    # Step 4: 최적 지하철역 계산
    optimal_station = find_optimal_station(origins, subway_stations)
    print("Optimal Station:", optimal_station)
