import pandas as pd
import networkx as nx
import os

# 1. 데이터 전처리
def preprocess_data(df):
    df['소요시간'] = df['소요시간'].apply(lambda x: int(x.split(':')[0]) * 60 + int(x.split(':')[1]))
    df['역간거리(km)'] = df['역간거리(km)'].astype(float)
    return df

# 2. 그래프 구조 생성
def create_graph(df):
    G = nx.Graph()
    prev_station = None  # 이전 역 이름을 저장할 변수 초기화
    for _, row in df.iterrows():
        if prev_station is not None:  # 이전 역이 있는 경우에만 엣지를 추가
            G.add_edge(prev_station, row['역명'], weight=row['소요시간'])
        prev_station = row['역명']  # 현재 역을 이전 역으로 업데이트
    return G

# 3. 최단 경로 계산
def calculate_shortest_paths(G, start_stations):
    return {start: nx.single_source_dijkstra_path_length(G, start) for start in start_stations}

# 4. 최적 만남 장소 선정
def find_optimal_meeting_point(G, start_stations):
    paths = calculate_shortest_paths(G, start_stations)
    
    min_total_time = float('inf')
    optimal_station = None
    
    for station in G.nodes():
        total_time = sum(paths[start].get(station, float('inf')) for start in start_stations)
        if total_time < min_total_time:
            min_total_time = total_time
            optimal_station = station
    
    return optimal_station, min_total_time

def find_optimal_meeting_location(origins):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # 현재 파일의 절대 경로
    
    # 1. 지하철 데이터 경로 설정
    subway_data_path = os.path.join(BASE_DIR, "../Data/maps/updated_seoul_subway.csv")
    subway_coordinates_data_path = os.path.join(BASE_DIR, "../Data/maps/updated_seoul_subway.csv")

    # 2. 각 사람의 가장 가까운 역 추출
    try:
        start_stations = [origin['nearest_station'] for origin in origins]
    except KeyError as e:
        raise ValueError(f"Missing key in origins data: {e}")

    # 3. 지하철 노선도 데이터 전처리
    try:
        subway_df = pd.read_csv(subway_data_path)
        subway_df = preprocess_data(subway_df)
    except FileNotFoundError:
        raise FileNotFoundError(f"Subway data file not found at {subway_data_path}")
    
    # 4. 그래프 생성
    G = create_graph(subway_df)

    # 5. 최적의 만남 장소 찾기
    try:
        optimal_station, total_time = find_optimal_meeting_point(G, start_stations)
    except Exception as e:
        raise RuntimeError(f"Error finding optimal meeting point: {e}")

    # 6. 최적 만남 장소의 좌표 가져오기
    try:
        coordinates_df = pd.read_csv(subway_coordinates_data_path)
        matching_rows = coordinates_df[coordinates_df['역명'] == optimal_station]
        
        if matching_rows.empty:
            raise ValueError(f"Optimal station '{optimal_station}' not found in coordinates data.")
        
        optimal_station_info = matching_rows.iloc[0]
    except FileNotFoundError:
        raise FileNotFoundError(f"Coordinates data file not found at {subway_coordinates_data_path}")
    except Exception as e:
        raise RuntimeError(f"Error retrieving optimal station info: {e}")

    # 7. 결과 반환
    return {
        "optimal_station": optimal_station,
        "latitude": optimal_station_info['위도'],
        "longitude": optimal_station_info['경도'],
        "total_travel_time": total_time,
        "nearest_stations": start_stations,
    }

# 메인 실행 코드
def main(file_path, start_stations):
    df = pd.read_csv(file_path)
    df = preprocess_data(df)
    G = create_graph(df)
    optimal_station, total_time = find_optimal_meeting_point(G, start_stations)
    # 사용 예시
    file_path = "../Data/maps/updated_seoul_subway.csv"  # CSV 파일의 경로를 지정하세요
    start_stations = ["석계", "남부터미널", "왕십리"]
